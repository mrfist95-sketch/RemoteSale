import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { ROLE_LABELS } from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
}

const NAV: Record<string, NavItem[]> = {
  BUYER: [
    { href: "/buyer", label: "Обзор" },
    { href: "/buyer/catalog", label: "Каталог" },
    { href: "/buyer/orders", label: "Мои заказы" },
    { href: "/buyer/payments", label: "Оплаты и долг" },
    { href: "/buyer/profile", label: "Мои данные" },
    { href: "/buyer/stats", label: "Статистика" },
  ],
  AGENT: [
    { href: "/agent", label: "Мои клиенты" },
    { href: "/agent/orders", label: "Заказы клиентов" },
    { href: "/agent/stats", label: "Статистика" },
  ],
  SELLER: [
    { href: "/seller", label: "Заявки" },
    { href: "/seller/route-list", label: "Маршрутный лист" },
    { href: "/seller/stats", label: "Статистика" },
  ],
  COURIER: [{ href: "/courier", label: "Доставка" }],
  ANALYST: [
    { href: "/analyst", label: "Сводная" },
    { href: "/analyst/agents", label: "Представители и клиенты" },
    { href: "/analyst/products", label: "Товары" },
  ],
  ADMIN: [
    { href: "/admin/users", label: "Пользователи" },
    { href: "/admin/price-list", label: "Прайс-лист" },
    { href: "/admin/orders", label: "Все заказы" },
  ],
};

export default function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: string };
  children: React.ReactNode;
}) {
  const items = NAV[user.role] ?? [];
  const navLinks = items.map((it) => (
    <Link
      key={it.href}
      href={it.href}
      className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
    >
      {it.label}
    </Link>
  ));
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden border-r border-zinc-200 bg-white p-4 md:flex md:w-60 md:shrink-0 md:flex-col">
        <div className="mb-6">
          <div className="text-lg font-semibold leading-tight">OnSale</div>
          <div className="text-xs text-zinc-500">{ROLE_LABELS[user.role]}</div>
        </div>
        <nav className="flex flex-col gap-1">{navLinks}</nav>
        <div className="mt-auto pt-4 text-[11px] text-zinc-400">© Галеро-РМ 2026</div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex flex-col gap-2 border-b border-zinc-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex items-center justify-between md:hidden">
            <div>
              <div className="text-base font-semibold leading-tight">OnSale</div>
              <div className="text-xs text-zinc-500">{ROLE_LABELS[user.role]}</div>
            </div>
            <LogoutButton />
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 md:hidden">{navLinks}</nav>
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm font-medium">{user.name ?? user.email}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
