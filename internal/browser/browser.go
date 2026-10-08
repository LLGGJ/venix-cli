// Package browser abre URLs no navegador padrão, inclusive no Termux (Android).
package browser

import (
	"os"
	"os/exec"
	"runtime"
	"time"
)

func commands(url string) [][]string {
	termux := [][]string{
		{"termux-open-url", url},
		{"termux-open", url},
		{"am", "start", "-a", "android.intent.action.VIEW", "-d", url},
	}
	switch runtime.GOOS {
	case "darwin":
		return [][]string{{"open", url}}
	case "windows":
		return [][]string{{"rundll32", "url.dll,FileProtocolHandler", url}}
	case "android":
		return append(termux, []string{"xdg-open", url})
	}
	list := [][]string{
		{"xdg-open", url},
		{"gio", "open", url},
		{"sensible-browser", url},
		{"wslview", url},
	}
	if os.Getenv("TERMUX_VERSION") != "" {
		return append(termux, list...)
	}
	return list
}

// Open tenta abrir url no navegador e informa se algum launcher aceitou o pedido.
func Open(url string) bool {
	for _, args := range commands(url) {
		path, err := exec.LookPath(args[0])
		if err != nil {
			continue
		}
		cmd := exec.Command(path, args[1:]...)
		done := make(chan error, 1)
		go func() { done <- cmd.Run() }()
		select {
		case err := <-done:
			if err == nil {
				return true
			}
		case <-time.After(3 * time.Second):
			return true
		}
	}
	return false
}
