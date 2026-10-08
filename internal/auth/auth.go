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
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/LLGGJ/venix-cli/internal/browser"
	"github.com/LLGGJ/venix-cli/internal/output"
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

// Dir devolve o diretório onde as credenciais são guardadas.
func Dir() string { return dir() }

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
	resultCh := make(chan error, 1)
	fail := func(e error) {
		select {
		case errCh <- e:
		default:
		}
	}
	var handled atomic.Bool
	mux := http.NewServeMux()
	srv := &http.Server{Addr: "127.0.0.1:" + callbackPort, Handler: mux}
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("error") != "" {
			desc := q.Get("error_description")
			if desc == "" {
				desc = q.Get("error")
			}
			writePage(w, http.StatusBadRequest, false, "Login recusado", desc)
			fail(errors.New(desc))
			return
		}
		if q.Get("state") != state {
			writePage(w, http.StatusBadRequest, false, "Estado inválido", "A resposta não corresponde a este login. Tente novamente.")
			fail(errors.New("STATE_INVALIDO"))
			return
		}
		if q.Get("code") == "" {
			writePage(w, http.StatusBadRequest, false, "Código ausente", "O servidor não devolveu o código de autorização.")
			fail(errors.New("CODE_AUSENTE"))
			return
		}
		if !handled.CompareAndSwap(false, true) {
			writePage(w, http.StatusConflict, false, "Link já utilizado", "Este link de autorização já foi usado.")
			return
		}
		codeCh <- q.Get("code")
		select {
		case err := <-resultCh:
			if err != nil {
				writePage(w, http.StatusInternalServerError, false, "Não foi possível concluir o login", err.Error())
				return
			}
			writePage(w, http.StatusOK, true, "Login concluído", "A CLI da VenixCloud foi autorizada com sucesso.")
		case <-time.After(30 * time.Second):
			writePage(w, http.StatusGatewayTimeout, false, "Tempo esgotado", "Volte ao terminal para ver o resultado.")
		case <-r.Context().Done():
		}
	})
	shutdown := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}
	lnErr := make(chan error, 1)
	go func() { lnErr <- srv.ListenAndServe() }()
	select {
	case e := <-lnErr:
		return Credentials{}, fmt.Errorf("não foi possível abrir callback local: %w", e)
	case <-time.After(150 * time.Millisecond):
	}
	output.Heading("Autorizar a CLI da VenixCloud")
	output.Info("Abra o link para autorizar:")
	output.Link("", u.String())
	var spin *output.Spinner
	if !noBrowser {
		if ok, detail := browser.OpenDetailed(u.String()); ok {
			output.Muted("Navegador aberto. Conclua a autorização e volte aqui.")
		} else {
			output.Warning("Não consegui abrir o navegador automaticamente. Abra o link acima manualmente.")
			output.Muted("detalhes: " + detail)
		}
		spin = output.StartSpinner("Aguardando autorização no navegador")
	} else {
		output.Info("Cole a URL final após autorizar:")
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
	var waitErr error
	select {
	case code = <-codeCh:
	case waitErr = <-errCh:
	case <-time.After(5 * time.Minute):
		waitErr = errors.New("LOGIN_TIMEOUT")
	}
	if spin != nil {
		spin.Stop()
	}
	if waitErr != nil {
		shutdown()
		return Credentials{}, waitErr
	}
	creds, err := exchange(clientID, code, redirect, verifier)
	if err == nil {
		err = save(creds)
	}
	resultCh <- err
	shutdown()
	return creds, err
}

func exchange(clientID, code, redirect, verifier string) (Credentials, error) {
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
	return Credentials{ClientID: clientID, AccessToken: token.AccessToken, RefreshToken: token.RefreshToken, ExpiresAt: time.Now().Add(time.Duration(token.ExpiresIn) * time.Second)}, nil
}

func save(c Credentials) error {
	p := configFile()
	if e := os.MkdirAll(filepath.Dir(p), 0700); e != nil {
		return e
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(p, append(b, '\n'), 0600)
}
