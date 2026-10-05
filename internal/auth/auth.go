package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

const (
	authURL         = "https://venixcloud.com/en/auth/bridge"
	tokenURL        = "https://api.venixcloud.com/v1/oauth2/token"
	callbackPort    = "53682"
	defaultClientID = "venix_cac3c2ea21c362d0a7"
)

type Credentials struct {
	ClientID     string    `json:"client_id"`
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token,omitempty"`
	ExpiresAt    time.Time `json:"expires_at"`
}

func configFile() string {
	if v := os.Getenv("VENIX_CONFIG_DIR"); v != "" {
		return filepath.Join(v, "credentials.json")
	}
	d, e := os.UserConfigDir()
	if e != nil {
		d, _ = os.UserHomeDir()
	}
	return filepath.Join(d, "venix", "credentials.json")
}
func randomBytes(n int) ([]byte, error) { b := make([]byte, n); _, e := rand.Read(b); return b, e }
func b64(b []byte) string               { return base64.RawURLEncoding.EncodeToString(b) }
func openBrowser(raw string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "darwin":
		cmd = "open"
		args = []string{raw}
	case "windows":
		cmd = "rundll32"
		args = []string{"url.dll,FileProtocolHandler", raw}
	default:
		cmd = "xdg-open"
		args = []string{raw}
	}
	c := exec.Command(cmd, args...)
	_ = c.Start()
}

func Login(noBrowser bool, clientID string) (Credentials, error) {
	if clientID == "" {
		clientID = os.Getenv("VENIX_CLIENT_ID")
	}
	if clientID == "" {
		clientID = defaultClientID
	}
	v, e := randomBytes(32)
	if e != nil {
		return Credentials{}, e
	}
	stateBytes, e := randomBytes(16)
	if e != nil {
		return Credentials{}, e
	}
	verifier := b64(v)
	sum := sha256.Sum256([]byte(verifier))
	challenge := b64(sum[:])
	state := fmt.Sprintf("%x", stateBytes)
	redirect := "http://127.0.0.1:" + callbackPort + "/callback"
	u, _ := url.Parse(authURL)
	q := u.Query()
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirect)
	q.Set("response_type", "code")
	q.Set("code_challenge", challenge)
	q.Set("code_challenge_method", "S256")
	q.Set("state", state)
	u.RawQuery = q.Encode()
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)
	mux := http.NewServeMux()
	srv := &http.Server{Addr: "127.0.0.1:" + callbackPort, Handler: mux}
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("error") != "" {
			http.Error(w, "Login recusado. Volte ao terminal.", 400)
			errCh <- fmt.Errorf("%s", q.Get("error_description"))
			return
		}
		if q.Get("state") != state {
			http.Error(w, "Estado inválido.", 400)
			errCh <- errors.New("STATE_INVALIDO")
			return
		}
		if q.Get("code") == "" {
			http.Error(w, "Código ausente.", 400)
			errCh <- errors.New("CODE_AUSENTE")
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		io.WriteString(w, "<h1>Login concluído ✔</h1><p>Você pode voltar ao terminal.</p>")
		codeCh <- q.Get("code")
	})
	lnErr := make(chan error, 1)
	go func() { lnErr <- srv.ListenAndServe() }()
	select {
	case e := <-lnErr:
		return Credentials{}, fmt.Errorf("não foi possível abrir callback local: %w", e)
	case <-time.After(150 * time.Millisecond):
	}
	fmt.Println("🔐 Abra o link para autorizar a CLI:")
	fmt.Println(u.String())
	if !noBrowser {
		openBrowser(u.String())
	} else {
		fmt.Println("Cole a URL final após autorizar:")
		var raw string
		fmt.Scanln(&raw)
		if raw != "" {
			if parsed, e := url.Parse(raw); e == nil && parsed.Query().Get("code") != "" {
				codeCh <- parsed.Query().Get("code")
			} else {
				codeCh <- raw
			}
		}
	}
	var code string
	select {
	case code = <-codeCh:
	case e := <-errCh:
		srv.Shutdown(context.Background())
		return Credentials{}, e
	case <-time.After(5 * time.Minute):
		srv.Shutdown(context.Background())
		return Credentials{}, errors.New("LOGIN_TIMEOUT")
	}
	srv.Shutdown(context.Background())
	payload := map[string]string{"grant_type": "authorization_code", "client_id": clientID, "code": code, "redirect_uri": redirect, "code_verifier": verifier}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPost, tokenURL, strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	res, e := http.DefaultClient.Do(req)
	if e != nil {
		return Credentials{}, e
	}
	defer res.Body.Close()
	raw, e := io.ReadAll(res.Body)
	if e != nil {
		return Credentials{}, e
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return Credentials{}, fmt.Errorf("LOGIN_FALHOU: HTTP_%d: %s", res.StatusCode, strings.TrimSpace(string(raw)))
	}
	var token struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if e = json.Unmarshal(raw, &token); e != nil {
		return Credentials{}, e
	}
	if token.AccessToken == "" {
		return Credentials{}, errors.New("RESPOSTA_SEM_ACCESS_TOKEN")
	}
	creds := Credentials{ClientID: clientID, AccessToken: token.AccessToken, RefreshToken: token.RefreshToken, ExpiresAt: time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)}
	return creds, save(creds)
}
func save(c Credentials) error {
	p := configFile()
	if e := os.MkdirAll(filepath.Dir(p), 0700); e != nil {
		return e
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(p, append(b, '\n'), 0600)
}
