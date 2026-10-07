#!/usr/bin/env bash
# Empacota o npm package, valida o conteúdo e testa wrapper + instalador com um binário falso.
set -euo pipefail
VERSION="${1:?uso: check-npm.sh <versao>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# A tag é a fonte da versão: trabalha numa cópia, sem alterar o repositório.
cp -r "$ROOT/npm-package" "$TMP/pkgsrc"
(cd "$TMP/pkgsrc" && npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null && npm pack --silent --pack-destination "$TMP" >/dev/null)
TGZ="$(ls "$TMP"/venix-*.tgz)"
expected=$'package/README.md\npackage/bin/venix.js\npackage/install.js\npackage/package.json'
actual="$(tar -tzf "$TGZ" | sort)"
[ "$actual" = "$expected" ] || { echo "ERRO: conteúdo inesperado no pacote:" >&2; echo "$actual" >&2; exit 1; }

cat > "$TMP/fake-native" <<FAKE
#!/bin/sh
if [ "\$1" = "--version" ]; then echo "$VERSION"; else echo "ARGS:\$*"; fi
FAKE
chmod +x "$TMP/fake-native"

export VENIX_BINARY_PATH="$TMP/fake-native"
npm install -g --prefix "$TMP/prefix" "$TGZ"
V="$TMP/prefix/bin/venix"
echo "npm $(npm -v), node $(node -v)"
ls -la "$TMP/prefix/bin" "$TMP/prefix/lib/node_modules/venix/bin" || true
GOT="$("$V" --version 2>/dev/null || true)"
[ "$GOT" = "$VERSION" ] || { echo "ERRO: venix --version devolveu '$GOT', esperado '$VERSION'" >&2; exit 1; }
GOT="$("$V" login --x 2>/dev/null || true)"
[ "$GOT" = "ARGS:login --x" ] || { echo "ERRO: argumentos devolveram '$GOT'" >&2; exit 1; }
echo "OK pacote npm $VERSION"

# Simula npm que não executa postinstall: o wrapper precisa instalar sozinho e manter stdout limpo.
rm -rf "$TMP/prefix2"
npm install -g --ignore-scripts --prefix "$TMP/prefix2" "$TGZ"
GOT="$("$TMP/prefix2/bin/venix" --version 2>/dev/null || true)"
[ "$GOT" = "$VERSION" ] || { echo "ERRO: sem postinstall, venix --version devolveu '$GOT'" >&2; exit 1; }
echo "OK instalação lazy (sem postinstall)"
