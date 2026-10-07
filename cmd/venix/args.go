package main

import (
	"os"
	"path/filepath"
)

// launcherArgs devolve os argumentos da CLI sem o caminho do próprio
// executável quando algum launcher (como o termux-exec no Android) o repete
// como primeiro argumento. Esse caminho nunca é um comando válido.
func launcherArgs(argv []string, exe string) []string {
	if len(argv) < 2 {
		return []string{}
	}
	args := argv[1:]
	if isSelf(args[0], exe) {
		return args[1:]
	}
	return args
}

func isSelf(arg, exe string) bool {
	if arg == "" || exe == "" {
		return false
	}
	if filepath.Clean(arg) == filepath.Clean(exe) {
		return true
	}
	a, errA := os.Stat(arg)
	b, errB := os.Stat(exe)
	return errA == nil && errB == nil && !a.IsDir() && os.SameFile(a, b)
}
