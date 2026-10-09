package output

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	reset  = "\033[0m"
	cyan   = "\033[36m"
	blue   = "\033[94m"
	green  = "\033[32m"
	yellow = "\033[33m"
	red    = "\033[31m"
	gray   = "\033[90m"
)

func enabled() bool { return os.Getenv("NO_COLOR") == "" && os.Getenv("TERM") != "dumb" }
func paint(code, message string) string {
	if !enabled() {
		return message
	}
	return code + message + reset
}
func Info(message string)    { fmt.Fprintln(os.Stdout, paint(cyan, "ℹ "+message)) }
func Success(message string) { fmt.Fprintln(os.Stdout, paint(green, "✔ "+message)) }
func Warning(message string) { fmt.Fprintln(os.Stderr, paint(yellow, "⚠ "+message)) }
func Error(message string)   { fmt.Fprintln(os.Stderr, paint(red, "✖ "+message)) }
func Heading(message string) { fmt.Fprintln(os.Stdout, paint(bold+blue, message)) }
func Muted(message string)   { fmt.Fprintln(os.Stdout, paint(gray, message)) }
func Link(label, url string) {
	if label == "" {
		fmt.Fprintln(os.Stdout, paint(blue, url))
		return
	}
	fmt.Fprintln(os.Stdout, paint(cyan, label)+" "+paint(blue, url))
}
func Status(status string) string {
	value := strings.ToUpper(strings.TrimSpace(status))
	code := gray
	switch value {
	case "ONLINE", "RUNNING", "ACTIVE", "STARTED", "UP":
		code = green
	case "DEPLOYING", "BUILDING", "STARTING", "RESTARTING", "INICIANDO", "PARANDO":
		code = yellow
	case "OFFLINE", "STOPPED", "STOPPING", "ERROR", "FAILED", "ERRO":
		code = red
	}
	return paint(code, status)
}

// Spinner mostra uma animação curta enquanto uma operação de rede está em andamento.
type Spinner struct {
	stop chan struct{}
	done chan struct{}
	once sync.Once
}

func StartSpinner(label string) *Spinner {
	s := &Spinner{stop: make(chan struct{}), done: make(chan struct{})}
	if !enabled() || !isTerminal() {
		close(s.done)
		return s
	}
	go func() {
		defer close(s.done)
		frames := []string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}
		for i := 0; ; i++ {
			select {
			case <-s.stop:
				fmt.Print("\r\033[2K")
				return
			default:
				fmt.Printf("\r%s %s", paint(cyan, frames[i%len(frames)]), label)
				time.Sleep(80 * time.Millisecond)
			}
		}
	}()
	return s
}

func (s *Spinner) Stop() {
	s.once.Do(func() { close(s.stop) })
	<-s.done
}

func isTerminal() bool {
	file, err := os.Stdout.Stat()
	return err == nil && file.Mode()&os.ModeCharDevice != 0
}

func JSON(enabledJSON bool, value any) error {
	if !enabledJSON {
		return nil
	}
	b, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintln(os.Stdout, string(b))
	return nil
}
