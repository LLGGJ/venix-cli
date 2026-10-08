'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plug, QrCode, X, Copy, Check, Eye, EyeOff, Lock, ExternalLink, Sparkles,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Aba "Integrações" do servidor — VERSÃO DE TESTE (só o dono principal vê).
//  • Gmail/E-mail: FUNCIONA (salva em /api/integrations/email/[guildId]).
//  • LofyPay: ainda só o visual.
// ─────────────────────────────────────────────────────────────────────────────

type IntegrationId = 'gmail' | 'lofypay';

/* ── Logos oficiais ─────────────────────────────────────────────────────── */

// Gmail: ícone colorido do Gmail (vetor, sem depender de arquivo).
function GmailLogo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-label="Gmail" role="img">
      <path fill="#4caf50" d="M45 16.2l-5 2.75-5 4.75L35 40h7c1.657 0 3-1.343 3-3V16.2z" />
      <path fill="#1e88e5" d="M3 16.2l3.614 1.71L13 23.7V40H6c-1.657 0-3-1.343-3-3V16.2z" />
      <polygon fill="#e53935" points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17" />
      <path fill="#c62828" d="M3 12.298V16.2l10 7.5V11.2L9.876 8.859C9.132 8.301 8.228 8 7.298 8h0C4.924 8 3 9.924 3 12.298z" />
      <path fill="#fbc02d" d="M45 12.298V16.2l-10 7.5V11.2l3.124-2.341C38.868 8.301 39.772 8 40.702 8h0C43.076 8 45 9.924 45 12.298z" />
    </svg>
  );
}

// LofyPay: tenta o arquivo local (/public/integrations/lofypay.png) e, se ele
// não existir, usa o favicon oficial direto do site da LofyPay. Só se os dois
// falharem cai num ícone genérico (a tela nunca quebra).
const LOFYPAY_LOGO_REMOTE = 'https://app.lofypay.com/img/favicon.png';
function LofyPayLogo({ className = 'w-6 h-6' }: { className?: string }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  if (stage === 2) return <QrCode className={`${className} text-accent-green`} strokeWidth={1.75} />;
  return (
    <img
      src={stage === 0 ? '/integrations/lofypay.png' : LOFYPAY_LOGO_REMOTE}
      alt="LofyPay"
      className={`${className} object-contain`}
      onError={() => setStage((s) => (s === 0 ? 1 : 2))}
    />
  );
}

function Logo({ id, className }: { id: IntegrationId; className?: string }) {
  return id === 'gmail' ? <GmailLogo className={className} /> : <LofyPayLogo className={className} />;
}

const INTEGRATIONS: {
  id: IntegrationId;
  name: string;
  tagline: string;
  desc: string;
  bullets: string[];
}[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    tagline: 'Avisos e transcripts por e-mail',
    desc: 'Receba no seu e-mail os avisos do servidor e envie o transcript do ticket ao cliente quando ele fechar.',
    bullets: ['Transcript para o cliente e/ou para você', 'Aviso de ticket novo e de avaliação', 'Respostas do cliente chegam no seu e-mail'],
  },
  {
    id: 'lofypay',
    name: 'LofyPay',
    tagline: 'Cobrança PIX no ticket',
    desc: 'O staff gera cobranças PIX direto no ticket: QR Code, chave copia e cola e confirmação automática quando o cliente paga.',
    bullets: ['QR Code + botão copiar chave PIX', 'Valor definido pelo staff, dentro do limite que você define', 'Confirmação automática do pagamento'],
  },
];

interface EmailState {
  enabled: boolean;
  owner_email: string;
  events: { transcript_client: boolean; transcript_owner: boolean; ticket_opened_owner: boolean; rating_owner: boolean };
  providerReady: boolean;
  fromAddress: string;
  usage: { sent24h: number; limit: number; perRecipient: number };
}

