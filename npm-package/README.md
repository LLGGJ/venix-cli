# `venix`

Este pacote npm é somente um **instalador/ponte**. A CLI executada é um binário nativo compilado em Go.

## Termux

Depois que a release `v1.0.1` existir no GitHub:

```bash
pkg update
pkg install nodejs tar
npm install -g venix
venix --version
venix login
```

O instalador detecta automaticamente o Termux como `android/arm64`, baixa o artefato Go PIE correto para o linker Android e coloca o executável dentro do pacote npm. O asset Linux ARM64 comum não é usado no Termux.

Para instalar uma versão específica:

```bash
npm install -g venix@1.0.1
```

Para testar um binário local sem download:

```bash
VENIX_BINARY_PATH=/caminho/para/venix npm install -g ./npm-package
```

O npm é usado apenas para facilitar a instalação no celular; comandos, autenticação, API, menus e operações continuam sendo executados pelo Go.
