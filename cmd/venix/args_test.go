package main

import (
	"reflect"
	"testing"
)

func TestLauncherArgs(t *testing.T) {
	bin := "/data/data/com.termux/files/home/venix"
	linker := "/apex/com.android.runtime/bin/linker64"
	tests := []struct {
		name string
		argv []string
		exe  string
		want []string
	}{
		{"sem argumentos", []string{bin}, bin, []string{}},
		{"normal", []string{bin, "--version"}, bin, []string{"--version"}},
		{"caminho repetido", []string{bin, bin, "--version"}, bin, []string{"--version"}},
		{"caminho repetido sozinho", []string{bin, bin}, bin, []string{}},
		{"comando normal", []string{bin, "apps", "--json"}, bin, []string{"apps", "--json"}},
		{"executável aponta para o linker", []string{bin, bin, "--version"}, linker, []string{"--version"}},
		{"linker não esconde comandos", []string{bin, "apps"}, linker, []string{"apps"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := launcherArgs(tt.argv, tt.exe); !reflect.DeepEqual(got, tt.want) {
				t.Fatalf("launcherArgs() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestAppStatus(t *testing.T) {
	tests := map[string]string{"online": "ONLINE", "STOPPED": "OFFLINE", "building": "INICIANDO", "stopping": "PARANDO", "failed": "ERRO", "-": "N/D", "": "N/D"}
	for in, want := range tests {
		if got, _ := appStatus(in); got != want {
			t.Fatalf("appStatus(%q) = %q, want %q", in, got, want)
		}
	}
}
