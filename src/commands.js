import fs from 'node:fs';
import path from 'node:path';
import * as api from './api.js';
import { login as doLogin, loginWithPassword } from './auth.js';
import { startHelpServer } from './help-web.js';
import { DEFAULT_CLIENT_ID, RUNTIMES, REMOTE_ZIP_PATH, VERSION } from './config.js';
import { VenixError } from './errors.js';
import { clearCreds, findLink, loadConfig, loadCreds, removeLink, saveConfig, saveLink } from './store.js';
import { zipDirectory } from './zip.js';
import { ask, banner, blue, bold, choose, confirm, cyan, dim, green, info, isInteractive, magenta, ok, red, section, spin, table, warn } from './ui.js';

const APP_NAME_RE = /^[a-zA-Z0-9_-]{3,50}$/;
const fmtSize = (bytes) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/* ====================================================================
 * Helpers
 * ==================================================================== */

/** Resolve a aplicação por id/nome, pelo vínculo (.venix.json) ou perguntando. */
async function resolveApp(ref) {
  const me = await api.getMe();
  const apps = me.applications ?? [];
  const key = ref ?? findLink()?.id;

  if (key) {
    const wanted = String(key).toLowerCase();
    const found =
      apps.find((a) => String(a.id) === String(key)) || apps.find((a) => String(a.name).toLowerCase() === wanted);
    if (!found) throw new VenixError('APP_NAO_ENCONTRADO', `Aplicação "${key}" não encontrada. Veja: venix apps`);
    return found;
  }

  if (apps.length === 0) throw new VenixError('SEM_APPS', 'Você ainda não tem aplicações. Crie uma com: venix up');
  if (!isInteractive()) {
    throw new VenixError('APP_NAO_INFORMADA', 'Informe a aplicação (nome ou id) ou rode "venix link" neste diretório.');
  }
  const id = await choose(
    'Qual aplicação?',
    apps.map((a) => ({ label: `${a.name} ${dim(`(${a.id})`)}`, value: a.id }))
  );
  return apps.find((a) => a.id === id);
}

function detectRuntime(dir) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  if (has('package.json')) return 'nodejs';
  if (has('requirements.txt') || has('pyproject.toml') || has('main.py') || has('app.py') || has('bot.py')) return 'python';
  if (has('go.mod')) return 'go';
  if (has('pom.xml') || has('build.gradle')) return 'java';
  if (has('Gemfile')) return 'ruby';
  if (has('composer.json')) return 'php';
  if (has('index.html')) return 'static';
  return 'nodejs';
}

function guessStartCommand(dir, runtime) {
  const has = (f) => fs.existsSync(path.join(dir, f));
  if (runtime === 'nodejs' || runtime === 'bun') {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.scripts?.start) return runtime === 'bun' ? 'bun run start' : 'npm start';
      if (pkg.main) return `${runtime === 'bun' ? 'bun' : 'node'} ${pkg.main}`;
    } catch {
      // sem package.json legível
    }
    return runtime === 'bun' ? 'bun index.js' : 'node index.js';
  }
  if (runtime === 'python') {
    const file = ['main.py', 'app.py', 'bot.py'].find(has);
    return file ? `python ${file}` : '';
  }
  return '';
}

function printZipInfo({ count, size, hasEnv }) {
  if (hasEnv) warn('O .env será enviado junto. Para excluir, adicione ".env" ao arquivo .venixignore.');
  return `${count} arquivos (${fmtSize(size)})`;
}

/* ====================================================================
 * Conta
 * ==================================================================== */

async function login(_args, flags) {
  const clientId = flags['client-id'] || loadConfig().clientId || DEFAULT_CLIENT_ID;
  const clientSecret = flags['client-secret'];
  const username = flags.username;
  const password = flags.password;

  // Se tiver username+password: login automático (sem navegador)
  if (username && password && clientSecret) {
    await loginWithPassword({ clientId, clientSecret, username, password });
  } else if (clientSecret) {
    // Tem secret mas sem user+pass: pedir no terminal
    const u = await ask('Usuário (email):');
    const p = await ask('Senha:', '');
    if (!u || !p) throw new VenixError('CREDENCIAIS_INCOMPLETAS', 'Usuário e senha obrigatórios.');
    await loginWithPassword({ clientId, clientSecret, username: u, password: p });
  } else {
    // Sem secret: login com PKCE (navegador)
    if (flags['client-id']) saveConfig({ clientId: flags['client-id'] });
    await doLogin({
      clientId,
      openBrowserWindow: flags.browser !== false,
      printUrl: (url) => {
        info('Abrindo o navegador para autorizar a CLI...');
        console.log(dim(`  Se não abrir, acesse:\n  ${url}`));
      },
    });
  }

  ok('Login concluído!');
  try {
    const me = await api.getMe();
    const plan = me.user?.plan;
    info(`Plano: ${plan?.name ?? plan ?? '—'} · ${(me.applications ?? []).length} aplicação(ões)`);
  } catch {
    // o login já foi salvo; o resumo é só um extra
  }
}

