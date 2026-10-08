package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/LLGGJ/venix-cli/internal/api"
	"github.com/LLGGJ/venix-cli/internal/menu"
	"github.com/LLGGJ/venix-cli/internal/output"
	"github.com/LLGGJ/venix-cli/internal/store"
	"github.com/LLGGJ/venix-cli/internal/zipper"
	"github.com/spf13/cobra"
)

func client() (*api.Client, error) {
	c, e := store.Creds()
	if e != nil {
		return nil, fmt.Errorf("não logado; use venix login")
	}
	return api.New(c.AccessToken), nil
}
func appsCmd() *cobra.Command {
	var jsonOutput bool
	c := &cobra.Command{Use: "apps", Short: "Lista aplicações e status", RunE: func(*cobra.Command, []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		spinner := output.StartSpinner("Carregando aplicações")
		m, e := c.GetMe()
		spinner.Stop()
		if e != nil {
			return e
		}
		if jsonOutput {
			return output.JSON(true, m)
		}
		apps := applications(m)
		if len(apps) == 0 {
			output.Warning("Nenhuma aplicação encontrada.")
			return nil
		}
		if !menu.IsTerminal() {
			printApps(apps)
			return nil
		}
		feed := &appsFeed{client: c, statusOK: true}
		for {
			items, e := feed.load()
			if e != nil {
				return e
			}
			if len(items) == 0 {
				output.Warning("Nenhuma aplicação encontrada.")
				return nil
			}
			item, ok, e := menu.SelectLive("APLICAÇÕES • ao vivo", []string{"NOME", "STATUS", "USO"}, items, 5*time.Second, feed.load)
			if e != nil || !ok {
				return e
			}
			app := feed.app(item.ID)
			if app == nil {
				continue
			}
			if e = appActions(c, app); e != nil {
				return e
			}
		}
	}}
	c.Flags().BoolVar(&jsonOutput, "json", false, "imprime JSON para automação")
	return c
}

func applications(me map[string]any) []map[string]any {
	var result []map[string]any
	if values, ok := me["applications"].([]any); ok {
		for _, value := range values {
			if app, ok := value.(map[string]any); ok {
				result = append(result, app)
			}
		}
	}
	return result
}

func appValue(app map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := app[key]; ok && value != nil && fmt.Sprint(value) != "" {
			return fmt.Sprint(value)
		}
	}
	return "-"
}

func appItem(app map[string]any) menu.Item {
	label, tone := appStatus(statusRaw(app))
	id := appValue(app, "id")
	if id == "-" {
		id = ""
	}
	return menu.Item{Title: appValue(app, "name", "appName"), Status: label, Detail: appUsage(app), ID: id, Tone: tone}
}

func appStatus(raw string) (string, menu.Tone) {
	value := strings.ToUpper(strings.TrimSpace(raw))
	switch value {
	case "ONLINE", "RUNNING", "ACTIVE", "STARTED", "UP", "HEALTHY":
		return "ONLINE", menu.ToneGood
	case "OFFLINE", "STOPPED", "DOWN", "EXITED", "PAUSED", "SUSPENDED":
		return "OFFLINE", menu.ToneBad
	case "STARTING", "DEPLOYING", "BUILDING", "RESTARTING":
		return "INICIANDO", menu.ToneWarn
	case "STOPPING":
		return "PARANDO", menu.ToneWarn
	case "ERROR", "FAILED", "CRASHED":
		return "ERRO", menu.ToneBad
	case "", "-":
		return "N/D", menu.ToneMuted
	}
	return value, menu.ToneMuted
}

func appURL(app map[string]any) string {
	return appValue(app, "url", "appUrl", "app_url", "dashboard_url", "domain")
}

func printApps(apps []map[string]any) {
	output.Heading("APLICAÇÕES")
	output.Muted(fmt.Sprintf("%-24s  %-10s  %s", "NOME", "STATUS", "USO"))
	for _, app := range apps {
		label, _ := appStatus(statusRaw(app))
		pad := strings.Repeat(" ", max(0, 10-len([]rune(label))))
		memory := appUsage(app)
		fmt.Printf("%-24s  %s%s  %s\n", appValue(app, "name", "appName"), output.Status(label), pad, memory)
		if url := appURL(app); url != "-" {
			output.Link("  ↳", url)
		}
	}
}

