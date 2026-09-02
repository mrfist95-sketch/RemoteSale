"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPayment, correctPayment, deletePayment } from "@/app/actions";
import { formatRub } from "@/lib/format";

export interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  date: string;
  createdBy: { name: string | null; email: string } | null;
}

export interface AuditRow {
  id: string;
  action: string;
  details: string | null;
  amount: number | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  payment_added: "Оплата внесена",
  payment_edited: "Оплата скорректирована",
  payment_deleted: "Оплата удалена",
  order_edited: "Заказ скорректирован",
};

const METHOD_LABELS: Record<string, string> = {
  card: "Карта",
  cash: "Наличные",
  invoice: "Счёт",
};

/** Панель оплат заказа: состояние долга, приём оплаты, корректировки, история */
export default function OrderPaymentsPanel({
  buyerId,
  orderId,
  total,
  paid,
  status,
  payments,
  audit,
  canPay,
  isAdmin,
  todayISO,
}: {
  buyerId: string;
  orderId: string;
  total: number;
  paid: number;
  status: string;
  payments: PaymentRow[];
  audit: AuditRow[];
  canPay: boolean;
  isAdmin: boolean;
  todayISO: string; // YYYY-MM-DD для определения "день в день"
}) {
  const router = useRouter();
  const debt = Math.max(0, total - paid);
  const [amount, setAmount] = useState(debt > 0 ? String(debt) : "");
  const [method, setMethod] = useState("card");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  // корректировка
  const [editing, setEditing] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState("card");
  const [editReason, setEditReason] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const val = Number(amount);
    if (!val || val <= 0) {
      setError("Укажите сумму");
      return;
    }
    if (val > debt + 0.009) {
      setError(`Сумма превышает задолженность на ${(val - debt).toFixed(2)} ₽ (задолженность: ${debt.toFixed(2)} ₽)`);
      return;
    }
    setLoading(true);
    try {
      await createPayment({ buyerId, orderId, amount: val, method });
      setMsg(`Оплата ${val.toFixed(2)} ₽ принята` + (val >= debt - 0.009 ? ". Заказ переведён в «Оплачен»." : ""));
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(p: PaymentRow) {
    setEditing(p.id);
    setEditAmount(String(p.amount));
    setEditMethod(p.method);
    setEditReason("");
  }

  async function saveEdit(id: string) {
    setError(null);
    try {
      await correctPayment({ paymentId: id, amount: Number(editAmount), method: editMethod, reason: editReason });
      setEditing(null);
      setMsg("Оплата скорректирована");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  async function removePayment(id: string) {
    const reason = prompt("Причина удаления оплаты (обязательно):");
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    try {
      await deletePayment(id, reason);
      setMsg("Оплата удалена");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      {/* Финансовое состояние заказа */}
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span>Сумма: <b>{formatRub(total)}</b></span>
        <span className="text-green-700">Оплачено: <b>{formatRub(paid)}</b></span>
        {debt > 0 ? (
          <span className="text-red-700">Остаток долга: <b>{formatRub(debt)}</b></span>
        ) : (
          <span className="text-green-700 font-medium">Оплачен полностью</span>
        )}
      </div>

      {/* Приём оплаты */}
      {canPay && debt > 0 ? (
        <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-zinc-500">Сумма, ₽ (долг: {debt.toFixed(2)})</label>
            <input
              type="number"
              min={0}
              step="0.01"
              max={debt}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500">Способ</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded border border-zinc-300 px-2 py-1 text-sm">
              <option value="card">Карта</option>
              <option value="cash">Наличные</option>
              <option value="invoice">Счёт</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
            {loading ? "…" : "Внести оплату"}
          </button>
          <button
            type="button"
            onClick={() => setAmount(String(debt))}
            className="rounded border border-green-600 px-2 py-1 text-xs text-green-700"
            title="Внести всю задолженность по заказу"
          >
            вся задолженность ({debt.toFixed(2)} ₽)
          </button>
          <span className="text-xs text-zinc-400">При полной оплате заказ автоматически станет «Оплачен»</span>
        </form>
      ) : (
        <p className="text-xs text-zinc-400">
          {canPay ? "Задолженность по заказу погашена" : "Приём оплаты доступен в статусах «Собран», «Отгружен», «Доставлен»"}
        </p>
      )}

      {/* Внесённые оплаты */}
      {payments.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-zinc-500">Оплаты по заказу:</p>
          <ul className="mt-1 space-y-1">
            {payments.map((p) => {
              const sameDay = p.date.slice(0, 10) === todayISO;
              const canCorrect = isAdmin || sameDay;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-zinc-100 bg-zinc-50 px-2 py-1 text-xs">
                  <span className="font-semibold text-green-700">+{formatRub(p.amount)}</span>
                  <span>{METHOD_LABELS[p.method] ?? p.method}</span>
                  <span className="text-zinc-400">{new Date(p.date).toLocaleString("ru-RU")}</span>
                  {p.createdBy && <span className="text-zinc-400">· {p.createdBy.name ?? p.createdBy.email}</span>}
                  {canCorrect ? (
                    editing === p.id ? (
                      <span className="inline-flex flex-wrap items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-24 rounded border border-zinc-300 px-1 py-0.5"
                        />
                        <select value={editMethod} onChange={(e) => setEditMethod(e.target.value)} className="rounded border border-zinc-300 px-1 py-0.5">
                          <option value="card">Карта</option>
                          <option value="cash">Наличные</option>
                          <option value="invoice">Счёт</option>
                        </select>
                        <input
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          placeholder="причина"
                          className="w-36 rounded border border-zinc-300 px-1 py-0.5"
                        />
                        <button onClick={() => saveEdit(p.id)} className="rounded bg-zinc-900 px-2 py-0.5 text-white">Сохранить</button>
                        <button onClick={() => setEditing(null)} className="text-zinc-400 hover:underline">отмена</button>
                      </span>
                    ) : (
                      <>
                        <button onClick={() => startEdit(p)} className="text-blue-600 hover:underline">корректировать</button>
                        <button onClick={() => removePayment(p.id)} className="text-red-600 hover:underline">удалить</button>
                      </>
                    )
                  ) : (
                    <span className="text-zinc-300" title="Только оплаты, внесённые сегодня; старые корректирует администратор">
                      корректировка — только у админа
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {msg && <p className="mt-1 text-xs text-green-600">{msg}</p>}

      {/* История операций по оплатам/корректировкам */}
      {audit.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setShowAudit((v) => !v)} className="text-xs text-zinc-500 hover:underline">
            {showAudit ? "Скрыть историю операций" : `История операций (${audit.length})`}
          </button>
          {showAudit && (
            <ul className="mt-1 space-y-1">
              {audit.map((a) => (
                <li key={a.id} className="text-xs text-zinc-500">
                  <span className="font-medium text-zinc-700">{ACTION_LABELS[a.action] ?? a.action}</span>
                  {a.amount != null && <span className="text-green-700"> {a.amount.toFixed(2)} ₽</span>}
                  <span> · {new Date(a.createdAt).toLocaleString("ru-RU")}</span>
                  {a.user && <span className="text-zinc-400"> · {a.user.name ?? a.user.email}</span>}
                  {a.details && <span className="block text-zinc-400">{a.details}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}