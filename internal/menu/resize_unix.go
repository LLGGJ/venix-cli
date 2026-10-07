//go:build !windows

package menu

import (
	"os"
	"os/signal"
	"syscall"
)

// watchResize chama fn sempre que o terminal muda de tamanho (SIGWINCH).
func watchResize(fn func()) func() {
	ch := make(chan os.Signal, 1)
	done := make(chan struct{})
	finished := make(chan struct{})
	signal.Notify(ch, syscall.SIGWINCH)
	go func() {
		defer close(finished)
		for {
			select {
			case <-ch:
				fn()
			case <-done:
				return
			}
		}
	}()
	return func() {
		signal.Stop(ch)
		close(done)
		<-finished
	}
}
