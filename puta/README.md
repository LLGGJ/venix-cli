# Venix CLI

CLI nativa da VenixCloud, escrita em Go, com binários para Linux, macOS e Windows.

## Instalação

Baixe o arquivo correspondente ao seu sistema na página de [Releases](https://github.com/LLGGJ/venix-cli/releases):

- Linux: `.tar.gz`
- macOS: `.tar.gz`
- Windows: `.zip`

Depois, coloque o executável `venix` no `PATH`.

### Linux e macOS

```bash
curl -LO https://github.com/LLGGJ/venix-cli/releases/download/v0.7.4/venix_0.7.4_linux_amd64.tar.gz
tar -xzf venix_0.7.4_linux_amd64.tar.gz
chmod +x venix
sudo install venix /usr/local/bin/venix
venix --version
```

Escolha o artefato `arm64` em computadores ARM.

## Login

```bash
venix login --client-id <id-publico-do-app-oauth>
```

Em SSH ou Termux, não abra o navegador automaticamente:

```bash
venix login --no-browser --client-id <id-publico-do-app-oauth>
```

A CLI usa OAuth2 com PKCE. Usuários não precisam de `client_secret`.

Redirect padrão:

```text
http://127.0.0.1:53682/callback
```

## Comandos

| Comando | Função |
|---|---|
| `venix login` | Autoriza a CLI com OAuth2 + PKCE |
| `venix logout` | Remove as credenciais locais |
| `venix whoami` | Mostra a sessão atual |
| `venix apps` | Lista aplicações e status |
| `venix up [nome]` | Cria uma aplicação a partir do diretório atual |
| `venix push [app]` | Envia arquivos, extrai e reinicia |
| `venix link [app]` | Vincula o diretório a uma aplicação |
| `venix start [app]` | Inicia uma aplicação |
| `venix stop [app]` | Para uma aplicação |
| `venix restart [app]` | Reinicia uma aplicação |
| `venix logs [app] [-f]` | Mostra ou acompanha logs SSE |
| `venix backup [app]` | Cria um snapshot |
| `venix deploy [app]` | Dispara um deploy |
| `venix ram [app] <mb>` | Altera a memória |
| `venix delete [app]` | Exclui uma aplicação |

Também existe o agrupamento equivalente `venix app <comando>`.

## Configuração

Variáveis aceitas:

```text
VENIX_CLIENT_ID
VENIX_API_BASE_URL
VENIX_AUTH_URL
VENIX_OAUTH_TOKEN_URL
VENIX_CALLBACK_PORT
VENIX_CONFIG_DIR
VENIX_DEBUG=1
NO_COLOR
```

As credenciais ficam em `~/.config/venix/credentials.json`, com permissão restrita.
Nunca envie `.env`, tokens ou chaves para o repositório.

## Desenvolvimento

Requisitos: Go 1.22 ou superior e Make.

```bash
make fmt
make tidy
make test
make build
./dist/venix --help
```

Build multiplataforma local:

```bash
GOOS=linux GOARCH=amd64 make build
GOOS=linux GOARCH=arm64 make build
GOOS=darwin GOARCH=amd64 make build
GOOS=darwin GOARCH=arm64 make build
GOOS=windows GOARCH=amd64 make build
GOOS=windows GOARCH=arm64 make build
```

## Releases

A release é criada automaticamente quando uma tag `v*` é enviada:

```bash
git add .
git commit -m "ci: configure automatic cross-platform releases"
git push origin main
git tag v0.7.4
git push origin v0.7.4
```

O GitHub Actions executa testes, GoReleaser e publica os 12 arquivos binários, além de `checksums.txt`.
