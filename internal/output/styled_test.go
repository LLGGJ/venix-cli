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
