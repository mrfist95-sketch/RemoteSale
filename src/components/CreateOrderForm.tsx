"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRub } from "@/lib/format";

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  categoryName: string | null;
  manufacturer: string | null;
}

type GroupMode = "category" | "manufacturer" | "flat";

interface Group {
  name: string | null;
  items: Product[];
}

function ProductRow({
  p,
  qty,
  setQty,
}: {
  p: Product;
  qty: Record<string, number>;
  setQty: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
  return (
    <tr className="border-t border-zinc-100">
      <td className="px-3 py-2">
        <div className="font-medium">{p.name}</div>
        <div className="text-xs text-zinc-400">
          {p.manufacturer ? `${p.manufacturer} · ` : ""}
          {p.unit}
        </div>
      </td>
      <td className="px-3 py-2">{formatRub(p.price)}</td>
      <td className="px-3 py-2">{p.stock}</td>
      <td className="px-3 py-2">
        <input
          type="number"
          min={0}
          value={qty[p.id] || ""}
          onChange={(e) => setQty((q) => ({ ...q, [p.id]: Number(e.target.value) }))}
          className="w-full rounded border border-zinc-300 px-2 py-1"
          placeholder="0"
        />
      </td>
    </tr>
  );
}

export default function CreateOrderForm({
  products,
  buyerId,
  action,
}: {
  products: Product[];
  buyerId: string;
  action: (buyerId: string, items: { productId: string; qty: number }[], note?: string) => Promise<{ ok: boolean }>;
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<GroupMode>("category");
  const [search, setSearch] = useState("");

  const groups: Group[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.categoryName ?? "").toLowerCase().includes(q) ||
            (p.manufacturer ?? "").toLowerCase().includes(q),
        )
      : products;

    if (group === "flat") {
      return [{ name: null, items: [...filtered].sort((a, b) => a.name.localeCompare(b.name, "ru")) }];
    }
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const key =
        group === "category"
          ? (p.categoryName ?? "— без категории —")
          : (p.manufacturer ?? "— без производителя —");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "ru"))
      .map(([name, items]) => ({ name, items: [...items].sort((a, b) => a.name.localeCompare(b.name, "ru")) }));
  }, [products, group, search]);

  const items = products
    .map((p) => ({ productId: p.id, qty: Number(qty[p.id] || 0) }))
    .filter((i) => i.qty > 0);
  const total = products.reduce((s, p) => s + p.price * Number(qty[p.id] || 0), 0);

  async function submit() {
    setError(null);
    if (items.length === 0) {
      setError("Укажите количество хотя бы для одной позиции");
      return;
    }
    setLoading(true);
    try {
      await action(buyerId, items, note || undefined);
      router.push("/buyer/orders");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <span className="text-zinc-500">Группировка:</span>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="group-mode"
            checked={group === "category"}
            onChange={() => setGroup("category")}
          />
          по товарным группам
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="group-mode"
            checked={group === "manufacturer"}
            onChange={() => setGroup("manufacturer")}
          />
          по производителям
        </label>
        <label className="flex items-center gap-1">
          <input
            type="radio"
            name="group-mode"
            checked={group === "flat"}
            onChange={() => setGroup("flat")}
          />
          единый список
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: название / категория / производитель…"
          className="ml-auto w-56 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
      </div>

      {groups.map((g, gi) => (
        <div key={g.name ?? `flat-${gi}`} className="overflow-hidden rounded-lg border border-zinc-200">
          {group === "category" && (
            <div className="flex items-center justify-between bg-zinc-100 px-3 py-2">
              <span className="text-sm font-semibold">{g.name ?? "Товары"}</span>
              <span className="text-xs text-zinc-500">{g.items.length} поз.</span>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left">
              <tr>
                <th className="px-3 py-2">Артикул / Наименование</th>
                <th className="px-3 py-2">Цена</th>
                <th className="px-3 py-2">Остаток</th>
                <th className="px-3 py-2 w-32">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((p) => (
                <ProductRow key={p.id} p={p} qty={qty} setQty={setQty} />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {groups.every((g) => g.items.length === 0) && (
        <p className="text-sm text-zinc-400">Ничего не найдено</p>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Комментарий к заказу</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded border border-zinc-300 px-3 py-2"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Итого: {formatRub(total)}</div>
        <button
          onClick={submit}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white font-medium disabled:opacity-50"
        >
          {loading ? "Создание…" : "Оформить заказ"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}