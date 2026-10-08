#!/usr/bin/env bash
# Gera os manifestos (Homebrew, Scoop, Winget, Termux) a partir de packaging/*.tpl.
# Uso: gen-packaging.sh <versao> <SHA256SUMS> <diretorio-de-saida>
# Variáveis: LICENSE_SPDX (padrão: CONFIRMAR-LICENCA), SOURCE_SHA256 (hash do tarball do código-fonte da tag)
set -euo pipefail
VERSION="${1:?uso: gen-packaging.sh <versao> <SHA256SUMS> <saida>}"
SUMS="${2:?}"
OUT="${3:?}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LICENSE_SPDX="${LICENSE_SPDX:-CONFIRMAR-LICENCA}"
SOURCE_SHA256="${SOURCE_SHA256:-}"

if [ -z "$SOURCE_SHA256" ]; then
  SOURCE_SHA256="$(curl -fsSL "https://github.com/LLGGJ/venix-cli/archive/refs/tags/v${VERSION}.tar.gz" | sha256sum | cut -d' ' -f1 || true)"
fi
[ -n "$SOURCE_SHA256" ] || SOURCE_SHA256="PREENCHER-SHA256-DO-CODIGO-FONTE"

mkdir -p "$OUT"
render() {
  local src="$1" dst="$2"
  mkdir -p "$(dirname "$dst")"
  local expr=(-e "s|@VERSION@|${VERSION}|g" -e "s|@LICENSE@|${LICENSE_SPDX}|g" -e "s|@SOURCE_SHA256@|${SOURCE_SHA256}|g")
  while read -r hash file; do
    file="${file#\*}"
    name="${file#venix_${VERSION}_}"
    name="${name%.tar.gz}"
    name="${name%.zip}"
    upper="$(printf '%s' "$hash" | tr 'a-f' 'A-F')"
    expr+=(-e "s|@SHA256_${name}@|${hash}|g" -e "s|@SHA256_${name}_UPPER@|${upper}|g")
  done < "$SUMS"
  sed "${expr[@]}" "$src" > "$dst"
  if grep -q '@[A-Za-z0-9_]*@' "$dst" && ! grep -q '^TERMUX_PKG_MAINTAINER' "$dst"; then
    echo "ERRO: placeholders sem substituição em $dst" >&2
    grep -n '@[A-Za-z0-9_]*@' "$dst" >&2
    exit 1
  fi
}

render "$ROOT/packaging/homebrew/venix.rb.tpl" "$OUT/homebrew/venix.rb"
render "$ROOT/packaging/scoop/venix.json.tpl" "$OUT/scoop/venix.json"
render "$ROOT/packaging/winget/LLGGJ.Venix.yaml.tpl" "$OUT/winget/LLGGJ.Venix.yaml"
render "$ROOT/packaging/winget/LLGGJ.Venix.installer.yaml.tpl" "$OUT/winget/LLGGJ.Venix.installer.yaml"
render "$ROOT/packaging/winget/LLGGJ.Venix.locale.pt-BR.yaml.tpl" "$OUT/winget/LLGGJ.Venix.locale.pt-BR.yaml"
render "$ROOT/packaging/termux/build.sh.tpl" "$OUT/termux/build.sh"
echo "Manifestos gerados em $OUT"
