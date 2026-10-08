package auth

import (
	"html"
	"net/http"
	"strings"
)

const toolsURL = "https://venixcloud.com/en/tools"

const successIcon = `<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="ring" cx="26" cy="26" r="23"/><path class="mark" d="M15 27l8 8 14-17"/></svg>`

const errorIcon = `<svg viewBox="0 0 52 52" aria-hidden="true"><circle class="ring" cx="26" cy="26" r="23"/><path class="mark" d="M18 18l16 16M34 18L18 34"/></svg>`

const pageHTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>{{TITLE}} • VenixCloud</title>
<style>
:root{--bg:#05060f;--card:rgba(255,255,255,.05);--line:rgba(255,255,255,.12);--text:#f4f6ff;--muted:#9aa3c7;--accent:#35e0a1;--brand:#5b7cff}
body.err{--accent:#ff5d73}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;display:flex;align-items:center;justify-content:center;padding:24px;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:radial-gradient(900px 500px at 15% -10%,rgba(91,124,255,.35),transparent 60%),radial-gradient(800px 500px at 100% 110%,rgba(53,224,230,.22),transparent 60%),var(--bg)}
.card{width:100%;max-width:440px;text-align:center;padding:40px 28px 32px;border:1px solid var(--line);border-radius:24px;background:var(--card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);box-shadow:0 30px 80px rgba(0,0,0,.55);animation:rise .5s ease both}
.brand{display:inline-flex;align-items:center;gap:8px;font-weight:700;letter-spacing:.14em;font-size:12px;color:var(--muted);text-transform:uppercase}
.brand i{width:10px;height:10px;border-radius:3px;background:linear-gradient(135deg,var(--brand),#35e0e6);display:inline-block;transform:rotate(45deg)}
.icon{width:88px;height:88px;margin:28px auto 20px;color:var(--accent);filter:drop-shadow(0 0 18px var(--accent))}
.icon svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.ring{stroke-dasharray:145;stroke-dashoffset:145;animation:draw .7s .1s ease forwards}
.mark{stroke-dasharray:50;stroke-dashoffset:50;animation:draw .45s .6s ease forwards}
h1{margin:0 0 10px;font-size:26px;line-height:1.2}
p{margin:0 auto;max-width:340px;color:var(--muted);line-height:1.55;font-size:15px}
.actions{margin-top:28px;display:flex;flex-direction:column;gap:10px}
a.btn{display:block;padding:13px 18px;border-radius:14px;text-decoration:none;font-weight:600;font-size:15px;color:#fff;background:linear-gradient(135deg,var(--brand),#35a8e6);transition:transform .15s ease,box-shadow .15s ease}
a.btn:hover{transform:translateY(-1px);box-shadow:0 10px 30px rgba(91,124,255,.45)}
.hint{margin-top:22px;font-size:13px;color:var(--muted)}
code{padding:2px 7px;border-radius:7px;background:rgba(255,255,255,.08);color:var(--text);font-family:ui-monospace,Menlo,Consolas,monospace}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.ring,.mark{stroke-dashoffset:0}}
</style>
</head>
<body class="{{CLASS}}">
<main class="card">
<div class="brand"><i></i>VenixCloud</div>
<div class="icon">{{ICON}}</div>
<h1>{{TITLE}}</h1>
<p>{{MESSAGE}}</p>
<div class="actions"><a class="btn" href="{{TOOLS}}">Abrir ferramentas da VenixCloud</a></div>
<div class="hint">{{HINT}}</div>
</main>
</body>
</html>`

func writePage(w http.ResponseWriter, status int, ok bool, title, message string) {
	class, icon := "ok", successIcon
	hint := "Você já pode fechar esta aba e voltar ao terminal."
	if !ok {
		class, icon = "err", errorIcon
		hint = "Volte ao terminal e rode <code>venix login</code> para tentar de novo."
	}
	page := strings.NewReplacer(
		"{{TITLE}}", html.EscapeString(title),
		"{{MESSAGE}}", html.EscapeString(message),
		"{{CLASS}}", class,
		"{{ICON}}", icon,
		"{{TOOLS}}", toolsURL,
		"{{HINT}}", hint,
	).Replace(pageHTML)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(page))
}
