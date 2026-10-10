package api

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Client struct {
	Base  string
	Token string
	HTTP  *http.Client
}

func New(token string) *Client {
	b := os.Getenv("VENIX_API_BASE_URL")
	if b == "" {
		b = "https://api.venixcloud.com/v1"
	}
	return &Client{strings.TrimRight(b, "/"), token, &http.Client{Timeout: 60 * time.Second}}
}
// apiMessage extrai o código e a mensagem de erro de uma resposta JSON da API
// (ou devolve o texto cru, cortado).
func apiMessage(raw []byte) string {
	var m map[string]any
	if json.Unmarshal(raw, &m) == nil {
		code, _ := m["code"].(string)
		if message := apiMessageField(m); message != "" {
			if code != "" {
				return code + ": " + message
			}
			return message
		}
	}
	text := strings.TrimSpace(string(raw))
	if r := []rune(text); len(r) > 300 {
		text = string(r[:300]) + "…"
	}
	return text
}

func apiMessageField(m map[string]any) string {
	for _, key := range []string{"message", "error", "detail", "msg"} {
		switch v := m[key].(type) {
		case string:
			if v != "" {
				return v
			}
		case map[string]any:
			if text, ok := v["message"].(string); ok && text != "" {
				return text
			}
		}
	}
	return ""
}

func (c *Client) do(method, path string, body []byte, content string) (map[string]any, error) {
	req, e := http.NewRequest(method, c.Base+path, bytes.NewReader(body))
	if e != nil {
		return nil, e
	}
	req.Header.Set("Accept", "application/json")
	if c.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.Token)
	}
	if content != "" {
		req.Header.Set("Content-Type", content)
	}
	res, e := c.HTTP.Do(req)
	if e != nil {
		return nil, e
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	if res.StatusCode == 401 {
		return nil, fmt.Errorf("UNAUTHORIZED")
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP_%d: %s", res.StatusCode, apiMessage(raw))
	}
	if out != nil {
		if s, _ := out["status"].(string); s != "" && s != "success" {
			return nil, fmt.Errorf("%v", out["message"])
		}
		if r, ok := out["response"].(map[string]any); ok {
			return r, nil
		}
	}
	return out, nil
}
func (c *Client) JSON(method, path string, v any) (map[string]any, error) {
	b, e := json.Marshal(v)
	if e != nil {
		return nil, e
	}
	return c.do(method, path, b, "application/json")
}
func (c *Client) Get(path string) (map[string]any, error)    { return c.do("GET", path, nil, "") }
func (c *Client) Delete(path string) (map[string]any, error) { return c.do("DELETE", path, nil, "") }
func (c *Client) Upload(path, remote string, data []byte) (map[string]any, error) {
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	_ = w.WriteField("path", remote)
	f, e := w.CreateFormFile("file", filepath.Base(remote))
	if e != nil {
		return nil, e
	}
	_, _ = f.Write(data)
	w.Close()
	return c.do("POST", path, b.Bytes(), w.FormDataContentType())
}
func (c *Client) GetMe() (map[string]any, error)      { return c.Get("/me") }
func (c *Client) AppsStatus() (map[string]any, error) { return c.Get("/apps/status") }
func (c *Client) AppAction(id, action string) (map[string]any, error) {
	return c.JSON("POST", "/apps/"+id+"/action", map[string]string{"action": action})
}
func (c *Client) CreateApp(v map[string]any) (map[string]any, error) {
	return c.JSON("POST", "/apps/create", v)
}
func (c *Client) CreateAppMultipart(name, runtime string, ram int, web bool, subdomain, start string, data []byte) (map[string]any, error) {
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	_ = w.WriteField("appName", name)
	_ = w.WriteField("runtime", runtime)
	_ = w.WriteField("ram", fmt.Sprint(ram))
	_ = w.WriteField("isWeb", fmt.Sprint(web))
	if subdomain != "" {
		_ = w.WriteField("subdomain", subdomain)
	}
	if start != "" {
		_ = w.WriteField("startCommand", start)
	}
	f, e := w.CreateFormFile("file", "index.zip")
	if e != nil {
		return nil, e
	}
	if _, e = f.Write(data); e != nil {
		return nil, e
	}
	content := w.FormDataContentType()
	w.Close()
	return c.do("POST", "/apps/create", b.Bytes(), content)
}
func (c *Client) Extract(id, path string) (map[string]any, error) {
	return c.JSON("POST", "/apps/"+id+"/files/extract", map[string]string{"filePath": path})
}
// Snapshot cria um backup da aplicação. A rota /snapshots não existe na API da
// VenixCloud, então tentamos as rotas prováveis e usamos a primeira que a API
// reconhece (qualquer erro diferente de "rota inexistente" é devolvido como está).
func (c *Client) Snapshot(id, name string) (map[string]any, error) {
	byApp := map[string]string{"name": name}
	byResource := map[string]string{"resourceId": id, "name": name}
	routes := []struct {
		path string
		body map[string]string
	}{
		{"/apps/" + id + "/snapshots", byApp},
		{"/apps/" + id + "/snapshot", byApp},
		{"/apps/" + id + "/backups", byApp},
		{"/apps/" + id + "/backup", byApp},
		{"/apps/" + id + "/snapshots/create", byApp},
		{"/snapshots/create", byResource},
		{"/backups", byResource},
	}
	for _, r := range routes {
		out, err := c.JSON("POST", r.path, r.body)
		if err == nil {
			return out, nil
		}
		if !strings.Contains(err.Error(), "ROUTE_NOT_FOUND") {
			return nil, err
		}
	}
	return nil, fmt.Errorf("ROUTE_NOT_FOUND: a API da VenixCloud não tem rota de backup (testei %d rotas)", len(routes))
}
func (c *Client) Deploy(id string) (map[string]any, error) {
	return c.JSON("POST", "/apps/"+id+"/deploy/trigger", nil)
}
func (c *Client) Ram(id string, mb int) (map[string]any, error) {
	return c.JSON("PATCH", "/apps/"+id, map[string]int{"max_ram": mb})
}
func (c *Client) Remove(id string) (map[string]any, error) { return c.Delete("/apps/" + id) }

