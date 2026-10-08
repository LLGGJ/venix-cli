package output

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

const (
	bold   = "\033[1m"
	purple = "\033[35m"
)

var (
	logPrefix   = regexp.MustCompile(`^(\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}\S*\]?)\s*(.*)$`)
	jsonKeyLine = regexp.MustCompile(`^(\s*)("(?:[^"\\]|\\.)*")(:\s*)(.*?)(,?)$`)
	jsonValLine = regexp.MustCompile(`^(\s*)(.*?)(,?)$`)
)

// Banner imprime um título em destaque com subtítulo opcional.
func Banner(title, subtitle string) {
	line := paint(bold+blue, "◆ "+title)
	if subtitle != "" {
		line += " " + paint(gray, subtitle)
	}
	fmt.Fprintln(os.Stdout, line)
}

// Section imprime o título de uma seção, separado do conteúdo anterior.
func Section(title string) {
	fmt.Fprintln(os.Stdout, "\n"+paint(bold+blue, title))
}

// Field imprime "  rótulo: valor" com o rótulo alinhado em width colunas.
func Field(label, value string, width int) {
	fmt.Fprintln(os.Stdout, "  "+paint(gray, fmt.Sprintf("%-*s", width, label+":"))+" "+value)
}

// Command imprime uma linha de lista de comandos.
func Command(name, description string, width int) {
	pad := name
	if n := width - len([]rune(name)); n > 0 {
		pad += strings.Repeat(" ", n)
	}
	fmt.Fprintln(os.Stdout, "  "+paint(cyan, pad)+"  "+description)
}

// Flags imprime a saída de FlagUsages() destacando os nomes das opções.
func Flags(usage string) {
	for _, l := range strings.Split(strings.TrimRight(usage, "\n"), "\n") {
		trimmed := strings.TrimLeft(l, " ")
		indent := l[:len(l)-len(trimmed)]
		if i := strings.Index(trimmed, "  "); i > 0 {
			fmt.Fprintln(os.Stdout, indent+paint(cyan, trimmed[:i])+trimmed[i:])
		} else {
			fmt.Fprintln(os.Stdout, l)
		}
	}
}

func containsAny(s string, words ...string) bool {
	for _, w := range words {
		if strings.Contains(s, w) {
			return true
		}
	}
	return false
}

// Log imprime uma linha de log com timestamp em cinza e cor por severidade.
func Log(line string) {
	prefix, rest := "", line
	if m := logPrefix.FindStringSubmatch(line); m != nil {
		prefix, rest = paint(gray, m[1])+" ", m[2]
	}
	lower := strings.ToLower(rest)
	code := ""
	switch {
	case containsAny(lower, "error", "erro", "fatal", "panic", "exception", "failed"):
		code = red
	case containsAny(lower, "warn", "aviso"):
		code = yellow
	case containsAny(lower, "debug", "trace"):
		code = gray
	}
	if code != "" {
		rest = paint(code, rest)
	}
	fmt.Fprintln(os.Stdout, prefix+rest)
}

func colorJSONValue(v string) string {
	switch {
	case v == "":
		return v
	case v[0] == '"':
		return paint(green, v)
	case v == "true" || v == "false" || v == "null":
		return paint(purple, v)
	case v[0] == '{' || v[0] == '[' || v[0] == '}' || v[0] == ']':
		return v
	}
	return paint(yellow, v)
}

// ColorJSON colore um JSON já indentado (chaves, textos, números e literais).
func ColorJSON(b []byte) string {
	lines := strings.Split(string(b), "\n")
	for i, l := range lines {
		if m := jsonKeyLine.FindStringSubmatch(l); m != nil {
			lines[i] = m[1] + paint(cyan, m[2]) + m[3] + colorJSONValue(m[4]) + m[5]
			continue
		}
		if m := jsonValLine.FindStringSubmatch(l); m != nil {
			lines[i] = m[1] + colorJSONValue(m[2]) + m[3]
		}
	}
	return strings.Join(lines, "\n")
}

// Check imprime o resultado de uma verificação (ok, warn ou fail) e, abaixo, o detalhe.
func Check(status, label, detail string) {
	icon, code := "✔", green
	switch status {
	case "warn":
		icon, code = "⚠", yellow
	case "fail":
		icon, code = "✖", red
	}
	fmt.Fprintln(os.Stdout, paint(code, icon)+" "+paint(bold, label))
	if detail != "" {
		fmt.Fprintln(os.Stdout, "    "+paint(gray, detail))
	}
}
