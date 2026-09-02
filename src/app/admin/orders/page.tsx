import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getOrdersDebtInfo } from "@/lib/stats";
import { formatRub, formatDateTime } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";
import StatusSelect from "@/components/StatusSelect";
import StatusHistory from "@/components/StatusHistory";
import OrderPaymentsPanel, { type PaymentRow, type AuditRow } from "@/components/OrderPaymentsPanel";
import DeleteToggle from "@/components/DeleteToggle";
import EditReasonsAdmin from "@/components/EditReasonsAdmin";
import { PAYABLE_STATUSES } from "@/lib/rbac";

async function loadOrders(deleted: boolean) {
  const orders = await prisma.order.findMany({
    where: { deleted },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      buyer: { select: { id: true, name: true, email: true, address: true, phone: true, deferral: true } },
      agent: { select: { name: true } },
      statusLogs: { orderBy: { changedAt: "asc" }, include: { changedBy: { select: { name: true, email: true } } } },
      payments: { orderBy: { date: "desc" }, include: { createdBy: { select: { name: true, email: true } } } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 20, include: { user: { select: { name: true, email: true } } } },
    },
  });
  const debtInfo = await getOrdersDebtInfo(orders.map((o) => o.id));
  return orders.map((o) => ({
    o,
    paid: debtInfo.get(o.id)?.paid ?? 0,
    overdueDays: debtInfo.get(o.id)?.overdueDays ?? 0,
    overdue: debtInfo.get(o.id)?.overdue ?? false,
  }));
}

function OrderCard({
  o,
  paid,
  overdueDays,
  overdue,
  deleted,
  todayISO,
}: {
  o: {
    id: string;
    buyerId: string;
    number: number;
    status: string;
    total: number;
    createdAt: Date;
    buyer: { name: string | null; email: string; address: string | null; phone: string | null; deferral: number };
    agent: { name: string | null } | null;
    items: { id: string; name: string; qty: number; price: number }[];
    statusLogs: { status: string; changedAt: Date; changedBy: { name: string | null; email: string } | null }[];
    payments: {
      id: string; amount: number; method: string; note: string | null; date: Date;
      createdBy: { name: string | null; email: string } | null;
    }[];
    auditLogs: {
      id: string; action: string; details: string | null; amount: number | null;
      createdAt: Date; user: { name: string | null; email: string } | null;
    }[];
  };
  paid: number;
  overdueDays: number;
  overdue: boolean;
  deleted: boolean;
  todayISO: string;
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
          {o.items.map((i) => (
            <tr key={i.id} className="border-t border-zinc-100">
              <td className="py-1">{i.name}</td>
              <td className="py-1 text-right">{i.qty} × {formatRub(i.price)}</td>
              <td className="py-1 text-right font-medium">{formatRub(i.qty * i.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <StatusHistory items={o.statusLogs} />
      {!deleted && (
        <OrderPaymentsPanel
          buyerId={o.buyerId}
          orderId={o.id}
          total={o.total}
          paid={paid}
          status={o.status}
          payments={o.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            note: p.note,
            date: p.date.toISOString(),
            createdBy: p.createdBy,
          })) as PaymentRow[]}
          audit={o.auditLogs.map((a) => ({
            id: a.id,
            action: a.action,
            details: a.details,
            amount: a.amount,
            createdAt: a.createdAt.toISOString(),
            user: a.user,
          })) as AuditRow[]}
          canPay={PAYABLE_STATUSES.includes(o.status)}
          isAdmin={true}
          todayISO={todayISO}
        />
      )}
    </Card>
  );
}

export default async function AdminOrdersPage() {
  await requireRole("ADMIN");
  const [active, deleted, reasons] = await Promise.all([
    loadOrders(false),
    loadOrders(true),
    prisma.orderEditReason.findMany({ orderBy: { name: "asc" } }),
  ]);
  const todayISO = new Date().toLocaleDateString("sv-SE");

  return (
    <div>
      <PageHeader title="Все заказы" subtitle={`Активных: ${active.length} · удалённых: ${deleted.length}`} />

      <EditReasonsAdmin reasons={reasons.map((r) => ({ id: r.id, name: r.name }))} />

      <div className="space-y-3">
        {active.length === 0 && <p className="text-sm text-zinc-400">Заказов пока нет</p>}
        {active.map((x) => (
          <OrderCard key={x.o.id} o={x.o} paid={x.paid} overdueDays={x.overdueDays} overdue={x.overdue} deleted={false} todayISO={todayISO} />
        ))}
      </div>

      {deleted.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">Удалённые (скрыты из отчётов)</h2>
          <div className="space-y-3">
            {deleted.map((x) => (
              <OrderCard key={x.o.id} o={x.o} paid={x.paid} overdueDays={x.overdueDays} overdue={x.overdue} deleted={true} todayISO={todayISO} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}