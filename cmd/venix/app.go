package main

import "github.com/spf13/cobra"

func appCommand() *cobra.Command {
	c := &cobra.Command{Use: "app", Short: "Gerencia aplicações"}
	c.AddCommand(appsCmd(), action("start", "Inicia aplicação"), action("stop", "Para aplicação"), action("restart", "Reinicia aplicação"), logsCmd(), backupCmd(), deployCmd(), ramCmd(), deleteCmd(), linkCmd(), upCmd(), pushCmd())
	return c
}
