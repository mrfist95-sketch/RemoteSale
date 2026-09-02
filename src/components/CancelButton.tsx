"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder } from "@/app/actions";

export default function CancelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function onClick() {
    if (!confirm("Отменить заказ?")) return;
    setLoading(true);
    try {
      await cancelOrder(orderId);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button onClick={onClick} disabled={loading} className="text-xs text-red-600 hover:underline">
      Отменить
    </button>
  );
}