async function logout() {
  clearCreds();
  ok('Você saiu. Credenciais removidas deste computador.');
}

async function whoami() {
  if (!loadCreds()) throw new VenixError('NAO_LOGADO');
  const me = await api.getMe();
  const user = me.user ?? {};
  const plan = user.plan;
  const who = user.email || user.username || user.name;
  if (who) console.log(`${bold('Conta')}   ${who}`);
  console.log(`${bold('Plano')}   ${plan?.name ?? (typeof plan === 'object' ? JSON.stringify(plan) : plan) ?? '—'}`);
  console.log(`${bold('Apps')}    ${(me.applications ?? []).length}`);
  const link = findLink();
  if (link) console.log(`${bold('Projeto')} ${link.name ?? link.id} ${dim(`(${link.id})`)}`);
}

/* ====================================================================
 * Aplicações
 * ==================================================================== */

async function apps() {
  const [me, statusList] = await Promise.all([api.getMe(), api.getAppsStatus().catch(() => [])]);
  const list = me.applications ?? [];
  if (list.length === 0) {
    info('Nenhuma aplicação ainda. Crie a primeira com: venix up');
    return;
  }
  const linkedId = findLink()?.id;
  table(
    ['NOME', 'ID', 'RAM', 'CPU', 'STATUS'],
    list.map((a) => {
      const s = (statusList ?? []).find((x) => String(x.id) === String(a.id));
      const status = !s ? dim('—') : s.running ? green('● online') : red('○ offline');
      const name = String(a.id) === String(linkedId) ? `${a.name} ${cyan('←')}` : a.name;
      return [name, a.id, a.ram ?? '—', s?.cpu ?? '—', status];
    })
  );
}

async function up(args, flags) {
  const dir = process.cwd();
  const interactive = isInteractive();
  const yes = flags.yes === true;

  if (interactive) banner('NOVA APLICAÇÃO', 'Vamos configurar e publicar seu projeto');

  const existing = findLink(dir);
  if (existing && existing.dir === dir && !yes) {
    if (!interactive) throw new VenixError('JA_VINCULADO', `Este diretório já está vinculado a "${existing.name}". Use "venix push" ou --yes.`);
    if (!(await confirm(`Este diretório já está vinculado a "${existing.name}". Criar uma NOVA aplicação mesmo assim?`))) return;
  }

  // nome
  const defaultName = path.basename(dir).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 50);
  let name = flags.name ?? args[0] ?? (interactive ? await ask('Nome da aplicação:', defaultName) : defaultName);
  if (!APP_NAME_RE.test(name)) throw new VenixError('NOME_INVALIDO', 'Nome inválido: use 3-50 caracteres entre letras, números, "_" e "-".');

  // runtime
  const detected = detectRuntime(dir);
  if (interactive) info(`Projeto: ${cyan(path.basename(dir))} · Runtime detectado: ${green(detected)}`);
  let runtime = flags.runtime;
  if (!runtime) {
    runtime = interactive
      ? await choose('Runtime:', RUNTIMES.map((r) => ({ label: r + (r === detected ? dim('  (detectado)') : ''), value: r })), RUNTIMES.indexOf(detected))
      : detected;
  }
  if (!RUNTIMES.includes(runtime)) throw new VenixError('RUNTIME_INVALIDO', `Runtime inválido. Use: ${RUNTIMES.join(', ')}`);

  // RAM
  const ramInput = flags.ram ?? (interactive ? await ask('RAM em MB (128-32768):', '256') : '256');
  const ram = Number(ramInput);
  if (!Number.isInteger(ram) || ram < 128 || ram > 32768) throw new VenixError('RAM_INVALIDA', 'RAM deve ser um inteiro entre 128 e 32768 MB.');

  // site ou worker
  let isWeb = flags.web;
  if (isWeb === undefined) isWeb = flags.subdomain ? true : interactive ? await confirm('É um site (com subdomínio)? Não = bot/worker') : false;
  let subdomain = flags.subdomain;
  if (isWeb && !subdomain) {
    if (!interactive) throw new VenixError('SUBDOMINIO_OBRIGATORIO', 'Sites precisam de --subdomain.');
    subdomain = await ask('Subdomínio:', name.toLowerCase());
  }

  // comando de início (opcional)
  const guess = guessStartCommand(dir, runtime);
  const startCommand = flags.start ?? (interactive ? await ask('Comando de início (vazio = padrão):', guess) : guess);

  const result = await spin('Compactando projeto...', async (set) => {
    const z = zipDirectory(dir, { withNodeModules: flags['with-node-modules'] === true });
    set(`Projeto compactado: ${printZipInfo(z)}`);
    return z;
  });

  const created = await spin('Criando aplicação...', async (set) => {
    const app = await api.createApp({ appName: name, runtime, ram, isWeb, subdomain, startCommand, zip: result.buffer });
    set(`Aplicação "${app?.name ?? name}" criada`);
    return app;
  });

  if (created?.id) {
    saveLink(dir, { id: created.id, name: created.name ?? name });
    info('Diretório vinculado à aplicação (.venix.json). Atualize depois com: venix push');
  }
  if (created?.subdomain) info(`Subdomínio: ${bold(created.subdomain)}`);
  if (created?.status) info(`Status: ${created.status}`);
}

