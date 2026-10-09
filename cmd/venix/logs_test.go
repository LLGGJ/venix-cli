package main

import "testing"

func TestLogText(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"texto puro", "servidor iniciado", "servidor iniciado"},
		{"json com log e hora", `{"log":"pronto\n","time":"2026-10-08T12:00:00Z"}`, "2026-10-08T12:00:00Z pronto"},
		{"json com message", `{"message":"erro ao conectar"}`, "erro ao conectar"},
		{"json sem campo conhecido", `{"foo":1}`, `{"foo":1}`},
		{"json inválido", `{quebrado`, `{quebrado`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := logText(tt.in); got != tt.want {
				t.Fatalf("logText() = %q, want %q", got, tt.want)
			}
		})
	}
}
