#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const binary = path.join(root, process.platform === 'win32' ? 'venix-native.exe' : 'venix-native');

// npm recentes podem não executar o postinstall; nesse caso o binário é baixado aqui,
// na primeira execução. Os logs vão para stderr para não poluir a saída (ex.: --version).
if (!fs.existsSync(binary)) {
  const installer = path.join(root, '..', 'install.js');
  const installResult = spawnSync(process.execPath, [installer], { stdio: [0, 2, 2] });
  if (installResult.error || installResult.status !== 0 || !fs.existsSync(binary)) {
    console.error('Não foi possível instalar o binário Go da Venix.');
    process.exit(1);
  }
}

const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error(`Não foi possível executar o binário Go: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
