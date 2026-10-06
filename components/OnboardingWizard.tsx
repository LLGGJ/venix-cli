'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Store, Users, PanelsTopLeft, ArrowRight, ArrowLeft, Hash, Check, X } from 'lucide-react';

interface ChannelOption { id: string; name: string }

const KINDS: { key: 'loja' | 'comunidade' | 'outro'; label: string; desc: string; icon: any }[] = [
  { key: 'loja', label: 'Loja', desc: 'Vendo produto ou serviço pelo servidor', icon: Store },
  { key: 'comunidade', label: 'Comunidade', desc: 'Comunidade, clã ou grupo de jogo', icon: Users },
  { key: 'outro', label: 'Outro', desc: 'Nenhuma das opções acima', icon: PanelsTopLeft },
];

// Primeira tela que o dono vê com o dashboard vazio: 3 perguntas rápidas e já
// sai com um painel publicado, em vez de uma tela em branco esperando ele
// descobrir sozinho por onde começar.
export default function OnboardingWizard({ guildId, channels }: { guildId: string; channels: ChannelOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1>(0);
  const [kind, setKind] = useState<'loja' | 'comunidade' | 'outro' | null>(null);
  const [channelId, setChannelId] = useState('');
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  async function finish() {
    setBusy(true);
    try {
      const r = await fetch(`/api/onboarding/${guildId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, channelId: channelId || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.panelId) {
        router.push(`/dashboard/${guildId}/panels/${d.panelId}`);
        router.refresh();
        return;
      }
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setHidden(true);
    fetch(`/api/onboarding/${guildId}`, { method: 'DELETE' }).catch(() => {});
    router.refresh();
  }

  if (hidden) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="led-card p-5 sm:p-6 mb-8 relative"
      >
        <button onClick={skip} aria-label="Pular" className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary">
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <p className="text-xs font-medium text-accent-indigoSoft mb-1">// Primeiros passos</p>
        <h2 className="font-display text-lg sm:text-xl font-bold mb-1">Vamos criar seu primeiro painel</h2>
        <p className="text-sm text-text-secondary mb-5">Duas perguntas rápidas e você já sai com algo publicado no servidor.</p>

        <AnimatePresence mode="wait">
          {step === 0 ? (
            <motion.div key="step0" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <p className="text-xs text-text-tertiary mb-2">1. Como é o seu servidor?</p>
              <div className="grid sm:grid-cols-3 gap-2 mb-5">
                {KINDS.map((k) => {
                  const Icon = k.icon;
                  const active = kind === k.key;
                  return (
                    <button
                      key={k.key} onClick={() => setKind(k.key)}
                      className={`text-left rounded-lg border p-3 transition-colors ${
                        active ? 'bg-accent-indigo/15 border-accent-indigo/40' : 'border-base-border hover:border-accent-indigo/30 hover:bg-base-surface2'
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-accent-indigoSoft' : 'text-text-tertiary'}`} strokeWidth={2} />
                      <p className="text-sm font-medium">{k.label}</p>
                      <p className="text-[11px] text-text-tertiary">{k.desc}</p>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setStep(1)} disabled={!kind}
                className="inline-flex items-center gap-1.5 bg-accent-indigo hover:bg-accent-indigoSoft disabled:opacity-40 transition-colors rounded-lg px-4 py-2 text-sm font-medium text-white"
              >
                Continuar <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </motion.div>
          ) : (
            <motion.div key="step1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <p className="text-xs text-text-tertiary mb-2 flex items-center gap-1.5">
                <Hash className="w-3 h-3" strokeWidth={2} /> 2. Em qual canal o painel aparece? (opcional)
              </p>
              <select
                value={channelId} onChange={(e) => setChannelId(e.target.value)}
                className="w-full bg-base-surface2 border border-base-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent-indigo/50 mb-5"
              >
                <option value="">Não publicar agora — só criar o painel</option>
                {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(0)}
                  className="inline-flex items-center gap-1.5 border border-base-border rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                >
                  <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} /> Voltar
                </button>
                <button
                  onClick={finish} disabled={busy}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-accent-indigo hover:bg-accent-indigoSoft disabled:opacity-60 transition-colors rounded-lg px-4 py-2 text-sm font-medium text-white"
                >
                  {busy ? 'Criando...' : <><Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Criar painel</>}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
