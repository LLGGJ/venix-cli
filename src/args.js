/** Flags sem valor (aceitam --no-<flag> para desligar). */
const BOOLEAN = new Set(['web', 'follow', 'yes', 'restart', 'browser', 'with-node-modules', 'help', 'version']);

const SHORT = { f: 'follow', y: 'yes', h: 'help', v: 'version', n: 'name', r: 'runtime', m: 'ram' };

/**
 * "up meu-app --ram 256 --no-web -y"
 *   -> { _: ['up', 'meu-app'], flags: { ram: '256', web: false, yes: true } }
 */
export function parseArgs(argv) {
  const _ = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--') {
      _.push(...argv.slice(i + 1));
      break;
    }

    const isLong = arg.startsWith('--');
    const isShort = !isLong && /^-[a-zA-Z]$/.test(arg);
    if (!isLong && !isShort) {
      _.push(arg);
      continue;
    }

    let key;
    let value;
    if (isLong) {
      const eq = arg.indexOf('=');
      key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      value = eq === -1 ? undefined : arg.slice(eq + 1);
    } else {
      key = SHORT[arg[1]] || arg[1];
    }

    let negated = false;
    if (key.startsWith('no-')) {
      negated = true;
      key = key.slice(3);
    }

    if (BOOLEAN.has(key)) {
      flags[key] = value === undefined ? !negated : value !== 'false';
    } else {
      if (value === undefined) {
        value = argv[++i];
        if (value === undefined) throw new Error(`Falta o valor de --${key}`);
      }
      flags[key] = value;
    }
  }

  return { _, flags };
}
