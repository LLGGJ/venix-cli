//go:build windows

package menu

// No Windows não existe SIGWINCH; o layout é recalculado a cada tecla.
func watchResize(fn func()) func() {
	return func() {}
}
