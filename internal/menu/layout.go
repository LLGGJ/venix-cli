package menu

import (
	"strings"
)

// Tone indica a cor semântica de um item (nunca é a única pista visual).
type Tone int

const (
	ToneNone Tone = iota
	ToneGood
	ToneWarn
	ToneBad
	ToneMuted
	ToneInfo
)

// Item é uma linha do menu. Status e Detail são opcionais.
type Item struct {
	Title  string
	Status string
	Detail string
	ID     string
	Tone   Tone
}

type style int

const (
	stPlain style = iota
	stDim
	stHeading
	stMarker
	stSelected
	stGood
	stWarn
	stBad
	stMuted
	stInfo
	stSelGood
	stSelWarn
	stSelBad
	stSelMuted
	stSelInfo
	stButton
)

type seg struct {
	text string
	st   style
}

type line []seg

func (l line) width() int {
	n := 0
	for _, s := range l {
		n += runeLen(s.text)
	}
	return n
}

func (l line) plain() string {
	var b strings.Builder
	for _, s := range l {
		b.WriteString(s.text)
	}
	return b.String()
}

var hints = []string{
	"Use ↑ ↓ para navegar • Enter para selecionar • Esc para sair",
	"↑↓ navegar • Enter selecionar • Esc sair",
	"↑↓ navegar • Enter ok • Esc sair",
	"↑↓ • Enter • Esc",
}

// runeLen devolve a largura em colunas do terminal: emojis largos ocupam 2.
func runeLen(s string) int {
	n := 0
	for _, r := range s {
		switch {
		case r == 0xFE0F || r == 0x200D:
		case r >= 0x1F300 && r <= 0x1FAFF, r == 0x26A1, r == 0x274C:
			n += 2
		default:
			n++
		}
	}
	return n
}

func padRight(s string, n int) string {
	if d := n - runeLen(s); d > 0 {
		return s + strings.Repeat(" ", d)
	}
	return s
}

func padLeft(s string, n int) string {
	if d := n - runeLen(s); d > 0 {
		return strings.Repeat(" ", d) + s
	}
	return s
}

func ellipsize(s string, n int) string {
	if n <= 0 {
		return ""
	}
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	if n == 1 {
		return "…"
	}
	return string(r[:n-1]) + "…"
}

// wrap quebra s em linhas de no máximo n colunas, preferindo espaços e hífens.
func wrap(s string, n int) []string {
	if n < 1 {
		n = 1
	}
	r := []rune(s)
	var out []string
	for len(r) > n {
		cut := n
		for i := n; i > n/2; i-- {
			if c := r[i-1]; c == ' ' || c == '-' || c == '_' {
				cut = i
				break
			}
		}
		out = append(out, strings.TrimRight(string(r[:cut]), " "))
		r = r[cut:]
		for len(r) > 0 && r[0] == ' ' {
			r = r[1:]
		}
	}
	if len(r) > 0 || len(out) == 0 {
		out = append(out, string(r))
	}
	return out
}

func clipLine(l line, n int) line {
	out := make(line, 0, len(l))
	left := n
	for _, s := range l {
		if left <= 0 {
			break
		}
		if w := runeLen(s.text); w > left {
			s.text = ellipsize(s.text, left)
			out = append(out, s)
			break
		} else {
			left -= w
		}
		out = append(out, s)
	}
	return out
}

func pickHint(n int) string {
	for _, h := range hints {
		if runeLen(h) <= n {
			return h
		}
	}
	return ellipsize(hints[len(hints)-1], n)
}

func statusText(it Item) string {
	if it.Status == "" {
		return ""
	}
	if it.Tone == ToneMuted {
		return "○ " + it.Status
	}
	return "● " + it.Status
}

func toneStyle(t Tone) style {
	switch t {
	case ToneGood:
		return stGood
	case ToneWarn:
		return stWarn
	case ToneBad:
		return stBad
	case ToneMuted:
		return stMuted
	case ToneInfo:
		return stInfo
	}
	return stPlain
}

// titleStyleFor define a cor do título: itens sem status/detalhe usam a cor do
// próprio tom (ex.: ações); itens com status só ganham cor quando selecionados.
func titleStyleFor(it Item, selected bool) style {
	plainItem := it.Status == "" && it.Detail == ""
	if !selected {
		if plainItem {
			return toneStyle(it.Tone)
		}
		return stPlain
	}
	if plainItem {
		switch it.Tone {
		case ToneGood:
			return stSelGood
		case ToneWarn:
			return stSelWarn
		case ToneBad:
			return stSelBad
		case ToneMuted:
			return stSelMuted
		case ToneInfo:
			return stSelInfo
		}
	}
	return stSelected
}

func markerFor(selected bool) (string, style) {
	if selected {
		return "❯ ", stMarker
	}
	return "  ", stPlain
}

