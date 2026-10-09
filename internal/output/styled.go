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

var (
	ansiRe     = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)
	errorRe    = regexp.MustCompile(`(?i)\b(error|erro|fatal|panic|exception|failed|traceback)\b`)
	debugRe    = regexp.MustCompile(`(?i)\b(debug|trace)\b`)
	logTokenRe = regexp.MustCompile(`(?i)(https?://\S+)|("(?:[^"\\]|\\.)*")(\s*:)?|\b(ERROR|ERRO|FATAL|PANIC|WARN|WARNING|AVISO|INFO|DEBUG|TRACE)\b|([A-Za-z_][\w.-]*)=|\b\d+(?:\.\d+)?(?:ms|s|MB|KB|GB)?\b|\b\d+(?:\.\d+)?%`)
)

func levelColor(token string) string {
	switch strings.ToUpper(token) {
	case "ERROR", "ERRO", "FATAL", "PANIC":
		return bold + red
	case "WARN", "WARNING", "AVISO":
		return yellow
	case "INFO":
		return cyan
	}
	return gray
}

// colorTokens destaca URLs, textos entre aspas, chaves, níveis e números de um log.
func colorTokens(s string) string {
	var b strings.Builder
	last := 0
	for _, m := range logTokenRe.FindAllStringSubmatchIndex(s, -1) {
		b.WriteString(s[last:m[0]])
		token := s[m[0]:m[1]]
		switch {
		case m[2] >= 0:
			b.WriteString(paint(blue, token))
		case m[4] >= 0 && m[6] >= 0:
			b.WriteString(paint(cyan, s[m[4]:m[5]]) + s[m[6]:m[7]])
		case m[4] >= 0:
			b.WriteString(paint(green, token))
		case m[8] >= 0:
			b.WriteString(paint(levelColor(token), token))
		case m[10] >= 0:
			b.WriteString(paint(cyan, s[m[10]:m[11]]) + paint(gray, "="))
		default:
			b.WriteString(paint(yellow, token))
		}
		last = m[1]
	}
	b.WriteString(s[last:])
	return b.String()
}

// FormatLog devolve uma linha de log colorida: timestamp em cinza, erros em
// vermelho, debug em cinza e, nas demais, URLs, textos, chaves e números
// destacados. Códigos de cor e caracteres de controle da origem são removidos.
func FormatLog(line string) string {
	line = ansiRe.ReplaceAllString(line, "")
	line = strings.Map(func(r rune) rune {
		switch {
		case r == '\t':
			return ' '
		case r < 0x20 || r == 0x7f:
			return -1
		}
		return r
	}, line)
	line = strings.TrimSpace(line)
	if line == "" {
		return ""
	}
	prefix, rest := "", line
	if m := logPrefix.FindStringSubmatch(line); m != nil {
		prefix, rest = paint(gray, m[1])+" ", m[2]
	}
	switch {
	case errorRe.MatchString(rest):
		return prefix + paint(red, rest)
	case debugRe.MatchString(rest):
		return prefix + paint(gray, rest)
	}
	return prefix + colorTokens(rest)
}

// Log imprime uma linha de log formatada por FormatLog.
func Log(line string) {
	if out := FormatLog(line); out != "" {
		fmt.Fprintln(os.Stdout, out)
	}
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
