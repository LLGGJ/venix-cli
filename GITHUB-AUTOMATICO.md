# Release automático da Venix CLI

A Venix CLI é distribuída como binário nativo Go, sem runtime externo.

## O que o workflow faz

O arquivo `.github/workflows/release.yml` é executado quando uma tag com o padrão `v*` é enviada. Ele:

1. baixa o código completo;
2. configura Go 1.22;
3. executa `gofmt`, `go vet` e `go test`;
4. executa o GoReleaser;
5. cria uma GitHub Release;
6. publica artefatos para Linux, macOS e Windows, em AMD64 e ARM64;
7. publica `checksums.txt`.

## Configuração no GitHub

Em `Settings → Actions → General`, deixe permitido que os workflows criem e escrevam releases. O workflow usa o `GITHUB_TOKEN` automático e a permissão:

```yaml
permissions:
  contents: write
```

Não crie token manual nem chave privada para esse workflow.

## Publicar uma versão

Na raiz do repositório:

```bash
git add .
git commit -m "ci: configure automatic cross-platform releases"
git push origin main

git tag v0.7.4
git push origin v0.7.4
```

Acompanhe em `Actions → Release`. Quando terminar, a release estará em:

```text
https://github.com/LLGGJ/venix-cli/releases
```

## Artefatos esperados

Para cada versão, o GoReleaser gera arquivos para os seis alvos:

```text
venix_VERSION_linux_amd64.tar.gz
venix_VERSION_linux_arm64.tar.gz
venix_VERSION_darwin_amd64.tar.gz
venix_VERSION_darwin_arm64.tar.gz
venix_VERSION_windows_amd64.zip
venix_VERSION_windows_arm64.zip
checksums.txt
```

Também são gerados arquivos `.zip` para todos os alvos, conforme a configuração do GoReleaser.

## Validação local

Com GoReleaser instalado:

```bash
make fmt
make tidy
make test
go vet ./...
make snapshot
```

O snapshot não publica nada. Ele apenas confirma que os binários e os checksums podem ser gerados.
