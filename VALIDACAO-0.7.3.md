# Validação da Venix Go 0.7.3

## Resultado

A base foi compilada com `go test ./...`, `go vet ./...` e executada pelo binário compilado contra o mock local. Passaram os comandos: `whoami`, `apps`, `start`, `stop`, `restart`, `backup`, `deploy`, `ram`, `logs`, `logs -f`, `up`, `push`, `link` e `delete`.

O `login` OAuth2 + PKCE também foi implementado e validado estruturalmente com callback local, state, PKCE, troca de token e armazenamento seguro. A confirmação final do login depende da API VenixCloud real.

## Repetir teste no Linux/Termux

```bash
go mod tidy
gofmt -w cmd internal
go test ./...
go vet ./...
go build -o /tmp/venix ./cmd/venix
python3 scripts/mock-api.py & MOCK=$!
export VENIX_API_BASE_URL=http://127.0.0.1:53989/v1
export VENIX_CONFIG_DIR=$(mktemp -d)
mkdir -p "$VENIX_CONFIG_DIR"
printf '%s' '{"client_id":"test","access_token":"test-token"}' > "$VENIX_CONFIG_DIR/credentials.json"
/tmp/venix whoami
/tmp/venix apps
/tmp/venix start demo
/tmp/venix stop demo
/tmp/venix restart demo
/tmp/venix backup demo
/tmp/venix deploy demo
/tmp/venix ram demo 512
/tmp/venix logs demo
/tmp/venix logs demo -f
kill "$MOCK"
```

## Teste real

```bash
unset VENIX_API_BASE_URL
venix login
venix whoami
venix apps
venix up minha-app
venix push minha-app
venix logs minha-app -f
venix backup minha-app
venix deploy minha-app
venix ram minha-app 512
venix start minha-app
venix stop minha-app
venix restart minha-app
venix delete minha-app
```

A API real precisa estar online e os endpoints devem corresponder ao contrato já usado pela CLI JavaScript. A versão JavaScript continua disponível como fallback até o teste real de cada conta ser concluído.

## Publicação

```bash
git add .
git commit -m "feat: migrate Venix CLI commands to Go"
git push origin main
git tag v0.7.3
git push origin v0.7.3
```

Depois da release GitHub, publique o conteúdo de `npm-package/`:

```bash
cd npm-package
npm pack --dry-run
npm publish --access public
```

O instalador npm só deve ser publicado depois que os seis artefatos da release existirem no GitHub.
