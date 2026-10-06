package menu

import (
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/term"
)

const (
	reset = "\033[0m"
	cyan  = "\033[36m"
	blue  = "\033[94m"
	white = "\033[97m"
	dim   = "\033[2m"
)

func color(code, value string) string {
	if os.Getenv("NO_COLOR") != "" || os.Getenv("TERM") == "dumb" {
		return value
	}
	return code + value + reset
}

// Select mostra uma lista navegável e devolve o índice confirmado pelo usuário.
// Setas cima/baixo alteram a seleção; Enter confirma; Esc ou q cancela.
func Select(title string, items []string) (int, error) {
	if len(items) == 0 {
		return -1, fmt.Errorf("menu vazio")
	}
	if !term.IsTerminal(int(os.Stdin.Fd())) {
		return -1, fmt.Errorf("menu interativo exige um terminal")
	}

	state, err := term.MakeRaw(int(os.Stdin.Fd()))
	if err != nil {
		return -1, fmt.Errorf("ativar modo interativo: %w", err)
	}
	defer term.Restore(int(os.Stdin.Fd()), state)

	selected := 0
	for {
		render(title, items, selected)
		key, err := readKey(os.Stdin)
		if err != nil {
			return -1, err
		}
		switch key {
		case "up":
			selected = (selected - 1 + len(items)) % len(items)
		case "down":
			selected = (selected + 1) % len(items)
		case "enter":
			clear(len(items) + 3)
			return selected, nil
		case "esc", "q":
			clear(len(items) + 3)
			return -1, nil
		}
	}
}

func render(title string, items []string, selected int) {
	clear(len(items) + 3)
	fmt.Println(color(blue, "◆ "+title))
	fmt.Println(color(dim, "Use ↑ ↓ para navegar • Enter para selecionar • Esc para sair"))
	for i, item := range items {
		if i == selected {
			fmt.Println(color(cyan, "❯ ") + color(white, item))
		} else {
			fmt.Println("  " + item)
		}
	}
}

func clear(lines int) {
	if os.Getenv("NO_COLOR") == "" && os.Getenv("TERM") != "dumb" {
		fmt.Print("\033[2J\033[H")
		return
	}
	for i := 0; i < lines; i++ {
		fmt.Println()
	}
}

func readKey(r io.Reader) (string, error) {
	var b [3]byte
	n, err := r.Read(b[:])
	if err != nil {
		return "", err
	}
	if n == 1 {
		switch b[0] {
		case 3:
			return "esc", nil
		case 10, 13:
			return "enter", nil
		case 27:
			return "esc", nil
		case 'q', 'Q':
			return "q", nil
		}
	}
	if n >= 3 && b[0] == 27 && b[1] == '[' {
		switch b[2] {
		case 'A':
			return "up", nil
		case 'B':
			return "down", nil
		}
	}
	return "", nil
}

func IsTerminal() bool {
	return term.IsTerminal(int(os.Stdin.Fd())) && term.IsTerminal(int(os.Stdout.Fd())) && !strings.EqualFold(os.Getenv("TERM"), "dumb")
}
