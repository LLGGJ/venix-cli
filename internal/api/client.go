package api

import (
	"bufio"
	"bytes"
	"encoding/json"
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
		return nil, fmt.Errorf("HTTP_%d: %s", res.StatusCode, strings.TrimSpace(string(raw)))
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
func (c *Client) Snapshot(id, name string) (map[string]any, error) {
	return c.JSON("POST", "/snapshots", map[string]string{"resourceId": id, "name": name})
}
func (c *Client) Deploy(id string) (map[string]any, error) {
	return c.JSON("POST", "/apps/"+id+"/deploy/trigger", nil)
}
func (c *Client) Ram(id string, mb int) (map[string]any, error) {
	return c.JSON("PATCH", "/apps/"+id, map[string]int{"max_ram": mb})
}
func (c *Client) Remove(id string) (map[string]any, error) { return c.Delete("/apps/" + id) }

func (c *Client) StreamLogs(id string, follow bool, onLine func(string)) error {
	req, e := http.NewRequest("GET", c.Base+"/instances/stream/"+id, nil)
	if e != nil {
		return e
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Authorization", "Bearer "+c.Token)
	if !follow {
		req.Header.Set("X-Venix-Seconds", "4")
	}
	res, e := c.HTTP.Do(req)
	if e != nil {
		return e
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("HTTP_%d", res.StatusCode)
	}
	s := bufio.NewScanner(res.Body)
	for s.Scan() {
		line := s.Text()
		if strings.HasPrefix(line, "data:") {
			onLine(strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	return s.Err()
}
