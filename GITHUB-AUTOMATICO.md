# Release automático da Venix CLI

Fonte única da versão: **a tag Git**. O Go recebe a versão por `-ldflags "-X main.version=..."` (sem tag local o padrão é `dev`), e o `npm-package/package.json` não tem campo `version` no repositório: o workflow aplica a versão da tag antes de publicar.

## Publicar

Basta enviar uma tag `vX.Y.Z` (o site já faz isso ao commitar). Se já existir uma release vazia ou em rascunho para a tag, ela é substituída.

O workflow `release.yml` valida versão e nomes, roda `gofmt`/`vet`/`test`, compila `./cmd/venix` para 7 alvos (matriz definida em `.github/release-targets.json`), valida formato/arquitetura de cada binário, cria os archives, gera `SHA256SUMS`, publica a GitHub Release (só depois de tudo anexado) e então publica o npm (Trusted Publishing/OIDC ou o secret opcional `NPM_TOKEN`).

Artefatos: `venix_<versão>_<os>_<arch>.tar.gz` (`.zip` no Windows) e `SHA256SUMS`. Dentro de cada archive o executável se chama `venix` (`venix.exe`).

Android/Termux é compilado com cgo e o Android NDK (binário dinâmico Bionic), como o `go build` feito no próprio Termux. No npm, configure um Trusted Publisher para `LLGGJ/venix-cli`, workflow `release.yml`.
