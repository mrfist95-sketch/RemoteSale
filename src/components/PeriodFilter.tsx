"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function PeriodFilter() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    router.push(`${pathname}?${q.toString()}`);
  }
  function reset() {
    setFrom("");
    setTo("");
    router.push(pathname);
  }

  return (
    <form onSubmit={apply} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-zinc-500">С</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500">По</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        />
      </div>
      <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
        Применить
      </button>
      <button type="button" onClick={reset} className="text-sm text-zinc-500 hover:underline">
        Сбросить
      </button>
    </form>
  );
}
