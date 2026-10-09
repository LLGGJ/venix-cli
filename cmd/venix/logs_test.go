package main

import (
	"errors"
	"strings"
	"testing"
)

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

const sampleMetrics = `{"cpu":1.55,"memory":{"usage":122003456,"limit":1073741824,"percent":11.36},"network":{"rx_bytes":25420403,"tx_bytes":24948304},"apm":{"process":{"status":"online","restarts":0,"uptime_seconds":474878,"runtime":"venixcloud/nodejs:22.22.0"},"http":{"latency_ms":11.5}},"disk_used":274186240,"status":"running","timestamp":1791581202143}`

func TestStreamRowMetrics(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	row, metric := streamRow(sampleMetrics)
	if !metric {
		t.Fatal("amostra de métricas deveria ser marcada como métrica")
	}
	for _, want := range []string{"ONLINE", "CPU 1.6%", "RAM 116/1024 MB (11%)", "↓24 MB ↑24 MB", "disco 261 MB", "uptime 5d 11h", "reinícios 0", "runtime nodejs:22.22.0", "HTTP 12 ms"} {
		if !strings.Contains(row, want) {
			t.Fatalf("faltou %q em %q", want, row)
		}
	}
}

func TestStreamRowStatusAndText(t *testing.T) {
	t.Setenv("NO_COLOR", "1")
	if row, metric := streamRow(`"RUNNING"`); row != "ONLINE" || !metric {
		t.Fatalf("status = %q, %v", row, metric)
	}
	if row, metric := streamRow("servidor iniciado"); row != "servidor iniciado" || metric {
		t.Fatalf("texto = %q, %v", row, metric)
	}
	if row, _ := streamRow("   "); row != "" {
		t.Fatalf("linha vazia deveria sumir, veio %q", row)
	}
}

func TestMergeMetrics(t *testing.T) {
	app := map[string]any{"id": "a1", "max_ram": float64(1024)}
	mergeMetrics(app, map[string]any{"cpu": 2.5, "memory": map[string]any{"usage": float64(104857600)}, "status": "running"})
	if got := appUsage(app); got != "CPU 2.5% • 100/1024 MB" {
		t.Fatalf("appUsage = %q", got)
	}
	if label, _ := appStatus(statusRaw(app)); label != "ONLINE" {
		t.Fatalf("status = %q", label)
	}
}

func TestReportErrorKinds(t *testing.T) {
	if !isAuthError(errNotLoggedIn) || !isAuthError(errors.New("UNAUTHORIZED")) || isAuthError(errors.New("HTTP_500")) {
		t.Fatal("isAuthError classificou errado")
	}
	if !isNetworkError("dial tcp: lookup api: no such host") || isNetworkError("HTTP_404") {
		t.Fatal("isNetworkError classificou errado")
	}
}