// buildFrame calcula todas as linhas da tela. Nenhuma linha devolvida é mais
// larga que width-1 colunas e o resultado cabe em height linhas (quando
// possível). O retorno inclui o novo índice do primeiro item visível.
func buildFrame(title string, headers []string, items []Item, selected, top, width, height int) ([]line, int) {
	usable := width - 1
	if usable < 12 {
		usable = 12
	}

	prefix := ""
	if usable >= 20 {
		prefix = "◆ "
	}
	fixed := []line{
		makeHeading(prefix+title, usable),
		{{text: pickHint(usable), st: stDim}},
		{},
	}

	hasMeta := false
	nameW, statusW, detailW := 0, 0, 0
	for _, it := range items {
		if it.Status != "" || it.Detail != "" {
			hasMeta = true
		}
		nameW = maxInt(nameW, runeLen(it.Title))
		statusW = maxInt(statusW, runeLen(statusText(it)))
		detailW = maxInt(detailW, runeLen(it.Detail))
	}
	useHeaders := hasMeta && len(headers) == 3
	if useHeaders {
		nameW = maxInt(nameW, runeLen(headers[0]))
		if statusW > 0 {
			statusW = maxInt(statusW, runeLen(headers[1]))
		}
		if detailW > 0 {
			detailW = maxInt(detailW, runeLen(headers[2]))
		}
	}

	tableWidth := func(gap int) int {
		total := 2 + nameW
		if statusW > 0 {
			total += gap + statusW
		}
		if detailW > 0 {
			total += gap + detailW
		}
		return total
	}
	gap := 3
	if tableWidth(gap) > usable {
		gap = 2
	}
	table := hasMeta && tableWidth(gap) <= usable
	stacked := hasMeta && !table
	gapText := strings.Repeat(" ", gap)

	if table && useHeaders {
		row := line{{text: "  " + padRight(headers[0], nameW), st: stDim}}
		if statusW > 0 {
			row = append(row, seg{text: gapText + padRight(headers[1], statusW), st: stDim})
		}
		if detailW > 0 {
			row = append(row, seg{text: gapText + padLeft(headers[2], detailW), st: stDim})
		}
		fixed = append(fixed, row)
	}

	blocks := make([][]line, len(items))
	for i, it := range items {
		marker, markerStyle := markerFor(i == selected)
		titleStyle := titleStyleFor(it, i == selected)
		var block []line
		switch {
		case table:
			row := line{{text: marker, st: markerStyle}, {text: padRight(it.Title, nameW), st: titleStyle}}
			if statusW > 0 {
				row = append(row, seg{text: gapText}, seg{text: padRight(statusText(it), statusW), st: toneStyle(it.Tone)})
			}
			if detailW > 0 {
				row = append(row, seg{text: gapText}, seg{text: padLeft(it.Detail, detailW), st: stPlain})
			}
			block = []line{row}
		case stacked:
			for j, part := range wrap(it.Title, usable-2) {
				m, ms := "  ", stPlain
				if j == 0 {
					m, ms = marker, markerStyle
				}
				block = append(block, line{{text: m, st: ms}, {text: part, st: titleStyle}})
			}
			if it.Status != "" || it.Detail != "" {
				meta := line{{text: "  "}}
				if it.Status != "" {
					meta = append(meta, seg{text: statusText(it), st: toneStyle(it.Tone)})
				}
				if it.Status != "" && it.Detail != "" {
					meta = append(meta, seg{text: " • ", st: stDim})
				}
				if it.Detail != "" {
					meta = append(meta, seg{text: it.Detail})
				}
				block = append(block, meta)
			}
			if i < len(items)-1 {
				block = append(block, line{})
			}
		default:
			block = []line{{{text: marker, st: markerStyle}, {text: ellipsize(it.Title, usable-2), st: titleStyle}}}
		}
		blocks[i] = block
	}

	avail := 1 << 30
	if height > 0 {
		avail = maxInt(height-len(fixed), 1)
	}
	if selected < 0 {
		selected = 0
	}
	if top > selected {
		top = selected
	}
	if top < 0 {
		top = 0
	}
	for top < selected && blockHeight(blocks, top, selected) > avail {
		top++
	}

	out := append([]line(nil), fixed...)
	used := 0
	for i := top; i < len(blocks); i++ {
		if i > top && used+len(blocks[i]) > avail {
			break
		}
		out = append(out, blocks[i]...)
		used += len(blocks[i])
	}
	for len(out) > len(fixed) && len(out[len(out)-1]) == 0 {
		out = out[:len(out)-1]
	}

	for i := range out {
		out[i] = clipLine(out[i], usable)
	}
	return out, top
}

func makeHeading(title string, usable int) line {
	heading := ellipsize(title, usable)
	if i := strings.Index(heading, " • "); i >= 0 {
		return line{{text: heading[:i], st: stHeading}, {text: " • ", st: stDim}, {text: heading[i+len(" • "):], st: stSelected}}
	}
	return line{{text: heading, st: stHeading}}
}

func blockHeight(blocks [][]line, from, to int) int {
	n := 0
	for i := from; i <= to && i < len(blocks); i++ {
		n += len(blocks[i])
	}
	return n
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func styleCode(s style) string {
	switch s {
	case stDim:
		return "\033[2m"
	case stHeading:
		return "\033[94m"
	case stMarker:
		return "\033[36m"
	case stSelected, stSelInfo:
		return "\033[1;96m"
	case stGood:
		return "\033[32m"
	case stWarn:
		return "\033[33m"
	case stBad:
		return "\033[31m"
	case stMuted:
		return "\033[90m"
	case stInfo:
		return "\033[36m"
	case stButton:
		return "\033[1;30;46m"
	case stSelGood:
		return "\033[1;92m"
	case stSelWarn:
		return "\033[1;93m"
	case stSelBad:
		return "\033[1;91m"
	case stSelMuted:
		return "\033[1;37m"
	}
	return ""
}

// renderFrame monta uma única string com a tela inteira. Em modo raw o
// terminal não converte "\n" em "\r\n", por isso cada linha termina com "\r\n".
func renderFrame(lines []line, colors bool) string {
	var b strings.Builder
	b.WriteString("\033[H")
	for i, l := range lines {
		for _, s := range l {
			if code := styleCode(s.st); colors && code != "" && s.text != "" {
				b.WriteString(code + s.text + "\033[0m")
			} else {
				b.WriteString(s.text)
			}
		}
		b.WriteString("\033[K")
		if i < len(lines)-1 {
			b.WriteString("\r\n")
		}
	}
	b.WriteString("\033[J")
	return b.String()
}
