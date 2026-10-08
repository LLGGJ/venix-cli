// Package browser abre URLs no navegador padrão, inclusive no Termux (Android).
package browser

import (
	"bytes"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

func commands(url string) [][]string {
	termux := [][]string{
		{"termux-open-url", url},
		{"termux-open", url},
		{"am", "start", "--user", "0", "-a", "android.intent.action.VIEW", "-d", url},
		{"/system/bin/am", "start", "--user", "0", "-a", "android.intent.action.VIEW", "-d", url},
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

func isExecutable(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir() && info.Mode()&0o111 != 0
}

// lookPath procura o comando no PATH sem usar faccessat2, que alguns
// kernels/seccomp do Android bloqueiam (o exec.LookPath do Go falha nesses casos).
func lookPath(name string) (string, bool) {
	if runtime.GOOS == "windows" {
		path, err := exec.LookPath(name)
		return path, err == nil
	}
	if strings.ContainsRune(name, '/') {
		return name, isExecutable(name)
	}
	for _, dir := range filepath.SplitList(os.Getenv("PATH")) {
		if dir == "" {
			continue
		}
		if path := filepath.Join(dir, name); isExecutable(path) {
			return path, true
		}
	}
	return "", false
}

// systemEnv remove variáveis do Termux que quebram binários do sistema Android.
func systemEnv() []string {
	var env []string
	for _, kv := range os.Environ() {
		if strings.HasPrefix(kv, "LD_LIBRARY_PATH=") || strings.HasPrefix(kv, "LD_PRELOAD=") {
			continue
		}
		env = append(env, kv)
	}
	return env
}

func describe(err error, stderr string) string {
	msg := strings.TrimSpace(stderr)
	if i := strings.IndexByte(msg, '\n'); i >= 0 {
		msg = msg[:i]
	}
	if msg == "" {
		return err.Error()
	}
	if r := []rune(msg); len(r) > 70 {
		msg = string(r[:70]) + "…"
	}
	return err.Error() + " (" + msg + ")"
}

// Open tenta abrir url no navegador e informa se algum launcher aceitou o pedido.
func Open(url string) bool {
	ok, _ := OpenDetailed(url)
	return ok
}

// OpenDetailed é como Open, mas devolve também o motivo de cada tentativa que falhou.
func OpenDetailed(url string) (bool, string) {
	var notes []string
	for _, args := range commands(url) {
		path, found := lookPath(args[0])
		if !found {
			notes = append(notes, args[0]+": não encontrado")
			continue
		}
		cmd := exec.Command(path, args[1:]...)
		if args[0] == "/system/bin/am" {
			cmd.Env = systemEnv()
		}
		var stderr bytes.Buffer
		cmd.Stderr = &stderr
		done := make(chan error, 1)
		go func() { done <- cmd.Run() }()
		select {
		case err := <-done:
			if err == nil {
				return true, ""
			}
			notes = append(notes, args[0]+": "+describe(err, stderr.String()))
		case <-time.After(3 * time.Second):
			return true, ""
		}
	}
	return false, strings.Join(notes, "; ")
}

// LookPath procura name no PATH (sem faccessat2) e informa se o encontrou.
func LookPath(name string) (string, bool) { return lookPath(name) }

// Launcher descreve um programa que pode abrir o navegador neste sistema.
type Launcher struct {
	Name  string
	Path  string
	Found bool
}

// Launchers lista os programas candidatos e se cada um existe no PATH.
func Launchers() []Launcher {
	seen := map[string]bool{}
	var list []Launcher
	for _, args := range commands("https://example.com") {
		if seen[args[0]] {
			continue
		}
		seen[args[0]] = true
		path, found := lookPath(args[0])
		list = append(list, Launcher{Name: args[0], Path: path, Found: found})
	}
	return list
}
