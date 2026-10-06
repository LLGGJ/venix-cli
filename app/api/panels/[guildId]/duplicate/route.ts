import { NextResponse } from 'next/server';
import { requireGuildAdmin } from '@/lib/guard';
import { getState, mutateState } from '@/lib/db';

const FREE_PANEL_LIMIT = 3;

// Duplica um painel do servidor atual pra OUTRO servidor que a mesma pessoa
// administra. Exige ser admin dos DOIS (origem e destino) — sem isso, seria
// possível empurrar painel pra servidor de outra pessoa.
export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const guard = await requireGuildAdmin(params.guildId);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const panelId = typeof body?.panelId === 'string' ? body.panelId : '';
  const targetGuildId = typeof body?.targetGuildId === 'string' ? body.targetGuildId : '';
  if (!panelId || !targetGuildId) return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 });
  if (targetGuildId === params.guildId) return NextResponse.json({ error: 'Escolha um servidor diferente do atual.' }, { status: 400 });

  const targetGuard = await requireGuildAdmin(targetGuildId);
  if (!targetGuard.ok) {
    return NextResponse.json({ error: 'Você não administra o servidor de destino.' }, { status: 403 });
  }

  const state = await getState();
  const source = state.panels.find((p) => p.guild_id === params.guildId && p.panel_id === panelId);
  if (!source) return NextResponse.json({ error: 'Painel não encontrado.' }, { status: 404 });

  const targetPlan = state.guildPlans[targetGuildId];
  const targetHasVip = !!(targetPlan && targetPlan.active);
  const targetCount = state.panels.filter((p) => p.guild_id === targetGuildId).length;
  if (!targetHasVip && targetCount >= FREE_PANEL_LIMIT) {
    return NextResponse.json({ error: `O servidor de destino já atingiu o limite de ${FREE_PANEL_LIMIT} painéis do plano grátis.` }, { status: 400 });
  }

  let newPanelId = '';
  await mutateState((s) => {
    newPanelId = `panel_${Date.now()}`;
    s.panels.push({
      ...source,
      guild_id: targetGuildId,
      panel_id: newPanelId,
      // IDs que só fazem sentido no servidor de origem — nunca existem no
      // destino, então sempre voltam vazios pro dono configurar de novo lá.
      panel_channel_id: null,
      panel_message_id: null,
      panel_last_channel_id: null,
      publish_requested_at: null,
      publish_last_result: null,
      logs_channel_id: null,
      category_parent_id: null,
      support_roles: [],
      // As opções do painel (botões/select) copiam normalmente, mas os IDs
      // de cargo/canal dentro de cada ação também não existem no destino.
      panel_options: (source.panel_options || []).map((o: any) => ({
        ...o,
        id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  return NextResponse.json({ success: true, panelId: newPanelId });
}
