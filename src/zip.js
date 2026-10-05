/**
 * Empacota um diretório em .zip usando só módulos nativos do Node
 * (zlib + CRC32 próprio). Respeita .venixignore e ignora symlinks.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { VenixError } from './errors.js';

/* ---------- ignore ---------- */

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (ch === '?') {
      re += '[^/]';
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

function compileRule(raw) {
  const dirOnly = raw.endsWith('/');
  let pattern = raw.replace(/\/+$/, '');
  const anchored = pattern.startsWith('/');
  pattern = pattern.replace(/^\//, '');
  const matchFullPath = anchored || pattern.includes('/');
  const re = globToRegex(pattern);
  return (rel, isDir) => {
    if (dirOnly && !isDir) return false;
    return re.test(matchFullPath ? rel : path.posix.basename(rel));
  };
}

export function makeIgnore(root, { withNodeModules = false } = {}) {
  const rules = ['.git/', '.venix.json', '.DS_Store', '__pycache__/', '.venv/', 'venv/', '*.pyc'];
  if (!withNodeModules) rules.push('node_modules/');

  try {
    const extra = fs.readFileSync(path.join(root, '.venixignore'), 'utf8').split(/\r?\n/);
    for (const line of extra) {
      const t = line.trim();
      if (t && !t.startsWith('#')) rules.push(t);
    }
  } catch {
    // sem .venixignore
  }

  const compiled = rules.map(compileRule);
  return (rel, isDir) => compiled.some((rule) => rule(rel, isDir));
}

/* ---------- coleta de arquivos ---------- */

export function collectFiles(root, isIgnored) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!isIgnored(rel, true)) walk(abs);
      } else if (entry.isFile() && !isIgnored(rel, false)) {
        const st = fs.statSync(abs);
        files.push({ abs, rel, mode: st.mode, mtime: st.mtime, size: st.size });
      }
    }
  };
  walk(root);
  return files.sort((a, b) => (a.rel < b.rel ? -1 : 1));
}

/* ---------- escrita do zip ---------- */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const d = date.getFullYear() < 1980 ? new Date(1980, 0, 1) : date;
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function buildZip(files) {
  if (files.length > 0xffff) throw new VenixError('ZIP_MUITOS_ARQUIVOS', `${files.length} arquivos (máx. 65535)`);

  const chunks = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    const crc = crc32(data);
    let method = 0;
    let payload = data;
    if (data.length > 0) {
      const deflated = zlib.deflateRawSync(data, { level: 6 });
      if (deflated.length < data.length) {
        method = 8;
        payload = deflated;
      }
    }

    const name = Buffer.from(f.rel, 'utf8');
    const { time, date } = dosDateTime(f.mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE((3 << 8) | 20, 4); // criado em UNIX (preserva permissões)
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(payload.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(((f.mode & 0xffff) << 16) >>> 0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    chunks.push(local, name, payload);
    offset += local.length + name.length + payload.length;
  }

  const cdSize = central.reduce((sum, b) => sum + b.length, 0);
  if (offset + cdSize > 0xffffffff) throw new VenixError('ZIP_GRANDE_DEMAIS', 'O projeto passa de 4 GB.');

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, ...central, end]);
}

/** Atalho: coleta + zipa um diretório. */
export function zipDirectory(root, options = {}) {
  const files = collectFiles(root, makeIgnore(root, options));
  if (files.length === 0) throw new VenixError('PROJETO_VAZIO', 'Nenhum arquivo para enviar neste diretório.');
  const buffer = buildZip(files);
  return {
    buffer,
    count: files.length,
    size: buffer.length,
    hasEnv: files.some((f) => /^\.env(\..+)?$/.test(f.rel)),
  };
}
