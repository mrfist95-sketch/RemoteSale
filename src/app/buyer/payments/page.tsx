import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getBuyerDebt, getBuyerPaid } from "@/lib/stats";
import { formatRub, formatDate } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";

export default async function BuyerPaymentsPage() {
  const user = await requireRole("BUYER");
  const debt = await getBuyerDebt(user.id);
  const paid = await getBuyerPaid(user.id);
  const payments = await prisma.payment.findMany({
    where: { buyerId: user.id },
    orderBy: { date: "desc" },
  });

  return (
    <div>
      <PageHeader title="Оплаты и задолженность" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Задолженность" value={formatRub(debt)} hint={debt > 0 ? "нужно оплатить" : "нет долга"} />
        <StatCard label="Оплачено" value={formatRub(paid)} />
        <StatCard label="Статус" value={debt > 0 ? "Есть долг" : "Оплачено"} />
      </div>

      <Card title="История оплат">
        {payments.length === 0 && <p className="text-sm text-zinc-400">Оплат пока нет</p>}
        <ul className="divide-y divide-zinc-100">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                {formatDate(p.date)} · {p.method}
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
