#!/usr/bin/env bash
# Empacota o npm package, valida o conteúdo e testa wrapper + instalador com um binário falso.
set -euo pipefail
VERSION="${1:?uso: check-npm.sh <versao>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PKG_VERSION="$(node -p "require(process.argv[1]).version" "$ROOT/npm-package/package.json")"
[ "$PKG_VERSION" = "$VERSION" ] || { echo "ERRO: package.json=$PKG_VERSION, esperado $VERSION" >&2; exit 1; }

(cd "$ROOT/npm-package" && npm pack --silent --pack-destination "$TMP" >/dev/null)
TGZ="$(ls "$TMP"/venix-*.tgz)"
expected=$'package/README.md\npackage/bin/venix.js\npackage/install.js\npackage/package.json'
actual="$(tar -tzf "$TGZ" | sort)"
[ "$actual" = "$expected" ] || { echo "ERRO: conteúdo inesperado no pacote:" >&2; echo "$actual" >&2; exit 1; }

cat > "$TMP/fake-native" <<FAKE
#!/bin/sh
if [ "\$1" = "--version" ]; then echo "$VERSION"; else echo "ARGS:\$*"; fi
FAKE
chmod +x "$TMP/fake-native"

VENIX_BINARY_PATH="$TMP/fake-native" npm install -g --silent --prefix "$TMP/prefix" "$TGZ"
V="$TMP/prefix/bin/venix"
[ "$("$V" --version)" = "$VERSION" ] || { echo "ERRO: venix --version" >&2; exit 1; }
[ "$("$V" login --x)" = "ARGS:login --x" ] || { echo "ERRO: argumentos não encaminhados corretamente" >&2; exit 1; }
echo "OK pacote npm $VERSION"
