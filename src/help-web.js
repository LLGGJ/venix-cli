import http from 'node:http';
import { spawn } from 'node:child_process';

const DEFAULT_PORT = 53683;

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const openBrowser = (url) => {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'rundll32' : 'termux-open-url';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {
      if (process.platform === 'linux') {
        const fallback = spawn('xdg-open', [url], { detached: true, stdio: 'ignore' });
        fallback.on('error', () => {});
        fallback.unref();
      }
    });
    child.unref();
  } catch {
    // O endereço continua sendo mostrado no terminal.
  }
};

const page = () => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Venix CLI — Central de ajuda</title>
<style>
:root{color-scheme:dark;--bg:#05070b;--panel:#0c111b;--panel2:#101827;--line:#1d2b42;--text:#f4f7fb;--muted:#91a0b5;--blue:#4da3ff;--blue2:#8cc8ff;--glow:rgba(77,163,255,.3)}
*{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:radial-gradient(circle at 80% -10%,#12315d 0,transparent 38%),var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;min-height:100vh}
.shell{max-width:1120px;margin:auto;padding:20px 16px 48px}.top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:8px 0 24px}.brand{display:flex;align-items:center;gap:12px}.mark{width:42px;height:42px;border:1px solid var(--blue);display:grid;place-items:center;color:var(--blue2);font-size:24px;box-shadow:0 0 22px var(--glow);animation:pulse 2.5s ease-in-out infinite}.brand h1{font-size:20px;margin:0;letter-spacing:.04em}.brand p{margin:3px 0 0;color:var(--muted);font-size:12px}.status{color:#a9d6ff;font-size:12px;border:1px solid #24466d;background:#0a1728;padding:8px 10px;border-radius:999px}.hero{border:1px solid var(--line);background:linear-gradient(145deg,rgba(16,24,39,.96),rgba(7,10,16,.96));padding:26px;border-radius:18px;box-shadow:0 18px 60px rgba(0,0,0,.3);overflow:hidden;position:relative}.hero:after{content:"";position:absolute;inset:auto -15% -70% 20%;height:220px;background:var(--glow);filter:blur(70px);pointer-events:none}.eyebrow{color:var(--blue2);font-size:12px;letter-spacing:.16em;text-transform:uppercase}.hero h2{font-size:clamp(28px,6vw,58px);line-height:.98;margin:12px 0 14px;max-width:740px}.hero h2 span{color:var(--blue2)}.hero p{color:var(--muted);max-width:680px;line-height:1.6;margin:0}.terminal{margin-top:22px;background:#020305;border:1px solid #24466d;border-radius:14px;padding:0;color:#cfe7ff;font:13px/1.65 ui-monospace,SFMono-Regular,Menlo,monospace;height:310px;position:relative;overflow:hidden;box-shadow:inset 0 0 35px rgba(0,0,0,.55),0 0 28px rgba(77,163,255,.1)}.terminal-head{height:42px;display:flex;align-items:center;gap:7px;padding:0 15px;border-bottom:1px solid #162b45;background:#07111f;color:#6f8dab;font-size:11px}.dot{width:9px;height:9px;border-radius:50%;background:#345b82}.dot.live{background:#55b5ff;box-shadow:0 0 10px #55b5ff}.terminal-title{margin-left:5px;letter-spacing:.05em}.terminal-scroll{height:268px;overflow:hidden;padding:15px 17px;scroll-behavior:smooth}.term-line{white-space:pre-wrap;word-break:break-word;margin:0 0 10px;animation:termIn .25s ease}.term-line.cmd{color:#e8f4ff}.term-line.cmd .prompt{color:var(--blue2);font-weight:700}.term-line.out{color:#91a9c2}.term-line.ok{color:#79d6a7}.term-line.dimmed{color:#52718f}.cursor{display:inline-block;width:8px;height:15px;background:var(--blue);vertical-align:-2px;animation:blink 1s steps(1) infinite}.tabs{display:flex;gap:8px;overflow:auto;padding:20px 0 14px;scrollbar-width:none}.tabs button{flex:0 0 auto;border:1px solid var(--line);background:var(--panel);color:var(--muted);padding:11px 14px;border-radius:10px;font-weight:700;cursor:pointer}.tabs button.active,.tabs button:hover{border-color:var(--blue);color:var(--text);background:#10213a;box-shadow:0 0 18px var(--glow)}.view{display:none;animation:rise .35s ease}.view.active{display:block}.section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:10px 0 14px}.section-title h3{font-size:22px;margin:0}.section-title p{color:var(--muted);font-size:13px;margin:0}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{background:linear-gradient(160deg,var(--panel2),var(--panel));border:1px solid var(--line);border-radius:14px;padding:17px;transition:transform .2s,border-color .2s,box-shadow .2s;animation:cardIn .55s both}.card:hover{transform:translateY(-3px);border-color:var(--blue);box-shadow:0 12px 28px rgba(0,0,0,.25)}.card .icon{color:var(--blue);font-size:20px}.card h4{margin:11px 0 7px}.card p{color:var(--muted);font-size:13px;line-height:1.55;margin:0}.cmds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.cmd{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:14px;animation:cardIn .55s both}.cmd code{color:#d6eaff;background:#061321;border:1px solid #1c3858;border-radius:7px;padding:5px 7px;font:12px ui-monospace,monospace;white-space:nowrap}.cmd div{color:var(--muted);font-size:13px;line-height:1.45}.steps{counter-reset:step;display:grid;gap:10px}.step{counter-increment:step;display:flex;gap:13px;align-items:flex-start;border-left:1px solid #285584;padding:5px 0 10px 14px;animation:cardIn .55s both}.step:before{content:counter(step,decimal-leading-zero);color:var(--blue2);font:700 12px ui-monospace,monospace}.step strong{display:block;margin-bottom:4px}.step span{color:var(--muted);font-size:13px}.codebox{border:1px solid var(--line);background:#020305;border-radius:12px;padding:16px;overflow:auto;color:#c6e2ff;font:13px/1.7 ui-monospace,monospace}.footer{color:#61718a;text-align:center;font-size:12px;margin-top:36px}@keyframes termIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}@keyframes cardIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}.card:nth-child(2),.cmd:nth-child(2),.step:nth-child(2){animation-delay:.08s}.card:nth-child(3),.cmd:nth-child(3),.step:nth-child(3){animation-delay:.16s}.cmd:nth-child(4),.step:nth-child(4){animation-delay:.24s}.cmd:nth-child(5),.step:nth-child(5){animation-delay:.32s}.cmd:nth-child(6){animation-delay:.40s}.cmd:nth-child(7){animation-delay:.48s}.cmd:nth-child(8){animation-delay:.56s}.cmd:nth-child(9){animation-delay:.64s}.cmd:nth-child(10){animation-delay:.72s}@keyframes pulse{50%{box-shadow:0 0 34px var(--glow);transform:translateY(-2px)}}@keyframes blink{50%{opacity:0}}@keyframes rise{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
@media(max-width:720px){.shell{padding:14px 11px 34px}.top{align-items:flex-start}.status{font-size:10px;padding:7px 8px}.hero{padding:20px 16px}.grid,.cmds{grid-template-columns:1fr}.section-title{display:block}.section-title p{margin-top:5px}.hero h2{font-size:38px}.cmd{display:block}.cmd code{display:inline-block;margin-bottom:8px;white-space:normal}.terminal{font-size:12px}}
</style>
</head>
<body>
<main class="shell">
<header class="top"><div class="brand"><div class="mark">&gt;_</div><div><h1>venix CLI</h1><p>Central de ajuda local</p></div></div><div class="status">● localhost · offline-first</div></header>
<section class="hero"><div class="eyebrow">terminal / cloud / deploy</div><h2>Seu terminal.<br><span>Mais simples.</span></h2><p>Use a Venix CLI para autenticar, criar aplicações, acompanhar logs e publicar atualizações sem sair do terminal.</p><div class="terminal"><div class="terminal-head"><span class="dot"></span><span class="dot"></span><span class="dot live"></span><span class="terminal-title">venix · sessão local</span></div><div class="terminal-scroll" id="terminalScroll"><div id="terminalHistory"></div><div class="term-line cmd"><span class="prompt">$</span> <span id="typed"></span><span class="cursor"></span></div></div></div></section>
<nav class="tabs" aria-label="Seções"><button class="active" data-tab="home">Visão geral</button><button data-tab="commands">Comandos</button><button data-tab="usage">Como usar</button><button data-tab="config">Configuração</button></nav>
<section id="home" class="view active"><div class="section-title"><h3>Comece por aqui</h3><p>O essencial em quatro passos.</p></div><div class="grid"><article class="card"><div class="icon">01</div><h4>Entre</h4><p>Execute <b>venix login</b> e autorize no navegador com OAuth2 + PKCE.</p></article><article class="card"><div class="icon">02</div><h4>Crie</h4><p>Rode <b>venix up</b> dentro do seu projeto para criar uma aplicação.</p></article><article class="card"><div class="icon">03</div><h4>Observe</h4><p>Use <b>venix logs -f</b> para acompanhar a aplicação ao vivo.</p></article></div></section>
<section id="commands" class="view"><div class="section-title"><h3>Comandos principais</h3><p>Escolha uma ação e copie o comando.</p></div><div class="cmds"><div class="cmd"><code>venix login</code><div>Autentica sua conta no navegador.</div></div><div class="cmd"><code>venix whoami</code><div>Mostra conta, plano e vínculo atual.</div></div><div class="cmd"><code>venix apps</code><div>Lista aplicações e status.</div></div><div class="cmd"><code>venix up nome</code><div>Cria uma aplicação com o projeto atual.</div></div><div class="cmd"><code>venix push nome</code><div>Envia alterações e reinicia.</div></div><div class="cmd"><code>venix logs nome -f</code><div>Acompanha logs ao vivo.</div></div><div class="cmd"><code>venix restart nome</code><div>Reinicia o container.</div></div><div class="cmd"><code>venix backup nome</code><div>Cria um snapshot do volume.</div></div><div class="cmd"><code>venix ram nome 512</code><div>Altera a memória em MB.</div></div><div class="cmd"><code>venix delete nome</code><div>Exclui depois da confirmação.</div></div></div></section>
<section id="usage" class="view"><div class="section-title"><h3>Fluxo de uso</h3><p>Do zero ao primeiro deploy.</p></div><div class="steps"><div class="step"><div><strong>Instale a CLI</strong><span><code>npm install -g github:LLGGJ/venix-cli</code></span></div></div><div class="step"><div><strong>Faça login</strong><span><code>venix login</code> abre a autorização no navegador.</span></div></div><div class="step"><div><strong>Entre no projeto</strong><span><code>cd meu-projeto</code> e confira seu package.json ou aplicação.</span></div></div><div class="step"><div><strong>Publique</strong><span><code>venix up minha-app</code> cria e vincula a aplicação.</span></div></div><div class="step"><div><strong>Atualize</strong><span>Depois use <code>venix push</code> para enviar mudanças.</span></div></div></div></section>
<section id="config" class="view"><div class="section-title"><h3>Configuração</h3><p>O app público não precisa de segredo.</p></div><div class="codebox">VENIX_CLIENT_ID=venix_cac3c2ea21c362d0a7<br>VENIX_API_BASE_URL=https://api.venixcloud.com/v1<br>VENIX_CALLBACK_PORT=53682<br>VENIX_COLOR=1</div><div class="grid" style="margin-top:12px"><article class="card"><div class="icon">PKCE</div><h4>Login público</h4><p>A CLI usa Client ID público + PKCE S256. Usuários não precisam de Client Secret.</p></article><article class="card"><div class="icon">LOCAL</div><h4>Ajuda local</h4><p>Esta central roda em localhost e não envia dados para nenhum site externo.</p></article><article class="card"><div class="icon">SAFE</div><h4>Segredos</h4><p>Nunca coloque .env, tokens ou credentials.json em repositórios públicos.</p></article></div></section>
<footer class="footer">Venix CLI · ajuda local · pressione Ctrl+C no terminal para encerrar</footer>
</main>
<script>
const tabs=[...document.querySelectorAll('.tabs button')];const views=[...document.querySelectorAll('.view')];tabs.forEach(b=>b.addEventListener('click',()=>{tabs.forEach(x=>x.classList.toggle('active',x===b));views.forEach(v=>v.classList.toggle('active',v.id===b.dataset.tab));}));
const demos=[{cmd:'venix login',out:'● Navegador aberto · OAuth2 + PKCE',type:'ok'},{cmd:'venix apps',out:'● 3 aplicações encontradas · 2 online',type:'ok'},{cmd:'venix up minha-app',out:'◐ Compactando projeto...\\n✔ Aplicação criada · minha-app',type:'ok'},{cmd:'venix logs minha-app -f',out:'[web] listening on :3000\\n[venix] status: online',type:'out'},{cmd:'venix push minha-app',out:'✔ Upload concluído · reiniciando aplicação',type:'ok'}];let demoIndex=0,typedPos=0,back=false;const typed=document.getElementById('typed'),terminalHistory=document.getElementById('terminalHistory'),scroll=document.getElementById('terminalScroll');function bottom(){scroll.scrollTop=scroll.scrollHeight}function addLine(text,kind){const el=document.createElement('div');el.className='term-line '+kind;el.textContent=text;terminalHistory.appendChild(el);bottom()}function typeCommand(){const item=demos[demoIndex],text=item.cmd;typed.textContent=text.slice(0,typedPos++);bottom();if(typedPos<=text.length){setTimeout(typeCommand,60);return}setTimeout(()=>{addLine('$ '+text,'cmd');typed.textContent='';typedPos=0;setTimeout(()=>{addLine(item.out,item.type);setTimeout(()=>{demoIndex=(demoIndex+1)%demos.length;typeCommand()},900)},420)},500)}typeCommand();
</script>
</body></html>`;

export function startHelpServer() {
  const requestedPort = Number(process.env.VENIX_HELP_PORT) || DEFAULT_PORT;
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(page());
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
  server.on('error', (err) => {
    console.error(`Não foi possível abrir a ajuda local: ${err.message}`);
  });
  server.listen(requestedPort, '127.0.0.1', () => {
    const address = server.address();
    const url = `http://127.0.0.1:${typeof address === 'object' ? address.port : requestedPort}`;
    console.log(`\nVenix Help → ${url}`);
    console.log('A central abriu no navegador. Volte ao terminal e use Ctrl+C para fechar.');
    openBrowser(url);
  });
  process.once('SIGINT', () => {
    server.close(() => process.exit(0));
  });
  return server;
}
