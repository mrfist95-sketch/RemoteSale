import { requireRole } from "@/lib/rbac";
import { getBuyerStats } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { MonthlyChart } from "@/components/charts";

export default async function BuyerStatsPage() {
  const user = await requireRole("BUYER");
  const stats = await getBuyerStats(user.id);

  return (
    <div>
      <PageHeader title="Статистика покупок" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Заказов" value={String(stats.orderCount)} />
        <StatCard label="Сумма покупок" value={formatRub(stats.orderSum)} />
        <StatCard label="Оплачено" value={formatRub(stats.paid)} />
        <StatCard label="Долг" value={formatRub(stats.debt)} />
      </div>
      <Card title="Динамика по месяцам">
        <MonthlyChart data={stats.byMonth} />
      </Card>
    </div>
  );
}
