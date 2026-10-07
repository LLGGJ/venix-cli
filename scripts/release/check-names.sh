#!/usr/bin/env bash
# Garante que install.js procura exatamente os nomes que o workflow publica.
set -euo pipefail
VERSION="${1:?uso: check-names.sh <versao>}"
cd "$(dirname "$0")/../.."
status=0
while read -r name goos goarch ext; do
  case "$goos" in windows) plat=win32 ;; *) plat=linux ;; esac
  [ "$goos" = darwin ] && plat=darwin
  case "$goarch" in amd64) arch=x64 ;; arm64) arch=arm64 ;; esac
  extra=()
  [ "$goos" = android ] && extra=(TERMUX_VERSION=1)
  got=$(env "${extra[@]}" VENIX_DRY_RUN=1 VENIX_VERSION="$VERSION" VENIX_PLATFORM="$plat" VENIX_ARCH="$arch" node npm-package/install.js)
  want="venix_${VERSION}_${name}.${ext}"
  if [ "$got" != "$want" ]; then echo "ERRO: install.js usa '$got', workflow publica '$want'" >&2; status=1; else echo "OK $want"; fi
done < <(node -e 'for (const t of require("./.github/release-targets.json")) console.log(t.name, t.goos, t.goarch, t.ext)')
exit $status
