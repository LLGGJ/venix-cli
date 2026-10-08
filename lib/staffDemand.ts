import { getState, getPool } from './db';

export interface DemandPoint {
  date: string;     // AAAA-MM-DD
  tickets: number;  // tickets abertos no dia, em TODOS os servidores — proxy de "demanda"
  joined: number;   // servidores que o bot entrou no dia
  left: number;     // servidores que o bot saiu no dia
}

// Série dos últimos `days` dias pro gráfico de demanda em STAFFS → Visão
// Geral.
//
//  • Tickets: vêm de state.tickets (getState()) — tudo no bot mora num único
//    blob JSON (bot_state), não existe tabela "tickets" separada no Postgres.
//  • Entradas/saídas de servidor: vêm da tabela guild_events, essa sim uma
//    tabela própria (bot/services/guildEvents.ts) — só existe a partir de
//    quando foi implementada. Pode aparecer zerada nos dias mais antigos da
//    janela mesmo que o bot tenha ganhado/perdido servidor antes disso; não
//    tem como reconstruir esse histórico retroativamente.
export async function getDemandTrend(days = 30): Promise<DemandPoint[]> {
  const state = await getState();

  const ticketsByDay = new Map<string, number>();
  for (const t of state.tickets || []) {
    const day = typeof t.created_at === 'string' ? t.created_at.slice(0, 10) : null;
    if (day) ticketsByDay.set(day, (ticketsByDay.get(day) || 0) + 1);
  }

  const joinedByDay = new Map<string, number>();
  const leftByDay = new Map<string, number>();
  try {
    const { rows } = await getPool().query(
      `select to_char(created_at, 'YYYY-MM-DD') as day, kind, count(*)::int as n
       from guild_events
       where created_at > now() - interval '${days} days'
       group by day, kind`
    );
    for (const r of rows as any[]) {
      (r.kind === 'join' ? joinedByDay : leftByDay).set(r.day, r.n);
    }
  } catch {
    // tabela ainda não existe (bot antigo, sem deploy do guildEvents) — segue sem essa parte
  }

  const points: DemandPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({
      date: key,
      tickets: ticketsByDay.get(key) || 0,
      joined: joinedByDay.get(key) || 0,
      left: leftByDay.get(key) || 0,
    });
  }
  return points;
}
