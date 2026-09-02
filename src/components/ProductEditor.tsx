"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRub } from "@/lib/format";
import {
  updateProduct,
  createCategory,
  deleteCategory,
  mergeCategories,
  deleteProducts,
  restoreProducts,
  hardDeleteProducts,
  createProduct,
} from "@/app/actions";

interface Row {
  id: string;
  article: string | null;
  name: string;
  unit: string;
  price: number;
  stock: number;
  categoryId: string | null;
  categoryName: string | null;
  manufacturer: string | null;
  deleted: boolean;
}

interface Cat {
  id: string;
  name: string;
  _count: { products: number };
}

type SortKey = "article" | "name" | "manufacturer" | "category" | "price" | "stock";

export default function ProductEditor({ products, categories }: { products: Row[]; categories: Cat[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, { price: string; stock: string; categoryId: string | "null" }>>(
    Object.fromEntries(
      products.map((p) => [
        p.id,
        { price: String(p.price), stock: String(p.stock), categoryId: p.categoryId ?? "null" },
      ]),
    ),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Сортировка / фильтры
  const [sortKey, setSortKey] = useState<SortKey>("article");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterCat, setFilterCat] = useState("");
  const [filterManu, setFilterManu] = useState("");
  const [search, setSearch] = useState("");
  const [showDeleted, setShowDeleted] = useState(false); // «не показывать с пометкой на удаление» — по умолчанию

  // Массовое выделение
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Справочник категорий
  const [newCat, setNewCat] = useState("");
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [catError, setCatError] = useState<string | null>(null);

  // Форма добавления позиции
  const [addOpen, setAddOpen] = useState(false);
  const [nName, setNName] = useState("");
  const [nArticle, setNArticle] = useState("");
  const [nUnit, setNUnit] = useState("шт");
  const [nPrice, setNPrice] = useState("");
  const [nStock, setNStock] = useState("");
  const [nManu, setNManu] = useState("");
  const [nCat, setNCat] = useState("null");
  const [nBusy, setNBusy] = useState(false);
  const [nError, setNError] = useState<string | null>(null);

  const manufacturers = useMemo(
    () =>
      [...new Set(products.map((p) => p.manufacturer).filter((m): m is string => !!m))].sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [products],
  );

  // Активный список: активные или удалённые
  const visible = useMemo(() => {
    let list = products.filter((p) => (showDeleted ? p.deleted : !p.deleted));
    if (filterCat) list = list.filter((p) => p.categoryId === filterCat);
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
        case "category":
          return p.categoryName ?? "";
        case "manufacturer":
          return p.manufacturer ?? "";
        case "price":
          return p.price;
        case "stock":
          return p.stock;
        case "name":
          return p.name;
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
  }, [products, showDeleted, filterCat, filterManu, search, sortKey, sortDir]);

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function set(id: string, field: "price" | "stock" | "categoryId", value: string) {
    setRows((r) => ({ ...r, [id]: { ...r[id], [field]: value } }));
  }

  function headerClick(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function sortIndicator(k: SortKey): string {
    if (sortKey !== k) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  async function save(id: string) {
    setBusy(id);
    setError(null);
    try {
      await updateProduct(id, {
        price: Number(rows[id].price),
        stock: Math.max(0, Math.floor(Number(rows[id].stock) || 0)),
        categoryId: rows[id].categoryId === "null" ? null : rows[id].categoryId,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setBusy(null);
    }
  }

  async function bulk(kind: "soft" | "restore" | "hard") {
    setError(null);
    setNotice(null);
    if (selected.size === 0) {
      setError("Не выбрано ни одной позиции");
      return;
    }
    const ids = [...selected];
    try {
      if (kind === "soft") {
        if (!confirm(`Пометить на удаление ${ids.length} поз.? Они исчезнут из каталога и форм заказа.`)) return;
        const res = await deleteProducts(ids);
        setNotice(`Помечено на удаление: ${res.count}`);
      } else if (kind === "restore") {
        const res = await restoreProducts(ids);
        setNotice(`Восстановлено: ${res.count}`);
      } else {
        if (!confirm("ЖЁСТКОЕ удаление из базы. Товары с историей заказов будут пропущены. Продолжить?")) return;
        const res = await hardDeleteProducts(ids);
        setNotice(`Жёстко удалено: ${res.count}` + (res.skippedMessage ? `. ${res.skippedMessage}` : ""));
      }
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setCatError(null);
    try {
      await createCategory(newCat);
      setNewCat("");
      router.refresh();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function doMerge() {
    setCatError(null);
    if (!mergeFrom || !mergeTo || mergeFrom === mergeTo) {
      setCatError("Выберите две разные категории");
      return;
    }
    if (!confirm("Перенести все товары в выбранную категорию и удалить исходную?")) return;
    try {
      await mergeCategories(mergeFrom, mergeTo);
      setMergeFrom("");
      setMergeTo("");
      router.refresh();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function doDeleteCategory(id: string) {
    if (!confirm("Удалить категорию? Товары останутся без категории.")) return;
    try {
      await deleteCategory(id);
      router.refresh();
    } catch (err) {
      setCatError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setNError(null);
    setNBusy(true);
    try {
      const res = await createProduct({
        name: nName,
        article: nArticle, // пустая строка -> сгенерируется автоматически
        unit: nUnit,
        price: Number(nPrice) || 0,
        stock: Math.max(0, Math.floor(Number(nStock) || 0)),
        manufacturer: nManu,
        categoryId: nCat === "null" ? null : nCat,
      });
      setNotice(`Позиция добавлена, артикул: ${res.article}`);
      setNName("");
      setNArticle("");
      setNPrice("");
      setNStock("");
      setNManu("");
      setAddOpen(false);
      router.refresh();
    } catch (err) {
      setNError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setNBusy(false);
    }
  }

  const th = (k: SortKey) => (
    <th className={`py-2 ${k !== "article" ? "cursor-pointer select-none hover:text-zinc-800" : ""}`} onClick={k === "article" ? undefined : () => headerClick(k)}>
      {k === "article"
        ? "Артикул"
        : k === "name"
          ? "Наименование"
          : k === "manufacturer"
            ? "Производитель"
            : k === "category"
              ? "Категория"
              : k === "price"
                ? `Цена${sortIndicator(k)}`
                : `Остаток${sortIndicator(k)}`}
      {k !== "price" && k !== "stock" ? sortIndicator(k) : ""}
    </th>
  );

  return (
    <div className="space-y-4">
      {/* Справочник категорий */}
      <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
        <p className="mb-2 font-medium">Товарные категории (справочник)</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {categories.length === 0 && <span className="text-xs text-zinc-400">Пока нет категорий</span>}
          {categories.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ${
                c._count.products === 0
                  ? "bg-red-50 text-red-700 ring-red-200"
                  : "bg-white text-zinc-700 ring-zinc-200"
              }`}
              title={c._count.products === 0 ? "Категория без товаров — можно безопасно удалить" : undefined}
            >
              {c.name}
              <span className="text-zinc-400">· {c._count.products === 0 ? "0 товаров" : c._count.products}</span>
              <button
                onClick={() => doDeleteCategory(c.id)}
                title="Удалить категорию"
                className={`ml-0.5 ${
                  c._count.products === 0 ? "font-bold text-red-600 hover:text-red-800" : "text-zinc-400 hover:text-red-600"
                }`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <form onSubmit={addCategory} className="flex items-end gap-2">
            <label className="text-xs text-zinc-500">
              Новая категория
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="ml-2 w-40 rounded border border-zinc-300 px-2 py-1 text-sm"
                placeholder="Например: Крепёж"
              />
            </label>
            <button type="submit" className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white">
              Добавить
            </button>
          </form>
          <div className="flex items-end gap-2 border-l border-zinc-200 pl-3">
            <label className="text-xs text-zinc-500">
              Объединить
              <select
                value={mergeFrom}
                onChange={(e) => setMergeFrom(e.target.value)}
                className="ml-2 rounded border border-zinc-300 px-1 py-1 text-sm"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-zinc-400">→</span>
            <label className="text-xs text-zinc-500">
              в
              <select
                value={mergeTo}
                onChange={(e) => setMergeTo(e.target.value)}
                className="ml-2 rounded border border-zinc-300 px-1 py-1 text-sm"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={doMerge} className="rounded border border-zinc-300 px-3 py-1.5 text-xs">
              Объединить
            </button>
          </div>
        </div>
        {catError && <p className="mt-2 text-xs text-red-600">{catError}</p>}
      </div>

      {/* Панель фильтров и сортировки */}
      <div className="flex flex-wrap items-center gap-3 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <label className="text-xs text-zinc-500">
          Категория
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="ml-2 rounded border border-zinc-300 px-1 py-1 text-sm"
          >
            <option value="">все</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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
          placeholder="Поиск: название / артикул / производитель"
          className="w-64 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
        <label className="ml-auto flex items-center gap-1 text-xs">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          показывать удалённые
        </label>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</div>
      )}

      {/* Массовые операции */}
      <div className="flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <span className="text-xs text-zinc-500">
          Выбрано: {selected.size}
          {selected.size > 0 && (
            <button onClick={() => setSelected(new Set())} className="ml-2 text-zinc-400 hover:underline">
              снять
            </button>
          )}
        </span>
        {showDeleted ? (
          <>
            <button
              onClick={() => bulk("restore")}
              disabled={selected.size === 0}
              className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Восстановить
            </button>
            <button
              onClick={() => bulk("hard")}
              disabled={selected.size === 0}
              className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
              title="Удалить из базы окончательно (товары с историей заказов будут пропущены)"
            >
              Удалить окончательно
            </button>
          </>
        ) : (
          <button
            onClick={() => bulk("soft")}
            disabled={selected.size === 0}
            className="rounded border border-red-300 bg-white px-3 py-1.5 text-xs text-red-700 disabled:opacity-50"
          >
            Пометить на удаление
          </button>
        )}
        <span className="text-xs text-zinc-400">
          {showDeleted
            ? "Удалённые товары: восстановление или жёсткое удаление (с историей заказов — пропускаются)"
            : "Удалённые товары скрыты; включите «показывать удалённые» ниже таблицы"}
        </span>
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="ml-auto rounded bg-zinc-900 px-3 py-1.5 text-xs text-white"
        >
          {addOpen ? "Скрыть форму" : "+ Добавить позицию"}
        </button>
      </div>

      {/* Форма добавления позиции */}
      {addOpen && (
        <form onSubmit={addProduct} className="space-y-2 rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <p className="text-xs text-zinc-500">
            Артикул можно не указывать — он будет выдан автоматически (АРТ-XXXXXX).
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-zinc-500">
              Наименование *
              <input
                required
                value={nName}
                onChange={(e) => setNName(e.target.value)}
                className="ml-1 w-52 rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Артикул
              <input
                value={nArticle}
                onChange={(e) => setNArticle(e.target.value)}
                placeholder="пусто = авто"
                className="ml-1 w-32 rounded border border-zinc-300 px-2 py-1 font-mono text-xs"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Категория
              <select
                value={nCat}
                onChange={(e) => setNCat(e.target.value)}
                className="ml-1 rounded border border-zinc-300 px-1 py-1"
              >
                <option value="null">— без —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-zinc-500">
              Производитель
              <input
                value={nManu}
                onChange={(e) => setNManu(e.target.value)}
                className="ml-1 w-36 rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Ед.
              <input
                value={nUnit}
                onChange={(e) => setNUnit(e.target.value)}
                className="ml-1 w-16 rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Цена
              <input
                type="number"
                step="0.01"
                value={nPrice}
                onChange={(e) => setNPrice(e.target.value)}
                className="ml-1 w-24 rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <label className="text-xs text-zinc-500">
              Остаток
              <input
                type="number"
                value={nStock}
                onChange={(e) => setNStock(e.target.value)}
                className="ml-1 w-20 rounded border border-zinc-300 px-2 py-1"
              />
            </label>
            <button
              type="submit"
              disabled={nBusy}
              className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              {nBusy ? "…" : "Добавить"}
            </button>
          </div>
          {nError && <p className="text-xs text-red-600">{nError}</p>}
        </form>
      )}

      {/* Таблица товаров */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500">
            <tr>
              <th className="py-2" />
              {th("article")}
              <th className="py-2 cursor-pointer select-none hover:text-zinc-800" onClick={() => headerClick("name")}>
                Наименование{sortIndicator("name")}
              </th>
              {th("manufacturer")}
              <th className="py-2 cursor-pointer select-none hover:text-zinc-800" onClick={() => headerClick("category")}>
                Товарная категория{sortIndicator("category")}
              </th>
              <th className="py-2">Ед.</th>
              {th("price")}
              {th("stock")}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="py-4 text-center text-sm text-zinc-400">
                  Нет позиций по фильтру
                </td>
              </tr>
            )}
            {visible.map((p) => (
              <tr key={p.id} className={`border-t border-zinc-100 ${p.deleted ? "opacity-60" : ""}`}>
                <td className="py-2">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSel(p.id)} />
                </td>
                <td className="py-2 font-mono text-xs">{p.article ?? "—"}</td>
                <td className="py-2">{p.name}</td>
                <td className="py-2 text-zinc-600">{p.manufacturer ?? "—"}</td>
                <td className="py-2">
                  <select
                    value={rows[p.id].categoryId}
                    onChange={(e) => set(p.id, "categoryId", e.target.value)}
                    className="rounded border border-zinc-300 px-1 py-1 text-xs"
                  >
                    <option value="null">— без категории —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">{p.unit}</td>
                <td className="py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={rows[p.id].price}
                    onChange={(e) => set(p.id, "price", e.target.value)}
                    className="w-24 rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    value={rows[p.id].stock}
                    onChange={(e) => set(p.id, "stock", e.target.value)}
                    className="w-20 rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="py-2">
                  <button
                    onClick={() => save(p.id)}
                    disabled={busy === p.id}
                    className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50"
                  >
                    {busy === p.id ? "…" : "Сохранить"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}