import { getUserGuildsChecked } from '@/lib/auth';
import { requireGuildAdmin } from '@/lib/guard';
import IntegrationsGuildClient from '@/components/IntegrationsGuildClient';

// Liberado pra qualquer admin do servidor (antes era só pro dono principal
// do bot, em modo de teste).
export default async function IntegracoesGuildPage({ params }: { params: { guildId: string } }) {
  const guard = await requireGuildAdmin(params.guildId);
  if (!guard.ok) return guard.response;

  let guildName = 'Seu servidor';
  try {
    const { guilds } = await getUserGuildsChecked((guard.session as any).accessToken);
    guildName = guilds.find((g: any) => g.id === params.guildId)?.name || guildName;
  } catch {}

  return <IntegrationsGuildClient guildId={params.guildId} guildName={guildName} />;
}
