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

// mergeStatus copia para cada app os campos do endpoint de status (mesmo id).
func mergeStatus(apps []map[string]any, status map[string]any) {
	byID := map[string]map[string]any{}
	for _, key := range []string{"apps", "applications", "data"} {
		if list, ok := status[key].([]any); ok {
			for _, value := range list {
				if m, ok := value.(map[string]any); ok {
					byID[fmt.Sprint(m["id"])] = m
				}
			}
		}
	}
	if len(byID) == 0 {
		for id, value := range status {
			if m, ok := value.(map[string]any); ok {
				byID[id] = m
			}
		}
	}
	for _, app := range apps {
		if extra, ok := byID[fmt.Sprint(app["id"])]; ok {
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
