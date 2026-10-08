package menu

import (
	"strings"
	"testing"
)

func sampleApps() []Item {
	return []Item{
		{Title: "api-darck-shop", Status: "ONLINE", Detail: "1024 MB", Tone: ToneGood},
		{Title: "zouder filas", Status: "OFFLINE", Detail: "384 MB", Tone: ToneBad},
		{Title: "tickets", Status: "ONLINE", Detail: "512 MB", Tone: ToneGood},
		{Title: "venix-cloud", Status: "INICIANDO", Detail: "300 MB", Tone: ToneWarn},
	}
}

func plainFrame(lines []line) string {
	parts := make([]string, len(lines))
	for i, l := range lines {
		parts[i] = l.plain()
	}
	return strings.Join(parts, "\n")
}

func TestBuildFrameNeverExceedsWidth(t *testing.T) {
	headers := []string{"NOME", "STATUS", "MEMÓRIA"}
	for _, width := range []int{20, 30, 40, 50, 60, 70, 80, 100, 120} {
		lines, _ := buildFrame("APLICAÇÕES", headers, sampleApps(), 1, 0, width, 30)
		for _, l := range lines {
			if l.width() > width-1 {
				t.Fatalf("largura %d: linha com %d colunas: %q", width, l.width(), l.plain())
			}
		}
		text := plainFrame(lines)
		for _, it := range sampleApps() {
			if width >= 30 && !strings.Contains(text, it.Title) {
				t.Fatalf("largura %d: nome %q ausente:\n%s", width, it.Title, text)
			}
		}
		if strings.Count(text, "❯") != 1 {
			t.Fatalf("largura %d: esperado um cursor:\n%s", width, text)
		}
	}
}

func TestBuildFrameLayouts(t *testing.T) {
	wide, _ := buildFrame("APLICAÇÕES", []string{"NOME", "STATUS", "MEMÓRIA"}, sampleApps(), 0, 0, 100, 30)
	if !strings.Contains(plainFrame(wide), "MEMÓRIA") {
		t.Fatalf("terminal largo deveria usar tabela:\n%s", plainFrame(wide))
	}
	narrow, _ := buildFrame("APLICAÇÕES", []string{"NOME", "STATUS", "MEMÓRIA"}, sampleApps(), 0, 0, 30, 30)
	text := plainFrame(narrow)
	if strings.Contains(text, "MEMÓRIA") || !strings.Contains(text, "● ONLINE • 1024 MB") {
		t.Fatalf("terminal estreito deveria empilhar:\n%s", text)
	}
}

func TestBuildFrameWrapsLongNames(t *testing.T) {
	items := []Item{{Title: "zouder-aplicacao-muito-longa-de-producao", Status: "ONLINE", Detail: "512 MB"}}
	lines, _ := buildFrame("APLICAÇÕES", nil, items, 0, 0, 30, 30)
	for _, l := range lines {
		if l.width() > 29 {
			t.Fatalf("linha larga demais: %q", l.plain())
		}
	}
	joined := strings.ReplaceAll(plainFrame(lines), "\n  ", "")
	if !strings.Contains(joined, "zouder-aplicacao-muito-longa-de-producao") {
		t.Fatalf("nome deveria ser preservado por quebra:\n%s", plainFrame(lines))
	}
}

func TestBuildFrameScrollsToSelected(t *testing.T) {
	var items []Item
	for i := 0; i < 20; i++ {
		items = append(items, Item{Title: strings.Repeat("a", i+1)})
	}
	lines, top := buildFrame("T", nil, items, 15, 0, 40, 10)
	if len(lines) > 10 {
		t.Fatalf("esperado no máximo 10 linhas, veio %d", len(lines))
	}
	if top == 0 || !strings.Contains(plainFrame(lines), "❯ "+strings.Repeat("a", 16)) {
		t.Fatalf("item selecionado deveria estar visível:\n%s", plainFrame(lines))
	}
}

func TestRenderFrameUsesCarriageReturn(t *testing.T) {
	out := renderFrame([]line{{{text: "a"}}, {{text: "b"}}}, false)
	if !strings.Contains(out, "\r\n") || strings.Contains(strings.ReplaceAll(out, "\r\n", ""), "\n") {
		t.Fatalf("todas as quebras devem ser \\r\\n em modo raw: %q", out)
	}
}

func findSeg(lines []line, text string) (seg, bool) {
	for _, l := range lines {
		for _, s := range l {
			if s.text == text {
				return s, true
			}
		}
	}
	return seg{}, false
}

func TestTitleStyles(t *testing.T) {
	items := []Item{{Title: "Reiniciar", Tone: ToneWarn}, {Title: "Excluir", Tone: ToneBad}}
	lines, _ := buildFrame("AÇÕES • api", nil, items, 1, 0, 60, 20)
	if s, ok := findSeg(lines, "Reiniciar"); !ok || s.st != stWarn {
		t.Fatalf("ação não selecionada deveria usar a cor do tom: %+v", s)
	}
	if s, ok := findSeg(lines, "Excluir"); !ok || s.st != stSelBad {
		t.Fatalf("ação selecionada deveria usar o tom em negrito: %+v", s)
	}
	if s, ok := findSeg(lines, "api"); !ok || s.st != stSelected {
		t.Fatalf("nome do app no cabeçalho deveria ser colorido: %+v", s)
	}
}

func TestSelectedAppNameIsColored(t *testing.T) {
	lines, _ := buildFrame("APLICAÇÕES", nil, sampleApps(), 0, 0, 100, 30)
	found := false
	for _, l := range lines {
		for _, s := range l {
			if strings.HasPrefix(s.text, "api-darck-shop") && s.st == stSelected {
				found = true
			}
		}
	}
	if !found {
		t.Fatalf("app selecionado deveria usar stSelected:\n%s", plainFrame(lines))
	}
}
