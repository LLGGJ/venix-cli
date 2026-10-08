package main

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/LLGGJ/venix-cli/internal/api"
	"github.com/LLGGJ/venix-cli/internal/menu"
)

// appsFeed carrega as aplicações (e, se a API oferecer, o status detalhado)
// para o menu ao vivo do `venix apps`.
type appsFeed struct {
	client   *api.Client
	mu       sync.Mutex
	apps     map[string]map[string]any
	statusOK bool
}

func (f *appsFeed) load() ([]menu.Item, error) {
	me, err := f.client.GetMe()
	if err != nil {
		return nil, err
	}
	apps := applications(me)

	f.mu.Lock()
	tryStatus := f.statusOK
	f.mu.Unlock()
	if tryStatus {
		if status, err := f.client.AppsStatus(); err == nil {
			mergeStatus(apps, status)
		} else {
			f.mu.Lock()
			f.statusOK = false
			f.mu.Unlock()
		}
	}

	byID := make(map[string]map[string]any, len(apps))
	items := make([]menu.Item, len(apps))
	for i, app := range apps {
		items[i] = appItem(app)
		byID[items[i].ID] = app
	}
	f.mu.Lock()
	f.apps = byID
	f.mu.Unlock()
	return items, nil
}

func (f *appsFeed) app(id string) map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.apps[id]
}

func idOf(m map[string]any) string {
	for _, key := range []string{"id", "appId", "app_id", "_id"} {
		if v, ok := m[key]; ok && v != nil && fmt.Sprint(v) != "" {
			return fmt.Sprint(v)
		}
	}
	return ""
}

var statusKeys = []string{"status", "state", "app_status", "appStatus", "container_status", "instance_status", "instanceStatus"}
var boolStatusKeys = []string{"running", "is_running", "isRunning", "online", "is_online", "isOnline", "active"}

func hasStatus(m map[string]any) bool {
	for _, key := range append(append([]string{}, statusKeys...), boolStatusKeys...) {
		if _, ok := m[key]; ok {
			return true
		}
	}
	return false
}

// statusRaw extrai o status de uma aplicação, aceitando textos, booleanos e objetos aninhados.
func statusRaw(app map[string]any) string {
	for _, key := range statusKeys {
		switch v := app[key].(type) {
		case string:
			if v != "" {
				return v
			}
		case bool:
			if v {
				return "online"
			}
			return "offline"
		case map[string]any:
			for _, inner := range []string{"status", "state", "name"} {
				if text, ok := v[inner].(string); ok && text != "" {
					return text
				}
			}
		}
	}
	for _, key := range boolStatusKeys {
		if v, ok := app[key].(bool); ok {
			if v {
				return "online"
			}
			return "offline"
		}
	}
	return ""
}

// collectStatus indexa, por id (ou nome), os objetos de status devolvidos pela API.
func collectStatus(value any, byKey map[string]map[string]any, depth int) {
	switch v := value.(type) {
	case []any:
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				if id := idOf(m); id != "" {
					byKey[id] = m
				}
				if name, ok := m["name"].(string); ok && name != "" {
					byKey[name] = m
				}
			}
		}
	case map[string]any:
		for key, item := range v {
			switch x := item.(type) {
			case string:
				byKey[key] = map[string]any{"status": x}
			case bool:
				byKey[key] = map[string]any{"running": x}
			case map[string]any:
				if hasStatus(x) {
					byKey[key] = x
				} else if depth < 2 {
					collectStatus(x, byKey, depth+1)
				}
			case []any:
				if depth < 2 {
					collectStatus(x, byKey, depth+1)
				}
			}
		}
	}
}

// mergeStatus copia para cada app os campos do endpoint de status (mesmo id ou nome).
func mergeStatus(apps []map[string]any, status map[string]any) {
	byKey := map[string]map[string]any{}
	collectStatus(status, byKey, 0)
	for _, app := range apps {
		extra, ok := byKey[fmt.Sprint(app["id"])]
		if !ok {
			extra, ok = byKey[fmt.Sprint(app["name"])]
		}
		if ok {
			for k, v := range extra {
				if v != nil {
					app[k] = v
				}
			}
		}
	}
}

func numberValue(app map[string]any, keys ...string) float64 {
	for _, key := range keys {
		switch v := app[key].(type) {
		case float64:
			return v
		case string:
			if f, err := strconv.ParseFloat(strings.TrimSuffix(strings.TrimSpace(v), "%"), 64); err == nil {
				return f
			}
		}
	}
	return -1
}

func formatMB(v float64) string {
	if v > 1<<20 {
		v /= 1 << 20
	}
	return strconv.FormatFloat(v, 'f', 0, 64)
}

// appUsage monta "CPU 12% • 256/1024 MB" com o que a API informar; sem
// métricas de uso mostra só o limite de memória.
func appUsage(app map[string]any) string {
	limit := appValue(app, "max_ram", "ram", "memory")
	cpu := numberValue(app, "cpu", "cpu_usage", "cpuUsage", "cpu_percent")
	used := numberValue(app, "memory_usage", "ram_usage", "memory_used", "ram_used", "memoryUsage")
	var parts []string
	if cpu >= 0 {
		parts = append(parts, fmt.Sprintf("CPU %.0f%%", cpu))
	}
	switch {
	case used >= 0 && limit != "-":
		parts = append(parts, formatMB(used)+"/"+limit+" MB")
	case used >= 0:
		parts = append(parts, formatMB(used)+" MB")
	case limit != "-":
		parts = append(parts, limit+" MB")
	}
	if len(parts) == 0 {
		return "-"
	}
	return strings.Join(parts, " • ")
}
