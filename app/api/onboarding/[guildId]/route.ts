import { NextResponse } from 'next/server';
import { requireGuildAdmin } from '@/lib/guard';
import { mutateState } from '@/lib/db';

type GuildKind = 'loja' | 'comunidade' | 'outro';

// Painel inicial por tipo de servidor — só o necessário pra sair de "tela
// em branco" pra "já tem algo publicado", nada definitivo: o dono edita
// tudo normalmente depois pela tela do painel.
function starterPanel(kind: GuildKind) {
  const base = {
    color: '#5865F2',
    interaction_type: 'select' as const,
  };
  if (kind === 'loja') {
    return {
      ...base,
      title: 'Central de Atendimento',
      description: 'Precisa de ajuda com seu pedido ou tem alguma dúvida? Escolha uma opção abaixo.',
      panel_options: [
        { id: `opt_${Date.now()}_1`, label: 'Dúvidas e Vendas', emoji: null, action: { type: 'TICKET' } },
        { id: `opt_${Date.now()}_2`, label: 'Suporte Pós-venda', emoji: null, action: { type: 'TICKET' } },
      ],
    };
  }
  if (kind === 'comunidade') {
    return {
      ...base,
      title: 'Suporte da Comunidade',
      description: 'Dúvidas, problemas ou sugestões? Abra um ticket e a equipe te ajuda.',
      panel_options: [
        { id: `opt_${Date.now()}_1`, label: 'Preciso de Ajuda', emoji: null, action: { type: 'TICKET' } },
        { id: `opt_${Date.now()}_2`, label: 'Denunciar algo', emoji: null, action: { type: 'TICKET' } },
      ],
    };
  }
  return {
    ...base,
    title: 'Suporte',
    description: 'Selecione uma opção abaixo para abrir um ticket.',
    panel_options: [{ id: `opt_${Date.now()}_1`, label: 'Abrir ticket', emoji: null, action: { type: 'TICKET' } }],
  };
}

export async function POST(req: Request, { params }: { params: { guildId: string } }) {
  const guard = await requireGuildAdmin(params.guildId);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const kind: GuildKind = ['loja', 'comunidade', 'outro'].includes(body?.kind) ? body.kind : 'outro';
  const channelId = typeof body?.channelId === 'string' && /^\d{15,25}$/.test(body.channelId) ? body.channelId : null;

  let panelId: string | null = null;
  await mutateState((state) => {
    if (!state.guildSettings[params.guildId]) state.guildSettings[params.guildId] = {};
    // Idempotente: se já tiver passado pelo onboarding (ex.: clique duplo),
    // não cria um segundo painel.
    if (state.guildSettings[params.guildId].onboarded) return;

    panelId = `panel_${Date.now()}`;
    const starter = starterPanel(kind);
    state.panels.push({
      guild_id: params.guildId,
      panel_id: panelId,
      enabled: true,
      title: starter.title,
      description: starter.description,
      emoji: null,
      thumbnail_url: null,
      banner_url: null,
      color: starter.color,
      panel_channel_id: channelId,
      panel_message_id: null,
      panel_last_channel_id: null,
      // Com canal escolhido, já deixa marcado pra publicar — o bot publica
      // sozinho em até 1s (mesmo mecanismo de publish_requested_at usado
      // pelo botão "Enviar" do editor de painel).
      publish_requested_at: channelId ? new Date().toISOString() : null,
      publish_last_result: null,
      support_roles: [],
      panel_options: starter.panel_options,
      interaction_type: starter.interaction_type,
      logs_channel_id: null,
      logs_format: 'TXT',
      ticket_type: 'CATEGORIA',
      category_parent_id: null,
      max_tickets: 1,
      welcome_message: null,
      notify_on_open: true,
      ticket_name_format: 'ticket-{user}-{id}',
      format: 'container',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    state.guildSettings[params.guildId].onboarded = true;
    state.guildSettings[params.guildId].onboarded_kind = kind;
    state.guildSettings[params.guildId].onboarded_at = new Date().toISOString();
  });

  return NextResponse.json({ success: true, panelId });
}

// Pular o assistente sem criar painel nenhum — ainda marca como "visto" pra
// não aparecer de novo.
export async function DELETE(_req: Request, { params }: { params: { guildId: string } }) {
  const guard = await requireGuildAdmin(params.guildId);
  if (!guard.ok) return guard.response;
  await mutateState((state) => {
    if (!state.guildSettings[params.guildId]) state.guildSettings[params.guildId] = {};
    state.guildSettings[params.guildId].onboarded = true;
    state.guildSettings[params.guildId].onboarded_skipped = true;
  });
  return NextResponse.json({ success: true });
}
