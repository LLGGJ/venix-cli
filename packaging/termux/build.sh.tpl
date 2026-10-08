TERMUX_PKG_HOMEPAGE=https://venixcloud.com
TERMUX_PKG_DESCRIPTION="CLI da VenixCloud"
TERMUX_PKG_LICENSE="@LICENSE@"
TERMUX_PKG_MAINTAINER="@LLGGJ"
TERMUX_PKG_VERSION=@VERSION@
TERMUX_PKG_SRCURL=https://github.com/LLGGJ/venix-cli/archive/refs/tags/v${TERMUX_PKG_VERSION}.tar.gz
TERMUX_PKG_SHA256=@SOURCE_SHA256@
TERMUX_PKG_AUTO_UPDATE=true
TERMUX_PKG_BUILD_IN_SRC=true

termux_step_make() {
	termux_setup_golang
	go build -trimpath -ldflags "-s -w -X main.version=${TERMUX_PKG_VERSION}" -o venix ./cmd/venix
}

termux_step_make_install() {
	install -Dm755 venix "$TERMUX_PREFIX/bin/venix"
}
