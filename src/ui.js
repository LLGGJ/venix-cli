import readline from 'node:readline';

const useColor = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.VENIX_COLOR === '1');
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const bold = paint('1');
export const dim = paint('2');
export const red = paint('31');
export const green = paint('32');
export const yellow = paint('33');
export const cyan = paint('36');
export const blue = paint('34');
export const magenta = paint('35');
export const white = paint('37');

export function banner(title, subtitle = '') {
  const line = magenta('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n${line}`);
  console.log(`${magenta('◆')} ${bold(title)}`);
  if (subtitle) console.log(`${dim(subtitle)}`);
  console.log(`${line}\n`);
}

export function section(title) {
  return console.log(`\n${blue('▸')} ${bold(title)}`);
}
export const ok = (msg) => console.log(`${green('✔')} ${bold(green('OK'))} ${msg}`);
export const info = (msg) => console.log(`${cyan('●')} ${bold(cyan('INFO'))} ${msg}`);
export const warn = (msg) => console.error(`${yellow('▲')} ${bold(yellow('ATENÇÃO'))} ${msg}`);
export const error = (msg) => console.error(`${red('✖')} ${bold(red('ERRO'))} ${msg}`);

export const isInteractive = () => Boolean(process.stdin.isTTY && process.stdout.isTTY);

const stripAnsi = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');

/** Pergunta uma linha. Se stdin fechar sem resposta, devolve o padrão. */
export function ask(question, def = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    let answered = false;
    rl.on('close', () => {
      if (!answered) resolve(def);
    });
    const prompt = def
      ? `${magenta('◆')} ${bold(question)} ${dim(`[padrão: ${def}]`)} ${cyan('›')} `
      : `${magenta('◆')} ${bold(question)} ${cyan('›')} `;
    rl.question(prompt, (answer) => {
      answered = true;
      rl.close();
      resolve(answer.trim() || def);
    });
  });
}

export async function confirm(question, def = false) {
  const hint = def ? 'S/n' : 's/N';
  const answer = (await ask(`${question} ${yellow(`[${hint}]`)}`)).toLowerCase();
  if (!answer) return def;
  return ['s', 'sim', 'y', 'yes'].includes(answer);
}

/** Lista numerada; devolve o `value` escolhido. */
export async function choose(question, options, defIndex = 0) {
  console.error(`\n${magenta('◆')} ${bold(question)}`);
  options.forEach((o, i) => {
    const marker = i === defIndex ? green('●') : dim('○');
    const hint = i === defIndex ? dim('  recomendado') : '';
    console.error(`  ${marker} ${cyan(String(i + 1).padStart(2))} ${o.label}${hint}`);
  });
  for (;;) {
    const answer = await ask('Escolha uma opção', String(defIndex + 1));
    const n = Number(answer);
    if (Number.isInteger(n) && n >= 1 && n <= options.length) return options[n - 1].value;
    console.error(`${red('✖')} ${red('Opção inválida.')} ${dim('Digite um dos números acima.')}`);
  }
}

/** Executa `fn` mostrando um spinner. `fn` recebe setText() para atualizar a legenda. */
export async function spin(text, fn) {
  const frames = ['◐', '◓', '◑', '◒'];
  let current = text;
  let i = 0;
  let timer = null;
  const tty = process.stderr.isTTY;

  if (tty) {
    timer = setInterval(() => process.stderr.write(`\r\x1b[K${magenta(frames[i++ % frames.length])} ${cyan(current)}`), 120);
  } else {
    console.error(`… ${text}`);
  }
  const stop = () => {
    if (timer) clearInterval(timer);
    if (tty) process.stderr.write('\r\x1b[K');
  };

  try {
    const result = await fn((t) => (current = t));
    stop();
    ok(current);
    return result;
  } catch (err) {
    stop();
    throw err;
  }
}

export function table(headers, rows) {
  const all = [headers, ...rows];
  const widths = headers.map((_, c) => Math.max(...all.map((r) => stripAnsi(r[c] ?? '').length)));
  const line = (r, fmt = (x) => x) =>
    r.map((cell, c) => fmt(String(cell ?? '') + ' '.repeat(widths[c] - stripAnsi(cell ?? '').length))).join('  ');
  console.log(line(headers, dim));
  rows.forEach((r) => console.log(line(r)));
}
