import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_DIR } from './config.js';

const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const CREDS_FILE = path.join(CONFIG_DIR, 'credentials.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export const loadConfig = () => readJson(CONFIG_FILE) || {};
export const saveConfig = (patch) => writeJson(CONFIG_FILE, { ...loadConfig(), ...patch });

export const loadCreds = () => readJson(CREDS_FILE);
export const saveCreds = (creds) => writeJson(CREDS_FILE, creds);
export const clearCreds = () => fs.rmSync(CREDS_FILE, { force: true });

/** Procura .venix.json no diretório atual e nos pais. */
export function findLink(start = process.cwd()) {
  let dir = start;
  for (;;) {
    const data = readJson(path.join(dir, '.venix.json'));
    if (data?.id) return { ...data, dir };
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function saveLink(dir, data) {
  fs.writeFileSync(path.join(dir, '.venix.json'), JSON.stringify(data, null, 2) + '\n');
}

export function removeLink(dir) {
  fs.rmSync(path.join(dir, '.venix.json'), { force: true });
}
