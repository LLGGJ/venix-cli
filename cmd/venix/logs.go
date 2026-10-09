package main

import (
	"encoding/json"
	"strings"
)

var (
	logTextKeys = []string{"log", "message", "msg", "line", "text", "data"}
	logTimeKeys = []string{"time", "timestamp", "ts", "@timestamp"}
)

// logText extrai o texto de logs em JSON (ex.: {"log":"...","time":"..."}).
// Linhas que não são JSON, ou sem campo de texto conhecido, voltam como vieram.
func logText(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if !strings.HasPrefix(trimmed, "{") {
		return raw
	}
	var m map[string]any
	if json.Unmarshal([]byte(trimmed), &m) != nil {
		return raw
	}
	for _, key := range logTextKeys {
		text, ok := m[key].(string)
		if !ok || strings.TrimSpace(text) == "" {
			continue
		}
		text = strings.TrimRight(text, "\r\n")
		for _, timeKey := range logTimeKeys {
			if ts, ok := m[timeKey].(string); ok && ts != "" {
				return ts + " " + text
			}
		}
		return text
	}
	return raw
}
