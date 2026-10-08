package store

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Credentials struct {
	ClientID     string `json:"client_id"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	ExpiresAt    string `json:"expires_at,omitempty"`
}

func dir() string {
	if v := os.Getenv("VENIX_CONFIG_DIR"); v != "" {
		return v
	}
	d, e := os.UserConfigDir()
	if e != nil {
		d, _ = os.UserHomeDir()
	}
	return filepath.Join(d, "venix")
}

// Dir devolve o diretório onde as credenciais são guardadas.
func Dir() string { return dir() }

func Creds() (*Credentials, error) {
	b, e := os.ReadFile(filepath.Join(dir(), "credentials.json"))
	if e != nil {
		return nil, e
	}
	var c Credentials
	e = json.Unmarshal(b, &c)
	return &c, e
}

func Save(c Credentials) error {
	if e := os.MkdirAll(dir(), 0700); e != nil {
		return e
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(filepath.Join(dir(), "credentials.json"), append(b, '\n'), 0600)
}

func Clear() error { return os.Remove(filepath.Join(dir(), "credentials.json")) }

func Link(dir string) (map[string]any, error) {
	b, e := os.ReadFile(filepath.Join(dir, ".venix.json"))
	if e != nil {
		return nil, e
	}
	var v map[string]any
	e = json.Unmarshal(b, &v)
	return v, e
}

func SaveLink(dir string, v map[string]any) error {
	b, _ := json.MarshalIndent(v, "", "  ")
	return os.WriteFile(filepath.Join(dir, ".venix.json"), append(b, '\n'), 0600)
}
