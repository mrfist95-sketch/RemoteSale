import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBuyerDebt, getBuyerPaid, getBuyerOverdue } from "@/lib/stats";
import { formatRub, formatDate } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";
import StatusBadge from "@/components/StatusBadge";

export default async function BuyerHome() {
  const user = await requireRole("BUYER");
  const debt = await getBuyerDebt(user.id);
  const paid = await getBuyerPaid(user.id);
  const overdue = await getBuyerOverdue(user.id);
  const orders = await prisma.order.findMany({
    where: { buyerId: user.id, deleted: false },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { items: true },
  });
  const sum = orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0);

  return (
    <div>
      <PageHeader title={`Здравствуйте, ${user.name ?? user.email}`} subtitle="Личный кабинет покупателя" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Текущая задолженность" value={formatRub(debt)} hint={debt > 0 ? "требует оплаты" : "нет долга"} />
        <StatCard label="В том числе просрочено" value={formatRub(overdue.overdue)} hint={overdue.overdueDaysMax > 0 ? `до ${overdue.overdueDaysMax} дн.` : "нет просрочки"} />
        <StatCard label="Оплачено всего" value={formatRub(paid)} />
        <StatCard label="Заказов" value={String(orders.length)} />
      </div>

      <Card
        title="Последние заказы"
        action={
          <Link href="/buyer/catalog" className="text-sm text-indigo-600 hover:underline">
            Сформировать заказ →
          </Link>
        }
      >
        {orders.length === 0 && <p className="text-sm text-zinc-400">Заказов пока нет</p>}
        <ul className="divide-y divide-zinc-100">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium">№{o.number}</span> · {formatDate(o.createdAt)} ·{" "}
                {o.items.length} поз.
              </div>
              <div className="flex items-center gap-3">
                <span>{formatRub(o.total)}</span>
                <StatusBadge status={o.status} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
