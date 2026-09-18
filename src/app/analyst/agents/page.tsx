import { Suspense } from "react";
import { requireRole } from "@/lib/rbac";
import { getAgentsReport, getAgentOptions } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import PeriodFilter from "@/components/PeriodFilter";
import AgentFilter from "@/components/AgentFilter";
import { ClientExpandableRow } from "@/components/AnalystClientRow";

export default async function AnalystAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; agent?: string }>;
}) {
  await requireRole("ANALYST");
  const sp = await searchParams;
  const [report, agentOptions] = await Promise.all([
    getAgentsReport(sp.from, sp.to, sp.agent || undefined),
    getAgentOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Отчёт по торговым представителям"
        subtitle="Закреплённые клиенты, продажи и задолженность"
      />
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end">
        <Suspense fallback={null}>
          <PeriodFilter />
        </Suspense>
        <Suspense fallback={null}>
          <AgentFilter agents={agentOptions} />
        </Suspense>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-6">
        <StatCard label="Представителей" value={String(report.totals.agents)} />
        <StatCard label="Клиентов" value={String(report.totals.clients)} />
        <StatCard label="Сумма заказов" value={formatRub(report.totals.orderSum)} />
        <StatCard label="Оплачено" value={formatRub(report.totals.paid)} />
        <StatCard label="Задолженность" value={formatRub(report.totals.debt)} />
        <StatCard label="В т.ч. просрочено" value={formatRub(report.totals.overdue)} hint={report.totals.overdue > 0 ? "просроченная" : "нет"} />
      </div>

      <div className="space-y-4">
        {report.agents.map((a) => (
          <Card
            key={a.agentId}
            title={
              <span>
                {a.agentName}{" "}
              <span className="text-xs font-normal text-zinc-400">
                  · клиентов: {a.clientCount} · сумма {formatRub(a.totalSum)} · оплачено{" "}
                  {formatRub(a.totalPaid)} · долг {formatRub(a.totalDebt)} · просрочено{" "}
                  {formatRub(a.totalOverdue)}
                  </span>
              </span>
            }
          >
            {a.clients.length === 0 ? (
              <p className="text-sm text-zinc-400">Нет закреплённых клиентов</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr>
                      <th className="py-2">Клиент (адрес)</th>
                      <th className="py-2">Заказов</th>
                      <th className="py-2">Сумма</th>
                      <th className="py-2">Оплачено</th>
                      <th className="py-2">Долг</th>
                      <th className="py-2">Просрочено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.clients.map((c) => (
                      <ClientExpandableRow
                        key={c.buyerId}
                        c={{
                          buyerId: c.buyerId,
                          buyerName: c.buyerName,
                          buyerAddress: c.buyerAddress,
                          orderCount: c.orderCount,
                          orderSum: c.orderSum,
                          paid: c.paid,
                          debt: c.debt,
                          overdue: c.overdue,
                          orders: c.orders,
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card title="Клиенты без торгового представителя" className="mt-4">
        {report.unassigned.length === 0 ? (
          <p className="text-sm text-zinc-400">Все клиенты закреплены за представителями</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2">Клиент (адрес)</th>
                  <th className="py-2">Заказов</th>
                  <th className="py-2">Сумма</th>
                  <th className="py-2">Оплачено</th>
                  <th className="py-2">Долг</th>
                  <th className="py-2">Просрочено</th>
                </tr>
              </thead>
              <tbody>
                {report.unassigned.map((c) => (
                  <ClientExpandableRow
                    key={c.buyerId}
                    c={{
                      buyerId: c.buyerId,
                      buyerName: c.buyerName,
                      buyerAddress: c.buyerAddress,
                      orderCount: c.orderCount,
                      orderSum: c.orderSum,
                      paid: c.paid,
                      debt: c.debt,
                      overdue: c.overdue,
                      orders: c.orders,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}