import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOrdersDebtInfo } from "@/lib/stats";
import { formatRub, formatDateTime } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";
import StatusSelect from "@/components/StatusSelect";
import StatusHistory from "@/components/StatusHistory";
import AddPaymentForm from "@/components/AddPaymentForm";
import DeleteToggle from "@/components/DeleteToggle";

async function loadOrders(deleted: boolean) {
  const orders = await prisma.order.findMany({
    where: { deleted },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      buyer: { select: { id: true, name: true, email: true, address: true, phone: true, deferral: true } },
      agent: { select: { name: true } },
      statusLogs: { orderBy: { changedAt: "asc" }, include: { changedBy: { select: { name: true, email: true } } } },
    },
  });
  const debtInfo = await getOrdersDebtInfo(orders.map((o) => o.id));
  return orders.map((o) => ({
    o,
    overdueDays: debtInfo.get(o.id)?.overdueDays ?? 0,
    overdue: debtInfo.get(o.id)?.overdue ?? false,
  }));
}

function OrderCard({
  o,
  overdueDays,
  overdue,
  deleted,
}: {
  o: any;
  overdueDays: number;
  overdue: boolean;
  deleted: boolean;
}) {
  return (
    <Card key={o.id} className={deleted ? "opacity-70" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">Заказ №{o.number}</span> · {o.buyer.name ?? o.buyer.email}
          {o.agent && <span className="text-zinc-400"> · агент: {o.agent.name}</span>} ·{" "}
          {formatDateTime(o.createdAt)}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold">{formatRub(o.total)}</span>
          <StatusBadge status={o.status} />
          <StatusSelect orderId={o.id} current={o.status} role="ADMIN" />
          {overdue && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              Просрочено {overdueDays} дн.
            </span>
          )}
          <DeleteToggle orderId={o.id} deleted={deleted} />
        </div>
      </div>
      {(o.buyer.address || o.buyer.phone) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {o.buyer.address && <span>Адрес: {o.buyer.address}</span>}
          {o.buyer.phone && <span>Тел: {o.buyer.phone}</span>}
          {o.buyer.deferral > 0 && <span>Отсрочка: {o.buyer.deferral} дн.</span>}
        </div>
      )}
      <table className="mt-3 w-full text-sm">
        <tbody>
          {o.items.map((i: any) => (
            <tr key={i.id} className="border-t border-zinc-100">
              <td className="py-1">{i.name}</td>
              <td className="py-1 text-right">{i.qty} × {formatRub(i.price)}</td>
              <td className="py-1 text-right font-medium">{formatRub(i.qty * i.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <StatusHistory items={o.statusLogs} />
      <div className="mt-3 border-t border-zinc-100 pt-3">
        <AddPaymentForm buyerId={o.buyerId} orderId={o.id} />
      </div>
    </Card>
  );
}

export default async function AdminOrdersPage() {
  await requireRole("ADMIN");
  const [active, deleted] = await Promise.all([loadOrders(false), loadOrders(true)]);

  return (
    <div>
      <PageHeader title="Все заказы" subtitle={`Активных: ${active.length} · удалённых: ${deleted.length}`} />
      <div className="space-y-3">
        {active.length === 0 && <p className="text-sm text-zinc-400">Заказов пока нет</p>}
        {active.map((x) => (
          <OrderCard key={x.o.id} o={x.o} overdueDays={x.overdueDays} overdue={x.overdue} deleted={false} />
        ))}
      </div>

      {deleted.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Удалённые (скрыты из отчётов)</h2>
          <div className="space-y-3">
            {deleted.map((x) => (
              <OrderCard key={x.o.id} o={x.o} overdueDays={x.overdueDays} overdue={x.overdue} deleted={true} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
