'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, Trash2, Power, Hash, Palette, X, ChevronRight, AlertTriangle, Lock, Copy, Check, Server } from 'lucide-react';
import ColorPickerButton from './ColorPickerButton';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface Panel {
  panel_id: string;
  guild_id: string;
  enabled: boolean;
  title: string;
  description: string;
  color: string;
  panel_channel_id: string | null;
  ticket_type: string;
  max_tickets: number;
}

export default function PanelsClient({
  guildId,
  initialPanels,
  limit,
  otherGuilds = [],
}: {
  guildId: string;
  initialPanels: Panel[];
  limit: number | null;
  otherGuilds?: { id: string; name: string }[];
}) {
  const { t } = useLanguage();
  const [panels, setPanels] = useState(initialPanels);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: t('pl_default_description'), color: '#5865F2' });
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Panel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState<Panel | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState('');
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');
  const [duplicatedOk, setDuplicatedOk] = useState(false);

  async function confirmDuplicate() {
    if (!duplicating || !duplicateTarget) return;
    setDuplicateBusy(true);
    setDuplicateError('');
    try {
      const r = await fetch(`/api/panels/${guildId}/duplicate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ panelId: duplicating.panel_id, targetGuildId: duplicateTarget }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setDuplicateError(d.error || 'Não consegui duplicar.'); return; }
      setDuplicatedOk(true);
      setTimeout(() => {
        setDuplicating(null); setDuplicateTarget(''); setDuplicatedOk(false);
      }, 1400);
    } catch {
      setDuplicateError('Erro de conexão.');
    } finally {
      setDuplicateBusy(false);
    }
  }

  // Fluxo "Criar com IA": mode controla o que o modal mostra —
  // 'prompt' (campo de texto pra descrever o painel), 'needsIa' (aviso pra
  // configurar a IA primeiro) ou null (fechado). generatingAi é o loading
  // enquanto espera a resposta da IA (pode levar alguns segundos).
  const [aiMode, setAiMode] = useState<'prompt' | 'needsIa' | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [useServerEmojis, setUseServerEmojis] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState('');

  const canCreate = limit === null || panels.length < limit;

  async function createPanel() {
    if (!form.title.trim()) { setError(t('pl_title_required_error')); return; }
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`/api/panels/${guildId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: form }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || t('pl_create_error')); return; }
      setPanels((prev) => [...prev, data.panel]);
      setShowCreate(false);
      setForm({ title: '', description: t('pl_default_description'), color: '#5865F2' });
    } finally {
      setCreating(false);
    }
  }

  // Abre o fluxo de IA — decide na hora se mostra o campo de prompt ou o
  // aviso de "configure a IA primeiro", checando o backend (evita expor se
  // a guild tem chave de IA configurada só pelo estado do front).
  async function openAiCreate() {
    setAiError('');
    setAiPrompt('');
    try {
      const res = await fetch(`/api/guilds/${guildId}/ia-status`);
      const data = await res.json();
      setAiMode(data.configured ? 'prompt' : 'needsIa');
    } catch {
      // Se a checagem falhar, deixa tentar gerar mesmo assim — a rota de
      // geração também valida e devolve o mesmo aviso se precisar.
      setAiMode('prompt');
    }
  }

  async function generateWithAi() {
    if (!aiPrompt.trim()) { setAiError(t('pl_ai_describe_required_error')); return; }
    setGeneratingAi(true);
    setAiError('');
    try {
      const res = await fetch(`/api/panels/${guildId}/ai-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, useServerEmojis }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'IA_NOT_CONFIGURED') { setAiMode('needsIa'); return; }
        setAiError(data.error || t('pl_ai_generate_error'));
        return;
      }
      setPanels((prev) => [...prev, data.panel]);
      setAiMode(null);
    } finally {
      setGeneratingAi(false);
    }
  }
  async function togglePanel(panelId: string, enabled: boolean) {
    setPanels((prev) => prev.map((p) => (p.panel_id === panelId ? { ...p, enabled } : p)));
    await fetch(`/api/panels/${guildId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panelId, fields: { enabled } }),
    });
  }

  // BUG CORRIGIDO: antes, clicar na lixeira apagava o painel NA HORA, sem
  // nenhuma confirmação — um toque sem querer perdia o painel de vez, sem
  // chance de desfazer. Agora o clique só abre um modal de confirmação
  // (mesmo padrão de "mensagem grande com confirmar/cancelar" já usado do
  // lado do bot no Discord); a exclusão de verdade só acontece em
  // confirmDeletePanel, chamada pelo botão "Excluir" dentro do modal.
  function requestDeletePanel(p: Panel) {
    setConfirmDelete(p);
  }

  async function confirmDeletePanel() {
    if (!confirmDelete) return;
    const panelId = confirmDelete.panel_id;
    setDeleting(true);
    try {
      await fetch(`/api/panels/${guildId}?panelId=${panelId}`, { method: 'DELETE' });
      setPanels((prev) => prev.filter((p) => p.panel_id !== panelId));
      setConfirmDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('pl_title')}</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {panels.length}{limit !== null ? ` ${t('pl_of')} ${limit}` : ''} {t('pl_panels_suffix')}
            {limit !== null && ` ${t('pl_free_plan_suffix')}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openAiCreate}
            disabled={!canCreate}
            className="flex items-center justify-center gap-2 bg-base-surface2 border border-base-border hover:border-accent-indigo/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium text-text-primary"
          >
            <Sparkles className="w-4 h-4 text-accent-indigoSoft" strokeWidth={2} />
            {t('pl_ai_create_btn')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            disabled={!canCreate}
            className="flex items-center justify-center gap-2 bg-accent-indigo hover:bg-accent-indigoSoft disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            {t('pl_new_panel_btn')}
          </button>
        </div>
      </div>

      {!canCreate && (
        <div className="card-surface border-accent-amber/25 p-4 mb-6 text-sm text-accent-amber bg-accent-amber/5">
          {t('pl_limit_reached').replace('{limit}', String(limit))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {panels.map((p, i) => (
          <motion.div
            key={p.panel_id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="status-rail card-surface shadow-card overflow-hidden"
            style={{ ['--rail-color' as any]: p.enabled ? p.color : '#5B6178' }}
          >
            <Link href={`/dashboard/${guildId}/panels/${p.panel_id}`} className="block pl-5 pr-4 py-4 hover:bg-base-surface2/40 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.title}</p>
                  <p className="mono-tag text-[11px] text-text-tertiary mt-0.5">{p.panel_id}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.preventDefault(); togglePanel(p.panel_id, !p.enabled); }}
                    className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                      p.enabled ? 'text-accent-green bg-accent-green/10' : 'text-text-tertiary bg-base-surface2'
                    }`}
                    title={p.enabled ? t('pl_deactivate') : t('pl_activate')}
                  >
                    <Power className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  {otherGuilds.length > 0 && (
                    <button
                      onClick={(e) => { e.preventDefault(); setDuplicating(p); setDuplicateTarget(''); setDuplicateError(''); setDuplicatedOk(false); }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-accent-indigoSoft hover:bg-accent-indigo/10 transition-colors"
                      title="Duplicar para outro servidor"
                    >
                      <Copy className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.preventDefault(); requestDeletePanel(p); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-text-tertiary hover:text-accent-red hover:bg-accent-red/10 transition-colors"
                    title={t('pl_delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <ChevronRight className="w-4 h-4 text-text-tertiary ml-0.5" strokeWidth={2} />
                </div>
              </div>
              <p className="text-xs text-text-secondary line-clamp-2 mb-3">{p.description}</p>
              <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" strokeWidth={2} />{p.ticket_type}</span>
                <span className="flex items-center gap-1"><Palette className="w-3 h-3" strokeWidth={2} />{p.color}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {panels.length === 0 && (
        <div className="card-surface p-10 text-center">
          <p className="text-sm text-text-secondary">{t('pl_no_panels')}</p>
        </div>
      )}

      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="card-surface p-6 w-full max-w-md shadow-card"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display font-semibold">{t('pl_new_panel_btn')}</h3>
                <button onClick={() => setShowCreate(false)} className="text-text-tertiary hover:text-text-primary">
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-secondary mb-1.5 block">{t('pl_field_title')}</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder={t('pl_field_title_placeholder')}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-indigo/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary mb-1.5 block">{t('pl_field_description')}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-indigo/50 resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-secondary mb-1.5 block">{t('pl_field_color')}</label>
                  <div className="flex items-center gap-2">
                    <ColorPickerButton value={form.color} onChange={(hex) => setForm({ ...form, color: hex })} />
                    <span className="mono-tag text-xs text-text-secondary">{form.color}</span>
                  </div>
                </div>

                {error && <p className="text-xs text-accent-red">{error}</p>}

                <button
                  onClick={createPanel}
                  disabled={creating}
                  className="w-full bg-accent-indigo hover:bg-accent-indigoSoft transition-colors rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {creating ? t('pl_creating') : t('pl_create_btn')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {aiMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !generatingAi && setAiMode(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="card-surface p-6 w-full max-w-md shadow-card"
            >
              {aiMode === 'needsIa' ? (
                <>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-lg bg-accent-amber/12 border border-accent-amber/25 flex items-center justify-center shrink-0">
                      <Lock className="w-4.5 h-4.5 text-accent-amber" strokeWidth={2} />
                    </div>
                    <h3 className="font-display font-semibold">{t('pl_ai_not_configured_title')}</h3>
                  </div>
                  <p className="text-sm text-text-secondary mb-5">
                    {(() => {
                      const parts = t('pl_ai_notconfigured').split('{cmd}');
                      return <>{parts[0]}<code className="mono-tag text-xs">/config-ia</code>{parts[1]}</>;
                    })()}
                  </p>
                  <button
                    onClick={() => setAiMode(null)}
                    className="w-full bg-base-surface2 hover:bg-base-border transition-colors rounded-lg py-2.5 text-sm font-medium text-text-secondary"
                  >
                    {t('pl_understood')}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-accent-indigoSoft" strokeWidth={2} />
                      <h3 className="font-display font-semibold">{t('pl_ai_create_modal_title')}</h3>
                    </div>
                    <button onClick={() => !generatingAi && setAiMode(null)} className="text-text-tertiary hover:text-text-primary">
                      <X className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>

                  <label className="text-xs text-text-secondary mb-1.5 block">{t('pl_ai_describe_label')}</label>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    rows={4}
                    maxLength={700}
                    placeholder={t('pl_ai_placeholder')}
                    disabled={generatingAi}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-indigo/50 resize-none disabled:opacity-60"
                  />

                  <div className="flex items-center justify-between mt-3 mb-1">
                    <span className="text-xs text-text-secondary">{t('pl_ai_use_server_emojis')}</span>
                    <button
                      onClick={() => setUseServerEmojis((v) => !v)}
                      disabled={generatingAi}
                      className={`w-10 h-5.5 rounded-full relative transition-colors shrink-0 disabled:opacity-50 ${
                        useServerEmojis ? 'bg-accent-indigo' : 'bg-base-surface2 border border-base-border'
                      }`}
                    >
                      <motion.div
                        animate={{ x: useServerEmojis ? 18 : 2 }}
                        transition={{ duration: 0.15 }}
                        className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                      />
                    </button>
                  </div>
                  <p className="text-[11px] text-text-tertiary mb-1">
                    {useServerEmojis ? t('pl_ai_emoji_hint_on') : t('pl_ai_emoji_hint_off')}
                  </p>

                  {aiError && <p className="text-xs text-accent-red mt-2">{aiError}</p>}

                  <button
                    onClick={generateWithAi}
                    disabled={generatingAi}
                    className="w-full mt-4 bg-accent-indigo hover:bg-accent-indigoSoft transition-colors rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {generatingAi ? t('pl_generating') : t('pl_generate_btn')}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !deleting && setConfirmDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="card-surface p-6 w-full max-w-md shadow-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-accent-red/12 border border-accent-red/25 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4.5 h-4.5 text-accent-red" strokeWidth={2} />
                  </div>
                  <h3 className="font-display font-semibold">{t('pl_delete_confirm_title')}</h3>
                </div>
                <button
                  onClick={() => !deleting && setConfirmDelete(null)}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              <p className="text-sm text-text-secondary mb-1">
                {(() => {
                  const parts = t('pl_delete_confirm_body').split('{title}');
                  return <>{parts[0]}<strong className="text-text-primary">{confirmDelete.title}</strong>{parts[1]}</>;
                })()}
              </p>
              <p className="text-xs text-text-tertiary mb-5">
                {t('pl_delete_confirm_note')}
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting}
                  className="flex-1 bg-base-surface2 hover:bg-base-border transition-colors rounded-lg py-2.5 text-sm font-medium text-text-secondary disabled:opacity-50"
                >
                  {t('pl_cancel')}
                </button>
                <button
                  onClick={confirmDeletePanel}
                  disabled={deleting}
                  className="flex-1 bg-accent-red hover:bg-accent-red/85 transition-colors rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {deleting ? t('pl_deleting') : t('pl_delete')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {duplicating && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !duplicateBusy && setDuplicating(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="card-surface p-6 w-full max-w-md shadow-card"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-accent-indigo/12 border border-accent-indigo/25 flex items-center justify-center shrink-0">
                    <Copy className="w-4.5 h-4.5 text-accent-indigoSoft" strokeWidth={2} />
                  </div>
                  <h3 className="font-display font-semibold">Duplicar painel</h3>
                </div>
                <button onClick={() => !duplicateBusy && setDuplicating(null)} className="text-text-tertiary hover:text-text-primary">
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>

              {duplicatedOk ? (
                <div className="flex items-center gap-2 text-sm text-accent-green py-4">
                  <Check className="w-4 h-4" strokeWidth={2.5} /> Painel duplicado! Abra o outro servidor pra configurar o canal e a equipe.
                </div>
              ) : (
                <>
                  <p className="text-sm text-text-secondary mb-1">
                    Copia <strong className="text-text-primary">{duplicating.title}</strong> para outro servidor que você administra.
                  </p>
                  <p className="text-xs text-text-tertiary mb-4">
                    O canal, o cargo de staff e o canal de logs não vêm junto — você define isso no servidor de destino.
                  </p>

                  <label className="text-xs text-text-secondary mb-1.5 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5" strokeWidth={2} /> Servidor de destino
                  </label>
                  <select
                    value={duplicateTarget}
                    onChange={(e) => setDuplicateTarget(e.target.value)}
                    className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent-indigo/50 mb-4"
                  >
                    <option value="">Escolher servidor...</option>
                    {otherGuilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>

                  {duplicateError && <p className="text-xs text-accent-red mb-4">{duplicateError}</p>}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDuplicating(null)} disabled={duplicateBusy}
                      className="flex-1 bg-base-surface2 hover:bg-base-border transition-colors rounded-lg py-2.5 text-sm font-medium text-text-secondary disabled:opacity-50"
                    >
                      {t('pl_cancel')}
                    </button>
                    <button
                      onClick={confirmDuplicate} disabled={duplicateBusy || !duplicateTarget}
                      className="flex-1 bg-accent-indigo hover:bg-accent-indigoSoft transition-colors rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {duplicateBusy ? 'Duplicando...' : 'Duplicar'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
