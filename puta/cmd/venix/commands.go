package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/LLGGJ/venix-cli/internal/api"
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
	return &cobra.Command{Use: "apps", Short: "Lista aplicações e status", RunE: func(*cobra.Command, []string) error {
		c, e := client()
		if e != nil {
			return e
		}
		m, e := c.GetMe()
		if e != nil {
			return e
		}
		output.Heading("APLICAÇÕES")
		b, _ := json.MarshalIndent(m, "", "  ")
		fmt.Println(string(b))
		return nil
	}}
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
		_, e = c.AppAction(fmt.Sprint(a["id"]), strings.ToUpper(name))
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
		if _, e = c.Upload("/apps/"+fmt.Sprint(a["id"])+"/files/upload", "/__venix_update.zip", b); e != nil {
			return e
		}
		if _, e = c.Extract(fmt.Sprint(a["id"]), "/__venix_update.zip"); e != nil {
			return e
		}
		_, e = c.AppAction(fmt.Sprint(a["id"]), "RESTART")
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
		created, e := c.CreateAppMultipart(name, "go", 256, false, "", "", b)
		if e == nil {
			_ = store.SaveLink(".", map[string]any{"id": created["id"], "name": created["name"]})
			output.Success(fmt.Sprintf("Aplicação %v criada", created["name"]))
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
		return c.StreamLogs(fmt.Sprint(a["id"]), follow, func(line string) { output.Info(line) })
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
