import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOrdersDebtInfo } from "@/lib/stats";
import { formatRub, formatDateTime } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
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
    include: { items: true, statusLogs: { orderBy: { changedAt: "asc" }, include: { changedBy: { select: { name: true, email: true } } } } },
  });
  const debtInfo = await getOrdersDebtInfo(orders.map((o) => o.id));

  return (
    <div>
      <PageHeader title="Мои заказы" />
      <div className="space-y-3">
        {orders.length === 0 && <p className="text-sm text-zinc-400">Заказов пока нет</p>}
        {orders.map((o) => {
          const info = debtInfo.get(o.id);
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
              {o.note && <p className="mt-2 text-xs text-zinc-500">Комментарий: {o.note}</p>}
              <StatusHistory items={o.statusLogs} />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