async function push(args, flags) {
  const app = await resolveApp(args[0]);
  // sem app explícito e com vínculo, empacota a raiz do projeto
  const link = findLink();
  const root = !args[0] && link ? link.dir : process.cwd();

  const z = await spin('Compactando projeto...', async (set) => {
    const res = zipDirectory(root, { withNodeModules: flags['with-node-modules'] === true });
    set(`Projeto compactado: ${printZipInfo(res)}`);
    return res;
  });

  await spin(`Enviando para ${app.name}...`, async (set) => {
    await api.uploadFile(app.id, z.buffer, REMOTE_ZIP_PATH);
    set('Arquivos enviados');
  });

  await spin('Extraindo no container...', async (set) => {
    await api.extractFile(app.id, REMOTE_ZIP_PATH);
    set('Arquivos atualizados (os existentes foram sobrescritos)');
  });

  if (flags.restart === false) {
    info('Reinício pulado (--no-restart). Reinicie para aplicar: venix restart');
    return;
  }
  try {
    await spin('Reiniciando...', async (set) => {
      await api.setAppAction(app.id, 'RESTART');
      set(`${app.name} reiniciada`);
    });
  } catch (err) {
    warn(`Arquivos atualizados, mas o reinício falhou (${err.code}). Rode: venix restart ${app.name}`);
  }
}

async function link(args) {
  const app = await resolveApp(args[0]);
  saveLink(process.cwd(), { id: app.id, name: app.name });
  ok(`Diretório vinculado a "${app.name}".`);
}

const makeAction = (action, doing, done) => async (args) => {
  const app = await resolveApp(args[0]);
  await spin(`${doing} ${app.name}...`, async (set) => {
    await api.setAppAction(app.id, action);
    set(`${app.name} ${done}`);
  });
};

async function logs(args, flags) {
  const app = await resolveApp(args[0]);
  const follow = flags.follow === true;
  const seconds = Number(flags.seconds) || 4;

  const controller = new AbortController();
  process.once('SIGINT', () => controller.abort());

  let received = 0;
  if (follow) info(`Acompanhando logs de ${app.name} (Ctrl+C para sair)...`);

  await api.streamLogs(app.id, {
    follow,
    seconds,
    signal: controller.signal,
    onLine: (raw) => {
      received++;
      let text = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') text = parsed;
        else {
          const field = ['log', 'message', 'line', 'text', 'output', 'data'].find((k) => typeof parsed?.[k] === 'string');
          text = field ? parsed[field] : raw;
        }
      } catch {
        // texto puro
      }
      console.log(text);
    },
  });

  if (received === 0) info('Nenhum log recebido no intervalo (use -f para acompanhar ao vivo).');
}

async function backup(args, flags) {
  const app = await resolveApp(args[0]);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const name = flags.name || `backup-${stamp}`;
  await spin(`Criando backup de ${app.name}...`, async (set) => {
    await api.createSnapshot(app.id, name);
    set(`Backup "${name}" criado`);
  });
}

async function deploy(args) {
  const app = await resolveApp(args[0]);
  await spin(`Disparando deploy do GitHub em ${app.name}...`, async (set) => {
    await api.triggerDeploy(app.id);
    set('Deploy disparado (último commit do repositório vinculado)');
  });
}

