package menu

import (
	"strings"
	"testing"
)

func TestReadKey(t *testing.T) {
	tests := []struct {
		name string
		data string
		want string
	}{
		{name: "seta para cima", data: "\x1b[A", want: "up"},
		{name: "seta para baixo", data: "\x1b[B", want: "down"},
		{name: "enter", data: "\r", want: "enter"},
		{name: "escape", data: "\x1b", want: "esc"},
		{name: "sair", data: "q", want: "q"},
		{name: "seta modo aplicação", data: "\x1bOA", want: "up"},
		{name: "j desce", data: "j", want: "down"},
		{name: "k sobe", data: "k", want: "up"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := readKey(strings.NewReader(tt.data))
			if err != nil {
				t.Fatalf("readKey() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("readKey() = %q, want %q", got, tt.want)
			}
		})
	}
}
