"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeOrderStatus } from "@/app/actions";
import { ORDER_STATUS_LABELS, statusOptionsFor } from "@/lib/rbac";

export default function StatusSelect({
  orderId,
  current,
  role,
}: {
  orderId: string;
  current: string;
  role: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(current);
  const [loading, setLoading] = useState(false);
  const options = statusOptionsFor(role);
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    setStatus(v);
    setLoading(true);
    try {
      await changeOrderStatus(orderId, v);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  return (
    <select
      value={status}
      onChange={onChange}
      disabled={loading}
      className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
    >
      {options.map((s) => (
        <option key={s} value={s}>
          {ORDER_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
