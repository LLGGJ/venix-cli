# venix-cli

CLI da VenixCloud: crie, atualize e gerencie suas aplicações pelo terminal.
Zero dependências, só Node 18+.

```bash
npm install -g venix    # instalação pública pelo npm
venix login --client-id <id-do-app-oauth-da-cli>
venix help               # abre a central de ajuda local no navegador
cd meu-projeto
venix up                # cria a aplicação com o conteúdo do diretório
venix push              # atualiza (envia, extrai por cima e reinicia)
venix logs -f           # acompanha os logs
```

## Comandos

| Comando | O que faz |
|---|---|
| `login [--client-id id] [--no-browser]` | Autoriza a CLI pelo navegador (OAuth2 + PKCE) |
| `logout` / `whoami` | Sai / mostra conta, plano e projeto vinculado |
| `apps` | Lista aplicações e status |
| `up [nome] [--runtime r] [--ram mb] [--web --subdomain s \| --no-web] [--start "cmd"]` | Cria a aplicação a partir do diretório atual (pergunta o que faltar) |
| `push [app] [--no-restart]` | Zipa o projeto → upload → extract → restart |
| `link [app]` | Vincula o diretório a uma aplicação (`.venix.json`) |
| `start` / `stop` / `restart [app]` | Controle do container |
| `logs [app] [-f] [--seconds n]` | Logs (SSE); `-f` acompanha ao vivo |
| `backup [app] [--name n]` | Snapshot do volume |
| `deploy [app]` | Deploy do último commit do GitHub vinculado |
| `ram [app] <mb>` | Altera a memória |
| `delete [app] [-y]` | Exclui (pede para digitar o nome) |

`[app]` é nome ou id; dentro de um projeto vinculado pode ser omitido.
Em scripts/CI (sem terminal interativo) tudo precisa vir por flags.

## Central de ajuda local

`venix` ou `venix help` inicia uma central visual em `http://127.0.0.1:53683` e tenta
abrir o navegador automaticamente. A página funciona offline e tem abas de visão geral,
comandos, fluxo de uso e configuração.

Para escolher outra porta:

```bash
VENIX_HELP_PORT=53900 venix help
```

Para usar a ajuda textual no terminal:

```bash
VENIX_HELP_TEXT=1 venix help
```

## Login: o que precisa existir na VenixCloud

A CLI é um **cliente público** — não carrega `client_secret`. Cadastre um app
OAuth2 separado do site/bot com:

- redirect URI exato: `http://127.0.0.1:53682/callback`
  (outra porta: `VENIX_CALLBACK_PORT`, e cadastre o novo redirect)
- PKCE (S256) habilitado e sem exigir secret no `authorization_code`/`refresh_token`

O `client_id` vai em `venix login --client-id ...` (fica salvo) ou `VENIX_CLIENT_ID`.
Em servidor remoto/SSH use `venix login --no-browser` e cole a URL final no terminal.

Tokens ficam em `~/.config/venix/credentials.json` (permissão 600, sem criptografia) e
são renovados sozinhos pelo `refresh_token`.

### ⚠️ Premissas não confirmadas (todas em `src/auth.js`)

- Parâmetros do authorize: `client_id`, `redirect_uri`, `response_type=code`,
  `code_challenge`, `code_challenge_method=S256`, `state`, em
  `https://venixcloud.com/en/auth/bridge`
- Troca do code e refresh via `POST /v1/oauth2/token` em JSON (mesmo formato do bot),
  com `code_verifier` e **sem** `client_secret`
- Formato dos eventos de log (SSE) — a CLI imprime o conteúdo de `data:`

Se algo diferir, o ajuste fica concentrado em `src/auth.js` e `src/api.js`.

## O que vai no envio

- Sempre ignorados: `.git`, `node_modules`, `.venix.json`, `venv`, `.venv`, `__pycache__`, `*.pyc`
  (`--with-node-modules` inclui o `node_modules`)
- Crie um `.venixignore` (um padrão por linha, estilo `.gitignore`, sem `!`)
- **O `.env` é enviado** (a API não tem rota de variáveis de ambiente); a CLI avisa. Para excluir: `.env` no `.venixignore`
- `push` **sobrescreve** arquivos de mesmo caminho e **não apaga** os que você removeu localmente

## Variáveis de ambiente

`VENIX_CLIENT_ID`, `VENIX_API_BASE_URL`, `VENIX_AUTH_URL`, `VENIX_OAUTH_TOKEN_URL`,
`VENIX_CALLBACK_PORT`, `VENIX_CONFIG_DIR`, `VENIX_DEBUG=1` (stack trace nos erros), `NO_COLOR`.

## Migração para Go

O diretório `cmd/venix` contém a nova base multiplataforma em Go/Cobra. A versão JavaScript continua preservada durante a migração incremental. Consulte [MIGRACAO-GO.md](MIGRACAO-GO.md) para build, testes, releases, instalação npm e a ordem segura de migração dos endpoints.

Para validar a base Go localmente:

```bash
go mod tidy
gofmt -w cmd internal
go vet ./...
go test ./...
go run ./cmd/venix --help
```
