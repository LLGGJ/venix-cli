package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// launcherArgs devolve os argumentos da CLI sem o caminho do próprio
// executável quando algum launcher o repete como primeiro argumento.
// Esse caminho nunca é um comando válido.
func launcherArgs(argv []string, exe string) []string {
	if len(argv) < 2 {
		return []string{}
	}
	args := argv[1:]
	for _, self := range selfPaths(argv[0], exe) {
		if isSelf(args[0], self) {
			return args[1:]
		}
	}
	return args
}

// selfPaths lista os caminhos que identificam este executável. No Android,
// os.Executable pode apontar para o linker (/system/bin/linker64) em vez do
// binário, então argv[0] também é considerado.
func selfPaths(argv0, exe string) []string {
	paths := []string{exe}
	if argv0 == "" {
		return paths
	}
	if strings.ContainsRune(argv0, filepath.Separator) {
		if abs, err := filepath.Abs(argv0); err == nil {
			paths = append(paths, abs)
		}
	} else if found, err := exec.LookPath(argv0); err == nil {
		paths = append(paths, found)
	}
	return paths
}

func isSelf(arg, self string) bool {
	if arg == "" || self == "" {
		return false
	}
	if filepath.Clean(arg) == filepath.Clean(self) {
		return true
	}
	a, errA := os.Stat(arg)
	b, errB := os.Stat(self)
	return errA == nil && errB == nil && !a.IsDir() && os.SameFile(a, b)
}
