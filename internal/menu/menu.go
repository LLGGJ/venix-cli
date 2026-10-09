package menu

import (
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
	"time"

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
	index, _, err := run(title, headers, items, 0, nil)
	return index, err
}

// SelectLive é como SelectItems, mas chama refresh a cada interval e atualiza a
// lista na tela, mantendo a seleção (pelo ID, ou pelo título). Devolve o item
// escolhido; ok é false se o usuário cancelou.
func SelectLive(title string, headers []string, items []Item, interval time.Duration, refresh func() ([]Item, error)) (Item, bool, error) {
	index, list, err := run(title, headers, items, interval, refresh)
	if err != nil || index < 0 || index >= len(list) {
		return Item{}, false, err
	}
	return list[index], true, nil
}

func itemKey(it Item) string {
	if it.ID != "" {
		return it.ID
	}
	return it.Title
}

func run(title string, headers []string, items []Item, interval time.Duration, refresh func() ([]Item, error)) (int, []Item, error) {
	if len(items) == 0 {
		return -1, nil, fmt.Errorf("menu vazio")
	}
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return -1, nil, fmt.Errorf("menu interativo exige um terminal")
	}
	state, err := term.MakeRaw(fd)
	if err != nil {
		return -1, nil, fmt.Errorf("ativar modo interativo: %w", err)
	}
	defer term.Restore(fd, state)

	out := os.Stdout
	colors := colorsEnabled()
	fmt.Fprint(out, "\033[?1049h\033[?25l")
	defer fmt.Fprint(out, "\033[?25h\033[?1049l")

	var mu sync.Mutex
	closed := false
	selected, top := 0, 0
	redraw := func() {
		mu.Lock()
		defer mu.Unlock()
		if closed {
			return
		}
		width, height := terminalSize()
		var lines []line
		lines, top = buildFrame(title, headers, items, selected, top, width, height)
		fmt.Fprint(out, renderFrame(lines, colors))
	}
	stop := watchResize(redraw)
	defer stop()
	defer func() {
		mu.Lock()
		closed = true
		mu.Unlock()
	}()
	redraw()

	if refresh != nil && interval > 0 {
		go func() {
			ticker := time.NewTicker(interval)
			defer ticker.Stop()
			for range ticker.C {
				mu.Lock()
				stopped := closed
				mu.Unlock()
				if stopped {
					return
				}
				fresh, err := refresh()
				if err != nil || len(fresh) == 0 {
					continue
				}
				mu.Lock()
				if closed {
					mu.Unlock()
					return
				}
				key := itemKey(items[selected])
				items = fresh
				if selected >= len(items) {
					selected = len(items) - 1
				}
				for i, it := range items {
					if itemKey(it) == key {
						selected = i
						break
					}
				}
				mu.Unlock()
				redraw()
			}
		}()
	}

	for {
		key, err := readKey(os.Stdin)
		if err != nil {
			return -1, nil, err
		}
		mu.Lock()
		switch key {
		case "up":
			selected = (selected - 1 + len(items)) % len(items)
		case "down":
			selected = (selected + 1) % len(items)
		}
		current, snapshot := selected, items
		mu.Unlock()
		switch key {
		case "enter":
			return current, snapshot, nil
		case "esc", "q":
			return -1, snapshot, nil
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
		case 'g':
			return "home", nil
		case 'G':
			return "end", nil
		}
		return "", nil
	}
	if n >= 3 && b[0] == 27 && (b[1] == '[' || b[1] == 'O') {
		switch b[2] {
		case 'A':
			return "up", nil
		case 'B':
			return "down", nil
		case 'H':
			return "home", nil
		case 'F':
			return "end", nil
		}
		if n >= 4 && b[3] == '~' {
			switch b[2] {
			case '5':
				return "pgup", nil
			case '6':
				return "pgdn", nil
			case '1', '7':
				return "home", nil
			case '4', '8':
				return "end", nil
			}
		}
	}
	return "", nil
}

func IsTerminal() bool {
	return term.IsTerminal(int(os.Stdin.Fd())) && term.IsTerminal(int(os.Stdout.Fd())) && !strings.EqualFold(os.Getenv("TERM"), "dumb")
}

// Button mostra um botão com o texto label abaixo da saída atual e espera o
// usuário confirmar com Enter (Esc, q e Ctrl+C também voltam). Sem terminal, não espera.
func Button(label string) error {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return nil
	}
	state, err := term.MakeRaw(fd)
	if err != nil {
		return err
	}
	defer term.Restore(fd, state)

	button := "[ ❯ " + label + " ]  Enter para voltar"
	if colorsEnabled() {
		button = "\033[1;30;46m ❯ " + label + " \033[0m  \033[2mEnter para voltar\033[0m"
	}
	fmt.Fprint(os.Stdout, "\r\n"+button+"\r\n")
	for {
		key, err := readKey(os.Stdin)
		if err != nil {
			return err
		}
		if key == "enter" || key == "esc" || key == "q" {
			return nil
		}
	}
}
