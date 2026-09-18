"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function AgentFilter({
  agents,
  paramKey = "agent",
}: {
  agents: { id: string; name: string }[];
  paramKey?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const current = sp.get(paramKey) ?? "";

  function change(value: string) {
    const q = new URLSearchParams(sp.toString());
    if (value) q.set(paramKey, value);
    else q.delete(paramKey);
    const s = q.toString();
    router.push(s ? `${pathname}?${s}` : pathname);
  }

  return (
    <div>
      <label className="block text-xs text-zinc-500">Торговый представитель</label>
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
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
  );
}