import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { getAgentStats } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, StatCard, Card } from "@/components/ui";

export default async function AgentHome() {
  const user = await requireRole("AGENT");
  const stats = await getAgentStats(user.id);

  return (
    <div>
      <PageHeader title="Мои клиенты" subtitle="Закреплённые покупатели" />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Клиентов" value={String(stats.clients.length)} />
        <StatCard label="Сумма продаж" value={formatRub(stats.totalSum)} />
        <StatCard label="Задолженность" value={formatRub(stats.totalDebt)} />
      </div>

      <Card title="Клиенты">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500">
              <tr>
                <th className="py-2">Клиент</th>
                <th className="py-2">Заказов</th>
                <th className="py-2">Сумма</th>
                <th className="py-2">Оплачено</th>
                <th className="py-2">Долг</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {stats.clients.map((c) => (
                <tr key={c.buyerId} className="border-t border-zinc-100">
                  <td className="py-2 font-medium">{c.buyerName}</td>
                  <td className="py-2">{c.orderCount}</td>
                  <td className="py-2">{formatRub(c.orderSum)}</td>
                  <td className="py-2 text-green-700">{formatRub(c.paid)}</td>
                  <td className="py-2 text-red-700">{formatRub(c.debt)}</td>
                  <td className="py-2 text-right">
                    <Link href={`/agent/order/${c.buyerId}`} className="text-indigo-600 hover:underline">
                      Создать заказ
                    </Link>
                  </td>
                </tr>
              ))}
              {stats.clients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-zinc-400">
                    Клиенты не закреплены. Обратитесь к администратору.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
