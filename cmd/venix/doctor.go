package main

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/LLGGJ/venix-cli/internal/api"
	"github.com/LLGGJ/venix-cli/internal/browser"
	"github.com/LLGGJ/venix-cli/internal/menu"
	"github.com/LLGGJ/venix-cli/internal/output"
	"github.com/LLGGJ/venix-cli/internal/store"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

const doctorCallbackPort = "53682"

type check struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Detail string `json:"detail"`
}

func doctorCommand() *cobra.Command {
	var jsonOutput, openTest, dump bool
	c := &cobra.Command{
		Use:   "doctor",
		Short: "Diagnostica instalação, login, API e navegador",
		Args:  cobra.NoArgs,
		RunE: func(*cobra.Command, []string) error {
			if dump {
				return runDump()
			}
			return runDoctor(jsonOutput, openTest)
		},
	}
	c.Flags().BoolVar(&jsonOutput, "json", false, "imprime o diagnóstico em JSON")
	c.Flags().BoolVar(&openTest, "open-test", false, "tenta abrir o navegador de verdade")
	c.Flags().BoolVar(&dump, "dump", false, "mostra os dados brutos de aplicações e status da API (para suporte)")
	return c
}

func runDoctor(jsonOutput, openTest bool) error {
	checks := doctorChecks(openTest)
	warns, fails := 0, 0
	for _, ch := range checks {
		switch ch.Status {
		case "warn":
			warns++
		case "fail":
			fails++
		}
	}
	if jsonOutput {
		if err := output.JSON(true, checks); err != nil {
			return err
		}
	} else {
		output.Banner("Venix Doctor", version)
		fmt.Println()
		for _, ch := range checks {
			output.Check(ch.Status, ch.Name, ch.Detail)
		}
		fmt.Println()
		summary := fmt.Sprintf("%d verificações • %d avisos • %d falhas", len(checks), warns, fails)
		if fails > 0 {
			output.Error(summary)
		} else if warns > 0 {
			output.Warning(summary)
		} else {
			output.Success(summary)
		}
		if !openTest {
			output.Muted("Dica: venix doctor --open-test tenta abrir o navegador de verdade.")
		}
	}
	if fails > 0 {
		return errors.New("o diagnóstico encontrou falhas")
	}
	return nil
}

