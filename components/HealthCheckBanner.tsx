'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X, ChevronRight } from 'lucide-react';
import type { HealthIssue } from '@/lib/healthCheck';

const LABEL: Record<HealthIssue['kind'], (label: string) => string> = {
  missing_channel: () => 'O canal onde este painel é publicado não existe mais.',
  missing_logs_channel: () => 'O canal de logs deste painel não existe mais.',
  missing_role: (id) => `Um cargo de staff deste painel foi apagado (ID ${id}).`,
};

// Dispensar some só NESTA sessão (sessionStorage) — reabrindo o dashboard
// depois, se o problema continuar, o aviso volta. Isso evita duas coisas:
// o dono esquecer de vez de um canal quebrado, e o aviso voltar irritante
// toda hora que ele só trocou de página.
const DISMISS_KEY = 'zt_health_dismissed';

export default function HealthCheckBanner({ guildId, issues }: { guildId: string; issues: HealthIssue[] }) {
  const [dismissed, setDismissed] = useState(true); // começa escondido até checar o sessionStorage (evita flash)

  useEffect(() => {
    try {
      const key = `${DISMISS_KEY}:${guildId}:${issues.length}`;
      setDismissed(sessionStorage.getItem(key) === '1');
    } catch {
      setDismissed(false);
    }
  }, [guildId, issues.length]);

  function dismiss() {
    try { sessionStorage.setItem(`${DISMISS_KEY}:${guildId}:${issues.length}`, '1'); } catch {}
    setDismissed(true);
  }

  if (issues.length === 0) return null;

  // Agrupa por painel pra não listar o mesmo painel 3x se tiver vários cargos sumidos.
  const byPanel = new Map<string, { title: string; items: HealthIssue[] }>();
  for (const i of issues) {
    const cur = byPanel.get(i.panelId) || { title: i.panelTitle, items: [] };
    cur.items.push(i);
    byPanel.set(i.panelId, cur);
  }

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden mb-6"
        >
          <div className="rounded-xl border border-accent-amber/25 bg-accent-amber/[0.06] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-accent-amber mb-2">
                  {issues.length === 1 ? '1 coisa precisa de atenção' : `${byPanel.size} ${byPanel.size === 1 ? 'painel precisa' : 'painéis precisam'} de atenção`}
                </p>
                <ul className="space-y-1.5">
                  {Array.from(byPanel.entries()).map(([panelId, { title, items }]) => (
                    <li key={panelId}>
                      <Link
                        href={`/dashboard/${guildId}/panels/${panelId}`}
                        className="group flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
                      >
                        <span className="font-medium text-text-primary">{title}:</span>
                        <span>{items.map((it) => LABEL[it.kind](it.label)).join(' ')}</span>
                        <ChevronRight className="w-3 h-3 text-text-tertiary group-hover:translate-x-0.5 transition-transform shrink-0" strokeWidth={2} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={dismiss} aria-label="Dispensar aviso"
                className="text-text-tertiary hover:text-text-primary shrink-0 -mt-0.5 -mr-0.5"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
