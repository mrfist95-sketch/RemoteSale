"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/rbac";

export default function SellerOrderFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  function reset() {
    setStatus("");
    setFrom("");
    setTo("");
    router.push(pathname);
  }

  return (
    <form
      onSubmit={apply}
      className="flex flex-wrap items-end gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2"
    >
      <div>
        <label className="block text-xs text-zinc-500">Статус</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Все статусы</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-zinc-500">Дата с</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500">по</label>
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