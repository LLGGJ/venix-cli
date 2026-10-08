package browser

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLookPathIgnoresNonExecutable(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "tool"), []byte("#!/bin/sh\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PATH", dir)
	if _, ok := lookPath("tool"); ok {
		t.Fatal("arquivo sem permissão de execução não deve ser encontrado")
	}
	if err := os.Chmod(filepath.Join(dir, "tool"), 0o755); err != nil {
		t.Fatal(err)
	}
	if path, ok := lookPath("tool"); !ok || path != filepath.Join(dir, "tool") {
		t.Fatalf("lookPath = %q, %v", path, ok)
	}
}

func TestSystemEnvDropsLoaderVariables(t *testing.T) {
	t.Setenv("LD_LIBRARY_PATH", "/x")
	t.Setenv("LD_PRELOAD", "/y")
	for _, kv := range systemEnv() {
		if kv == "LD_LIBRARY_PATH=/x" || kv == "LD_PRELOAD=/y" {
			t.Fatalf("variável não removida: %s", kv)
		}
	}
}