func doctorChecks(openTest bool) []check {
	var checks []check
	add := func(name, status, detail string) {
		checks = append(checks, check{Name: name, Status: status, Detail: detail})
	}

	// Versão
	status, note := "ok", ""
	if version == "dev" {
		status, note = "warn", " — build local, sem versão de release"
	}
	add("Versão", status, fmt.Sprintf("%s (%s/%s, %s)%s", version, runtime.GOOS, runtime.GOARCH, runtime.Version(), note))

	// Executável
	exe, err := os.Executable()
	linkerMode := runtime.GOOS == "android" && strings.Contains(exe, "linker")
	self := exe
	if err != nil || linkerMode {
		if abs, e := filepath.Abs(os.Args[0]); e == nil {
			self = abs
		}
	}
	switch {
	case err != nil:
		add("Executável", "warn", "não foi possível descobrir o caminho: "+err.Error())
	case linkerMode:
		add("Executável", "ok", "iniciado pelo linker do Android (normal no Termux) • argv0: "+os.Args[0])
	default:
		add("Executável", "ok", exe+" • argv0: "+os.Args[0])
	}

	// Ambiente
	termux := os.Getenv("TERMUX_VERSION") != "" || strings.Contains(os.Getenv("PREFIX"), "com.termux")
	add("Ambiente", "ok", fmt.Sprintf("%s • termux=%t • TERM=%s • cores=%t • terminal interativo=%t", systemLabel(), termux, os.Getenv("TERM"), os.Getenv("NO_COLOR") == "", menu.IsTerminal()))
	if w, h, err := term.GetSize(int(os.Stdout.Fd())); err == nil {
		add("Terminal", "ok", fmt.Sprintf("%d colunas × %d linhas", w, h))
	} else {
		add("Terminal", "warn", "a saída não é um terminal (pipe ou redirecionamento)")
	}

	// PATH
	if found, ok := browser.LookPath("venix"); !ok {
		add("PATH", "warn", "o comando venix não está no PATH; diretório do executável: "+filepath.Dir(self))
	} else if a, errA := os.Stat(found); errA == nil {
		if b, errB := os.Stat(self); errB == nil && os.SameFile(a, b) {
			add("PATH", "ok", "venix → "+found)
		} else {
			add("PATH", "warn", "venix no PATH é "+found+", diferente deste executável ("+self+")")
		}
	} else {
		add("PATH", "ok", "venix → "+found)
	}

	// Configuração
	dir := store.Dir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		add("Configuração", "fail", dir+" não pode ser criado: "+err.Error())
	} else if f, err := os.CreateTemp(dir, ".doctor-*"); err != nil {
		add("Configuração", "fail", dir+" não é gravável: "+err.Error())
	} else {
		name := f.Name()
		f.Close()
		os.Remove(name)
		add("Configuração", "ok", dir)
	}

	// Login
	creds, credErr := store.Creds()
	switch {
	case credErr != nil || creds.AccessToken == "":
		add("Login", "warn", "sem sessão; rode: venix login")
	default:
		if t, err := time.Parse(time.RFC3339, creds.ExpiresAt); err != nil {
			add("Login", "ok", "sessão salva (client "+creds.ClientID+")")
		} else if time.Now().After(t) {
			add("Login", "warn", "sessão expirada em "+t.Local().Format("02/01/2006 15:04")+"; rode: venix login")
		} else {
			add("Login", "ok", "sessão válida até "+t.Local().Format("02/01/2006 15:04"))
		}
	}

	// Rede
	base := api.New("").Base
	for _, target := range []struct{ name, url string }{{"Site", "https://venixcloud.com"}, {"API", base}} {
		result := probe(target.url)
		add(target.name, result.Status, result.Detail)
	}

	// Conta
	if credErr == nil && creds.AccessToken != "" {
		start := time.Now()
		me, err := api.New(creds.AccessToken).GetMe()
		switch {
		case err == nil:
			add("Conta", "ok", fmt.Sprintf("%d aplicações • %d ms", len(applications(me)), time.Since(start).Milliseconds()))
		case err.Error() == "UNAUTHORIZED":
			add("Conta", "fail", "token recusado (401); rode: venix login")
		default:
			add("Conta", "fail", err.Error())
		}
	}

	// Porta do login
	if ln, err := net.Listen("tcp", "127.0.0.1:"+doctorCallbackPort); err != nil {
		add("Porta do login", "warn", "127.0.0.1:"+doctorCallbackPort+" ocupada: "+err.Error())
	} else {
		ln.Close()
		add("Porta do login", "ok", "127.0.0.1:"+doctorCallbackPort+" livre")
	}

	// Navegador
	var found, missing []string
	for _, l := range browser.Launchers() {
		if l.Found {
			found = append(found, l.Name)
		} else {
			missing = append(missing, l.Name)
		}
	}
	if len(found) == 0 {
		add("Navegador", "warn", "nenhum programa para abrir links; ausentes: "+strings.Join(missing, ", "))
	} else {
		detail := "disponíveis: " + strings.Join(found, ", ")
		if len(missing) > 0 {
			detail += " • ausentes: " + strings.Join(missing, ", ")
		}
		add("Navegador", "ok", detail)
	}
	if openTest {
		if ok, detail := browser.OpenDetailed(toolsURL); ok {
			add("Abrir link", "ok", "o sistema aceitou abrir "+toolsURL)
		} else {
			add("Abrir link", "fail", detail)
		}
	}
	return checks
}

// probe faz um GET e considera qualquer resposta HTTP como "alcançável".
func probe(url string) check {
	start := time.Now()
	client := &http.Client{Timeout: 8 * time.Second}
	res, err := client.Get(url)
	if err != nil {
		return check{Status: "fail", Detail: url + ": " + err.Error()}
	}
	res.Body.Close()
	note := ""
	if res.StatusCode >= 400 {
		note = " (servidor alcançável)"
	}
	return check{Status: "ok", Detail: fmt.Sprintf("%s → HTTP %d%s • %d ms", url, res.StatusCode, note, time.Since(start).Milliseconds())}
}

// runDump imprime os dados brutos usados pelo `venix apps`, para diagnóstico.
// Atenção: confira o conteúdo antes de compartilhar.
func runDump() error {
	c, err := client()
	if err != nil {
		return err
	}
	out := map[string]any{}
	if me, err := c.GetMe(); err != nil {
		out["me_error"] = err.Error()
	} else {
		out["me_applications"] = applications(me)
	}
	if status, err := c.AppsStatus(); err != nil {
		out["apps_status_error"] = err.Error()
	} else {
		out["apps_status"] = status
	}
	return output.JSON(true, out)
}

// systemLabel devolve o sistema detectado com seu emoji, ex.: "🐧 Linux detectado".
func systemLabel() string {
	switch runtime.GOOS {
	case "linux":
		return "🐧 Linux detectado"
	case "darwin":
		return "🍎 macOS detectado"
	case "windows":
		return "🪟 Windows detectado"
	case "android":
		return "🤖 Android (Termux) detectado"
	}
	return "💻 " + runtime.GOOS + " detectado"
}
