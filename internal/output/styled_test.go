package output

import (
	"strings"
	"testing"
)

func TestColorJSONWithoutColorIsIdentity(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	in := "{\n  \"name\": \"api\",\n  \"ram\": 512,\n  \"on\": true,\n  \"tags\": [\n    \"a\",\n    \"b\"\n  ]\n}"
	if got := ColorJSON([]byte(in)); got != in {
		t.Fatalf("sem cor o JSON deve permanecer igual:\n%s", got)
	}
}

func TestColorJSONColors(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm-256color")
	got := ColorJSON([]byte("{\n  \"name\": \"api\",\n  \"ram\": 512\n}"))
	for _, want := range []string{cyan + "\"name\"" + reset, green + "\"api\"" + reset, yellow + "512" + reset} {
		if !strings.Contains(got, want) {
			t.Fatalf("faltou %q em:\n%q", want, got)
		}
	}
}

func TestFormatLogStripsEverythingWithoutColor(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	in := "\x1b[31m2026-10-08 12:00:01\x1b[0m INFO listening on https://exemplo.com port=8080\r"
	want := "2026-10-08 12:00:01 INFO listening on https://exemplo.com port=8080"
	if got := FormatLog(in); got != want {
		t.Fatalf("FormatLog() = %q, want %q", got, want)
	}
	if got := FormatLog("   \r\n"); got != "" {
		t.Fatalf("linha vazia deveria devolver vazio, veio %q", got)
	}
}

func TestFormatLogColors(t *testing.T) {
	t.Setenv("NO_COLOR", "")
	t.Setenv("TERM", "xterm-256color")
	if got := FormatLog("2026-10-08 12:00:01 ERROR falhou"); !strings.Contains(got, red+"ERROR falhou"+reset) || !strings.Contains(got, gray+"2026-10-08 12:00:01"+reset) {
		t.Fatalf("erro deveria ficar vermelho com timestamp cinza: %q", got)
	}
	got := FormatLog(`INFO listening on https://x.io key="v" took 12ms`)
	for _, want := range []string{cyan + "INFO" + reset, blue + "https://x.io" + reset, green + `"v"` + reset, yellow + "12ms" + reset} {
		if !strings.Contains(got, want) {
			t.Fatalf("faltou %q em %q", want, got)
		}
	}
}
