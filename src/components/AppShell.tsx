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
  const mark = (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-bold text-white shadow-[0_6px_16px_-4px_rgb(66_100_236/0.7)]">
      OS
    </span>
  );
  const brand = (dark: boolean) => (
    <div className="flex items-center gap-2.5">
      {mark}
      <div>
        <div className={"text-base font-semibold leading-tight " + (dark ? "text-white" : "text-brand-900")}>OnSale</div>
        <div className={"text-xs " + (dark ? "text-slate-400" : "text-slate-500")}>{ROLE_LABELS[user.role]}</div>
      </div>
    </div>
  );
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden bg-gradient-to-b from-ink-800 to-ink-900 p-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="mb-8 mt-1 px-1">{brand(true)}</div>
        <nav className="flex flex-col gap-1" aria-label="Разделы">
          <NavLinks items={items} />
        </nav>
        <div className="mt-auto pt-4 px-1">
          <div className="mb-3 truncate rounded-lg bg-white/6 px-3 py-2 text-xs text-slate-300">{user.name ?? user.email}</div>
          <LogoutButton variant="dark" />
          <div className="mt-4 text-[11px] text-slate-500">© Галеро-РМ 2026</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-col gap-2 bg-white/80 px-4 py-3 shadow-[0_1px_0_rgb(14_24_56/0.06)] backdrop-blur-md md:hidden">
          <div className="flex items-center justify-between">
            {brand(false)}
            <LogoutButton />
          </div>
          <nav className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Разделы">
            <NavLinks items={items} mobile />
          </nav>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
