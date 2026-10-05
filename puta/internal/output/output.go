package output

import (
	"encoding/json"
	"fmt"
	"os"
)

const (
	reset  = "\033[0m"
	cyan   = "\033[36m"
	blue   = "\033[94m"
	green  = "\033[32m"
	yellow = "\033[33m"
	red    = "\033[31m"
)

func enabled() bool { return os.Getenv("NO_COLOR") == "" && os.Getenv("TERM") != "dumb" }
func paint(code, message string) string {
	if !enabled() {
		return message
	}
	return code + message + reset
}
func Info(message string)    { fmt.Fprintln(os.Stdout, paint(cyan, "ℹ "+message)) }
func Success(message string) { fmt.Fprintln(os.Stdout, paint(green, "✔ "+message)) }
func Warning(message string) { fmt.Fprintln(os.Stderr, paint(yellow, "⚠ "+message)) }
func Error(message string)   { fmt.Fprintln(os.Stderr, paint(red, "✖ "+message)) }
func Heading(message string) { fmt.Fprintln(os.Stdout, paint(blue, message)) }

func JSON(enabledJSON bool, value any) error {
	if !enabledJSON {
		return nil
	}
	b, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintln(os.Stdout, string(b))
	return nil
}
