"use client";

import { useMemo, useState } from "react";
import { formatRub } from "@/lib/format";

interface Row {
  id: string;
  article: string | null;
  name: string;
  unit: string;
  price: number;
  stock: number;
  categoryName: string | null;
  manufacturer: string | null;
}

type SortKey = "article" | "name" | "manufacturer" | "category" | "price";

export default function CatalogTable({ products }: { products: Row[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterCat, setFilterCat] = useState("");
  const [filterManu, setFilterManu] = useState("");
  const [search, setSearch] = useState("");

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.categoryName).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, "ru")),
    [products],
  );
  const manufacturers = useMemo(
    () => [...new Set(products.map((p) => p.manufacturer).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, "ru")),
    [products],
  );

  const visible = useMemo(() => {
    let list = products;
    if (filterCat) list = list.filter((p) => p.categoryName === filterCat);
    if (filterManu) list = list.filter((p) => p.manufacturer === filterManu);
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.article ?? "").toLowerCase().includes(q) ||
          (p.manufacturer ?? "").toLowerCase().includes(q),
      );
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (p: Row): string | number => {
      switch (sortKey) {
        case "name":
          return p.name;
        case "category":
          return p.categoryName ?? "";
        case "manufacturer":
          return p.manufacturer ?? "";
        case "price":
          return p.price;
        default:
          return p.article ?? "";
      }
    };
    return [...list].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "ru") * dir;
    });
  }, [products, sortKey, sortDir, filterCat, filterManu, search]);

  function headerClick(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function indicator(k: SortKey): string {
    if (sortKey !== k) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <label className="text-xs text-zinc-500">
          Категория
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="ml-2 rounded border border-zinc-300 px-1 py-1 text-sm"
          >
            <option value="">все</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-zinc-500">
          Производитель
          <select
            value={filterManu}
            onChange={(e) => setFilterManu(e.target.value)}
            className="ml-2 rounded border border-zinc-300 px-1 py-1 text-sm"
          >
            <option value="">все</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: название / производитель"
          className="ml-auto w-full max-w-64 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <span className="text-xs text-zinc-400">
          Сортировка — кликом по заголовку колонки
        </span>
      </div>

      {/* Мобильный: карточки */}
      <div className="md:hidden">
        {visible.length === 0 && <p className="py-4 text-center text-sm text-zinc-400">Ничего не найдено</p>}
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          {visible.map((p) => (
            <div key={p.id} className="border-t border-zinc-100 px-3 py-2 first:border-t-0">
              <div className="font-medium">{p.name}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {[p.categoryName, p.manufacturer].filter(Boolean).join(" · ") || "—"}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{formatRub(p.price)}</span>
                <span className="shrink-0 text-xs text-zinc-400">
                  {p.unit} · скл.: {p.stock}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Десктоп: таблица */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="cursor-pointer select-none py-2 hover:text-zinc-800" onClick={() => headerClick("name")}>
                Наименование{indicator("name")}
              </th>
              <th className="cursor-pointer select-none py-2 hover:text-zinc-800" onClick={() => headerClick("category")}>
                Категория{indicator("category")}
              </th>
              <th className="cursor-pointer select-none py-2 hover:text-zinc-800" onClick={() => headerClick("manufacturer")}>
                Производитель{indicator("manufacturer")}
              </th>
              <th className="py-2">Ед.</th>
              <th className="cursor-pointer select-none py-2 hover:text-zinc-800" onClick={() => headerClick("price")}>
                Цена{indicator("price")}
              </th>
              <th className="py-2">Остаток</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-sm text-zinc-400">
                  Ничего не найдено
                </td>
              </tr>
            )}
            {visible.map((p) => (
              <tr key={p.id} className="border-t border-zinc-100">
                <td className="py-2">{p.name}</td>
                <td className="py-2 text-zinc-500">{p.categoryName ?? "—"}</td>
                <td className="py-2 text-zinc-600">{p.manufacturer ?? "—"}</td>
                <td className="py-2">{p.unit}</td>
                <td className="py-2">{formatRub(p.price)}</td>
                <td className="py-2">{p.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}