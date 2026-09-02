"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeOrderStatus } from "@/app/actions";

export default function MarkDeliveredButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!confirm("Отметить заказ как доставленный?")) return;
    setBusy(true);
    try {
      await changeOrderStatus(orderId, "DELIVERED");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
    >
      {busy ? "…" : "Отметить доставку"}
    </button>
  );
}