// StreamLogs lê o stream da instância. Sem follow, termina sozinho em poucos segundos.
func (c *Client) StreamLogs(id string, follow bool, onLine func(string)) error {
	if follow {
		return c.stream(context.Background(), id, "", onLine)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return c.stream(ctx, id, "4", onLine)
}

// Metrics lê um instante do stream e devolve a última amostra de métricas
// (objeto com "cpu", "memory", "apm"...), ou nil se não vier nenhuma.
func (c *Client) Metrics(id string) (map[string]any, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	var last map[string]any
	err := c.stream(ctx, id, "1", func(line string) {
		var m map[string]any
		if json.Unmarshal([]byte(line), &m) == nil {
			if _, ok := m["cpu"]; ok {
				last = m
			}
		}
	})
	if last == nil && err != nil {
		return nil, err
	}
	return last, nil
}

func (c *Client) stream(ctx context.Context, id, seconds string, onLine func(string)) error {
	req, e := http.NewRequestWithContext(ctx, "GET", c.Base+"/instances/stream/"+id, nil)
	if e != nil {
		return e
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Authorization", "Bearer "+c.Token)
	if seconds != "" {
		req.Header.Set("X-Venix-Seconds", seconds)
	}
	res, e := c.HTTP.Do(req)
	if e != nil {
		if errors.Is(e, context.DeadlineExceeded) {
			return nil
		}
		return e
	}
	defer res.Body.Close()
	if res.StatusCode == 401 {
		return fmt.Errorf("UNAUTHORIZED")
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("HTTP_%d", res.StatusCode)
	}
	s := bufio.NewScanner(res.Body)
	s.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for s.Scan() {
		line := s.Text()
		if strings.HasPrefix(line, "data:") {
			onLine(strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if err := s.Err(); err != nil && !errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	return nil
}
