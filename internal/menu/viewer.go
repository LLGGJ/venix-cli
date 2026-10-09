package menu

import (
	"fmt"
	"os"
	"strings"
	"sync"

	"golang.org/x/term"
)

// wrapANSI quebra s (que pode ter códigos de cor) em linhas de no máximo width
// colunas visíveis. As linhas de continuação são recuadas e mantêm a cor ativa.
func wrapANSI(s string, width, indent int) []string {
	if width < indent+2 {
		width = indent + 2
	}
	var out []string
	var cur strings.Builder
	active := ""
	col := 0
	runes := []rune(s)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		if r == 0x1b && i+1 < len(runes) && runes[i+1] == '[' {
			j := i + 2
			for j < len(runes) && (runes[j] < 0x40 || runes[j] > 0x7e) {
				j++
			}
			if j >= len(runes) {
				break
			}
			seq := string(runes[i : j+1])
			cur.WriteString(seq)
			if runes[j] == 'm' {
				if seq == "\033[0m" || seq == "\033[m" {
					active = ""
				} else {
					active += seq
				}
			}
			i = j
			continue
		}
		if r == '\t' {
			r = ' '
		}
		if r < 0x20 {
			continue
		}
		w := runeLen(string(r))
		if col+w > width {
			if active != "" {
				cur.WriteString("\033[0m")
			}
			out = append(out, cur.String())
			cur.Reset()
			cur.WriteString(active)
			cur.WriteString(strings.Repeat(" ", indent))
			col = indent
		}
		cur.WriteRune(r)
		col += w
	}
	if active != "" {
		cur.WriteString("\033[0m")
	}
	return append(out, cur.String())
}

func viewerHint(usable int) string {
	for _, h := range []string{
		"↑↓ rolar • PgUp/PgDn página • g/G início/fim • Enter voltar",
		"↑↓ rolar • PgUp/PgDn • Enter voltar",
		"↑↓ rolar • Enter voltar",
		"↑↓ • Enter",
	} {
		if runeLen(h) <= usable {
			return h
		}
	}
	return ellipsize("↑↓ • Enter", usable)
}

// Viewer mostra linhas (já coloridas) em tela cheia, com rolagem e um botão
// Voltar sempre visível no rodapé. Começa na última linha.
func Viewer(title string, lines []string) error {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		for _, l := range lines {
			fmt.Println(l)
		}
		return nil
	}
	state, err := term.MakeRaw(fd)
	if err != nil {
		return err
	}
	defer term.Restore(fd, state)

	var rows []string
	for _, l := range lines {
		rows = append(rows, strings.Split(l, "\n")...)
	}
	out := os.Stdout
	colors := colorsEnabled()
	fmt.Fprint(out, "\033[?1049h\033[?25l")
	defer fmt.Fprint(out, "\033[?25h\033[?1049l")

	var mu sync.Mutex
	closed := false
	offset, page := 0, 1
	atBottom := true
	redraw := func() {
		mu.Lock()
		defer mu.Unlock()
		if closed {
			return
		}
		width, height := terminalSize()
		usable := maxInt(width-1, 12)
		bodyH := maxInt(height-4, 1)
		var wrapped []string
		for _, row := range rows {
			wrapped = append(wrapped, wrapANSI(row, usable, 2)...)
		}
		maxOff := maxInt(len(wrapped)-bodyH, 0)
		if atBottom {
			offset = maxOff
		}
		offset = maxInt(minInt(offset, maxOff), 0)
		atBottom = offset >= maxOff
		page = maxInt(bodyH-1, 1)

		prefix := ""
		if usable >= 20 {
			prefix = "◆ "
		}
		frame := []line{
			makeHeading(prefix+title, usable),
			{{text: viewerHint(usable), st: stDim}},
		}
		end := minInt(offset+bodyH, len(wrapped))
		for _, w := range wrapped[offset:end] {
			frame = append(frame, line{{text: w}})
		}
		for len(frame) < 2+bodyH {
			frame = append(frame, line{})
		}
		button := seg{text: " ❯ Voltar ", st: stButton}
		if !colors {
			button = seg{text: "[ ❯ Voltar ]"}
		}
		position := ""
		if len(wrapped) > 0 {
			position = fmt.Sprintf("  %d–%d de %d", offset+1, end, len(wrapped))
		}
		frame = append(frame, line{}, line{button, {text: position, st: stDim}})
		fmt.Fprint(out, renderFrame(frame, colors))
	}
	stop := watchResize(redraw)
	defer stop()
	defer func() {
		mu.Lock()
		closed = true
		mu.Unlock()
	}()
	redraw()

	for {
		key, err := readKey(os.Stdin)
		if err != nil {
			return err
		}
		mu.Lock()
		switch key {
		case "up":
			offset--
			atBottom = false
		case "down":
			offset++
			atBottom = false
		case "pgup":
			offset -= page
			atBottom = false
		case "pgdn":
			offset += page
			atBottom = false
		case "home":
			offset = 0
			atBottom = false
		case "end":
			atBottom = true
		}
		mu.Unlock()
		switch key {
		case "enter", "esc", "q":
			return nil
		default:
			redraw()
		}
	}
}
