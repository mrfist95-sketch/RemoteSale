import { Suspense } from "react";
import { requireRole } from "@/lib/rbac";
import { getProductsReport } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import PeriodFilter from "@/components/PeriodFilter";

export default async function AnalystProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole("ANALYST");
  const { from, to } = await searchParams;
  const report = await getProductsReport(from, to);

  return (
    <div>
      <PageHeader
        title="Отчёт в разрезе товаров"
        subtitle="Что заказано, оплачено и остаток долга по товарам"
      />
      <div className="mb-4">
        <Suspense fallback={null}>
          <PeriodFilter />
        </Suspense>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard label="Позиций" value={String(report.products.length)} />
        <StatCard label="Заказано (сумма)" value={formatRub(report.totals.orderedSum)} />
        <StatCard label="Оплачено" value={formatRub(report.totals.paidSum)} />
        <StatCard
          label="Не оплачено"
          value={formatRub(report.totals.unpaidSum)}
          hint="по отгруженным"
        />
        <StatCard
          label="В т.ч. просрочено"
          value={formatRub(report.totals.overdueSum)}
          hint={report.totals.overdueSum > 0 ? "просроченная" : "нет"}
        />
      </div>

      <Card title="Товары">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2">Товар</th>
                <th className="py-2">Кол-во</th>
                <th className="py-2">Заказано (сумма)</th>
                <th className="py-2">Заказов</th>
                <th className="py-2">Клиентов</th>
                <th className="py-2">Оплачено</th>
                <th className="py-2">Не оплачено</th>
                <th className="py-2">Просрочено</th>
              </tr>
            </thead>
            <tbody>
              {report.products.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-3 text-zinc-400">
                    Нет заказов за выбранный период
                  </td>
                </tr>
              )}
              {report.products.map((p) => (
                <tr key={p.productId} className="border-t border-zinc-100">
                  <td className="py-2 font-medium">
                    {p.name}
                    {p.unit ? <span className="text-zinc-400"> ({p.unit})</span> : null}
                  </td>
                  <td className="py-2">{p.orderedQty}</td>
                  <td className="py-2">{formatRub(p.orderedSum)}</td>
                  <td className="py-2">{p.orderCount}</td>
                  <td className="py-2">{p.buyerCount}</td>
                  <td className="py-2 text-green-700">{formatRub(p.paidSum)}</td>
                  <td className="py-2 text-red-700">{formatRub(p.unpaidSum)}</td>
                  <td className="py-2 text-orange-700">{p.overdueSum > 0 ? formatRub(p.overdueSum) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
