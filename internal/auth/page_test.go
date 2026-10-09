package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWritePageSuccess(t *testing.T) {
	rec := httptest.NewRecorder()
	writePage(rec, http.StatusOK, true, "Login concluído", "Tudo certo.")
	body := rec.Body.String()
	if rec.Code != http.StatusOK || !strings.Contains(body, "Login concluído") || !strings.Contains(body, toolsURL) {
		t.Fatalf("página de sucesso inesperada (%d): %s", rec.Code, body)
	}
	if strings.Contains(body, "{{") {
		t.Fatalf("placeholders sem substituição: %s", body)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("a página não deve ser cacheada")
	}
}

func TestWritePageEscapesHTML(t *testing.T) {
	rec := httptest.NewRecorder()
	writePage(rec, http.StatusBadRequest, false, "Erro", "<script>alert(1)</script>")
	body := rec.Body.String()
	if strings.Contains(body, "<script>alert(1)</script>") {
		t.Fatal("mensagem de erro precisa ser escapada")
	}
	if !strings.Contains(body, `class="err"`) {
		t.Fatal("página de erro deve usar a classe err")
	}
}
