"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem {
  href: string;
  label: string;
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
              "whitespace-nowrap text-sm transition-colors " +
              (mobile
                ? "rounded-full px-3.5 py-1.5 " +
                  (on ? "bg-brand-900 font-medium text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-brand-900")
                : "flex items-center gap-2.5 rounded-lg px-3 py-2.5 " +
                  (on ? "bg-white/12 font-medium text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"))
            }
          >
            {!mobile && (
              <span
                aria-hidden
                className={"h-1.5 w-1.5 rounded-full transition-colors " + (on ? "bg-brand-300" : "bg-white/20")}
              />
            )}
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
