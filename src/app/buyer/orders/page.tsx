import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOrdersDebtInfo, getBuyerDebt, getBuyerOverdue } from "@/lib/stats";
import { formatRub, formatDateTime } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";
import StatusHistory from "@/components/StatusHistory";
import CancelButton from "@/components/CancelButton";
import SubmitOrderButton from "@/components/SubmitOrderButton";
import { canCancel } from "@/lib/rbac";

export default async function BuyerOrdersPage() {
  const user = await requireRole("BUYER");
  const orders = await prisma.order.findMany({
    where: { buyerId: user.id, deleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      payments: { orderBy: { date: "asc" } },
      statusLogs: { orderBy: { changedAt: "asc" }, include: { changedBy: { select: { name: true, email: true } } } },
    },
  });
  const [debtInfo, totalDebt, overdueInfo] = await Promise.all([
    getOrdersDebtInfo(orders.map((o) => o.id)),
    getBuyerDebt(user.id),
    getBuyerOverdue(user.id),
  ]);

  return (
    <div>
      <PageHeader title="Мои заказы" />

      {/* Общая задолженность */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Заказов" value={String(orders.length)} />
        <StatCard label="Общий долг" value={formatRub(totalDebt)} />
        <StatCard label="В т.ч. просрочено" value={formatRub(overdueInfo.overdue)} />
        <StatCard label="Макс. просрочка" value={`${overdueInfo.overdueDaysMax} дн.`} />
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
                  <span className="font-semibold">Заказ №{o.number}</span> · {formatDateTime(o.createdAt)}
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={o.status} />
                  {info?.overdue && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      Просрочено {info.overdueDays} дн.
                    </span>
                  )}
                  {canCancel(o.status) && <CancelButton orderId={o.id} />}
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

              {/* Оплаты по заказу (только просмотр) */}
              {(o.payments.length > 0 || paid > 0) && (
                <div className="mt-2 rounded border border-zinc-100 bg-zinc-50 px-2 py-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>Оплачено: <b className="text-green-700">{formatRub(paid)}</b></span>
                    {unpaid > 0 ? (
                      <span>Остаток долга: <b className="text-red-700">{formatRub(unpaid)}</b></span>
                    ) : (
                      <span className="font-medium text-green-700">Оплачен полностью</span>
                    )}
                  </div>
                  {o.payments.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {o.payments.map((p) => (
                        <li key={p.id} className="flex flex-wrap items-center gap-x-2 text-zinc-500">
                          <span className="font-medium text-green-700">+{formatRub(p.amount)}</span>
                          <span>
                            {p.method === "card" ? "Карта" : p.method === "cash" ? "Наличные" : "Счёт"}
                          </span>
                          <span>· {formatDateTime(p.date)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {o.note && <p className="mt-2 text-xs text-zinc-500">Комментарий: {o.note}</p>}
              <StatusHistory items={o.statusLogs} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
