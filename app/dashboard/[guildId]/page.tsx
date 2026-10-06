import { getState } from '@/lib/db';
import { getDiscordMeta } from '@/lib/discordMeta';
import { getGuildHealthIssues } from '@/lib/healthCheck';
import OverviewClient from '@/components/OverviewClient';
import OnboardingWizard from '@/components/OnboardingWizard';
import HealthCheckBanner from '@/components/HealthCheckBanner';

async function getStaffRanking(guildId: string, tickets: any[]) {
  const attended = tickets.filter((t) => t.staff_id);
  const counts = new Map<string, { total: number; closed: number }>();
  for (const t of attended) {
    const entry = counts.get(t.staff_id) || { total: 0, closed: 0 };
    entry.total += 1;
    if (t.status === 'FECHADO') entry.closed += 1;
    counts.set(t.staff_id, entry);
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  const ranking = await Promise.all(
    Array.from(counts.entries()).map(async ([staffId, stats]) => {
      let name = staffId;
      let avatar: string | null = null;

      if (botToken) {
        try {
          const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${staffId}`, {
            headers: { Authorization: `Bot ${botToken}` },
            cache: 'no-store',
          });
          if (res.ok) {
            const member = await res.json();
            name = member.nick || member.user?.global_name || member.user?.username || staffId;
            const avatarHash = member.user?.avatar;
            avatar = avatarHash ? `https://cdn.discordapp.com/avatars/${staffId}/${avatarHash}.png?size=64` : null;
          }
        } catch {
          // membro pode ter saído do servidor — mantém o ID como nome de fallback
        }
      }

      return { staffId, name, avatar, total: stats.total, closed: stats.closed };
    })
  );

  ranking.sort((a, b) => b.total - a.total);
  return ranking.slice(0, 10);
}

export default async function OverviewPage({ params }: { params: { guildId: string } }) {
  const state = await getState();
  const guildId = params.guildId;
  const guildTickets = state.tickets.filter((t) => t.guild_id === guildId);

  const opened = guildTickets.length;
  const open = guildTickets.filter((t) => t.status !== 'FECHADO').length;
  const closed = guildTickets.filter((t) => t.status === 'FECHADO').length;
  const inProgress = guildTickets.filter((t) => t.status === 'EM_ATENDIMENTO').length;

  const assumeLogs = state.activityLog.filter((a) => a.guild_id === guildId && a.type === 'ASSUMIDO');
  let totalSeconds = 0;
  let count = 0;
  for (const log of assumeLogs) {
    const ticket = guildTickets.find((t) => t.ticket_id === log.ticket_id);
    if (!ticket) continue;
    const diff = (new Date(log.created_at).getTime() - new Date(ticket.created_at).getTime()) / 1000;
    if (diff >= 0) {
      totalSeconds += diff;
      count++;
    }
  }
  const avgResponseSeconds = count > 0 ? Math.round(totalSeconds / count) : null;

  const days: { date: string; count: number }[] = [];
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayCount = guildTickets.filter((t) => t.created_at?.slice(0, 10) === dateStr).length;
    days.push({ date: dateStr, count: dayCount });
  }

  const plan = state.guildPlans[guildId];
  const isVip = !!(plan && plan.active);
  const panels = state.panels.filter((p) => p.guild_id === guildId);
  const panelsCount = panels.length;
  const staffRanking = await getStaffRanking(guildId, guildTickets);

  // Assistente de primeiros passos: só aparece quando o dashboard ainda está
  // vazio de verdade (sem painel nenhum) E o dono nunca passou por ele nem
  // pulou. Depois disso vira a checagem de saúde no lugar.
  const onboarded = !!(state.guildSettings?.[guildId] as any)?.onboarded;
  let topSlot: React.ReactNode = null;
  if (!onboarded && panelsCount === 0) {
    const meta = await getDiscordMeta(guildId);
    const channels = meta.channels.filter((c) => c.type === 'text').map((c) => ({ id: c.id, name: c.name }));
    topSlot = <OnboardingWizard guildId={guildId} channels={channels} />;
  } else {
    const issues = await getGuildHealthIssues(guildId);
    if (issues.length > 0) topSlot = <HealthCheckBanner guildId={guildId} issues={issues} />;
  }

  return (
    <OverviewClient
      topSlot={topSlot}
      stats={{
        opened,
        open,
        closed,
        inProgress,
        avgResponseSeconds,
        days,
        isVip,
        panelsCount,
        planExpiresAt: plan?.expires_at || null,
        staffRanking,
      }}
    />
  );
}
