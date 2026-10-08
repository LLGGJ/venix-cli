'use client';

import { useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Ticket, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { DemandPoint } from '@/lib/staffDemand';

// Gráfico de demanda em STAFFS → Visão Geral: tickets por dia (todos os
// servidores) como indicador de uso, e servidores entrando/saindo do bot.
// A aba de servidores só tem dado a partir de quando o log foi implementado
// — por isso o aviso quando a soma de entradas+saídas no período é zero.
export default function DemandChart({ points }: { points: DemandPoint[] }) {
  const [tab, setTab] = useState<'tickets' | 'servers'>('tickets');

  const chartData = points.map((p) => ({
    label: new Date(p.date + 'T00:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    tickets: p.tickets,
    joined: p.joined,
    left: -p.left, // negativo só pra desenhar pra baixo no gráfico de barras
  }));

  const totalTickets = points.reduce((s, p) => s + p.tickets, 0);
  const totalJoined = points.reduce((s, p) => s + p.joined, 0);
  const totalLeft = points.reduce((s, p) => s + p.left, 0);

  // Tendência simples: metade mais recente vs metade mais antiga da janela.
  const half = Math.floor(points.length / 2) || 1;
  const recent = points.slice(-half).reduce((s, p) => s + p.tickets, 0);
  const older = points.slice(0, half).reduce((s, p) => s + p.tickets, 0);
  const trendUp = recent >= older;
  const trendPct = older > 0 ? Math.round((Math.abs(recent - older) / older) * 100) : null;

  const hasServerData = totalJoined + totalLeft > 0;

  return (
    <div className="card-surface p-4 sm:p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent-indigoSoft" strokeWidth={2} />
          <h2 className="text-sm font-medium">Demanda nos últimos {points.length} dias</h2>
        </div>
        <div className="flex rounded-lg border border-base-border overflow-hidden text-xs">
          <button
            onClick={() => setTab('tickets')}
            className={`px-3 py-1.5 transition-colors ${tab === 'tickets' ? 'bg-accent-indigo/20 text-accent-indigoSoft' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Tickets
          </button>
          <button
            onClick={() => setTab('servers')}
            className={`px-3 py-1.5 transition-colors ${tab === 'servers' ? 'bg-accent-indigo/20 text-accent-indigoSoft' : 'text-text-secondary hover:text-text-primary'}`}
          >
            Servidores
          </button>
        </div>
      </div>

      {tab === 'tickets' ? (
        <>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Ticket className="w-3.5 h-3.5 text-text-tertiary" strokeWidth={2} /> {totalTickets} tickets no período
            </div>
            {trendPct !== null && (
              <div className={`flex items-center gap-1 text-xs ${trendUp ? 'text-accent-green' : 'text-accent-red'}`}>
                {trendUp ? <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} /> : <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={2.5} />}
                {trendPct}% {trendUp ? 'na segunda metade do período' : 'de queda na segunda metade'}
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="demandTickets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6D7CFF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6D7CFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8a93a6' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#8a93a6' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#15192b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#f2f3f5' }}
              />
              <Area type="monotone" dataKey="tickets" name="Tickets" stroke="#6D7CFF" strokeWidth={2} fill="url(#demandTickets)" />
            </AreaChart>
          </ResponsiveContainer>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-accent-green">
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} /> {totalJoined} entraram
            </div>
            <div className="flex items-center gap-1.5 text-xs text-accent-red">
              <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={2.5} /> {totalLeft} saíram
            </div>
          </div>
          {!hasServerData ? (
            <p className="text-xs text-text-tertiary py-10 text-center">
              Ainda não há entradas ou saídas registradas neste período. Esse log começou a contar a partir de agora — vai se preencher com o tempo.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8a93a6' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: '#8a93a6' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#15192b', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#f2f3f5' }}
                  formatter={(value: number, name: string) => [Math.abs(value), name === 'left' ? 'Saíram' : 'Entraram']}
                />
                <Bar dataKey="joined" name="joined" fill="#34D399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="left" name="left" fill="#F87171" radius={[0, 0, 3, 3]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  );
}
