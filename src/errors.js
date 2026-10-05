export class VenixError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
    this.detail = detail;
  }
}

const MESSAGES = {
  NAO_LOGADO: 'Você não está logado. Rode: venix login',
  SESSAO_EXPIRADA: 'Sua sessão expirou. Rode: venix login',
  UNAUTHORIZED: 'A VenixCloud recusou seu token. Rode: venix login',
  SEM_CLIENT_ID:
    'Falta o client_id do app OAuth2 da CLI.\n  Use: venix login --client-id <id>   (ou defina VENIX_CLIENT_ID)',
  PORTA_EM_USO:
    'A porta do callback local está em uso. Feche o que a usa ou defina VENIX_CALLBACK_PORT\n  (e cadastre o novo redirect_uri no app OAuth2).',
  LOGIN_TIMEOUT: 'Tempo esgotado esperando a autorização no navegador.',
  LOGIN_RECUSADO: 'A autorização foi recusada.',
  STATE_INVALIDO: 'Resposta de login inválida (state não confere). Tente de novo.',
};

export function friendly(err) {
  if (!(err instanceof VenixError)) return err?.message || String(err);
  const base = MESSAGES[err.code];
  if (base) return err.code === 'LOGIN_RECUSADO' && err.detail ? `${base} (${err.detail})` : base;
  return err.detail && err.detail !== err.code ? `${err.code}: ${err.detail}` : err.code;
}
