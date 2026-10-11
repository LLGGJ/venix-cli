package main

import (
	"os"

	"github.com/spf13/cobra"
)

// version é injetada no build: -ldflags "-X main.version=1.2.3". "dev" é só o padrão local.
var version = "dev"

func main() {
	root := &cobra.Command{
		Use:           "venix",
		Short:         "CLI da VenixCloud",
		SilenceUsage:  true,
		SilenceErrors: true,
		RunE:          func(cmd *cobra.Command, _ []string) error { return cmd.Help() },
	}
	root.Version = version
	root.SetVersionTemplate("{{.Version}}\n")
	root.AddCommand(authCommand(), loginCommand(), &cobra.Command{Use: "logout", Short: "Remove as credenciais deste computador", RunE: func(*cobra.Command, []string) error { return logout() }}, &cobra.Command{Use: "whoami", Short: "Mostra conta, plano e projeto vinculado", RunE: func(*cobra.Command, []string) error { return whoami() }}, appCommand(), deployCmd())
	addCommands(root)
	exe, _ := os.Executable()
	args := launcherArgs(os.Args, exe)
	root.SetArgs(args)
	root.SetHelpFunc(colorHelp)
	root.PersistentPreRun = func(cmd *cobra.Command, _ []string) { clearForCommand(cmd) }
	if err := root.Execute(); err != nil {
		reportError(err, args)
		os.Exit(1)
	}
	if len(args) == 0 || (len(args) == 1 && args[0] == "help") {
		openToolsPage()
	}
}

func addCommands(root *cobra.Command) {
	root.AddCommand(doctorCommand(), appsCmd(), upCmd(), pushCmd(), linkCmd(), action("start", "Inicia aplicação"), action("stop", "Para aplicação"), action("restart", "Reinicia aplicação"), logsCmd(), backupCmd(), ramCmd(), deleteCmd())
}
