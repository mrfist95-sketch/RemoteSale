import { Suspense } from "react";
import { requireRole } from "@/lib/rbac";
import { getGlobalStats } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import { MonthlyChart, StatusChart } from "@/components/charts";
import PeriodFilter from "@/components/PeriodFilter";

export default async function AnalystPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ANALYST");
  const { from, to } = await searchParams;
  const stats = await getGlobalStats(from, to);

  return (
    <div>
      <PageHeader title="Аналитика продаж" subtitle="Только просмотр статистики" />
      <div className="mb-4">
        <Suspense fallback={null}>
          <PeriodFilter />
        </Suspense>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Заказов" value={String(stats.orderCount)} />
        <StatCard label="Сумма заказов" value={formatRub(stats.orderSum)} />
        <StatCard label="Оплачено" value={formatRub(stats.paid)} />
        <StatCard label="Задолженность" value={formatRub(stats.debt)} hint={stats.overdue > 0 ? `в т.ч. просрочено ${formatRub(stats.overdue)}` : "нет просрочки"} />
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