func appActions(c *api.Client, app map[string]any) error {
	id := appValue(app, "id")
	name := appValue(app, "name", "appName")
	items := []menu.Item{
		{Title: "📜 Ver logs", Tone: menu.ToneInfo},
		{Title: "🔄 Reiniciar", Tone: menu.ToneWarn},
		{Title: "⚡ Iniciar", Tone: menu.ToneGood},
		{Title: "🛑 Parar", Tone: menu.ToneBad},
		{Title: "💾 Criar backup", Tone: menu.ToneInfo},
		{Title: "🚀 Fazer deploy", Tone: menu.ToneGood},
		{Title: "❌ Excluir", Tone: menu.ToneBad},
		{Title: "🔙 Voltar", Tone: menu.ToneMuted},
	}
	for {
		selected, e := menu.SelectItems("AÇÕES • "+name, nil, items)
		if e != nil || selected < 0 || selected == len(items)-1 {
			return e
		}
		switch selected {
		case 0:
			output.Heading("LOGS • " + name)
			output.Muted("Carregando logs recentes...")
			e = c.StreamLogs(id, false, output.Log)
		case 1, 2, 3:
			actions := []string{"RESTART", "START", "STOP"}
			if _, e = c.AppAction(id, actions[selected-1]); e == nil {
				output.Success([]string{"Reiniciado", "Iniciado", "Parado"}[selected-1] + ": " + name)
			}
		case 4:
			if _, e = c.Snapshot(id, "backup-"+time.Now().Format("20060102-150405")); e == nil {
				output.Success("Backup criado: " + name)
			}
		case 5:
			if _, e = c.Deploy(id); e == nil {
				output.Success("Deploy disparado: " + name)
			}
		case 6:
			if _, e = c.Remove(id); e == nil {
				output.Success("Aplicação excluída: " + name)
				return menu.Button("Voltar")
			}
		}
		if e != nil {
			return e
		}
		if e = menu.Button("Voltar"); e != nil {
			return e
		}
	}
}
func getApp(c *api.Client, ref string) (map[string]any, error) {
	m, e := c.GetMe()
	if e != nil {
		return nil, e
	}
	arr, _ := m["applications"].([]any)
	if ref == "" {
		if l, e := store.Link("."); e == nil {
			ref = fmt.Sprint(l["id"])
		}
	}
	for _, x := range arr {
		a, _ := x.(map[string]any)
		if fmt.Sprint(a["id"]) == ref || strings.EqualFold(fmt.Sprint(a["name"]), ref) {
			return a, nil
		}
	}
	return nil, fmt.Errorf("aplicação não encontrada: %s", ref)
}
func action(name, verb string) *cobra.Command {
	return &cobra.Command{Use: name + " [app]", Short: verb, Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		ref := ""
		if len(args) > 0 {
			ref = args[0]
		}
		a, e := getApp(c, ref)
		if e != nil {
			return e
		}
		spinner := output.StartSpinner(verb)
		_, e = c.AppAction(fmt.Sprint(a["id"]), strings.ToUpper(name))
		spinner.Stop()
		if e == nil {
			output.Success(fmt.Sprintf("%s: %s", verb, a["name"]))
		}
		return e
	}}
}
func pushCmd() *cobra.Command {
	return &cobra.Command{Use: "push [app]", Short: "Envia arquivos, extrai e reinicia", Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		ref := ""
		if len(args) > 0 {
			ref = args[0]
		}
		a, e := getApp(c, ref)
		if e != nil {
			return e
		}
		b, n, e := zipper.Build(".", false)
		if e != nil {
			return e
		}
		output.Info(fmt.Sprintf("Compactados %d arquivos", n))
		spinner := output.StartSpinner("Enviando arquivos")
		if _, e = c.Upload("/apps/"+fmt.Sprint(a["id"])+"/files/upload", "/__venix_update.zip", b); e != nil {
			spinner.Stop()
			return e
		}
		spinner.Stop()
		spinner = output.StartSpinner("Extraindo arquivos")
		if _, e = c.Extract(fmt.Sprint(a["id"]), "/__venix_update.zip"); e != nil {
			spinner.Stop()
			return e
		}
		spinner.Stop()
		spinner = output.StartSpinner("Reiniciando aplicação")
		_, e = c.AppAction(fmt.Sprint(a["id"]), "RESTART")
		spinner.Stop()
		if e == nil {
			output.Success("Arquivos enviados e aplicação reiniciada")
		}
		return e
	}}
}
func upCmd() *cobra.Command {
	return &cobra.Command{Use: "up [nome]", Short: "Cria uma aplicação", Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		name := filepath.Base(mustWD())
		if len(args) > 0 {
			name = args[0]
		}
		b, n, e := zipper.Build(".", false)
		if e != nil {
			return e
		}
		output.Info(fmt.Sprintf("Compactados %d arquivos", n))
		spinner := output.StartSpinner("Criando aplicação")
		created, e := c.CreateAppMultipart(name, "go", 256, false, "", "", b)
		spinner.Stop()
		if e == nil {
			_ = store.SaveLink(".", map[string]any{"id": created["id"], "name": created["name"]})
			output.Success(fmt.Sprintf("Aplicação %v criada", created["name"]))
			if url := appURL(created); url != "-" {
				output.Link("Acessar aplicação:", url)
			}
		}
		return e
	}}
}
func mustWD() string { d, _ := os.Getwd(); return d }
func linkCmd() *cobra.Command {
	return &cobra.Command{Use: "link [app]", Short: "Vincula este diretório", Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		ref := ""
		if len(args) > 0 {
			ref = args[0]
		}
		a, e := getApp(c, ref)
		if e != nil {
			return e
		}
		e = store.SaveLink(".", map[string]any{"id": a["id"], "name": a["name"]})
		if e == nil {
			output.Success("Diretório vinculado")
		}
		return e
	}}
}
func backupCmd() *cobra.Command {
	return &cobra.Command{Use: "backup [app]", Short: "Cria um snapshot", Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		a, e := getApp(c, first(args))
		if e != nil {
			return e
		}
		_, e = c.Snapshot(fmt.Sprint(a["id"]), "backup-"+time.Now().Format("20060102-150405"))
		if e == nil {
			output.Success("Backup criado")
		}
		return e
	}}
}
func deployCmd() *cobra.Command {
	return &cobra.Command{Use: "deploy [app]", Short: "Dispara deploy", Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		a, e := getApp(c, first(args))
		if e != nil {
			return e
		}
		_, e = c.Deploy(fmt.Sprint(a["id"]))
		if e == nil {
			output.Success("Deploy disparado")
		}
		return e
	}}
}
func ramCmd() *cobra.Command {
	return &cobra.Command{Use: "ram [app] <mb>", Short: "Altera a memória", Args: cobra.MinimumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		mb, _ := strconv.Atoi(args[len(args)-1])
		ref := ""
		if len(args) > 1 {
			ref = args[0]
		}
		a, e := getApp(c, ref)
		if e != nil {
			return e
		}
		_, e = c.Ram(fmt.Sprint(a["id"]), mb)
		if e == nil {
			output.Success(fmt.Sprintf("Memória alterada para %d MB", mb))
		}
		return e
	}}
}
func deleteCmd() *cobra.Command {
	return &cobra.Command{Use: "delete [app]", Short: "Exclui uma aplicação", Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		a, e := getApp(c, first(args))
		if e != nil {
			return e
		}
		_, e = c.Remove(fmt.Sprint(a["id"]))
		if e == nil {
			output.Success("Aplicação excluída")
		}
		return e
	}}
}
func logsCmd() *cobra.Command {
	var follow bool
	c := &cobra.Command{Use: "logs [app]", Short: "Mostra os logs da aplicação", Args: cobra.MaximumNArgs(1), RunE: func(_ *cobra.Command, args []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		a, e := getApp(c, first(args))
		if e != nil {
			return e
		}
		if !follow {
			output.Info("Mostrando logs recentes")
		} else {
			output.Info("Acompanhando logs ao vivo; use Ctrl+C para sair")
		}
		return c.StreamLogs(fmt.Sprint(a["id"]), follow, output.Log)
	}}
	c.Flags().BoolVarP(&follow, "follow", "f", false, "acompanha os logs ao vivo")
	return c
}
func first(a []string) string {
	if len(a) > 0 {
		return a[0]
	}
	return ""
}
