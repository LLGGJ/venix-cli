# Venix CLI

CLI nativa da VenixCloud, escrita em Go, com binários para Linux, macOS e Windows.

## Instalação

### Termux pelo npm

O pacote npm é somente um instalador: ele baixa o binário nativo Go para o celular.
No Termux, ele baixa o asset `android_arm64` em PIE; não use diretamente o asset `linux_arm64`, pois o linker Android pode recusá-lo.

```bash
pkg update
pkg install nodejs tar
npm install -g venix
venix --version
venix login
```

Para instalar diretamente o pacote anexado à GitHub Release, sem usar uma
versão diferente do registro público npm:

```bash
npm install -g https://github.com/LLGGJ/venix-cli/releases/download/v0.7.4/venix-0.7.4.tgz
venix --version
```

Troque `0.7.4` pela tag da release mais recente. O pacote vem da mesma
release que contém os binários Go.

Para uma versão específica:

```bash
npm install -g venix@1.0.1
```

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
| `venix apps` | Lista aplicações e abre o menu interativo |
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

### Menu interativo de aplicações

Em um terminal, `venix apps` mostra nome, status e memória. Use as setas e Enter
para escolher uma aplicação. Depois, outro menu permite:

- ver detalhes;
- ver logs;
- reiniciar, iniciar ou parar;
- criar backup;
- fazer deploy do commit configurado;
- excluir a aplicação;
- voltar à lista.

Para scripts e automações, desative o menu com:

```bash
venix apps --json
```

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
