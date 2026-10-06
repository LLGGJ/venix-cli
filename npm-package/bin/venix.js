#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const binary = path.join(root, process.platform === 'win32' ? 'venix-native.exe' : 'venix-native');
if (!fs.existsSync(binary)) {
  console.error('Venix ainda não foi instalada. Execute npm install -g venix novamente.');
  process.exit(1);
}
const result = spawnSync(binary, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error(`Não foi possível executar o binário Go: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
