"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPayment } from "@/app/actions";

export default function AddPaymentForm({
  buyerId,
  orderId,
}: {
  buyerId: string;
  orderId?: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!amount || Number(amount) <= 0) {
      setError("Укажите сумму");
      return;
    }
    setLoading(true);
    try {
      await createPayment({ buyerId, orderId, amount: Number(amount), method });
      setAmount("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="block text-xs text-zinc-500">Сумма, ₽</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-500">Способ</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="card">Карта</option>
          <option value="cash">Наличные</option>
          <option value="invoice">Счёт</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "…" : "Оплата"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
