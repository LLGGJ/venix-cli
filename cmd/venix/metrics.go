package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/LLGGJ/venix-cli/internal/output"
)

func nested(m map[string]any, keys ...string) map[string]any {
	cur := m
	for _, key := range keys {
		next, ok := cur[key].(map[string]any)
		if !ok {
			return nil
		}
		cur = next
	}
	return cur
}

func metricsStatus(m map[string]any) string {
	if process := nested(m, "apm", "process"); process != nil {
		if s, ok := process["status"].(string); ok && s != "" {
			return s
		}
	}
	if s, ok := m["status"].(string); ok {
		return s
	}
	return ""
}

// mergeMetrics copia status, CPU e memória de uma amostra de métricas para o app.
func mergeMetrics(app, m map[string]any) {
	if status := metricsStatus(m); status != "" {
		app["status"] = status
	}
	if cpu, ok := m["cpu"].(float64); ok {
		app["cpu"] = cpu
	}
	if mem := nested(m, "memory"); mem != nil {
		if used, ok := mem["usage"].(float64); ok {
			app["memory_usage"] = used
		}
	}
}

func formatBytes(b float64) string {
	switch {
	case b >= 1<<30:
		return fmt.Sprintf("%.1f GB", b/(1<<30))
	case b >= 1<<20:
		return fmt.Sprintf("%.0f MB", b/(1<<20))
	}
	return fmt.Sprintf("%.0f KB", b/(1<<10))
}

func formatUptime(seconds float64) string {
	d := time.Duration(seconds) * time.Second
	switch {
	case d >= 24*time.Hour:
		return fmt.Sprintf("%dd %dh", int(d.Hours())/24, int(d.Hours())%24)
	case d >= time.Hour:
		return fmt.Sprintf("%dh %dm", int(d.Hours()), int(d.Minutes())%60)
	case d >= time.Minute:
		return fmt.Sprintf("%dm %ds", int(d.Minutes()), int(d.Seconds())%60)
	}
	return fmt.Sprintf("%ds", int(d.Seconds()))
}

func percentColor(p float64) string {
	switch {
	case p >= 90:
		return "red"
	case p >= 70:
		return "yellow"
	}
	return "green"
}

// formatMetrics transforma uma amostra de métricas em uma linha organizada e colorida.
func formatMetrics(m map[string]any) string {
	var parts []string
	if ts, ok := m["timestamp"].(float64); ok && ts > 0 {
		if ts > 1e12 {
			ts /= 1000
		}
		parts = append(parts, output.Colorize("gray", time.Unix(int64(ts), 0).Local().Format("15:04:05")))
	}
	if status := metricsStatus(m); status != "" {
		label, _ := appStatus(status)
		parts = append(parts, output.Status(label))
	}
	if cpu, ok := m["cpu"].(float64); ok {
		parts = append(parts, output.Colorize("gray", "CPU ")+output.Colorize(percentColor(cpu), fmt.Sprintf("%.1f%%", cpu)))
	}
	if mem := nested(m, "memory"); mem != nil {
		used, _ := mem["usage"].(float64)
		limit, _ := mem["limit"].(float64)
		text := fmt.Sprintf("%.0f MB", used/(1<<20))
		if limit > 0 {
			text = fmt.Sprintf("%.0f/%.0f MB", used/(1<<20), limit/(1<<20))
		}
		percent, ok := mem["percent"].(float64)
		if !ok && limit > 0 {
			percent = used / limit * 100
		}
		parts = append(parts, output.Colorize("gray", "RAM ")+output.Colorize(percentColor(percent), text+fmt.Sprintf(" (%.0f%%)", percent)))
	}
	if net := nested(m, "network"); net != nil {
		rx, _ := net["rx_bytes"].(float64)
		tx, _ := net["tx_bytes"].(float64)
		parts = append(parts, output.Colorize("gray", "rede ")+output.Colorize("cyan", "↓"+formatBytes(rx)+" ↑"+formatBytes(tx)))
	}
	if disk, ok := m["disk_used"].(float64); ok {
		parts = append(parts, output.Colorize("gray", "disco ")+output.Colorize("cyan", formatBytes(disk)))
	}
	if process := nested(m, "apm", "process"); process != nil {
		if up, ok := process["uptime_seconds"].(float64); ok {
			parts = append(parts, output.Colorize("gray", "uptime ")+output.Colorize("cyan", formatUptime(up)))
		}
		if restarts, ok := process["restarts"].(float64); ok {
			parts = append(parts, output.Colorize("gray", "reinícios ")+output.Colorize("cyan", fmt.Sprintf("%.0f", restarts)))
		}
		if runtime, ok := process["runtime"].(string); ok && runtime != "" {
			parts = append(parts, output.Colorize("gray", "runtime ")+output.Colorize("cyan", runtime[strings.LastIndex(runtime, "/")+1:]))
		}
	}
	if latency, ok := nested(m, "apm", "http")["latency_ms"].(float64); ok {
		parts = append(parts, output.Colorize("gray", "HTTP ")+output.Colorize("cyan", fmt.Sprintf("%.0f ms", latency)))
	}
	return strings.Join(parts, "  ")
}

// streamRow converte um evento do stream da instância em uma linha de tela.
// metric indica que a linha veio de métricas (e não de um log de texto).
func streamRow(raw string) (row string, metric bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false
	}
	var text string
	if json.Unmarshal([]byte(trimmed), &text) == nil {
		label, _ := appStatus(text)
		return output.Status(label), true
	}
	var m map[string]any
	if json.Unmarshal([]byte(trimmed), &m) == nil {
		if _, ok := m["cpu"]; ok {
			return formatMetrics(m), true
		}
	}
	return output.FormatLog(logText(raw)), false
}
