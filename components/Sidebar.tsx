'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, Ticket, PanelsTopLeft, Crown, ShieldOff, Bot, LogOut, ArrowLeft, Menu, X, ShieldCheck, Handshake, Bell, Link2, LifeBuoy, ChevronDown, Plug, Trophy,
} from 'lucide-react';
import { STAFF_NAV } from '@/lib/staffNav';
import { useLanguage } from '@/lib/i18n/LanguageContext';

const NAV = [
  { href: '', key: 'nav_overview', icon: LayoutDashboard },
  { href: '/tickets', key: 'nav_tickets', icon: Ticket },
  { href: '/panels', key: 'nav_panels', icon: PanelsTopLeft },
  { href: '/vip', key: 'nav_vip', icon: Crown },
  { href: '/blacklist', key: 'nav_blacklist', icon: ShieldOff },
  { href: '/ia', key: 'nav_ia', icon: Bot },
];

function SidebarContent({ guildId, guildName, guildIcon, isOwner, isMainOwner, isAffiliate, onNavigate }: { guildId: string; guildName: string; guildIcon: string | null; isOwner: boolean; isMainOwner: boolean; isAffiliate: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const base = `/dashboard/${guildId}`;
  const { t } = useLanguage();
  // Dropdown STAFFS: já abre sozinho se estiver dentro de /staff.
  const [staffOpen, setStaffOpen] = useState(pathname.startsWith('/staff'));

  // Lembra o último servidor aberto: as páginas /staff usam esse cookie pra
  // continuar mostrando o menu do servidor (com o dropdown STAFFS) em vez do
  // menu separado só de staff.
  useEffect(() => {
    document.cookie = `zt_last_guild=${guildId}; path=/; max-age=2592000; samesite=lax`;
  }, [guildId]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-base-border">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 text-xs text-text-tertiary hover:text-text-secondary transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          {t('nav_back_servers')}
        </Link>
        <div className="flex items-center gap-2.5 min-w-0">
          {guildIcon ? (
            <img src={guildIcon} alt="" className="w-7 h-7 rounded-full shrink-0 object-cover" />
          ) : (
            <div className="w-7 h-7 rounded-full shrink-0 bg-base-surface2 flex items-center justify-center text-[11px] font-semibold text-text-tertiary">
              {guildName.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="font-display font-semibold text-sm truncate">{guildName}</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-base-muted">
          {t('nav_section_config')}
        </p>
        {NAV.map((item) => {
          const href = `${base}${item.href}`;
          const active = pathname === href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-accent-indigo/15 text-accent-indigoSoft border border-accent-indigo/25'
                  : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={2} />
              {t(item.key)}
            </Link>
          );
        })}

        {/* Conquistas: card compartilhável + vitrine da página inicial (todos os admins) */}
        <Link
          href={`${base}/conquistas`}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${
            pathname === `${base}/conquistas`
              ? 'bg-accent-indigo/15 text-accent-indigoSoft border border-accent-indigo/25'
              : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary border border-transparent'
          }`}
        >
          <Trophy className="w-4 h-4 shrink-0" strokeWidth={2} />
          Conquistas
        </Link>

        {/* Integrações: liberado pra qualquer admin do servidor (a página
            também confere isso no servidor, não só aqui no menu). */}
        {isOwner && (
          <Link
            href={`${base}/integracoes`}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${
              pathname === `${base}/integracoes`
                ? 'bg-accent-indigo/15 text-accent-indigoSoft border border-accent-indigo/25'
                : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary border border-transparent'
            }`}
          >
            <Plug className="w-4 h-4 shrink-0" strokeWidth={2} />
            Integrações
          </Link>
        )}

        {/* Agora liberado pra todo mundo ver — fica logo abaixo do NAV
            normal, com separador. */}
        <div className="h-px bg-base-border my-2" />

        <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-base-muted">
          {t('nav_section_info')}
        </p>
        {/* Notificações é global (não é por servidor) — ativar aqui vale pra
            qualquer servidor onde o usuário tenha o cargo de suporte. Fica
            dentro da rota do servidor atual só pra herdar o menu lateral —
            a página em si não depende do guildId. */}
        <Link
          href={`${base}/notificacoes`}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${
            pathname === `${base}/notificacoes`
              ? 'bg-accent-indigo/15 text-accent-indigoSoft border border-accent-indigo/25'
              : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary border border-transparent'
          }`}
        >
          <Bell className="w-4 h-4 shrink-0" strokeWidth={2} />
          {t('nav_notifications')}
        </Link>
        {isAffiliate && (
        <Link
          href={`${base}/afiliados`}
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${
            pathname === `${base}/afiliados`
              ? 'bg-accent-indigo/15 text-accent-indigoSoft border border-accent-indigo/25'
              : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary border border-transparent'
          }`}
        >
          <Link2 className="w-4 h-4 shrink-0" strokeWidth={2} />
          {t('nav_affiliates')}
        </Link>
        )}
        <Link
          href="/parcerias"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${
            pathname === '/parcerias'
              ? 'bg-accent-indigo/15 text-accent-indigoSoft border border-accent-indigo/25'
              : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary border border-transparent'
          }`}
        >
          <Handshake className="w-4 h-4 shrink-0" strokeWidth={2} />
          {t('nav_partnerships')}
        </Link>
        <Link
          href="/suporte"
          onClick={onNavigate}
          className={`flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm transition-colors ${
            pathname === '/suporte'
              ? 'bg-accent-indigo/15 text-accent-indigoSoft border border-accent-indigo/25'
              : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary border border-transparent'
          }`}
        >
          <LifeBuoy className="w-4 h-4 shrink-0" strokeWidth={2} />
          {t('nav_support')}
        </Link>

        {/* Só aparece pra quem é o OWNER_ID do bot — calculado no servidor
            (layout.tsx), nunca no cliente, e chega aqui só como um booleano
            já resolvido. Separado do resto do NAV por uma linha, já que não
            é uma seção deste servidor — é uma área global do dono do bot. */}
        {isOwner && (
          <>
            <div className="h-px bg-base-border my-2" />
            <button
              type="button"
              onClick={() => setStaffOpen((o) => !o)}
              aria-expanded={staffOpen}
              aria-controls="staffs-menu"
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm font-semibold tracking-wide transition-colors border ${
                staffOpen
                  ? 'bg-accent-indigo/15 text-accent-indigoSoft border-accent-indigo/25'
                  : 'text-accent-indigoSoft hover:bg-accent-indigo/10 border-transparent'
              }`}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" strokeWidth={2} />
              <span className="flex-1 text-left">STAFFS</span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform duration-200 ${staffOpen ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </button>
            <AnimatePresence initial={false}>
              {staffOpen && (
                <motion.div
                  id="staffs-menu"
                  key="staffs-menu"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <div className="ml-4 mt-1 pl-2 border-l border-accent-indigo/20 space-y-0.5">
                    {STAFF_NAV.map((item) => {
                      const href = `/staff${item.href}`;
                      const active = pathname === href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={onNavigate}
                          className={`flex items-center gap-2 px-2.5 py-2 sm:py-1.5 rounded-md text-[13px] transition-colors ${
                            active
                              ? 'bg-accent-indigo/15 text-accent-indigoSoft'
                              : 'text-text-secondary hover:bg-base-surface2 hover:text-text-primary'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </nav>

      <div className="p-3 border-t border-base-border">
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 rounded-lg text-sm text-text-tertiary hover:text-accent-red hover:bg-accent-red/10 transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={2} />
          {t('nav_logout')}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ guildId, guildName, guildIcon, isOwner, isMainOwner, isAffiliate }: { guildId: string; guildName: string; guildIcon: string | null; isOwner: boolean; isMainOwner: boolean; isAffiliate: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha o drawer automaticamente ao trocar de rota (ex: navegação por trás/frente do navegador)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="w-full sm:w-auto sm:contents">
      {/* ── Topbar mobile: só aparece abaixo do breakpoint sm ── */}
      <div className="sm:hidden sticky top-0 z-30 w-full flex items-center justify-between px-4 py-3 border-b border-base-border bg-base-bg/95 backdrop-blur-sm">
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:bg-base-surface2 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" strokeWidth={2} />
        </button>
        <div className="flex items-center gap-2 min-w-0 max-w-[60%]">
          {guildIcon ? (
            <img src={guildIcon} alt="" className="w-6 h-6 rounded-full shrink-0 object-cover" />
          ) : (
            <div className="w-6 h-6 rounded-full shrink-0 bg-base-surface2 flex items-center justify-center text-[10px] font-semibold text-text-tertiary">
              {guildName.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="font-display font-semibold text-sm truncate">{guildName}</p>
        </div>
        <div className="w-9 shrink-0" /> {/* spacer para centralizar o título */}
      </div>

      {/* ── Sidebar fixa: só aparece em telas sm+ ── */}
      <aside className="hidden sm:flex w-60 shrink-0 border-r border-base-border h-screen sticky top-0 flex-col bg-base-surface/40 backdrop-blur-sm">
        <SidebarContent guildId={guildId} guildName={guildName} guildIcon={guildIcon} isOwner={isOwner} isMainOwner={isMainOwner} isAffiliate={isAffiliate} />
      </aside>

      {/* ── Drawer mobile: overlay + painel deslizante, só existe quando aberto ── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="sm:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="sm:hidden fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-base-surface border-r border-base-border z-50 flex flex-col"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-text-tertiary hover:bg-base-surface2 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
              <SidebarContent guildId={guildId} guildName={guildName} guildIcon={guildIcon} isOwner={isOwner} isMainOwner={isMainOwner} isAffiliate={isAffiliate} onNavigate={() => setOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
