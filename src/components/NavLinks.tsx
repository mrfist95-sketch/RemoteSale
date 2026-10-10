"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
}

// Иконки (24x24, штрих). Ключ — последний сегмент адреса; корень раздела — home
const ICONS: Record<string, string> = {
  home: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  courier: "M3 6h11v10H3zM14 9h4l3 3v4h-7M7 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  users: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  agents: "M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M17 4.5a3.5 3.5 0 010 7M18 14.5A6 6 0 0122 21",
  "price-list": "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  orders: "M9 3h6a1 1 0 011 1v1h2a1 1 0 011 1v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1h2V4a1 1 0 011-1zM9 12h6M9 16h4",
  catalog: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  payments: "M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 10h18M7 15h3",
  profile: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  stats: "M5 21V11M12 21V4M19 21v-7",
  "route-list": "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  leaderboard: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3",
  products: "M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8",
  new: "M12 5v14M5 12h14",
};

function iconKey(href: string): string {
  const parts = href.split("/").filter(Boolean);
  if (parts.length <= 1) return parts[0] === "courier" ? "courier" : "home";
  return parts[parts.length - 1];
}

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICONS[name] ?? ICONS.home} />
    </svg>
  );
}

/** Пункты меню с подсветкой текущего раздела */
export default function NavLinks({ items, mobile = false }: { items: NavItem[]; mobile?: boolean }) {
  const pathname = usePathname();
  // Активен самый длинный совпадающий префикс (чтобы «/buyer» не горел на «/buyer/orders»)
  const active = items
    .filter((it) => pathname === it.href || pathname.startsWith(it.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      {items.map((it) => {
        const on = it.href === active;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={
              mobile
                ? "whitespace-nowrap border-b-[3px] px-3.5 py-3 text-sm font-semibold transition-colors " +
                  (on ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:bg-slate-100")
                : "flex items-center gap-3 rounded-lg px-2 py-2 text-[15px] font-medium transition-colors " +
                  (on ? "bg-brand-50 text-brand-600" : "text-slate-900 hover:bg-slate-200/70")
            }
          >
            {!mobile && (
              <span
                className={
                  "grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors " +
                  (on ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-800")
                }
              >
                <Icon name={iconKey(it.href)} />
              </span>
            )}
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
