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

function initials(name?: string | null, email?: string | null): string {
  const src = (name ?? email ?? "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function AppShell({
  user,
  children,
}: {
  user: { name?: string | null; email?: string | null; role: string };
  children: React.ReactNode;
}) {
  const items = NAV[user.role] ?? [];
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 bg-white shadow-bar">
        <div className="flex h-14 items-center justify-between gap-3 px-3 md:px-4">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-[15px] font-extrabold text-white">
              OS
            </span>
            <span className="text-xl font-bold tracking-tight text-brand-600">OnSale</span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden text-right leading-tight sm:block">
              <div className="max-w-[16rem] truncate text-sm font-semibold text-slate-900">{user.name ?? user.email}</div>
              <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</div>
            </div>
            <span
              className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-sm font-bold text-slate-800"
              title={ROLE_LABELS[user.role]}
              aria-hidden
            >
              {initials(user.name, user.email)}
            </span>
            <LogoutButton />
          </div>
        </div>
        <nav className="flex overflow-x-auto border-t border-slate-200 px-1 md:hidden" aria-label="Разделы">
          <NavLinks items={items} mobile />
        </nav>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-72 shrink-0 overflow-y-auto p-2 md:block">
          <nav className="flex flex-col gap-0.5" aria-label="Разделы">
            <NavLinks items={items} />
          </nav>
          <div className="mt-6 px-3 text-[11px] text-slate-500">© Галеро-РМ 2026</div>
        </aside>
        <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 p-3 md:p-5 md:pl-2">{children}</main>
      </div>
    </div>
  );
}
