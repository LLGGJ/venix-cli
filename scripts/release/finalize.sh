#!/usr/bin/env bash
# Confere os archives baixados (nomes, tamanho) e gera SHA256SUMS.
set -euo pipefail
VERSION="${1:?uso: finalize.sh <versao> <diretorio>}"
DIR="${2:?uso: finalize.sh <versao> <diretorio>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$DIR"
expected="$(node -e 'for (const t of require(process.argv[1])) console.log(`venix_${process.argv[2]}_${t.name}.${t.ext}`)' "$ROOT/.github/release-targets.json" "$VERSION" | sort)"
actual="$(ls -1 | grep -v '^SHA256SUMS$' | sort || true)"
[ "$expected" = "$actual" ] || { echo "ERRO: arquivos diferentes do esperado" >&2; diff <(echo "$expected") <(echo "$actual") >&2 || true; exit 1; }
for f in $expected; do [ -s "$f" ] || { echo "ERRO: $f vazio" >&2; exit 1; }; done
sha256sum $expected > SHA256SUMS
sha256sum -c SHA256SUMS
[ "$(wc -l < SHA256SUMS)" -eq "$(echo "$expected" | wc -l)" ] || { echo "ERRO: SHA256SUMS incompleto" >&2; exit 1; }
