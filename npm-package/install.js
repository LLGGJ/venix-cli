import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const REPO = 'LLGGJ/venix-cli';
// Alvos publicados pelo workflow (.github/release-targets.json). Mantenha em sincronia.
const SUPPORTED = new Set([
  'linux_amd64', 'linux_arm64',
  'windows_amd64', 'windows_arm64',
  'darwin_amd64', 'darwin_arm64',
  'android_arm64'
]);

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.env.VENIX_VERSION || pkg.version;
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Versão inválida: ${version}`);
}

// VENIX_PLATFORM e VENIX_ARCH existem apenas para testes (--dry-run em CI).
const platform = process.env.VENIX_PLATFORM || process.platform;
const arch = process.env.VENIX_ARCH || process.arch;

function detectAndroid(env, plat) {
  if (plat === 'android') return true;
  if (plat !== 'linux') return false;
  if (env.TERMUX_VERSION) return true;
  return typeof env.PREFIX === 'string' && env.PREFIX.includes('/com.termux/');
}

const osName = detectAndroid(process.env, platform)
  ? 'android'
  : { win32: 'windows', darwin: 'darwin', linux: 'linux' }[platform];
const archName = { x64: 'amd64', arm64: 'arm64' }[arch];
const target = `${osName}_${archName}`;
if (!osName || !archName || !SUPPORTED.has(target)) {
  throw new Error(`Plataforma não suportada: ${platform}/${arch}`);
}

const isWindows = osName === 'windows';
const ext = isWindows ? '.zip' : '.tar.gz';
const archiveName = `venix_${version}_${target}${ext}`;
const baseUrl = (process.env.VENIX_RELEASE_BASE_URL || `https://github.com/${REPO}/releases/download/v${version}`).replace(/\/+$/, '');

if (process.env.VENIX_DRY_RUN) {
  console.log(archiveName);
  process.exit(0);
}

const binDir = path.join(root, 'bin');
const native = path.join(binDir, isWindows ? 'venix-native.exe' : 'venix-native');

function get(location, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Muitos redirecionamentos'));
    const client = location.startsWith('http://') ? http : https;
    const req = client.get(location, { headers: { 'User-Agent': 'venix-npm-installer' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(get(new URL(res.headers.location, location).toString(), redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`Download falhou (${res.statusCode}): ${location}`));
        return;
      }
      resolve(res);
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error(`Tempo esgotado: ${location}`)));
  });
}

async function downloadFile(url, file) {
  await pipeline(await get(url), fs.createWriteStream(file));
}

async function downloadText(url) {
  const chunks = [];
  for await (const chunk of await get(url)) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function expectedChecksum(name) {
  const text = await downloadText(`${baseUrl}/SHA256SUMS`);
  for (const raw of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(\S+)$/.exec(raw.trim());
    if (m && m[2] === name) return m[1].toLowerCase();
  }
  throw new Error(`${name} não consta em SHA256SUMS`);
}

function extract(archive, tmp) {
  const exeName = isWindows ? 'venix.exe' : 'venix';
  if (isWindows) {
    const q = s => s.replaceAll("'", "''");
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Force -LiteralPath '${q(archive)}' -DestinationPath '${q(tmp)}'`], { stdio: 'inherit' });
  } else {
    execFileSync('tar', ['-xzf', archive, '-C', tmp], { stdio: 'inherit' });
  }
  const extracted = path.join(tmp, exeName);
  if (!fs.existsSync(extracted)) throw new Error(`${exeName} não encontrado em ${archiveName}`);
  return extracted;
}

function place(source) {
  fs.mkdirSync(binDir, { recursive: true });
  const staging = `${native}.new`;
  fs.copyFileSync(source, staging);
  if (!isWindows) fs.chmodSync(staging, 0o755);
  fs.renameSync(staging, native);
}

function verify(expectedVersion) {
  let out;
  try {
    out = execFileSync(native, ['--version'], { encoding: 'utf8', timeout: 15000 }).trim();
  } catch (err) {
    fs.rmSync(native, { force: true });
    throw new Error(`o binário instalado não executa (${err.message.split('\n')[0]})`);
  }
  if (expectedVersion && out !== expectedVersion) {
    fs.rmSync(native, { force: true });
    throw new Error(`o binário informa a versão "${out}", esperado "${expectedVersion}"`);
  }
}

async function main() {
  if (process.env.VENIX_BINARY_PATH) {
    place(process.env.VENIX_BINARY_PATH);
    verify(null);
    console.log(`Venix: binário local instalado para ${target}.`);
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'venix-'));
  try {
    console.log(`Venix: baixando ${archiveName}...`);
    const archive = path.join(tmp, archiveName);
    await downloadFile(`${baseUrl}/${archiveName}`, archive);
    const want = await expectedChecksum(archiveName);
    const got = crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    if (got !== want) throw new Error(`SHA-256 inválido para ${archiveName}`);
    place(extract(archive, tmp));
    verify(version);
    console.log(`Venix: ${version} instalado para ${target}.`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(`Venix: falha na instalação: ${err.message}`);
  process.exit(1);
});
