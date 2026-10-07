package main

import (
	"reflect"
	"testing"
)

func TestLauncherArgs(t *testing.T) {
	exe := "/data/data/com.termux/files/usr/lib/node_modules/venix/bin/venix-native"
	tests := []struct {
		name string
		argv []string
		want []string
	}{
		{"sem argumentos", []string{"venix-native"}, []string{}},
		{"normal", []string{"venix-native", "--version"}, []string{"--version"}},
		{"caminho repetido", []string{"venix-native", exe, "--version"}, []string{"--version"}},
		{"caminho repetido sozinho", []string{"venix-native", exe}, []string{}},
		{"comando normal", []string{"venix-native", "apps", "--json"}, []string{"apps", "--json"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := launcherArgs(tt.argv, exe); !reflect.DeepEqual(got, tt.want) {
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
