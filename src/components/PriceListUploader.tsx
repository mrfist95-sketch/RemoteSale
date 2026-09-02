"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { stagePriceList, applyPriceList, type StagedProduct } from "@/app/price-actions";

interface ParseData {
  ok: true;
  encoding: string;
  delimiter?: string;
  totalRows: number;
  skipped: number;
  products: StagedProduct[];
  categories: string[];
  existingCategories: string[];
}

/** Выбор пользователя по категории, живёт в рамках сессии страницы (React state) */
type CategoryDecision = "create" | "merge";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_EXT = ["csv", "xlsx", "xls"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function clientValidate(f: File): string | null {
  const ext = f.name.toLowerCase().split(".").pop() ?? "";
  if (!ACCEPTED_EXT.includes(ext)) return "Поддерживаются только файлы CSV и XLSX";
  if (f.size > MAX_FILE_SIZE) return "Файл слишком большой (максимум 15 МБ)";
  return null;
}

export default function PriceListUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // фаза 2
  const [staged, setStaged] = useState<ParseData | null>(null);
  const [decisions, setDecisions] = useState<Record<string, CategoryDecision>>({});
  const [mergeTargets, setMergeTargets] = useState<Record<string, string>>({});
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const newCategories = useMemo(
    () => (staged ? staged.categories.filter((c) => !staged.existingCategories.includes(c)) : []),
    [staged],
  );
  const existingInFile = useMemo(
    () => (staged ? staged.categories.filter((c) => staged.existingCategories.includes(c)) : []),
    [staged],
  );

  /** Установка файла с клиентской проверкой; сбрасывает старые staged-данные */
  function pickFile(f: File | null) {
    setError(null);
    setDoneMsg(null);
    if (!f) {
      setFile(null);
      return;
    }
    const err = clientValidate(f);
    if (err) {
      setError(err);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setFile(f);
    // новый файл — сбрасываем недозавершённый шаг 2
    setStaged(null);
    setDecisions({});
    setMergeTargets({});
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files;
    if (!dropped || dropped.length === 0) return;
    if (dropped.length > 1) {
      setError("Выберите один файл");
      return;
    }
    pickFile(dropped[0]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDoneMsg(null);
    if (!file) {
      setError("Выберите файл CSV или XLSX");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await stagePriceList(fd);
      if (!res || !res.ok) {
        setError(res?.error ?? "Не удалось обработать файл (возможно, устарела страница — обновите её)");
        return;
      }
      // по умолчанию: существующие категории — merge с собой, новые — create
      const d: Record<string, CategoryDecision> = {};
      for (const c of res.data.categories) {
        d[c] = res.data.existingCategories.includes(c) ? "merge" : "create";
      }
      const m: Record<string, string> = {};
      for (const c of res.data.categories.filter((c) => !res.data.existingCategories.includes(c))) {
        m[c] = res.data.existingCategories[0] ?? "";
      }
      setDecisions(d);
      setMergeTargets(m);
      setStaged(res.data);
    } catch {
      setError("Не удалось обработать файл. Если страница была открыта давно — обновите её (F5) и повторите.");
      return;
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!staged) return;
    setApplying(true);
    setError(null);
    try {
      const choices: Record<string, string> = {};
      for (const c of staged.categories) {
        const dec = decisions[c] ?? "create";
        if (dec === "merge") {
          // merge для существующей категории = сама на себя (upsert), для новой — выбранная цель
          choices[c] = staged.existingCategories.includes(c) ? c : mergeTargets[c] || "create";
        } else {
          choices[c] = "create";
        }
      }
      const res = await applyPriceList({ products: staged.products, categoryChoices: choices });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDoneMsg(
        `Загружено: новых ${res.created}, обновлено ${res.updated}. Категорий создано: ${res.categoriesCreated}.` +
          (res.articlesGenerated > 0 ? ` Артикулов сгенерировано автоматически: ${res.articlesGenerated}.` : ""),
      );
      setStaged(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } finally {
      setApplying(false);
    }
  }

  function cancel() {
    setStaged(null);
    setDecisions({});
    setMergeTargets({});
  }

  // ---------- Шаг 2: подтверждение категорий ----------
  if (staged) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Шаг 2 из 2 — подтвердите загрузку
        </p>

        <div className="rounded border border-zinc-200 bg-zinc-50 p-3 text-sm">
          Файл распознан: <b>{staged.totalRows}</b> позиций, кодировка <b>{staged.encoding}</b>
          {staged.delimiter ? `, разделитель «${staged.delimiter === "\t" ? "таб" : staged.delimiter}»` : ""}.
        </div>

        {staged.categories.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Категорий в файле нет — товары будут добавлены без категории.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">Товарные категории в файле:</p>

            {existingInFile.length > 0 && (
              <div className="rounded border border-zinc-200 p-3 text-sm">
                <p className="mb-2 text-xs text-zinc-500">Уже есть в справочнике (объединяются автоматически):</p>
                <div className="flex flex-wrap gap-2">
                  {existingInFile.map((c) => (
                    <span key={c} className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {newCategories.length > 0 && (
              <div className="space-y-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                <p className="text-xs text-amber-700">
                  Новые категории — выберите: создать в справочнике или объединить с существующей:
                </p>
                {newCategories.map((c) => (
                  <div key={c} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c}</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={`cat-${c}`}
                        checked={(decisions[c] ?? "create") === "create"}
                        onChange={() => setDecisions((p) => ({ ...p, [c]: "create" }))}
                      />
                      создать
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="radio"
                        name={`cat-${c}`}
                        checked={decisions[c] === "merge"}
                        onChange={() => setDecisions((p) => ({ ...p, [c]: "merge" }))}
                      />
                      объединить с
                    </label>
                    {decisions[c] === "merge" && (
                      <select
                        value={mergeTargets[c] ?? ""}
                        onChange={(e) => setMergeTargets((p) => ({ ...p, [c]: e.target.value }))}
                        className="rounded border border-zinc-300 px-2 py-0.5 text-xs"
                      >
                        <option value="">— выберите —</option>
                        {staged.existingCategories.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={apply}
            disabled={applying}
            className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {applying ? "Сохранение…" : `Загрузить ${staged.totalRows} позиций`}
          </button>
          <button onClick={cancel} className="text-sm text-zinc-500 hover:underline">
            Отмена
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // ---------- Шаг 1: выбор файла ----------
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Шаг 1 из 2 — проверьте файл
      </p>

      <form onSubmit={submit} className="space-y-3">
        {/* Скрытый нативный input */}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />

        {/* Зона выбора / Drag & Drop */}
        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 ${
              dragOver ? "border-blue-500 bg-blue-50" : "border-zinc-300 bg-zinc-50 hover:bg-zinc-100"
            }`}
          >
            <span className="text-2xl" aria-hidden>
              📄
            </span>
            <span className="text-sm font-medium text-zinc-700">
              Выберите файл или перетащите его сюда
            </span>
            <span className="text-xs text-zinc-400">CSV или XLSX, до 15 МБ</span>
          </button>
        ) : (
          /* Карточка выбранного файла */
          <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="text-xl" aria-hidden>
                📄
              </span>
              <span className="truncate font-medium">{file.name}</span>
              <span className="shrink-0 text-xs text-zinc-400">{formatSize(file.size)}</span>
            </div>
            <button
              type="button"
              onClick={() => pickFile(null)}
              title="Убрать файл"
              className="shrink-0 rounded px-2 py-0.5 text-sm text-zinc-400 hover:bg-zinc-100 hover:text-red-600"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={loading || !file}
            className="rounded-md bg-zinc-900 px-4 py-2 text-white font-medium disabled:opacity-50"
          >
            {loading ? "Проверка…" : "Проверить файл"}
          </button>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-zinc-400">Шаблоны:</span>
            <a href="/api/price-template?format=csv" className="text-blue-600 hover:underline">
              скачать CSV
            </a>
            <a href="/api/price-template?format=xlsx" className="text-blue-600 hover:underline">
              скачать XLSX
            </a>
            <span className="text-zinc-400">
              (CSV в UTF-8 с BOM, разделитель «;» — открывается в Excel корректно)
            </span>
          </div>
        </div>
      </form>

      {error && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {doneMsg && (
        <div className="mt-3 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          {doneMsg}
        </div>
      )}
    </div>
  );
}