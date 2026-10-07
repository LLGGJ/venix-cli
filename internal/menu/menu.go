package menu

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"

	"golang.org/x/term"
)

func colorsEnabled() bool {
	return os.Getenv("NO_COLOR") == "" && os.Getenv("TERM") != "dumb"
}

func terminalSize() (int, int) {
	width, height, err := term.GetSize(int(os.Stdout.Fd()))
	if err != nil || width <= 0 {
		return 80, 24
	}
	if height <= 0 {
		height = 24
	}
	return width, height
}

// Select mostra uma lista navegável e devolve o índice confirmado pelo usuário.
// Setas (ou j/k) alteram a seleção; Enter confirma; Esc ou q cancela.
func Select(title string, items []string) (int, error) {
	list := make([]Item, len(items))
	for i, item := range items {
		list[i] = Item{Title: item}
	}
	return SelectItems(title, nil, list)
}

// SelectItems é como Select, mas aceita status/detalhe por item e cabeçalhos
// opcionais de colunas (exatamente três: nome, status e detalhe). O layout é
// recalculado a cada desenho, inclusive quando o terminal é redimensionado.
func SelectItems(title string, headers []string, items []Item) (int, error) {
	if len(items) == 0 {
		return -1, fmt.Errorf("menu vazio")
	}
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return -1, fmt.Errorf("menu interativo exige um terminal")
	}
	state, err := term.MakeRaw(fd)
	if err != nil {
		return -1, fmt.Errorf("ativar modo interativo: %w", err)
	}
	defer term.Restore(fd, state)

	out := os.Stdout
	colors := colorsEnabled()
	fmt.Fprint(out, "\033[?1049h\033[?25l")
	defer fmt.Fprint(out, "\033[?25h\033[?1049l")

	var mu sync.Mutex
	selected, top := 0, 0
	redraw := func() {
		mu.Lock()
		defer mu.Unlock()
		width, height := terminalSize()
		var lines []line
		lines, top = buildFrame(title, headers, items, selected, top, width, height)
		fmt.Fprint(out, renderFrame(lines, colors))
	}
	stop := watchResize(redraw)
	defer stop()
	redraw()

	for {
		key, err := readKey(os.Stdin)
		if err != nil {
			return -1, err
		}
		mu.Lock()
		switch key {
		case "up":
			selected = (selected - 1 + len(items)) % len(items)
		case "down":
			selected = (selected + 1) % len(items)
		}
		current := selected
		mu.Unlock()
		switch key {
		case "enter":
			return current, nil
		case "esc", "q":
			return -1, nil
		default:
			redraw()
		}
	}
}

func readKey(r io.Reader) (string, error) {
	var b [8]byte
	n, err := r.Read(b[:])
	if err != nil {
		return "", err
	}
	if n == 1 {
		switch b[0] {
		case 3, 27:
			return "esc", nil
		case 10, 13:
			return "enter", nil
		case 'q', 'Q':
			return "q", nil
		case 'k', 'K':
			return "up", nil
		case 'j', 'J':
			return "down", nil
		}
		return "", nil
	}
	if n >= 3 && b[0] == 27 && (b[1] == '[' || b[1] == 'O') {
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
