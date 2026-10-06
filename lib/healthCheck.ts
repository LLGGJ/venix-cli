import { getState } from './db';
import { getDiscordMeta } from './discordMeta';

export interface HealthIssue {
  kind: 'missing_channel' | 'missing_logs_channel' | 'missing_role';
  panelId: string;
  panelTitle: string;
  label: string; // nome/id do que sumiu, pra mostrar na mensagem
}

// Checagem leve de saúde do servidor: detecta os dois problemas mais comuns
// e mais quebram o bot em silêncio — um canal apagado que um painel ainda
// aponta, ou um cargo de staff apagado. Não é uma simulação completa de
// permissões do Discord (isso exigiria calcular overwrites de canal bit a
// bit); aqui só confirmamos se o canal/cargo AINDA EXISTE no servidor,
// comparando com a lista fresca que getDiscordMeta busca da API do Discord.
export async function getGuildHealthIssues(guildId: string): Promise<HealthIssue[]> {
  const [state, meta] = await Promise.all([getState(), getDiscordMeta(guildId)]);
  if (meta.error) return []; // sem dados frescos do Discord, melhor não acusar nada errado

  const channelIds = new Set(meta.channels.map((c) => c.id));
  const roleIds = new Set(meta.roles.map((r) => r.id));

  const issues: HealthIssue[] = [];
  const panels = state.panels.filter((p) => p.guild_id === guildId && p.enabled);

  for (const p of panels) {
    if (p.panel_channel_id && !channelIds.has(p.panel_channel_id)) {
      issues.push({ kind: 'missing_channel', panelId: p.panel_id, panelTitle: p.title, label: p.panel_channel_id });
    }
    if (p.logs_channel_id && !channelIds.has(p.logs_channel_id)) {
      issues.push({ kind: 'missing_logs_channel', panelId: p.panel_id, panelTitle: p.title, label: p.logs_channel_id });
    }
    for (const roleId of p.support_roles || []) {
      if (!roleIds.has(roleId)) {
        issues.push({ kind: 'missing_role', panelId: p.panel_id, panelTitle: p.title, label: roleId });
      }
    }
  }
  return issues;
}
