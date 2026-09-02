import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { formatRub, formatDateTime } from "@/lib/format";
import { PageHeader, Card } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";
import MarkDeliveredButton from "@/components/MarkDeliveredButton";

export default async function CourierHome() {
  const user = await requireRole("COURIER");
  const orders = await prisma.order.findMany({
    where: { status: "SHIPPED", deleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      buyer: { select: { name: true, email: true, address: true, phone: true, comment: true } },
    },
  });

  return (
    <div>
      <PageHeader title="Доставка" subtitle={`К доставке: ${orders.length}`} />
      <div className="space-y-3">
        {orders.length === 0 && <p className="text-sm text-zinc-400">Нет заказов к доставке</p>}
        {orders.map((o) => (
          <Card key={o.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm">
                <span className="font-semibold">Заказ №{o.number}</span> · {formatDateTime(o.createdAt)}
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={o.status} />
                {o.status !== "DELIVERED" && <MarkDeliveredButton orderId={o.id} />}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
              <div>
                <span className="text-zinc-500">Получатель: </span>
                {o.buyer.name ?? o.buyer.email}
              </div>
              <div>
                <span className="text-zinc-500">Тел: </span>
                {o.buyer.phone ?? "—"}
              </div>
              <div className="sm:col-span-2">
                <span className="text-zinc-500">Адрес: </span>
                {o.buyer.address ?? "—"}
              </div>
              {o.buyer.comment && (
                <div className="sm:col-span-2 text-xs text-zinc-500">
                  Комментарий: {o.buyer.comment}
                </div>
              )}
            </div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id} className="border-t border-zinc-100">
                    <td className="py-1">{i.name}</td>
                    <td className="py-1 text-right">{i.qty}</td>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
