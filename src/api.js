/**
 * Cliente da API da VenixCloud. Endpoints iguais aos do bot (services/api.js).
 * Toda chamada passa por request(): token válido, renovação automática e
 * uma nova tentativa quando a API devolve 401.
 */

import { API_BASE } from './config.js';
import { getAccessToken } from './auth.js';
import { VenixError } from './errors.js';

const isAuthFailure = (status, code) => status === 401 || code === 'UNAUTHORIZED';

async function request(method, path, { json, form } = {}) {
  let token = await getAccessToken();

  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    let body;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = form; // fetch define o multipart/boundary sozinho
    }

    let res;
    try {
      res = await fetch(`${API_BASE}${path}`, { method, headers, body });
    } catch (err) {
      throw new VenixError('REDE', err.cause?.message || err.message);
    }

    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // não-JSON
    }

    if (isAuthFailure(res.status, parsed?.code) && attempt === 0) {
      token = await getAccessToken({ force: true });
      continue;
    }

    if (!res.ok || parsed?.status !== 'success') {
      throw new VenixError(parsed?.code || `HTTP_${res.status}`, parsed?.message);
    }
    return parsed.response;
  }
  throw new VenixError('UNAUTHORIZED');
}

/** GET /me -> { user: { plan }, applications: [{ id, name, ram, ... }] } */
export const getMe = () => request('GET', '/me');

/** GET /apps/status -> [{ id, cpu, ram, running }] */
export const getAppsStatus = () => request('GET', '/apps/status');

/** POST /apps/create (multipart). `zip` é um Buffer. */
export function createApp({ appName, runtime, ram, isWeb, subdomain, startCommand, zip }) {
  const form = new FormData();
  form.append('appName', appName);
  form.append('runtime', runtime);
  form.append('ram', String(ram));
  form.append('isWeb', isWeb ? 'true' : 'false'); // a API exige a STRING
  if (isWeb && subdomain) form.append('subdomain', subdomain);
  if (startCommand) form.append('startCommand', startCommand);
  form.append('file', new Blob([zip], { type: 'application/zip' }), 'index.zip');
  return request('POST', '/apps/create', { form });
}

/** POST /apps/:id/action  { action: START | STOP | RESTART } */
export const setAppAction = (id, action) => request('POST', `/apps/${id}/action`, { json: { action } });

/** DELETE /apps/:id */
export const deleteApp = (id) => request('DELETE', `/apps/${id}`);

/** PATCH /apps/:id  { max_ram } */
export const updateAppRam = (id, ram) => request('PATCH', `/apps/${id}`, { json: { max_ram: Number(ram) } });

/** POST /snapshots  { resourceId, name } */
export const createSnapshot = (id, name) => request('POST', '/snapshots', { json: { resourceId: id, name } });

/** POST /apps/:id/deploy/trigger — deploy do repositório GitHub vinculado */
export const triggerDeploy = (id) => request('POST', `/apps/${id}/deploy/trigger`);

/** POST /apps/:id/files/upload (multipart) */
export function uploadFile(id, zip, remotePath) {
  const form = new FormData();
  form.append('path', remotePath);
  form.append('file', new Blob([zip], { type: 'application/zip' }), remotePath.split('/').pop());
  return request('POST', `/apps/${id}/files/upload`, { form });
}

/** POST /apps/:id/files/extract  { filePath } */
export const extractFile = (id, filePath) => request('POST', `/apps/${id}/files/extract`, { json: { filePath } });

/**
 * SSE GET /instances/stream/:id — chama onLine() para cada linha `data:`.
 * Sem `follow`, encerra sozinho depois de `seconds`. `signal` permite Ctrl+C.
 * ⚠️ O formato exato dos eventos não está na doc; o parser extrai só `data:`.
 */
export async function streamLogs(id, { follow = false, seconds = 4, onLine, signal }) {
  const controller = new AbortController();
  signal?.addEventListener('abort', () => controller.abort());
  const timer = follow ? null : setTimeout(() => controller.abort(), seconds * 1000);

  const open = async (token) =>
    fetch(`${API_BASE}/instances/stream/${id}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
      signal: controller.signal,
    });

  try {
    let res = await open(await getAccessToken());
    if (res.status === 401) res = await open(await getAccessToken({ force: true }));
    if (!res.ok) throw new VenixError(`HTTP_${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        if (line.startsWith('data:')) onLine(line.slice(5).trim());
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      if (err instanceof VenixError) throw err;
      throw new VenixError('REDE', err.cause?.message || err.message);
    }
    // AbortError = encerramos de propósito (timeout ou Ctrl+C)
  } finally {
    clearTimeout(timer);
  }
}
