package main

import (
	"os"
	"time"

	"github.com/LLGGJ/venix-cli/internal/auth"
	"github.com/LLGGJ/venix-cli/internal/output"
	"github.com/LLGGJ/venix-cli/internal/store"
	"github.com/spf13/cobra"
)

func authCommand() *cobra.Command {
	c := &cobra.Command{Use: "auth", Short: "Gerencia a sessão VenixCloud"}
	c.AddCommand(loginCommand())
	c.AddCommand(&cobra.Command{Use: "logout", Short: "Remove a sessão local", RunE: func(*cobra.Command, []string) error { return logout() }})
	c.AddCommand(&cobra.Command{Use: "whoami", Short: "Mostra a conta atual", RunE: func(*cobra.Command, []string) error { return whoami() }})
	return c
}

func loginCommand() *cobra.Command {
	var noBrowser bool
	var clientID string
	c := &cobra.Command{Use: "login", Short: "Autoriza a CLI com OAuth2 + PKCE", RunE: func(*cobra.Command, []string) error {
		creds, e := auth.Login(noBrowser, clientID)
		if e != nil {
			return e
		}
		output.Success("Login concluído")
		_ = creds
		return nil
	}}
	c.Flags().BoolVar(&noBrowser, "no-browser", false, "não abre o navegador; mostra a URL")
	c.Flags().StringVar(&clientID, "client-id", "", "Client ID OAuth2")
	return c
}
func logout() error {
	if e := store.Clear(); e != nil && !os.IsNotExist(e) {
		return e
	}
	output.Success("Você saiu. Credenciais removidas deste computador.")
	return nil
}
func whoami() error {
	creds, e := store.Creds()
	if e != nil {
		if os.IsNotExist(e) {
			return errNotLoggedIn
		}
		return e
	}
	if creds.AccessToken == "" {
		return errNotLoggedIn
	}
	output.Success("Conectado à VenixCloud")
	output.Field("Client ID", creds.ClientID, 10)
	if t, err := time.Parse(time.RFC3339, creds.ExpiresAt); err == nil {
		output.Field("Sessão até", t.Local().Format("02/01/2006 15:04"), 10)
	}
	c, err := client()
	if err != nil {
		return nil
	}
	me, err := c.GetMe()
	if err != nil {
		return nil
	}
	if user, ok := me["user"].(map[string]any); ok {
		me = user
	}
	for _, f := range []struct{ label, key string }{{"Nome", "name"}, {"E-mail", "email"}, {"Plano", "plan"}} {
		if v := appValue(me, f.key); v != "-" {
			output.Field(f.label, v, 10)
		}
	}
	return nil
}
