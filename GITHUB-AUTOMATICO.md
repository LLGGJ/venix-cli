# Release automático da Venix CLI

Fonte única da versão: **a tag Git**. O Go recebe a versão por `-ldflags "-X main.version=..."` (sem tag local o padrão é `dev`), e o workflow falha se `npm-package/package.json` não tiver a mesma versão.

## Publicar

```bash
cd npm-package && npm version 1.0.5 --no-git-tag-version && cd ..
make fmt
git add -A && git commit -m "release: 1.0.5"
git push origin main
git tag v1.0.5 && git push origin v1.0.5
```

O workflow `release.yml` valida versão e nomes, roda `gofmt`/`vet`/`test`, compila `./cmd/venix` para 7 alvos (matriz definida em `.github/release-targets.json`), valida formato/arquitetura de cada binário, cria os archives, gera `SHA256SUMS`, publica a GitHub Release (só depois de tudo anexado) e então publica o npm (Trusted Publishing/OIDC ou o secret opcional `NPM_TOKEN`).

Artefatos: `venix_<versão>_<os>_<arch>.tar.gz` (`.zip` no Windows) e `SHA256SUMS`. Dentro de cada archive o executável se chama `venix` (`venix.exe`).

Android/Termux é compilado com cgo e o Android NDK (binário dinâmico Bionic), como o `go build` feito no próprio Termux. No npm, configure um Trusted Publisher para `LLGGJ/venix-cli`, workflow `release.yml`.
