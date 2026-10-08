import { getState } from '@/lib/db';
import { getBotGuilds } from '@/lib/discordGuilds';
import { getDemandTrend } from '@/lib/staffDemand';
import StaffOverviewClient from '@/components/staff/StaffOverviewClient';
import DemandChart from '@/components/staff/DemandChart';

export default async function StaffOverviewPage() {
  const [state, botGuilds, demandPoints] = await Promise.all([getState(), getBotGuilds(), getDemandTrend(30)]);

  const activePlans = Object.values(state.guildPlans || {}).filter((p: any) => p?.active);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const salesThisMonth = (state.pendingPurchases || []).filter(
    (p: any) => p.status === 'CONFIRMED' && new Date(p.created_at) >= startOfMonth
  );
  const revenueThisMonth = salesThisMonth.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
      <p className="text-xs font-medium text-accent-indigoSoft mb-1">// Staff</p>
      <h1 className="font-display text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Visão geral</h1>

      {/* BUG CORRIGIDO: esta página é um Server Component — passar
          componentes de ícone (Server, Crown, etc, que são FUNÇÕES React)
          direto pra StatCard (Client Component) através dessa fronteira
          derrubava a página inteira com "Funções não podem ser passadas
          diretamente para Componentes do Cliente". Agora só números/strings
          primitivos atravessam a fronteira; os ícones são escolhidos
          inteiramente dentro do client component (StaffOverviewClient). */}
      <StaffOverviewClient
        serverCount={botGuilds.length}
        activeVipCount={activePlans.length}
        salesThisMonth={salesThisMonth.length}
        revenueThisMonth={revenueThisMonth}
      />

      <div className="mt-6">
        <DemandChart points={demandPoints} />
      </div>
    </main>
  );
}
