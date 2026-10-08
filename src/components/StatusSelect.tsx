"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeOrderStatus } from "@/app/actions";
import { unwrap } from "@/lib/action-result";
import { ORDER_STATUS_LABELS } from "@/lib/rbac-core";
import { statusOptions } from "@/lib/order-rules";
import { toast } from "@/components/Toaster";

/** Смена статуса: в списке только переходы, разрешённые правилами для этой роли */
export default function StatusSelect({
  orderId,
  current,
  role,
  paid = 0,
  total,
}: {
  orderId: string;
  current: string;
  role: string;
  paid?: number;
  total?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const options = statusOptions(current, role, paid, total ?? Number.POSITIVE_INFINITY);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === current) return;
    setLoading(true);
    try {
      unwrap(await changeOrderStatus(orderId, v));
      toast.success(`Статус: ${ORDER_STATUS_LABELS[v] ?? v}`);
      router.refresh();
    } catch (err) {
      toast.fromError(err);
    } finally {
      setLoading(false);
    }
  }

  if (options.length <= 1) {
    return <span className="text-xs text-zinc-400">нет доступных переходов</span>;
  }
  return (
    <select
      value={current}
      onChange={onChange}
      disabled={loading}
      aria-label="Сменить статус заказа"
      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm disabled:opacity-50"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {s === current ? `${ORDER_STATUS_LABELS[s] ?? s} (текущий)` : `→ ${ORDER_STATUS_LABELS[s] ?? s}`}
        </option>
      ))}
    </select>
  );
}
