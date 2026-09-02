import { requireRole } from "@/lib/rbac";
import { getGlobalStats } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { MonthlyChart, StatusChart } from "@/components/charts";

export default async function SellerStatsPage() {
  await requireRole("SELLER");
  const stats = await getGlobalStats();

  return (
    <div>
      <PageHeader title="Статистика продаж" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Заказов" value={String(stats.orderCount)} />
        <StatCard label="Сумма заказов" value={formatRub(stats.orderSum)} />
        <StatCard label="Оплачено" value={formatRub(stats.paid)} />
        <StatCard label="Задолженность" value={formatRub(stats.debt)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Динамика по месяцам">
          <MonthlyChart data={stats.byMonth} />
        </Card>
        <Card title="Распределение по статусам">
          <StatusChart data={stats.byStatus} />
        </Card>
      </div>
    </div>
  );
}
