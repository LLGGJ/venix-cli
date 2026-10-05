import os from 'node:os';
import path from 'node:path';

export const VERSION = '0.6.3';

const env = process.env;

/** Base da API (mesma usada pelo bot). */
export const API_BASE = (env.VENIX_API_BASE_URL || 'https://api.venixcloud.com/v1').replace(/\/+$/, '');

/** Tela de autorização OAuth2 da VenixCloud (a mesma que o site do bot usa). */
export const AUTH_URL = env.VENIX_AUTH_URL || 'https://venixcloud.com/en/auth/bridge';

/** Endpoint de troca de code / refresh / Resource Owner Password. */
export const TOKEN_URL = env.VENIX_OAUTH_TOKEN_URL || 'https://api.venixcloud.com/v1/oauth2/token';

/**
 * Porta fixa do callback local. Provedores OAuth costumam exigir o redirect_uri
 * exato cadastrado, então cadastre: http://127.0.0.1:53682/callback
 */
export const CALLBACK_PORT = Number(env.VENIX_CALLBACK_PORT) || 53682;

/** Client ID público da CLI; pode ser sobrescrito por VENIX_CLIENT_ID. */
export const DEFAULT_CLIENT_ID = env.VENIX_CLIENT_ID || 'venix_cac3c2ea21c362d0a7';

/** Algumas instalações exigem secret também na troca do authorization code. */
export const CLIENT_SECRET = env.VENIX_CLIENT_SECRET || '';

export const CONFIG_DIR =
  env.VENIX_CONFIG_DIR ||
  (process.platform === 'win32'
    ? path.join(env.APPDATA || os.homedir(), 'venix')
    : path.join(env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'venix'));

export const RUNTIMES = ['nodejs', 'bun', 'python', 'go', 'java', 'ruby', 'php', 'static'];

export const REMOTE_ZIP_PATH = '/__venix_update.zip';