async function ram(args, flags) {
  const last = args[args.length - 1];
  const mb = Number(last);
  if (!Number.isInteger(mb)) throw new VenixError('RAM_INVALIDA', 'Uso: venix ram [app] <MB>');
  if (mb < 128 || mb > 32768) throw new VenixError('RAM_INVALIDA', 'RAM deve estar entre 128 e 32768 MB.');
  const app = await resolveApp(args.length > 1 ? args[0] : undefined);

  if (flags.yes !== true && isInteractive() && !(await confirm(`Alterar a memória de "${app.name}" para ${mb} MB?`, true))) return;
  await spin(`Alterando memória de ${app.name}...`, async (set) => {
    await api.updateAppRam(app.id, mb);
    set(`Memória de ${app.name} agora é ${mb} MB`);
  });
}

async function del(args, flags) {
  const app = await resolveApp(args[0]);
  if (flags.yes !== true) {
    if (!isInteractive()) throw new VenixError('CONFIRMACAO_NECESSARIA', 'Use --yes para excluir sem confirmação.');
    console.error(`${red('⚠')} Isso exclui ${bold(app.name)} permanentemente: container, subdomínio e volume.`);
    const typed = await ask(`Digite o nome da aplicação para confirmar:`);
    if (typed !== app.name) {
      info('Cancelado — nada foi alterado.');
      return;
    }
  }
  await spin(`Excluindo ${app.name}...`, async (set) => {
    await api.deleteApp(app.id);
    set(`${app.name} excluída`);
  });
  const link = findLink();
  if (link && String(link.id) === String(app.id)) removeLink(link.dir);
}

/* ====================================================================
 * Ajuda
 * ==================================================================== */

function help() {
  if (process.env.VENIX_HELP_TEXT !== '1') return startHelpServer();
  const item = (command, description) => {
    console.log(`  ${cyan(command)}`);
    console.log(`    ${dim(description)}`);
  };

  console.log(`\n${magenta('◆')} ${bold('venix')} ${dim(`v${VERSION}`)} — CLI da VenixCloud`);
  console.log(`${dim('  Hospede e gerencie suas aplicações pelo terminal')}`);
  console.log(`\n${cyan('Uso')}  venix <comando> [app] [opções]`);
  console.log(`${dim('      Help responsivo para telas estreitas.')}`);

  section('Conta');
  item('login [opções]', 'Autoriza a CLI com OAuth2 + PKCE');
  item('login --no-browser', 'Login manual para SSH ou Termux');
  item('logout', 'Remove as credenciais deste computador');
  item('whoami', 'Mostra conta, plano e projeto vinculado');

  section('Aplicações');
  item('apps', 'Lista aplicações e status');
  item('up [nome] [opções]', 'Cria uma aplicação a partir do diretório atual');
  item('push [app] [opções]', 'Envia arquivos, extrai e reinicia');
  item('link [app]', 'Vincula este diretório a uma aplicação');
  item('start | stop | restart [app]', 'Controla a aplicação');
  item('logs [app] [-f]', 'Mostra ou acompanha logs ao vivo');
  item('backup [app]', 'Cria um snapshot do volume');
  item('deploy [app]', 'Dispara deploy do GitHub vinculado');
  item('ram [app] <mb>', 'Altera a memória entre 128 e 32768 MB');
  item('delete [app] [-y]', 'Exclui uma aplicação após confirmação');

  section('Opções comuns');
  item('-y, --yes', 'Não pede confirmação');
  item('--with-node-modules', 'Inclui node_modules no envio');
  item('-h, --help | -v, --version', 'Mostra ajuda ou versão');

  section('Variáveis de ambiente');
  item('VENIX_CLIENT_ID', 'Client ID do app OAuth2');
  item('VENIX_CLIENT_SECRET', 'Secret exigido por algumas APIs OAuth2');
  item('VENIX_API_BASE_URL', 'Base da API da hospedagem');
  item('VENIX_CONFIG_DIR', 'Pasta das credenciais locais');

  section('Exemplos rápidos');
  item('venix login', 'Entrar na sua conta pelo navegador');
  item('venix apps', 'Ver suas aplicações');
  item('venix up minha-app', 'Publicar o projeto atual');
  item('venix logs minha-app -f', 'Acompanhar os logs ao vivo');
  item('venix push minha-app', 'Enviar uma atualização');

  console.log(`\n${green('Dica')} ${dim('Use venix help | less -R para navegar pelo help.')}`);
}

export const commands = {
  login,
  logout,
  whoami,
  apps,
  ls: apps,
  up,
  push,
  link,
  start: makeAction('START', 'Iniciando', 'iniciada'),
  stop: makeAction('STOP', 'Parando', 'parada'),
  restart: makeAction('RESTART', 'Reiniciando', 'reiniciada'),
  logs,
  backup,
  deploy,
  ram,
  delete: del,
  rm: del,
  help,
};
