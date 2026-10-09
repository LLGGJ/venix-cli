package menu

import (
	"strings"
	"testing"
)

func stripANSI(s string) string {
	var b strings.Builder
	runes := []rune(s)
	for i := 0; i < len(runes); i++ {
		if runes[i] == 0x1b {
			for i < len(runes) && runes[i] != 'm' {
				i++
			}
			continue
		}
		b.WriteRune(runes[i])
	}
	return b.String()
}

func TestWrapANSIKeepsWidthAndColor(t *testing.T) {
	in := "\033[31m" + strings.Repeat("x", 25) + "\033[0m"
	lines := wrapANSI(in, 10, 2)
	if len(lines) < 3 {
		t.Fatalf("esperado ao menos 3 linhas, veio %d: %q", len(lines), lines)
	}
	for i, l := range lines {
		if w := runeLen(stripANSI(l)); w > 10 {
			t.Fatalf("linha %d com %d colunas: %q", i, w, l)
		}
		if i > 0 && !strings.HasPrefix(l, "\033[31m") {
			t.Fatalf("continuação deveria manter a cor: %q", l)
		}
	}
	if got := strings.ReplaceAll(stripANSI(strings.Join(lines, "")), " ", ""); got != strings.Repeat("x", 25) {
		t.Fatalf("texto perdido: %q", got)
	}
}

func TestWrapANSIDropsControlChars(t *testing.T) {
	lines := wrapANSI("ok\r\x07 fim", 20, 2)
	if len(lines) != 1 || stripANSI(lines[0]) != "ok fim" {
		t.Fatalf("resultado inesperado: %q", lines)
	}
}
