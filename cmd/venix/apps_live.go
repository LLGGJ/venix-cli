package main

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/LLGGJ/venix-cli/internal/api"
	"github.com/LLGGJ/venix-cli/internal/menu"
)

// appsFeed carrega as aplicações (status, CPU e memória) para o menu ao vivo do
// `venix apps`, com cuidado para não estourar o limite de requisições da API.
type appsFeed struct {
	client       *api.Client
	mu           sync.Mutex
	apps         map[string]map[string]any
	statusOK     bool
	metrics      map[string]map[string]any
	metricsAt    time.Time
	backoffUntil time.Time
}

var (
	cpuKeys         = []string{"cpu", "cpu_usage", "cpuUsage", "cpu_percent"}
	memoryUsageKeys = []string{"memory_usage", "ram_usage", "memory_used", "ram_used", "memoryUsage"}
)

// load devolve a lista atual. Sem force, durante uma pausa por limite de
// requisições (HTTP 429) não chama a API e devolve nil.
func (f *appsFeed) load(force bool) ([]menu.Item, error) {
	f.mu.Lock()
	waiting := time.Now().Before(f.backoffUntil)
	f.mu.Unlock()
	if waiting && !force {
		return nil, nil
	}
	me, err := f.client.GetMe()
	if err != nil {
		f.noteRateLimit(err)
		return nil, err
	}
	apps := applications(me)
	f.enrich(apps)

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

func (f *appsFeed) noteRateLimit(err error) {
	if err != nil && strings.Contains(err.Error(), "HTTP_429") {
		f.mu.Lock()
		f.backoffUntil = time.Now().Add(30 * time.Second)
		f.mu.Unlock()
	}
}

// enrich completa as aplicações com status (endpoint de status) e com CPU,
// memória e status lidos do stream de cada instância. As métricas são
// atualizadas no máximo a cada 20 segundos para poupar a API.
func (f *appsFeed) enrich(apps []map[string]any) {
	f.mu.Lock()
	tryStatus := f.statusOK
	stale := time.Since(f.metricsAt) > 20*time.Second
	f.mu.Unlock()
	if tryStatus {
		if status, err := f.client.AppsStatus(); err == nil {
			mergeStatus(apps, status)
		} else if strings.Contains(err.Error(), "HTTP_429") {
			f.noteRateLimit(err)
		} else {
			f.mu.Lock()
			f.statusOK = false
			f.mu.Unlock()
		}
	}
	if stale {
		fresh := f.fetchMetrics(apps)
		f.mu.Lock()
		f.metrics = fresh
		f.metricsAt = time.Now()
		f.mu.Unlock()
	}
	f.mu.Lock()
	cached := f.metrics
	f.mu.Unlock()
	for _, app := range apps {
		if m := cached[fmt.Sprint(app["id"])]; m != nil {
			mergeMetrics(app, m)
		}
	}
}

func (f *appsFeed) fetchMetrics(apps []map[string]any) map[string]map[string]any {
	fresh := map[string]map[string]any{}
	var mu sync.Mutex
	var wg sync.WaitGroup
	slots := make(chan struct{}, 3)
	for _, app := range apps {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			m, err := f.client.Metrics(id)
			if err != nil {
				f.noteRateLimit(err)
				return
			}
			if m != nil {
				mu.Lock()
				fresh[id] = m
				mu.Unlock()
			}
		}(fmt.Sprint(app["id"]))
	}
	wg.Wait()
	return fresh
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

// mergeKeys são os únicos campos que o endpoint de status pode copiar para o app
// (assim ele nunca sobrescreve nome, id ou limites de memória).
var mergeKeys = func() map[string]bool {
	keys := map[string]bool{}
	for _, list := range [][]string{statusKeys, boolStatusKeys, cpuKeys, memoryUsageKeys, {"uptime", "uptime_seconds"}} {
		for _, key := range list {
			keys[key] = true
		}
	}
	return keys
}()

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

// mergeStatus copia para cada app apenas os campos de status/uso do endpoint de status.
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
				if v != nil && mergeKeys[k] {
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

// memoryLimit devolve o limite de memória em MB ("-" se desconhecido).
func memoryLimit(app map[string]any) string {
	if v := numberValue(app, "max_ram", "maxRam", "ram_limit", "memory_limit"); v >= 0 {
		return formatMB(v)
	}
	for _, key := range []string{"ram", "memory"} {
		switch v := app[key].(type) {
		case float64:
			return formatMB(v)
		case string:
			if f, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
				return formatMB(f)
			}
		}
	}
	return "-"
}

// appUsage monta "CPU 12% • 256/1024 MB" com o que a API informar; sem
// métricas de uso mostra só o limite de memória.
func appUsage(app map[string]any) string {
	limit := memoryLimit(app)
	cpu := numberValue(app, cpuKeys...)
	used := numberValue(app, memoryUsageKeys...)
	var parts []string
	if cpu >= 0 {
		if cpu < 10 {
			parts = append(parts, fmt.Sprintf("CPU %.1f%%", cpu))
		} else {
			parts = append(parts, fmt.Sprintf("CPU %.0f%%", cpu))
		}
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
