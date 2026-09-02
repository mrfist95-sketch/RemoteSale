import { requireRole } from "@/lib/rbac";
import { getAgentStats } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { ClientsChart } from "@/components/charts";

export default async function AgentStatsPage() {
  const user = await requireRole("AGENT");
  const stats = await getAgentStats(user.id);

  return (
    <div>
      <PageHeader title="Статистика продаж" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Сумма продаж" value={formatRub(stats.totalSum)} />
        <StatCard label="Задолженность" value={formatRub(stats.totalDebt)} />
        <StatCard label="Клиентов" value={String(stats.clients.length)} />
      </div>
      <Card title="Продажи и долг по клиентам">
        <ClientsChart
          data={stats.clients.map((c) => ({ name: c.buyerName, sum: c.orderSum, debt: c.debt }))}
        />
      </Card>
    </div>
  );
}
