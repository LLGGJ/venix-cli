package config

import (
	"os"
	"path/filepath"
)

func Dir() string {
	if v := os.Getenv("VENIX_CONFIG_DIR"); v != "" {
		return v
	}
	if v, err := os.UserConfigDir(); err == nil {
		return filepath.Join(v, "venix")
	}
	if v, err := os.UserHomeDir(); err == nil {
		return filepath.Join(v, ".config", "venix")
	}
	return ".venix"
}
