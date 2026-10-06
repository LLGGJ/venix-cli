import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.env.VENIX_VERSION || pkg.version;
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`VENIX_VERSION inválida: ${version}`);
}

const isAndroid = process.platform === 'android' || Boolean(process.env.TERMUX_VERSION);
const platform = isAndroid ? 'android' : process.platform;
const osName = { win32: 'windows', darwin: 'darwin', linux: 'linux', android: 'android' }[platform];
const archName = { x64: 'amd64', arm64: 'arm64' }[process.arch];
if (!osName || !archName) {
  throw new Error(`Plataforma não suportada: ${process.platform}/${process.arch}`);
}

const release = `v${version}`;
const artifact = `venix_${version}_${osName}_${archName}`;
const ext = osName === 'windows' ? '.zip' : '.tar.gz';
const url = process.env.VENIX_RELEASE_URL || `https://github.com/LLGGJ/venix-cli/releases/download/${release}/${artifact}${ext}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'venix-'));
const archive = path.join(tmp, `venix${ext}`);
const target = path.join(root, 'bin');
const native = path.join(target, osName === 'windows' ? 'venix-native.exe' : 'venix-native');

function download(location, redirects = 0) {
  if (redirects > 5) throw new Error('Muitos redirecionamentos ao baixar o binário Go');
  return new Promise((resolve, reject) => {
    https.get(location, { headers: { 'User-Agent': 'venix-npm-installer' } }, response => {
      if ([301, 302, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        return resolve(download(response.headers.location, redirects + 1));
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`Download falhou (${response.statusCode}): ${location}`));
      }
      const out = fs.createWriteStream(archive);
      response.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

function extract() {
  fs.mkdirSync(target, { recursive: true });
  if (osName === 'windows') {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Force '${archive.replaceAll("'", "''")}' '${tmp.replaceAll("'", "''")}'`], { stdio: 'inherit' });
    const extracted = path.join(tmp, 'venix.exe');
    if (!fs.existsSync(extracted)) throw new Error('venix.exe não encontrado no ZIP');
    fs.copyFileSync(extracted, native);
  } else {
    execFileSync('tar', ['-xzf', archive, '-C', tmp]);
    const extracted = path.join(tmp, 'venix');
    if (!fs.existsSync(extracted)) throw new Error('venix não encontrado no .tar.gz');
    fs.copyFileSync(extracted, native);
    fs.chmodSync(native, 0o755);
  }
}

try {
  if (process.env.VENIX_BINARY_PATH) {
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(process.env.VENIX_BINARY_PATH, native);
    if (osName !== 'windows') fs.chmodSync(native, 0o755);
  } else {
    console.log(`Venix: baixando ${artifact}${ext}...`);
    await download(url);
    extract();
  }
  console.log(`Venix: binário Go ${version} instalado para ${osName}/${archName}.`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
