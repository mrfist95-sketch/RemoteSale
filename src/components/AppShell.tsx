import LogoutButton from "@/components/LogoutButton";
import NavLinks, { type NavItem } from "@/components/NavLinks";
import { ROLE_LABELS } from "@/lib/rbac-core";

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
    { href: "/analyst/leaderboard", label: "Лидерборд" },
    { href: "/analyst/price-list", label: "Прайс-лист" },
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
  const brand = (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-900 text-sm font-bold text-white">OS</span>
      <div>
        <div className="text-base font-semibold leading-tight text-brand-900">OnSale</div>
        <div className="text-xs text-zinc-500">{ROLE_LABELS[user.role]}</div>
      </div>
    </div>
  );
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden border-r border-zinc-200 bg-white p-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="mb-6">{brand}</div>
        <nav className="flex flex-col gap-1" aria-label="Разделы">
          <NavLinks items={items} />
        </nav>
        <div className="mt-auto pt-4 text-[11px] text-zinc-400">© Галеро-РМ 2026</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-col gap-2 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-end md:px-6">
          <div className="flex items-center justify-between md:hidden">
            {brand}
            <LogoutButton />
          </div>
          <nav className="flex gap-1 overflow-x-auto pb-1 md:hidden" aria-label="Разделы">
            <NavLinks items={items} mobile />
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-sm text-zinc-500">{user.name ?? user.email}</span>
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
