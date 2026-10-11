package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/LLGGJ/venix-cli/internal/browser"
	"github.com/LLGGJ/venix-cli/internal/menu"
	"github.com/LLGGJ/venix-cli/internal/output"
	"github.com/spf13/cobra"
)

const toolsURL = "https://venixcloud.com/en/tools"

func localizeFlags(cmd *cobra.Command, usage string) string {
	usage = strings.Replace(usage, "help for "+cmd.Name(), "mostra a ajuda", 1)
	return strings.Replace(usage, "version for "+cmd.Name(), "mostra a versão", 1)
}

func isListed(c *cobra.Command) bool {
	return c.IsAvailableCommand() || c.Name() == "help"
}

// colorHelp substitui o help padrão do cobra por uma versão colorida.
func colorHelp(cmd *cobra.Command, _ []string) {
	if cmd.Root() == cmd {
		output.Banner("Venix CLI", version)
	} else {
		output.Banner(cmd.CommandPath(), "")
	}
	desc := cmd.Long
	if desc == "" {
		desc = cmd.Short
	}
	if desc != "" {
		fmt.Fprintln(os.Stdout, desc)
	}

	output.Section("Uso")
	if cmd.Runnable() {
		fmt.Fprintln(os.Stdout, "  "+cmd.UseLine())
	}
	if cmd.HasAvailableSubCommands() {
		fmt.Fprintln(os.Stdout, "  "+cmd.CommandPath()+" [comando]")
	}

	if cmd.HasAvailableSubCommands() {
		output.Section("Comandos")
		width := 0
		for _, sub := range cmd.Commands() {
			if isListed(sub) && len(sub.Name()) > width {
				width = len(sub.Name())
			}
		}
		for _, sub := range cmd.Commands() {
			if isListed(sub) {
				output.Command(sub.Name(), sub.Short, width)
			}
		}
	}
	if cmd.Example != "" {
		output.Section("Exemplos")
		fmt.Fprintln(os.Stdout, cmd.Example)
	}
	if cmd.HasAvailableLocalFlags() {
		output.Section("Opções")
		output.Flags(localizeFlags(cmd, cmd.LocalFlags().FlagUsages()))
	}
	if cmd.HasAvailableInheritedFlags() {
		output.Section("Opções globais")
		output.Flags(localizeFlags(cmd, cmd.InheritedFlags().FlagUsages()))
	}
	if cmd.HasAvailableSubCommands() {
		output.Muted("\nUse \"" + cmd.CommandPath() + " [comando] --help\" para mais informações.")
	}
	fmt.Fprintln(os.Stdout)
	output.Link("Ferramentas e documentação:", toolsURL)
}

// openToolsPage abre a página de ferramentas depois de `venix` ou `venix help`.
// Só abre em terminais interativos; VENIX_NO_OPEN=1 desativa.
func openToolsPage() {
	if os.Getenv("VENIX_NO_OPEN") != "" || os.Getenv("CI") != "" || !menu.IsTerminal() {
		return
	}
	ok, detail := browser.OpenDetailed(toolsURL)
	if ok {
		output.Muted("Abrindo " + toolsURL + " no navegador...")
	} else if os.Getenv("VENIX_DEBUG") != "" {
		output.Muted("Não consegui abrir o navegador: " + detail)
	}
}

// clearForCommand limpa a tela antes dos comandos interativos (e do help).
func clearForCommand(cmd *cobra.Command) {
	switch cmd.Name() {
	case "venix", "help", "login", "apps", "doctor", "whoami":
	default:
		return
	}
	if flag := cmd.Flags().Lookup("json"); flag != nil && flag.Changed {
		return
	}
	output.Clear()
}
