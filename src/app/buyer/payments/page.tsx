import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBuyerDebt, getBuyerPaid, getBuyerOverdue } from "@/lib/stats";
import { formatRub, formatDate } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";

export default async function BuyerPaymentsPage() {
  const user = await requireRole("BUYER");
  const [debt, paid, overdueInfo, payments, orders] = await Promise.all([
    getBuyerDebt(user.id),
    getBuyerPaid(user.id),
    getBuyerOverdue(user.id),
    prisma.payment.findMany({
      where: { buyerId: user.id },
      orderBy: { date: "desc" },
      include: { order: { select: { number: true } } },
    }),
    // Заказы с остатком долга
    prisma.order.findMany({
      where: { buyerId: user.id, deleted: false, status: { in: ["SHIPPED", "DELIVERED", "PAID"] } },
      select: { id: true, number: true, total: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const orderIds = orders.map((o) => o.id);
  const paidByOrder = new Map<string, number>();
  if (orderIds.length > 0) {
    const byOrder = await prisma.payment.groupBy({
      by: ["orderId"],
      where: { buyerId: user.id, orderId: { in: orderIds } },
      _sum: { amount: true },
    });
    for (const r of byOrder) {
      if (r.orderId) paidByOrder.set(r.orderId, r._sum.amount ?? 0);
    }
  }

  const withDebt = orders
    .map((o) => ({ ...o, paid: paidByOrder.get(o.id) ?? 0, rest: Math.max(0, o.total - (paidByOrder.get(o.id) ?? 0)) }))
    .filter((o) => o.rest > 0);

  const orderNumber = new Map(orders.map((o) => [o.id, o.number]));

  return (
    <div>
      <PageHeader title="Оплаты и задолженность" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Задолженность" value={formatRub(debt)} hint={debt > 0 ? "нужно оплатить" : "нет долга"} />
        <StatCard label="В т.ч. просрочено" value={formatRub(overdueInfo.overdue)} hint={`${overdueInfo.overdueDaysMax} дн.`} />
        <StatCard label="Оплачено всего" value={formatRub(paid)} />
        <StatCard label="Статус" value={debt > 0 ? "Есть долг" : "Оплачено"} />
      </div>

      {withDebt.length > 0 && (
        <Card title="Долг по заказам" className="mb-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-2">Заказ</th>
                  <th className="py-2">Статус</th>
                  <th className="py-2 text-right">Сумма</th>
                  <th className="py-2 text-right">Оплачено</th>
                  <th className="py-2 text-right">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {withDebt.map((o) => (
                  <tr key={o.id} className="border-t border-zinc-100">
                    <td className="py-2 font-medium">№{o.number}</td>
                    <td className="py-2 text-zinc-500">
                      {o.status === "SHIPPED" ? "Отгружен" : o.status === "DELIVERED" ? "Доставлен" : "Оплачен (есть остаток)"}
                    </td>
                    <td className="py-2 text-right">{formatRub(o.total)}</td>
                    <td className="py-2 text-right text-green-700">{formatRub(o.paid)}</td>
                    <td className="py-2 text-right font-semibold text-red-700">{formatRub(o.rest)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="История оплат">
        {payments.length === 0 && <p className="text-sm text-zinc-400">Оплат пока нет</p>}
        <ul className="divide-y divide-zinc-100">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                {formatDate(p.date)} · {p.method === "card" ? "Карта" : p.method === "cash" ? "Наличные" : "Счёт"}
                {p.order && <span className="text-zinc-500"> · заказ №{p.order.number}</span>}
                {p.note ? ` · ${p.note}` : ""}
              </div>
              <div className="font-medium text-green-700">+{formatRub(p.amount)}</div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}