#!/bin/sh
# Instalador da Venix CLI (Linux, macOS e Android/Termux). Não depende do npm.
#
#   curl -fsSL https://raw.githubusercontent.com/LLGGJ/venix-cli/main/install.sh | sh
#
# Variáveis opcionais:
#   VENIX_VERSION           versão a instalar (ex.: 1.0.13); padrão: a última release
#   VENIX_INSTALL_DIR       diretório de destino
#   VENIX_RELEASE_BASE_URL  diretório alternativo com os archives e o SHA256SUMS
set -eu

REPO="LLGGJ/venix-cli"

say() { printf '%s\n' "$*"; }
fail() {
	printf 'erro: %s\n' "$*" >&2
	exit 1
}
have() { command -v "$1" >/dev/null 2>&1; }

fetch() {
	if have curl; then
		curl -fsSL --retry 3 -o "$2" "$1" || fail "falha ao baixar $1"
	elif have wget; then
		wget -q -O "$2" "$1" || fail "falha ao baixar $1"
	else
		fail "instale curl ou wget"
	fi
}

sha256_of() {
	if have sha256sum; then
		sha256sum "$1" | cut -d' ' -f1
	elif have shasum; then
		shasum -a 256 "$1" | cut -d' ' -f1
	elif have openssl; then
		openssl dgst -sha256 "$1" | sed 's/^.*= //'
	else
		fail "instale sha256sum, shasum ou openssl para verificar o download"
	fi
}

# --- sistema e arquitetura -------------------------------------------------
case "$(uname -m)" in
x86_64 | amd64) ARCH=amd64 ;;
aarch64 | arm64) ARCH=arm64 ;;
*) fail "arquitetura não suportada: $(uname -m)" ;;
esac

IS_TERMUX=0
if [ -n "${TERMUX_VERSION:-}" ]; then
	IS_TERMUX=1
else
	case "${PREFIX:-}" in *com.termux*) IS_TERMUX=1 ;; esac
fi

case "$(uname -s)" in
Linux)
	if [ "$IS_TERMUX" = 1 ]; then
		[ "$ARCH" = arm64 ] || fail "no Termux só há suporte a arm64"
		OS=android
	else
		OS=linux
	fi
	;;
Darwin) OS=darwin ;;
*) fail "sistema não suportado: $(uname -s). No Windows use install.ps1" ;;
esac
TARGET="${OS}_${ARCH}"
case "$OS" in
linux) SYS_EMOJI="🐧"; SYS_NAME="Linux" ;;
darwin) SYS_EMOJI="🍎"; SYS_NAME="macOS" ;;
android) SYS_EMOJI="🤖"; SYS_NAME="Android (Termux)" ;;
esac

# --- versão ----------------------------------------------------------------
VERSION="${VENIX_VERSION:-}"
VERSION="${VERSION#v}"
if [ -z "$VERSION" ]; then
	have curl || fail "sem curl, informe VENIX_VERSION (ex.: VENIX_VERSION=1.0.13)"
	LATEST_URL="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest")" ||
		fail "não foi possível descobrir a última versão"
	VERSION="${LATEST_URL##*/}"
	VERSION="${VERSION#v}"
	[ -n "$VERSION" ] || fail "não foi possível descobrir a última versão"
fi

BASE_URL="${VENIX_RELEASE_BASE_URL:-https://github.com/$REPO/releases/download/v$VERSION}"
BASE_URL="${BASE_URL%/}"
ARCHIVE="venix_${VERSION}_${TARGET}.tar.gz"

# --- destino ---------------------------------------------------------------
if [ -n "${VENIX_INSTALL_DIR:-}" ]; then
	DEST="$VENIX_INSTALL_DIR"
elif [ "$IS_TERMUX" = 1 ] && [ -n "${PREFIX:-}" ]; then
	DEST="$PREFIX/bin"
elif [ -w /usr/local/bin ]; then
	DEST=/usr/local/bin
else
	DEST="$HOME/.local/bin"
fi
mkdir -p "$DEST"

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t venix)"
trap 'rm -rf "$TMP"' EXIT INT TERM

say "Venix CLI $VERSION ($TARGET)"
say "Baixando $ARCHIVE..."
fetch "$BASE_URL/$ARCHIVE" "$TMP/$ARCHIVE"
fetch "$BASE_URL/SHA256SUMS" "$TMP/SHA256SUMS"

WANT="$(awk -v f="$ARCHIVE" '{ n=$2; sub(/^\*/, "", n); if (n == f) { print tolower($1); exit } }' "$TMP/SHA256SUMS")"
[ -n "$WANT" ] || fail "$ARCHIVE não consta em SHA256SUMS"
GOT="$(sha256_of "$TMP/$ARCHIVE")"
[ "$GOT" = "$WANT" ] || fail "SHA-256 inválido para $ARCHIVE"
say "$SYS_EMOJI $SYS_NAME detectado ($ARCH)"

tar -xzf "$TMP/$ARCHIVE" -C "$TMP" || fail "falha ao extrair $ARCHIVE"
[ -f "$TMP/venix" ] || fail "venix não encontrado dentro de $ARCHIVE"

cp "$TMP/venix" "$DEST/venix.new"
chmod 755 "$DEST/venix.new"
mv -f "$DEST/venix.new" "$DEST/venix"

OUT="$("$DEST/venix" --version 2>/dev/null || true)"
[ "$OUT" = "$VERSION" ] || fail "o binário instalado informa '$OUT', esperado '$VERSION'"

say "Instalado em $DEST/venix"
case ":$PATH:" in
*":$DEST:"*) ;;
*) say "Aviso: $DEST não está no PATH. Adicione ao seu shell: export PATH=\"$DEST:\$PATH\"" ;;
esac
say "Pronto! Rode: venix help"
