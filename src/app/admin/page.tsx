import Link from "next/link";
import { requireRole } from "@/lib/rbac";
import { getGlobalStats } from "@/lib/stats";
import { formatRub } from "@/lib/format";
import { PageHeader, Card, StatCard } from "@/components/ui";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";

export default async function AdminPage() {
  await requireRole("ADMIN");
  const stats = await getGlobalStats();

  const links = [
    { href: "/admin/users", label: "Пользователи и роли" },
    { href: "/admin/price-list", label: "Прайс-лист" },
    { href: "/admin/orders", label: "Все заказы" },
  ];

  return (
    <div>
      <PageHeader
        title="Панель администратора"
        subtitle="Сводная статистика по платформе"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Заказов" value={String(stats.orderCount)} />
        <StatCard label="Сумма заказов" value={formatRub(stats.orderSum)} />
        <StatCard label="Оплачено" value={formatRub(stats.paid)} />
        <StatCard label="Задолженность" value={formatRub(stats.debt)} hint="по отгруженным" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card title="Разделы управления">
          <ul className="divide-y divide-zinc-100 text-sm">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block py-2 font-medium text-zinc-800 hover:text-zinc-900">
                  {l.label} →
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Заказы по статусам">
          <ul className="divide-y divide-zinc-100 text-sm">
            {stats.byStatus.length === 0 && (
              <li className="py-2 text-zinc-400">Нет заказов</li>
            )}
            {stats.byStatus.map((s) => (
              <li key={s.status} className="flex items-center justify-between py-2">
                <span>{ORDER_STATUS_LABELS[s.status] ?? s.status}</span>
                <span className="font-medium">{s.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
