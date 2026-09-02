"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitOrder } from "@/app/actions";

export default function SubmitOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    if (!confirm("Передать заказ в работу? После этого черновик нельзя будет изменить, заказ увидит продавец.")) return;
    setLoading(true);
    setError(null);
    try {
      await submitOrder(orderId);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded bg-zinc-900 px-2.5 py-1 text-xs text-white disabled:opacity-50"
        title="Черновик станет заказом: его увидит продавец; редактировать будет нельзя"
      >
        {loading ? "…" : "Передать в работу"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}