"use client";

// Лёгкие уведомления вместо alert(): toast.success("..."), toast.error("...").
import { useEffect, useState } from "react";

type Kind = "success" | "error" | "info";
interface Item {
  id: number;
  kind: Kind;
  text: string;
}

let seq = 0;
const listeners = new Set<(i: Item) => void>();

function push(kind: Kind, text: string) {
  const item = { id: ++seq, kind, text };
  listeners.forEach((l) => l(item));
}

export const toast = {
  success: (t: string) => push("success", t),
  error: (t: string) => push("error", t),
  info: (t: string) => push("info", t),
  /** Показать ошибку из catch */
  fromError: (e: unknown) => push("error", e instanceof Error ? e.message : "Ошибка"),
};

const STYLE: Record<Kind, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-brand-200 bg-white text-zinc-900",
};

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    const on = (i: Item) => {
      setItems((prev) => [...prev.slice(-3), i]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== i.id)), i.kind === "error" ? 8000 : 4000);
    };
    listeners.add(on);
    return () => {
      listeners.delete(on);
    };
  }, []);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      {items.map((i) => (
        <div
          key={i.id}
          role={i.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto w-full max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${STYLE[i.kind]}`}
          onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}
        >
          {i.text}
        </div>
      ))}
    </div>
  );
}
