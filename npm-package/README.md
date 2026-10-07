# `venix`

Pacote npm que apenas **instala** a Venix CLI: o executável real é um binário nativo em Go, baixado da GitHub Release de mesma versão.

```bash
npm install -g venix
venix --version
venix help
```

Plataformas: Linux (amd64, arm64), macOS (amd64, arm64), Windows (amd64, arm64) e Android/Termux (arm64).

No Termux, instale antes `pkg install nodejs tar`. O instalador detecta o Termux e baixa o asset `android_arm64`, nunca o `linux_arm64`.

O instalador confere o SHA-256 do arquivo contra o `SHA256SUMS` da release e executa `--version` no binário antes de concluir.

Variáveis úteis: `VENIX_BINARY_PATH` (usa um binário local, sem download) e `VENIX_RELEASE_BASE_URL` (outro diretório de release, com `SHA256SUMS`).

Se o seu npm não executa scripts de instalação (npm 12+ ou `--ignore-scripts`), o binário é baixado automaticamente na primeira execução de `venix`.
