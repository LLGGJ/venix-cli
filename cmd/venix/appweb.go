package main

import (
	"net/url"
	"strings"

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

// printAppDetails mostra os dados da aplicação como texto, sem JSON.
func printAppDetails(app map[string]any) {
	label, _ := appStatus(statusRaw(app))
	rows := [][2]string{
		{"Nome", appValue(app, "name", "appName")},
		{"ID", appValue(app, "id")},
		{"Status", label},
		{"Endereço", webURL(app)},
		{"Domínio", appValue(app, "domain", "custom_domain", "customDomain", "subdomain")},
		{"Rota", appValue(app, "route", "base_path", "basePath", "web_path")},
		{"Memória", appUsage(app)},
		{"Runtime", appValue(app, "runtime", "language")},
		{"Arquivo inicial", appValue(app, "start", "start_file", "startFile", "main")},
		{"Criado em", appValue(app, "created_at", "createdAt", "created")},
	}
	output.Heading("🔎 DETALHES • " + appValue(app, "name", "appName"))
	for _, row := range rows {
		if row[1] == "" || row[1] == "-" {
			continue
		}
		output.Field(row[0], row[1], 17)
	}
}
