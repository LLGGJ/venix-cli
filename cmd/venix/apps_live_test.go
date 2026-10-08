package main

import "testing"

func TestAppUsage(t *testing.T) {
	tests := []struct {
		name string
		app  map[string]any
		want string
	}{
		{"só limite", map[string]any{"max_ram": float64(512)}, "512 MB"},
		{"cpu e memória", map[string]any{"max_ram": float64(1024), "cpu": 12.4, "memory_usage": float64(256)}, "CPU 12% • 256/1024 MB"},
		{"memória em bytes", map[string]any{"max_ram": float64(1024), "ram_usage": float64(268435456)}, "256/1024 MB"},
		{"texto com porcento", map[string]any{"cpu_usage": "7%"}, "CPU 7%"},
		{"sem dados", map[string]any{}, "-"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := appUsage(tt.app); got != tt.want {
				t.Fatalf("appUsage() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestMergeStatus(t *testing.T) {
	apps := []map[string]any{{"id": "a1", "name": "api"}, {"id": "b2", "name": "bot"}}
	status := map[string]any{"apps": []any{map[string]any{"id": "a1", "status": "online", "cpu": float64(3)}}}
	mergeStatus(apps, status)
	if apps[0]["status"] != "online" || apps[0]["cpu"] != float64(3) {
		t.Fatalf("status não mesclado: %v", apps[0])
	}
	if _, ok := apps[1]["status"]; ok {
		t.Fatalf("app sem status não deve ser alterado: %v", apps[1])
	}
}

func TestStatusRaw(t *testing.T) {
	tests := []struct {
		name string
		app  map[string]any
		want string
	}{
		{"texto", map[string]any{"status": "running"}, "running"},
		{"booleano", map[string]any{"running": true}, "online"},
		{"objeto", map[string]any{"state": map[string]any{"status": "stopped"}}, "stopped"},
		{"ausente", map[string]any{"name": "x"}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := statusRaw(tt.app); got != tt.want {
				t.Fatalf("statusRaw() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestMergeStatusShapes(t *testing.T) {
	apps := []map[string]any{{"id": "a1", "name": "api"}, {"id": "b2", "name": "bot"}}
	mergeStatus(apps, map[string]any{"statuses": map[string]any{"a1": "online", "bot": false}})
	if statusRaw(apps[0]) != "online" || statusRaw(apps[1]) != "offline" {
		t.Fatalf("status por id/nome não mesclado: %v %v", apps[0], apps[1])
	}
}
