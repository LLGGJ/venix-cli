import { getServerSession } from 'next-auth';
import { authOptions, getUserGuildsChecked } from '@/lib/auth';
import { getState } from '@/lib/db';
import { getBotGuildIds } from '@/lib/discordGuilds';
import PanelsClient from '@/components/PanelsClient';

const FREE_PANEL_LIMIT = 3;

export default async function PanelsPage({ params }: { params: { guildId: string } }) {
  const state = await getState();
  const panels = state.panels.filter((p) => p.guild_id === params.guildId);
  const plan = state.guildPlans[params.guildId];
  const hasVip = !!(plan && plan.active);

  // Outros servidores que a pessoa administra e onde o bot já está — usados
  // pra "Duplicar painel para outro servidor". Busca melhor-esforço: se
  // falhar, a opção de duplicar simplesmente não aparece, sem quebrar a tela.
  let otherGuilds: { id: string; name: string }[] = [];
  try {
    const session = await getServerSession(authOptions);
    if (session) {
      const [{ guilds }, botGuildIds] = await Promise.all([
        getUserGuildsChecked((session as any).accessToken),
        getBotGuildIds(),
      ]);
      otherGuilds = guilds
        .filter((g: any) => g.id !== params.guildId && botGuildIds.has(g.id))
        .map((g: any) => ({ id: g.id, name: g.name }));
    }
  } catch {}

  return (
    <PanelsClient
      guildId={params.guildId}
      initialPanels={panels}
      limit={hasVip ? null : FREE_PANEL_LIMIT}
      otherGuilds={otherGuilds}
    />
  );
}
