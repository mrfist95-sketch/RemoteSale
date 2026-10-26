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
              "whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors " +
              (on
                ? "bg-brand-50 font-medium text-brand-800" + (mobile ? "" : " shadow-[inset_3px_0_0_var(--color-brand-600)]")
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900")
            }
          >
            {it.label}
          </Link>
        );
      })}
    </>
  );
}
