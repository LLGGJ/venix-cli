/**
 * OAuth2 Authorization Code + PKCE (cliente público, sem client_secret).
 *
 * Fluxo: abre o navegador na tela de autorização da VenixCloud, recebe o
 * `code` num servidor local (127.0.0.1) e troca por access/refresh token.
 *
 * ⚠️ Premissas a validar com a VenixCloud (ficam todas neste arquivo):
 *   - parâmetros do authorize: client_id, redirect_uri, response_type=code,
 *     code_challenge, code_challenge_method=S256, state
 *   - o app OAuth2 aceita cliente público + redirect http://127.0.0.1:<porta>/callback
 *   - troca de code e refresh em POST JSON no TOKEN_URL (mesmo formato do bot)
 */

import http from 'node:http';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { AUTH_URL, TOKEN_URL, CALLBACK_PORT, CLIENT_SECRET } from './config.js';
import { loadCreds, saveCreds } from './store.js';
import { VenixError } from './errors.js';

const EXPIRY_MARGIN_MS = 2 * 60_000;
const LOGIN_TIMEOUT_MS = 5 * 60_000;

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {
    // sem navegador — o usuário abre o link impresso no terminal
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const page = (title, msg) =>
  `<!doctype html><meta charset="utf-8"><title>VenixCloud CLI</title>` +
  `<body style="font-family:system-ui;background:#0f1117;color:#e8e8ee;display:grid;place-items:center;height:100vh;margin:0">` +
  `<div style="text-align:center"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(msg)}</p></div></body>`;

/**
 * Sobe o servidor de callback e espera o `code`.
 * Com `manual`, também aceita a URL final (ou o code) colada no terminal —
 * útil em servidores remotos/SSH onde o navegador não alcança o localhost.
 */
function waitForCode({ state, onListening, manual }) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let rl = null;
    let timer = null;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${CALLBACK_PORT}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const err = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      const gotState = url.searchParams.get('state');

      const reply = (status, title, msg) => {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page(title, msg));
      };

      if (err) {
        reply(400, 'Login recusado', url.searchParams.get('error_description') || err);
        finish(new VenixError('LOGIN_RECUSADO', url.searchParams.get('error_description') || err));
      } else if (!code || gotState !== state) {
        reply(400, 'Resposta inválida', 'Volte ao terminal e tente novamente.');
        if (code) finish(new VenixError('STATE_INVALIDO'));
      } else {
        reply(200, 'Tudo certo ✔', 'Login concluído. Pode fechar esta aba e voltar ao terminal.');
        finish(null, code);
      }
    });

    function finish(error, code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      rl?.close();
      server.close();
      server.closeAllConnections?.();
      error ? reject(error) : resolve(code);
    }

    server.on('error', (e) =>
      finish(e.code === 'EADDRINUSE' ? new VenixError('PORTA_EM_USO') : new VenixError('REDE', e.message))
    );

    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      onListening?.();
      if (manual) {
        rl = readline.createInterface({ input: process.stdin, output: process.stderr });
        rl.question('Ou cole aqui a URL final do navegador (ou só o code): ', (answer) => {
          const text = answer.trim();
          if (!text) return;
          try {
            const u = new URL(text);
            if (u.searchParams.get('state') !== state) return finish(new VenixError('STATE_INVALIDO'));
            finish(null, u.searchParams.get('code'));
          } catch {
            finish(null, text);
          }
        });
      }
    });

    timer = setTimeout(() => finish(new VenixError('LOGIN_TIMEOUT')), LOGIN_TIMEOUT_MS);
  });
}

async function tokenRequest(body) {
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return { ok: false, permanent: false, error: err.name === 'TimeoutError' ? 'TIMEOUT' : err.message };
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // corpo não-JSON
  }

  if (!res.ok) {
    const transient = res.status >= 500 || res.status === 429;
    return {
      ok: false,
      permanent: !transient,
      error: json?.error_description || json?.error || json?.code || `HTTP_${res.status}`,
    };
  }
  if (!json?.access_token) return { ok: false, permanent: false, error: 'RESPOSTA_SEM_ACCESS_TOKEN' };
  return { ok: true, data: json };
}

function persist(clientId, data, previous) {
  const creds = {
    client_id: clientId,
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? previous?.refresh_token ?? null,
    expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    saved_at: new Date().toISOString(),
  };
  saveCreds(creds);
  return creds;
}

/**
 * Login com username + password (Resource Owner Password Grant).
 * Ideal pra app mobile, CI/CD, scripts — sem navegador.
 */
export async function loginWithPassword({ clientId, clientSecret, username, password }) {
  if (!clientId || !clientSecret || !username || !password) {
    throw new VenixError('CREDENCIAIS_INCOMPLETAS', 'Faltam: client_id, client_secret, username, password');
  }

  const result = await tokenRequest({
    grant_type: 'password',
    client_id: clientId,
    client_secret: clientSecret,
    username,
    password,
    scope: '*', // ou os scopes específicos se houver
  });
  if (!result.ok) throw new VenixError('LOGIN_FALHOU', result.error);

  return persist(clientId, result.data);
}

/** Faz o login completo com PKCE. `printUrl(url)` mostra o link no terminal. */
export async function login({ clientId, openBrowserWindow = true, printUrl }) {
  if (!clientId) throw new VenixError('SEM_CLIENT_ID');

  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = `http://127.0.0.1:${CALLBACK_PORT}/callback`;

  const url = new URL(AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);

  const code = await waitForCode({
    state,
    manual: !openBrowserWindow,
    onListening: () => {
      printUrl?.(url.toString());
      if (openBrowserWindow) openBrowser(url.toString());
    },
  });

  const result = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: clientId,
    ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  if (!result.ok) throw new VenixError('LOGIN_FALHOU', result.error);

  return persist(clientId, result.data);
}

/**
 * Devolve um access_token válido, renovando via refresh_token quando
 * estiver perto de expirar (ou com `force`).
 */
export async function getAccessToken({ force = false } = {}) {
  const creds = loadCreds();
  if (!creds?.access_token) throw new VenixError('NAO_LOGADO');

  const fresh = creds.expires_at && Date.now() < creds.expires_at - EXPIRY_MARGIN_MS;
  if (fresh && !force) return creds.access_token;

  if (!creds.refresh_token) {
    if (fresh) return creds.access_token; // sem como renovar: tenta com o que tem
    throw new VenixError('SESSAO_EXPIRADA');
  }

  let last;
  for (const delay of [0, 500, 1500]) {
    if (delay) await new Promise((r) => setTimeout(r, delay));
    last = await tokenRequest({
      grant_type: 'refresh_token',
      client_id: creds.client_id,
      ...(CLIENT_SECRET ? { client_secret: CLIENT_SECRET } : {}),
      refresh_token: creds.refresh_token,
    });
    if (last.ok) return persist(creds.client_id, last.data, creds).access_token;
    if (last.permanent) break;
  }

  throw new VenixError(last.permanent ? 'SESSAO_EXPIRADA' : 'REDE', last.error);
}
