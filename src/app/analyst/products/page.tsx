import { Suspense } from "react";
import { requireRole } from "@/lib/rbac";
import { getProductsReport, getProductFilterOptions } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import ProductsReportFilters from "@/components/ProductsReportFilters";

export default async function AnalystProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string; category?: string; manufacturer?: string }>;
}) {
  await requireRole("ANALYST");
  const sp = await searchParams;
  const [report, filterOptions] = await Promise.all([
    getProductsReport({
      from: sp.from,
      to: sp.to,
      status: sp.status || undefined,
      categoryId: sp.category || undefined,
      manufacturer: sp.manufacturer || undefined,
    }),
    getProductFilterOptions(),
  ]);

  // Группировка по товарной категории (null -> «Без группы»)
  const groups = new Map<string, typeof report.products>();
  for (const p of report.products) {
    const key = p.categoryName ?? "Без группы";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const groupNames = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, "ru"));

  return (
    <div>
      <PageHeader
        title="Отчёт в разрезе товаров"
        subtitle="Что заказано, оплачено и остаток долга по товарам"
      />
      <div className="mb-4">
        <Suspense fallback={null}>
          <ProductsReportFilters
            categories={filterOptions.categories}
            manufacturers={filterOptions.manufacturers}
          />
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

      {groupNames.map((g) => (
        <Card key={g} title={g} className="mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2">Товар</th>
                  <th className="py-2">Производитель</th>
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
                {groups.get(g)!.map((p) => (
                  <tr key={p.productId} className="border-t border-zinc-100">
                    <td className="py-2 font-medium">
                      {p.name}
                      {p.unit ? <span className="text-zinc-400"> ({p.unit})</span> : null}
                    </td>
                    <td className="py-2 text-zinc-600">{p.manufacturer ?? "—"}</td>
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
      ))}

      {report.products.length === 0 && (
        <Card title="Товары">
          <p className="py-3 text-sm text-zinc-400">Нет заказов за выбранный период и фильтры</p>
        </Card>
      )}
    </div>
  );
}