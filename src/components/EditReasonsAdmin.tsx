"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createEditReason, deleteEditReason } from "@/app/actions";

export default function EditReasonsAdmin({ reasons }: { reasons: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createEditReason(name);
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, n: string) {
    if (!confirm(`Удалить причину «${n}»? Она останется в истории корректировок, но исчезнет из списка выбора.`)) return;
    setError(null);
    try {
      await deleteEditReason(id);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div className="mb-4 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
      <p className="mb-2 font-medium">Причины корректировки заказов (используется продавцом)</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {reasons.length === 0 && <span className="text-xs text-zinc-400">Список пуст — продавец будет вводить причину текстом</span>}
        {reasons.map((r) => (
          <span
            key={r.id}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-zinc-200"
          >
            {r.name}
            <button onClick={() => remove(r.id, r.name)} title="Удалить причину" className="text-zinc-400 hover:text-red-600">
              ×
            </button>
          </span>
        ))}
      </div>
      <form onSubmit={add} className="flex items-end gap-2">
        <label className="text-xs text-zinc-500">
          Новая причина
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ml-2 w-64 rounded border border-zinc-300 px-2 py-1 text-sm"
            placeholder="Например: Нет на складе"
          />
        </label>
        <button type="submit" disabled={busy} className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-50">
          Добавить
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}