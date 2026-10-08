package browser

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
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

func TestViaLinker(t *testing.T) {
	dir := t.TempDir()
	linker := filepath.Join(dir, "linker64")
	script := filepath.Join(dir, "open-url")
	if err := os.WriteFile(linker, []byte("x"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(script, []byte("#!/data/usr/bin/sh -e\necho hi\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	name, argv := viaLinker("android", linker, script, []string{"https://x"})
	want := []string{"/data/usr/bin/sh", "-e", script, "https://x"}
	if name != linker || !reflect.DeepEqual(argv, want) {
		t.Fatalf("viaLinker = %q %v, want %q %v", name, argv, linker, want)
	}
	if name, argv := viaLinker("linux", linker, script, []string{"a"}); name != script || len(argv) != 1 {
		t.Fatalf("fora do Android nada deve mudar: %q %v", name, argv)
	}
	if name, _ := viaLinker("android", linker, "/system/bin/am", nil); name != "/system/bin/am" {
		t.Fatalf("binários do sistema não passam pelo linker: %q", name)
	}
}

func TestSystemEnvUsesSystemPath(t *testing.T) {
	t.Setenv("PATH", "/data/data/com.termux/files/usr/bin")
	found := ""
	for _, kv := range systemEnv() {
		if strings.HasPrefix(kv, "PATH=") {
			found = kv
		}
	}
	if found != "PATH=/system/bin:/system/xbin" {
		t.Fatalf("PATH = %q", found)
	}
}
