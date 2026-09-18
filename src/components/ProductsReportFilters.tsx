"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/rbac-core";

export default function ProductsReportFilters({
  categories,
  manufacturers,
  agents,
}: {
  categories: { id: string; name: string }[];
  manufacturers: string[];
  agents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const [from, setFrom] = useState(sp.get("from") ?? "");
  const [to, setTo] = useState(sp.get("to") ?? "");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [categoryId, setCategoryId] = useState(sp.get("category") ?? "");
  const [manufacturer, setManufacturer] = useState(sp.get("manufacturer") ?? "");
  const [agentId, setAgentId] = useState(sp.get("agent") ?? "");

  function push(q: URLSearchParams) {
    router.push(q.toString() ? `${pathname}?${q.toString()}` : pathname);
  }

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    if (status) q.set("status", status);
    if (categoryId) q.set("category", categoryId);
    if (manufacturer) q.set("manufacturer", manufacturer);
    if (agentId) q.set("agent", agentId);
    push(q);
  }

  function change(key: string, value: string, current: URLSearchParams) {
    const q = new URLSearchParams(current.toString());
    if (value) q.set(key, value);
    else q.delete(key);
    push(q);
  }

  function reset() {
    setFrom("");
    setTo("");
    setStatus("");
    setCategoryId("");
    setManufacturer("");
    setAgentId("");
    router.push(pathname);
  }

  const statusNow = sp.get("status") ?? "";
  const categoryNow = sp.get("category") ?? "";
  const manufacturerNow = sp.get("manufacturer") ?? "";
  const agentNow = sp.get("agent") ?? "";

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
      <div>
        <label className="block text-xs text-zinc-500">Статус заказа</label>
        <select
          value={statusNow}
          onChange={(e) => {
            setStatus(e.target.value);
            change("status", e.target.value, sp);
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Активные (без черновиков и отменённых)</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-zinc-500">Товарная группа</label>
        <select
          value={categoryNow}
          onChange={(e) => {
            setCategoryId(e.target.value);
            change("category", e.target.value, sp);
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Все группы</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-zinc-500">Производитель</label>
        <select
          value={manufacturerNow}
          onChange={(e) => {
            setManufacturer(e.target.value);
            change("manufacturer", e.target.value, sp);
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Все производители</option>
          {manufacturers.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      {agents && (
        <div>
          <label className="block text-xs text-zinc-500">Торговый представитель</label>
          <select
            value={agentNow}
            onChange={(e) => {
              setAgentId(e.target.value);
              change("agent", e.target.value, sp);
            }}
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="">Все представители</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
        Применить
      </button>
      <button type="button" onClick={reset} className="text-sm text-zinc-500 hover:underline">
        Сбросить
      </button>
    </form>
  );
}