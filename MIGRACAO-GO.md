# Migração Go — estado funcional

A base Go mantém os nomes antigos: `login`, `logout`, `whoami`, `apps`, `up`, `push`, `link`, `start`, `stop`, `restart`, `logs`, `backup`, `deploy`, `ram` e `delete`.

## Testes locais

```bash
go mod tidy
gofmt -w cmd internal
go vet ./...
go test ./...
go run ./cmd/venix --help
```

## Teste no Termux

Compile dentro da home do Termux, nunca em `~/storage/downloads`:

```bash
go build -o ~/bin/venix ./cmd/venix
venix --version
venix login
```

A migração só é considerada pronta para publicar após testar contra a API VenixCloud real: login, `/me`, `/apps/status`, criação/upload/extract, ações, snapshots, deploy, RAM, delete e SSE de logs. O ZIP final não deve ser gerado antes dessa validação.
