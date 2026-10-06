'use client';

import Image from 'next/image';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from 'framer-motion';
import { Ticket, Clock, CheckCircle2, Loader, Crown, PanelsTopLeft, Trophy, User } from 'lucide-react';
import StatCard from './StatCard';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface StaffRankingEntry {
  staffId: string;
  name: string;
  avatar: string | null;
  total: number;
  closed: number;
}

interface Stats {
  opened: number;
  open: number;
  closed: number;
  inProgress: number;
  avgResponseSeconds: number | null;
  days: { date: string; count: number }[];
  isVip: boolean;
  panelsCount: number;
  planExpiresAt: string | null;
  staffRanking: StaffRankingEntry[];
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function OverviewClient({ stats, topSlot }: { stats: Stats; topSlot?: React.ReactNode }) {
  const { t, locale } = useLanguage();
  const chartData = stats.days.map((d) => ({
    date: new Date(d.date + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
    tickets: d.count,
  }));

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
      {topSlot}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('ov_title')}</h1>
          <p className="text-sm text-text-tertiary mt-1">{t('ov_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <LanguageSwitcher />
          {stats.isVip && (
            <div className="flex items-center gap-2 bg-accent-amber/10 border border-accent-amber/25 rounded-full px-3.5 py-1.5">
              <Crown className="w-3.5 h-3.5 text-accent-amber" strokeWidth={2} />
              <span className="text-xs font-medium text-accent-amber">{t('ov_vip_active')}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label={t('stat_open')} value={stats.open} icon={Ticket} accent="indigo" delay={0} />
        <StatCard label={t('stat_in_progress')} value={stats.inProgress} icon={Loader} accent="amber" delay={0.05} />
        <StatCard label={t('stat_closed')} value={stats.closed} icon={CheckCircle2} accent="green" delay={0.1} />
        <StatCard
          label={t('stat_avg_response')}
          value={formatDuration(stats.avgResponseSeconds)}
          icon={Clock}
          accent="violet"
          delay={0.15}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="card-surface p-6 shadow-card mb-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-medium text-sm">{t('chart_title')}</h2>
          <span className="text-xs text-text-tertiary">{t('chart_total')}: {stats.opened}</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="ticketGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5865F2" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#5865F2" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1C2030" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: '#5B6178', fontSize: 11 }} axisLine={{ stroke: '#1C2030' }} tickLine={false} />
            <YAxis tick={{ fill: '#5B6178', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#161A26', border: '1px solid #262B3D', borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: '#9CA3B8' }}
              itemStyle={{ color: '#E7E9F0' }}
            />
            <Area type="monotone" dataKey="tickets" stroke="#5865F2" strokeWidth={2} fill="url(#ticketGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.22 }}
        className="card-surface p-6 shadow-card mb-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <Trophy className="w-4 h-4 text-accent-amber" strokeWidth={2} />
          <h2 className="font-display font-medium text-sm">{t('ranking_title')}</h2>
        </div>
        {stats.staffRanking.length === 0 ? (
          <p className="text-xs text-text-tertiary py-2">
            {t('ranking_empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {stats.staffRanking.map((s, i) => (
              <motion.div
                key={s.staffId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: 0.25 + i * 0.04 }}
                className="flex items-center gap-3 bg-base-surface2 rounded-lg px-3 py-2.5"
              >
                <span className={`w-6 text-center font-display font-semibold text-sm shrink-0 ${
                  i === 0 ? 'text-accent-amber' : i === 1 ? 'text-text-secondary' : i === 2 ? 'text-accent-red' : 'text-text-tertiary'
                }`}>
                  {i + 1}
                </span>
                {s.avatar ? (
                  <Image src={s.avatar} alt={s.name} width={32} height={32} className="rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-base-surface border border-base-border flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-text-tertiary" strokeWidth={2} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-[11px] text-text-tertiary">{s.closed} {t('ranking_closed_suffix')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-semibold text-sm">{s.total}</p>
                  <p className="text-[10px] text-text-tertiary">{t('ranking_attended')}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.25 }}
          className="card-surface p-5 shadow-card flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-accent-indigo/12 border border-accent-indigo/25 flex items-center justify-center">
            <PanelsTopLeft className="w-4.5 h-4.5 text-accent-indigoSoft" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs text-text-tertiary">{t('panels_active')}</p>
            <p className="font-display text-lg font-semibold">{stats.panelsCount}</p>
          </div>
        </motion.div>

        {stats.isVip && stats.planExpiresAt && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="card-surface p-5 shadow-card flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-lg bg-accent-amber/12 border border-accent-amber/25 flex items-center justify-center">
              <Crown className="w-4.5 h-4.5 text-accent-amber" strokeWidth={2} />
            </div>
            <div>
              <p className="text-xs text-text-tertiary">{t('plan_expires')}</p>
              <p className="font-display text-lg font-semibold">
                {new Date(stats.planExpiresAt).toLocaleDateString(locale)}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
