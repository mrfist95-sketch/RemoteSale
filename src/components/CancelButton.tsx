"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/app/actions";
import { unwrap } from "@/lib/action-result";
import { toast } from "@/components/Toaster";

export default function CancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onClick() {
    if (!confirm("Отменить заказ?")) return;
    setLoading(true);
    try {
      unwrap(await cancelOrder(orderId));
      toast.success("Заказ отменён");
      router.refresh();
    } catch (e) {
      toast.fromError(e);
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={onClick} disabled={loading} className="text-xs text-red-600 hover:underline disabled:opacity-50">
      {loading ? "…" : "Отменить"}
    </button>
  );
}