export default function IntegrationsGuildClient({ guildId, guildName }: { guildId: string; guildName: string }) {
  const [open, setOpen] = useState<IntegrationId | null>(null);
  const [email, setEmail] = useState<EmailState | null>(null);
  const [lofy, setLofy] = useState<LofyState | null>(null);
  const current = INTEGRATIONS.find((i) => i.id === open) || null;

  async function loadLofy() {
    try {
      const r = await fetch(`/api/integrations/lofypay/${guildId}`, { cache: 'no-store' });
      if (r.ok) setLofy(await r.json());
    } catch {}
  }
  useEffect(() => { loadLofy(); }, [guildId]);

  async function loadEmail() {
    try {
      const r = await fetch(`/api/integrations/email/${guildId}`, { cache: 'no-store' });
      if (r.ok) setEmail(await r.json());
    } catch {}
  }
  useEffect(() => { loadEmail(); }, [guildId]);

  const connected = (id: IntegrationId) => id === 'gmail' && !!email?.enabled && !!email.owner_email;

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <p className="text-xs font-medium text-accent-indigoSoft mb-1">// Servidor</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold flex items-center gap-2 mb-2">
          <Plug className="w-6 h-6 text-accent-indigoSoft" strokeWidth={2} />
          Integrações
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          Conecte serviços externos ao atendimento deste servidor.
        </p>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-3">
        {INTEGRATIONS.map((it, i) => {
          return (
            <motion.article
              key={it.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4 }}
              className="card-surface p-5 flex flex-col transition-[border-color,box-shadow] duration-300 hover:border-accent-indigo/40 hover:shadow-[0_8px_30px_-12px_rgba(56,189,248,0.35)]"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-white border border-white/10 flex items-center justify-center shrink-0 p-1.5">
                  <Logo id={it.id} className="w-full h-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-semibold">{it.name}</h2>
                    {(it.id === 'lofypay' ? !!lofy?.connected : connected(it.id)) ? (
                      <span className="mono-tag text-[10px] text-accent-green bg-accent-green/12 border border-accent-green/25 rounded px-1.5 py-0.5">
                        Conectado
                      </span>
                    ) : (
                      <span className="mono-tag text-[10px] text-text-tertiary bg-base-surface2 border border-base-border rounded px-1.5 py-0.5">
                        Não conectado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-tertiary">{it.tagline}</p>
                </div>
              </div>

              <p className="text-sm text-text-secondary leading-relaxed mb-3">{it.desc}</p>
              <ul className="space-y-1.5 mb-5">
                {it.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2 text-xs text-text-secondary">
                    <Check className="w-3.5 h-3.5 text-accent-green shrink-0" strokeWidth={2.5} />
                    {b}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setOpen(it.id)}
                className="mt-auto w-full bg-accent-indigo hover:bg-accent-indigoSoft transition-colors rounded-lg py-2.5 text-sm font-medium text-white"
              >
                {(it.id === 'lofypay' ? !!lofy?.connected : connected(it.id)) ? 'Configurar' : 'Conectar'}
              </button>
            </motion.article>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 bg-accent-indigo/8 border border-accent-indigo/20 rounded-lg px-3.5 py-3 mt-4">
        <Sparkles className="w-4 h-4 text-accent-indigoSoft shrink-0 mt-0.5" strokeWidth={2} />
        <p className="text-xs text-text-secondary leading-relaxed">
          Essas são as integrações disponíveis por enquanto. Mais estão a caminho — vamos liberando aos poucos conforme ficam prontas.
        </p>
      </div>

      <AnimatePresence>
        {current && (
          <Modal key={current.id} onClose={() => setOpen(null)} title={`Conectar ${current.name}`} logoId={current.id}>
            {current.id === 'gmail'
              ? <GmailForm guildId={guildId} guildName={guildName} initial={email} onSaved={loadEmail} onClose={() => setOpen(null)} />
              : <LofyForm guildId={guildId} initial={lofy} onSaved={loadLofy} onClose={() => setOpen(null)} />}
          </Modal>
        )}
      </AnimatePresence>
    </main>
  );
}

/* ── Modal base ─────────────────────────────────────────────────────────── */

function Modal({
  children, onClose, title, logoId,
}: { children: React.ReactNode; onClose: () => void; title: string; logoId: IntegrationId }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={title}
        className="card-surface w-full sm:max-w-md rounded-b-none sm:rounded-b-xl p-5 shadow-card max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-white border border-white/10 flex items-center justify-center p-1.5">
            <Logo id={logoId} className="w-full h-full" />
          </div>
          <h3 className="font-display font-semibold flex-1">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-text-tertiary hover:text-text-primary">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ── Peças de formulário ────────────────────────────────────────────────── */

const inputCls =
  'w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-indigo/50';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="text-xs text-text-secondary mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 text-left bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 mb-2"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm">{label}</span>
        {desc && <span className="block text-[11px] text-text-tertiary">{desc}</span>}
      </span>
      <span className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent-indigo' : 'bg-base-border'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete="off" spellCheck={false}
        className={`${inputCls} pr-10`}
      />
      <button
        type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar' : 'Mostrar'}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
      >
        {show ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
      </button>
    </div>
  );
}

// Botão de salvar de teste: não salva nada, só avisa.
function TestSave({ onClose, label = 'Salvar e conectar' }: { onClose: () => void; label?: string }) {
  const [warn, setWarn] = useState(false);
  return (
    <div className="mt-4">
      <AnimatePresence>
        {warn && (
          <motion.p
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="text-xs text-accent-amber bg-accent-amber/10 border border-accent-amber/25 rounded-lg px-3 py-2 mb-3 overflow-hidden"
          >
            Ainda é só o visual: nada foi salvo nem conectado.
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flex gap-2">
        <button
          onClick={() => setWarn(true)}
          className="flex-1 bg-accent-indigo hover:bg-accent-indigoSoft transition-colors rounded-lg py-2.5 text-sm font-medium text-white"
        >
          {label}
        </button>
        <button onClick={onClose} className="px-4 rounded-lg border border-base-border text-sm text-text-secondary hover:text-text-primary">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ── Gmail / E-mail (funcionando) ───────────────────────────────────────── */

function GmailForm({
  guildId, guildName, initial, onSaved, onClose,
}: { guildId: string; guildName: string; initial: EmailState | null; onSaved: () => void; onClose: () => void }) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [ownerEmail, setOwnerEmail] = useState(initial?.owner_email ?? '');
  const [ev, setEv] = useState(initial?.events ?? { transcript_client: true, transcript_owner: false, ticket_opened_owner: false, rating_owner: false });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setEvent = (k: keyof typeof ev, v: boolean) => setEv((p) => ({ ...p, [k]: v }));
  const from = initial?.fromAddress || 'tickets@zoudertickets.com';

  async function save(): Promise<boolean> {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/integrations/email/${guildId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, owner_email: ownerEmail.trim(), events: ev }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: d.error || 'Não consegui salvar.' }); return false; }
      setMsg({ ok: true, text: 'Salvo!' });
      onSaved();
      return true;
    } catch {
      setMsg({ ok: false, text: 'Erro de conexão ao salvar.' });
      return false;
    } finally { setSaving(false); }
  }

  async function test() {
    if (!(await save())) return;
    setTesting(true);
    try {
      const r = await fetch(`/api/integrations/email/${guildId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guildName }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok
        ? { ok: true, text: `E-mail de teste enviado para ${ownerEmail.trim()}. Confira a caixa de entrada (e o spam).` }
        : { ok: false, text: d.error || 'Não consegui enviar o teste.' });
      onSaved();
    } catch {
      setMsg({ ok: false, text: 'Erro de conexão ao enviar o teste.' });
    } finally { setTesting(false); }
  }

  return (
    <div>
      <p className="text-xs text-text-secondary mb-4 leading-relaxed">
        Os e-mails saem de <code className="text-text-primary">{from}</code> com o nome do seu servidor. Quando o cliente responde, a resposta vai direto para o <strong className="text-text-primary">seu e-mail</strong>.
      </p>

      {initial && !initial.providerReady && (
        <p className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2 mb-3">
          A chave do serviço de e-mail ainda não está configurada no site.
        </p>
      )}

      <Toggle checked={enabled} onChange={setEnabled} label="Integração ativa" desc="Desligada, nenhum e-mail é enviado por este servidor." />

      <div className="mt-3">
        <Field label="Seu e-mail (Gmail ou outro)" hint="Recebe os avisos e as respostas dos clientes.">
          <input value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="voce@gmail.com" inputMode="email" autoComplete="email" className={inputCls} />
        </Field>
      </div>

      <p className="text-xs text-text-secondary mb-2 mt-4">O que enviar</p>
      <Toggle checked={ev.transcript_client} onChange={(v) => setEvent('transcript_client', v)} label="Transcript para o cliente" desc={'Ao fechar o ticket. Precisa de um campo "E-mail" no formulário do painel (VIP).'} />
      <Toggle checked={ev.transcript_owner} onChange={(v) => setEvent('transcript_owner', v)} label="Transcript para mim" desc="Uma cópia de todo ticket fechado." />
      <Toggle checked={ev.ticket_opened_owner} onChange={(v) => setEvent('ticket_opened_owner', v)} label="Aviso de ticket novo" desc="Um e-mail a cada ticket aberto, com o link do canal." />
      <Toggle checked={ev.rating_owner} onChange={(v) => setEvent('rating_owner', v)} label="Aviso de avaliação" desc="Quando um cliente avalia o atendimento." />

      {initial && (
        <div className="flex items-center justify-between text-[11px] text-text-tertiary mt-3">
          <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" strokeWidth={2} /> Limite diário do servidor</span>
          <span><strong className="text-text-secondary">{initial.usage.sent24h}</strong> / {initial.usage.limit} nas últimas 24h</span>
        </div>
      )}

      <AnimatePresence>
        {msg && (
          <motion.p
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className={`text-xs rounded-lg px-3 py-2 mt-3 overflow-hidden border ${msg.ok ? 'text-accent-green bg-accent-green/10 border-accent-green/25' : 'text-accent-red bg-accent-red/10 border-accent-red/25'}`}
          >
            {msg.text}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={save} disabled={saving || testing}
          className="flex-1 min-w-[120px] bg-accent-indigo hover:bg-accent-indigoSoft transition-colors rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving && !testing ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          onClick={test} disabled={saving || testing || !ownerEmail.trim()}
          className="flex-1 min-w-[120px] rounded-lg border border-base-border py-2.5 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          {testing ? 'Enviando...' : 'Enviar teste'}
        </button>
        <button onClick={onClose} className="px-4 rounded-lg border border-base-border text-sm text-text-secondary hover:text-text-primary">
          Fechar
        </button>
      </div>
    </div>
  );
}

/* ── LofyPay (funcionando) ──────────────────────────────────────────────── */

interface LofyState { connected: boolean; enabled: boolean; min_value: number; max_value: number; secretReady: boolean; webhookUrl: string | null }

function LofyForm({
  guildId, initial, onSaved, onClose,
}: { guildId: string; initial: LofyState | null; onSaved: () => void; onClose: () => void }) {
  const [tab, setTab] = useState<'config' | 'tutorial'>('config');
  const [apiKey, setApiKey] = useState('');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [minValue, setMinValue] = useState(initial ? String(initial.min_value).replace('.', ',') : '1,00');
  const [maxValue, setMaxValue] = useState(initial ? String(initial.max_value).replace('.', ',') : '500,00');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // URL real, com o token de segurança embutido — vem pronta do servidor
  // (ver lib/webhookAuth.ts). Não precisa colar em nenhum lugar: o bot já
  // manda essa mesma URL sozinho em toda cobrança que cria.
  const webhookUrl = initial?.webhookUrl || '';

  async function copyWebhook() {
    try { await navigator.clipboard.writeText(webhookUrl); } catch {}
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 1600);
  }

  const toNum = (v: string) => {
    const n = Number(v.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  };

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/integrations/lofypay/${guildId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey.trim(), enabled, min_value: toNum(minValue), max_value: toNum(maxValue) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: d.error || 'Não consegui salvar.' }); return; }
      setMsg({ ok: true, text: 'Salvo!' });
      setApiKey('');
      onSaved();
    } catch {
      setMsg({ ok: false, text: 'Erro de conexão ao salvar.' });
    } finally { setSaving(false); }
  }

  // Confirmação das cobranças é por WEBHOOK (a LofyPay avisa a URL abaixo
  // sozinha, sem o site ficar perguntando). Este botão só valida que a chave
  // é aceita, criando uma cobrança de R$ 1,00 descartável.
  async function test() {
    const key = apiKey.trim();
    if (!key) { setMsg({ ok: false, text: 'Cole a chave antes de testar.' }); return; }
    setTesting(true); setMsg(null);
    try {
      const r = await fetch(`/api/integrations/lofypay/${guildId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: key }),
      });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? { ok: true, text: 'Chave válida! A LofyPay aceitou a cobrança de teste.' } : { ok: false, text: d.error || 'A chave não funcionou.' });
    } catch {
      setMsg({ ok: false, text: 'Erro de conexão ao testar.' });
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    if (!confirm('Desconectar a LofyPay deste servidor? O staff não vai mais conseguir cobrar por PIX nos tickets.')) return;
    setRemoving(true);
    try {
      const r = await fetch(`/api/integrations/lofypay/${guildId}`, { method: 'DELETE' });
      if (r.ok) { onSaved(); onClose(); }
    } finally { setRemoving(false); }
  }

  return (
    <div>
      <div className="flex gap-1 mb-4 bg-base-surface2 border border-base-border rounded-lg p-1">
        {(['config', 'tutorial'] as const).map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'bg-accent-indigo/20 text-accent-indigoSoft' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {t === 'config' ? 'Configurar' : 'Como fazer (tutorial)'}
          </button>
        ))}
      </div>

      {tab === 'config' ? (
        <div>
          {initial && !initial.secretReady && (
            <p className="text-xs text-accent-red bg-accent-red/10 border border-accent-red/25 rounded-lg px-3 py-2 mb-3">
              O site ainda não está pronto para guardar chaves com segurança (falta configurar no servidor).
            </p>
          )}

          <Field label="Chave da API (LofyPay)" hint={initial?.connected ? 'Já existe uma chave salva. Deixe em branco para manter a atual, ou cole uma nova para substituir.' : 'Fica criptografada e nunca é mostrada de volta.'}>
            <SecretInput value={apiKey} onChange={setApiKey} placeholder={initial?.connected ? '•••••••••••••••• (chave salva)' : 'Cole aqui a sua chave da LofyPay'} />
          </Field>

          <Field label="URL do webhook" hint="A LofyPay avisa este link sozinha quando um PIX é pago — é por aqui que a confirmação acontece de verdade, sem o site precisar ficar perguntando.">
            <div className="flex gap-2">
              <input readOnly value={webhookUrl} className={`${inputCls} text-text-tertiary`} />
              <button
                type="button" onClick={copyWebhook} aria-label="Copiar URL do webhook"
                className="w-10 shrink-0 rounded-lg border border-base-border flex items-center justify-center text-text-secondary hover:text-text-primary"
              >
                {copiedWebhook ? <Check className="w-4 h-4 text-accent-green" strokeWidth={2.5} /> : <Copy className="w-4 h-4" strokeWidth={2} />}
              </button>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Valor mínimo (R$)">
              <input value={minValue} onChange={(e) => setMinValue(e.target.value.replace(/[^\d,]/g, ''))} placeholder="1,00" inputMode="decimal" className={inputCls} />
            </Field>
            <Field label="Valor máximo (R$)">
              <input value={maxValue} onChange={(e) => setMaxValue(e.target.value.replace(/[^\d,]/g, ''))} placeholder="500,00" inputMode="decimal" className={inputCls} />
            </Field>
          </div>

          <Toggle checked={enabled} onChange={setEnabled} label="Cobrança PIX nos tickets" desc="Mostra &quot;Cobrar via PIX&quot; no Painel Staff do ticket." />

          <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary mt-1 mb-1">
            <Lock className="w-3 h-3" strokeWidth={2} /> O dinheiro cai direto na sua conta LofyPay — o bot nunca toca no valor.
          </div>

          <AnimatePresence>
            {msg && (
              <motion.p
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className={`text-xs rounded-lg px-3 py-2 mt-3 overflow-hidden border ${msg.ok ? 'text-accent-green bg-accent-green/10 border-accent-green/25' : 'text-accent-red bg-accent-red/10 border-accent-red/25'}`}
              >
                {msg.text}
              </motion.p>
            )}
          </AnimatePresence>



          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={save} disabled={saving || testing || removing}
              className="flex-1 min-w-[110px] bg-accent-indigo hover:bg-accent-indigoSoft transition-colors rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={test} disabled={saving || testing || removing || !apiKey.trim()}
              className="flex-1 min-w-[110px] rounded-lg border border-base-border py-2.5 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50">
              {testing ? 'Testando...' : 'Testar chave'}
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            {initial?.connected && (
              <button onClick={disconnect} disabled={removing || saving || testing}
                className="flex-1 rounded-lg border border-accent-red/30 text-accent-red py-2 text-xs font-medium hover:bg-accent-red/10 disabled:opacity-50">
                {removing ? 'Desconectando...' : 'Desconectar'}
              </button>
            )}
            <button onClick={onClose} className="flex-1 rounded-lg border border-base-border text-xs text-text-secondary hover:text-text-primary py-2">
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <LofyTutorial />
      )}
    </div>
  );
}

function TutStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-6 h-6 rounded-full bg-accent-indigo/15 border border-accent-indigo/30 text-accent-indigoSoft text-xs font-semibold flex items-center justify-center shrink-0">{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium mb-0.5">{title}</p>
        <div className="text-xs text-text-secondary leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function LofyTutorial() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-text-secondary leading-relaxed">
        Siga os passos para conectar a sua conta da LofyPay. O dinheiro das cobranças vai direto para ela — o bot só gera o QR Code e confere se o pagamento caiu.
      </p>
      <TutStep n={1} title="Crie (ou acesse) sua conta na LofyPay">
        Entre em{' '}
        <a href="https://app.lofypay.com" target="_blank" rel="noopener noreferrer" className="text-accent-indigoSoft hover:underline inline-flex items-center gap-1">
          app.lofypay.com <ExternalLink className="w-3 h-3" strokeWidth={2} />
        </a>{' '}
        e faça seu cadastro com os dados da sua empresa ou CPF/CNPJ.
      </TutStep>
      <TutStep n={2} title="Gere a sua chave de API">
        No painel da LofyPay, procure por <strong className="text-text-primary">API</strong> ou <strong className="text-text-primary">Integrações</strong> e crie uma nova chave (às vezes chamada de <em>API Key</em> ou <em>Secret Key</em>).
      </TutStep>
      <TutStep n={3} title="Cole a chave aqui">
        Volte na aba <strong className="text-text-primary">Configurar</strong>, cole a chave no campo e clique em <strong className="text-text-primary">Testar chave</strong> antes de salvar, pra ter certeza de que está certa.
      </TutStep>
      <TutStep n={4} title="Defina o valor mínimo e máximo">
        É o limite que o staff pode cobrar por ticket. Comece com algo seguro, como R$ 1,00 a R$ 500,00, e ajuste depois.
      </TutStep>
      <TutStep n={5} title="Ligue a cobrança PIX e salve">
        Com o interruptor ligado e a chave salva, a opção <strong className="text-text-primary">Cobrar via PIX</strong> já aparece no Painel Staff de todos os tickets do servidor.
      </TutStep>
      <TutStep n={6} title="Teste no Discord">
        Abra um ticket de teste, clique em <strong className="text-text-primary">Cobrar via PIX</strong> no Painel Staff, informe um valor baixo (ex.: R$ 1,00) e confira se o QR Code e a chave aparecem certinho.
      </TutStep>
      <div className="rounded-lg bg-accent-amber/10 border border-accent-amber/25 px-3 py-2.5">
        <p className="text-[11px] text-accent-amber leading-relaxed">
          Guarde bem a sua chave: ela dá acesso para gerar cobranças na sua conta. Se desconfiar que vazou, gere uma nova na LofyPay e cole ela aqui.
        </p>
      </div>
    </div>
  );
}

