package main

import (
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/LLGGJ/venix-cli/internal/output"
)

// webURL monta o endereço web exato da aplicação (domínio + rota). Devolve ""
// quando a API não informa um domínio completo.
func webURL(app map[string]any) string {
	raw := appValue(app, "url", "appUrl", "app_url", "public_url", "publicUrl", "web_url", "webUrl", "domain", "custom_domain", "customDomain")
	if raw == "-" {
		return ""
	}
	if !strings.Contains(raw, "://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || !strings.Contains(u.Host, ".") {
		return ""
	}
	if route := appValue(app, "route", "base_path", "basePath", "web_path"); route != "-" && (u.Path == "" || u.Path == "/") {
		u.Path = "/" + strings.TrimLeft(route, "/")
	}
	return u.String()
}

func formatDate(raw string) string {
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.Local().Format("02/01/2006 15:04")
	}
	return raw
}

func printSection(title string, rows [][2]string) {
	var shown [][2]string
	for _, row := range rows {
		if row[1] != "" && row[1] != "-" {
			shown = append(shown, row)
		}
	}
	if len(shown) == 0 {
		return
	}
	output.Section(title)
	for _, row := range shown {
		output.Field(row[0], row[1], 14)
	}
}

// printAppDetails mostra os dados da aplicação como texto, separados em seções.
func printAppDetails(app map[string]any) {
	name := appValue(app, "name", "appName")
	label, _ := appStatus(statusRaw(app))
	output.Heading("🔎 DETALHES • " + name)
	output.Muted(strings.Repeat("─", 32))

	printSection("APLICAÇÃO", [][2]string{
		{"Nome", name},
		{"ID", appValue(app, "id")},
		{"Status", output.Status(label)},
		{"Criado em", formatDate(appValue(app, "created_at", "createdAt", "created"))},
		{"Runtime", appValue(app, "runtime", "language")},
		{"Arquivo inicial", appValue(app, "start", "start_file", "startFile", "main")},
	})
	printSection("ENDEREÇO", [][2]string{
		{"URL", webURL(app)},
		{"Domínio", appValue(app, "domain", "custom_domain", "customDomain", "subdomain")},
		{"Rota", appValue(app, "route", "base_path", "basePath", "web_path")},
	})

	var resources [][2]string
	if cpu := numberValue(app, cpuKeys...); cpu >= 0 {
		resources = append(resources, [2]string{"CPU", fmt.Sprintf("%.1f%%", cpu)})
	}
	limit := memoryLimit(app)
	if used := numberValue(app, memoryUsageKeys...); used >= 0 {
		text := formatMB(used) + " MB"
		if limit != "-" {
			text = formatMB(used) + " de " + limit + " MB"
		}
		resources = append(resources, [2]string{"Memória", text})
	} else if limit != "-" {
		resources = append(resources, [2]string{"Limite de RAM", limit + " MB"})
	}
	printSection("RECURSOS", resources)
	fmt.Println()
}
