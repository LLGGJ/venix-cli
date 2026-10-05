package main

import (
	"os"

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
	c, e := store.Creds()
	if e != nil {
		return e
	}
	return output.JSON(false, map[string]any{"client_id": c.ClientID, "authenticated": c.AccessToken != ""})
}
