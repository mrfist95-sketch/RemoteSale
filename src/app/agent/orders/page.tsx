import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOrdersDebtInfo } from "@/lib/stats";
import { formatRub, formatDateTime } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";
import StatusHistory from "@/components/StatusHistory";
import SubmitOrderButton from "@/components/SubmitOrderButton";
import Link from "next/link";

const DEBT_STATUSES = ["SHIPPED", "DELIVERED", "PAID"];
const METHOD_LABELS: Record<string, string> = {
  card: "Карта",
  cash: "Наличные",
  invoice: "Счёт",
};

export default async function AgentOrdersPage() {
  const user = await requireRole("AGENT");
  const orders = await prisma.order.findMany({
    where: { agentId: user.id, deleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      payments: { orderBy: { date: "asc" } },
      buyer: { select: { name: true, email: true } },
      statusLogs: { orderBy: { changedAt: "asc" }, include: { changedBy: { select: { name: true, email: true } } } },
    },
  });
  const debtInfo = await getOrdersDebtInfo(orders.map((o) => o.id));

  // Общий долг и просрочка по клиентам агента (только долговые статусы)
  let totalDebt = 0;
  let totalOverdue = 0;
  for (const o of orders) {
    const info = debtInfo.get(o.id);
    if (!info || !DEBT_STATUSES.includes(o.status)) continue;
    totalDebt += info.unpaid;
    if (info.overdue) totalOverdue += info.unpaid;
  }

  return (
    <div>
      <PageHeader title="Заказы клиентов" subtitle="Сформированные вами заказы" />

      {/* Финансовая сводка по клиентам */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Заказов" value={String(orders.length)} />
        <StatCard label="Общий долг клиентов" value={formatRub(totalDebt)} />
        <StatCard label="В т.ч. просрочено" value={formatRub(totalOverdue)} />
        <StatCard
          label="Клиентов"
          value={String(new Set(orders.map((o) => o.buyerId)).size)}
        />
      </div>

      <div className="space-y-3">
        {orders.length === 0 && <p className="text-sm text-zinc-400">Заказов пока нет</p>}
        {orders.map((o) => {
          const info = debtInfo.get(o.id);
          const paid = info?.paid ?? 0;
          const unpaid = info?.unpaid ?? 0;
          return (
            <Card key={o.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-semibold">Заказ №{o.number}</span> ·{" "}
                  <Link href={`/agent/order/${o.buyerId}`} className="text-indigo-600 hover:underline">
                    {o.buyer.name ?? o.buyer.email}
                  </Link>{" "}
                  · {formatDateTime(o.createdAt)}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.status} />
                  {info?.overdue && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Просрочено {info.overdueDays} дн.
                    </span>
                  )}
                  {o.status === "NEW" && <SubmitOrderButton orderId={o.id} />}
                </div>
              </div>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {o.items.map((i) => (
                    <tr key={i.id} className="border-t border-zinc-100">
                      <td className="py-1">{i.name}</td>
                      <td className="py-1 text-right">{i.qty} × {formatRub(i.price)}</td>
                      <td className="py-1 text-right font-medium">{formatRub(i.qty * i.price)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td />
                    <td className="pt-2 text-right text-sm text-zinc-500">Итого</td>
                    <td className="pt-2 text-right font-semibold">{formatRub(o.total)}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Оплаты по заказу */}
              {(o.payments.length > 0 || paid > 0) && (
                <div className="mt-2 rounded border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      Оплачено: <b className="text-green-700">{formatRub(paid)}</b>
                    </span>
                    {unpaid > 0 ? (
                      <span>
                        Остаток долга: <b className="text-red-700">{formatRub(unpaid)}</b>
                      </span>
                    ) : (
                      <span className="font-medium text-green-700">Оплачен полностью</span>
                    )}
                  </div>
                  {o.payments.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {o.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-2 text-zinc-500">
                          <span className="font-medium text-green-700">+{formatRub(p.amount)}</span>
                          <span>{METHOD_LABELS[p.method] ?? p.method}</span>
                          <span>· {formatDateTime(p.date)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <StatusHistory items={o.statusLogs} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}