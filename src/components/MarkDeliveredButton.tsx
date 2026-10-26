"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { changeOrderStatus } from "@/app/actions";
import { unwrap } from "@/lib/action-result";
import { toast } from "@/components/Toaster";

export default function MarkDeliveredButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!confirm("Отметить заказ как доставленный?")) return;
    setBusy(true);
    try {
      unwrap(await changeOrderStatus(orderId, "DELIVERED"));
      toast.success("Доставка отмечена");
      router.refresh();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {busy ? "…" : "Отметить доставку"}
    </button>
  );
}
