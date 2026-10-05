package main

import (
	"os"

	"github.com/LLGGJ/venix-cli/internal/output"
	"github.com/spf13/cobra"
)

var version = "0.7.3"

func main() {
	root := &cobra.Command{
		Use:          "venix",
		Short:        "CLI da VenixCloud",
		SilenceUsage: true,
		RunE:         func(cmd *cobra.Command, _ []string) error { return cmd.Help() },
	}
	root.Version = version
	root.SetVersionTemplate("{{.Version}}\n")
	root.AddCommand(authCommand(), loginCommand(), &cobra.Command{Use: "logout", Short: "Remove as credenciais deste computador", RunE: func(*cobra.Command, []string) error { return logout() }}, &cobra.Command{Use: "whoami", Short: "Mostra conta, plano e projeto vinculado", RunE: func(*cobra.Command, []string) error { return whoami() }}, appCommand(), deployCmd())
	addCommands(root)
	if err := root.Execute(); err != nil {
		output.Error("erro: " + err.Error())
		os.Exit(1)
	}
}

func addCommands(root *cobra.Command) {
	root.AddCommand(appsCmd(), upCmd(), pushCmd(), linkCmd(), action("start", "Inicia aplicação"), action("stop", "Para aplicação"), action("restart", "Reinicia aplicação"), logsCmd(), backupCmd(), ramCmd(), deleteCmd())
}
