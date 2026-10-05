#!/usr/bin/env node
import { loadEnvFile } from '../src/env.js';

// Carrega .env antes dos módulos que leem process.env.
loadEnvFile();

const { parseArgs } = await import('../src/args.js');
const { commands } = await import('../src/commands.js');
const { VERSION } = await import('../src/config.js');
const { friendly } = await import('../src/errors.js');
const { error } = await import('../src/ui.js');

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`venix precisa do Node 18 ou superior (você tem ${process.versions.node}).`);
  process.exit(1);
}

async function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  const [name, ...args] = _;

  if (flags.version) return console.log(VERSION);
  if (!name || flags.help || name === 'help') return commands.help();

  const run = Object.hasOwn(commands, name) ? commands[name] : null;
  if (!run) {
    error(`Comando desconhecido: "${name}". Rode "venix help".`);
    process.exitCode = 1;
    return;
  }
  await run(args, flags);
}

main().catch((err) => {
  error(friendly(err));
  if (process.env.VENIX_DEBUG) console.error(err);
  process.exitCode = 1;
});
