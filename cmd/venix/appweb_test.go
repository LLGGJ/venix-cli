package main

import "testing"

func TestWebURL(t *testing.T) {
	tests := []struct {
		name string
		app  map[string]any
		want string
	}{
		{"url completa", map[string]any{"url": "https://api.exemplo.com/v1"}, "https://api.exemplo.com/v1"},
		{"domínio sem esquema", map[string]any{"domain": "bot.exemplo.com"}, "https://bot.exemplo.com"},
		{"domínio com rota", map[string]any{"domain": "bot.exemplo.com", "route": "painel"}, "https://bot.exemplo.com/painel"},
		{"rota não sobrescreve caminho da url", map[string]any{"url": "https://a.exemplo.com/x", "route": "y"}, "https://a.exemplo.com/x"},
		{"subdomínio solto não é endereço", map[string]any{"domain": "meuapp"}, ""},
		{"sem endereço", map[string]any{"name": "x"}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := webURL(tt.app); got != tt.want {
				t.Fatalf("webURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
