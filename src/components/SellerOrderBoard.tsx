"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkChangeStatus, editOrderItems } from "@/app/actions";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, PAYABLE_STATUSES } from "@/lib/rbac";
import { formatRub, formatDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import StatusSelect from "@/components/StatusSelect";
import StatusHistory from "@/components/StatusHistory";
import OrderPaymentsPanel, { type PaymentRow, type AuditRow } from "@/components/OrderPaymentsPanel";

export interface SellerOrderItem {
  id: string;
  buyerId: string;
  number: number;
  status: string;
  total: number;
  paid: number;
  createdAt: string;
  buyer: {
    name: string | null;
    email: string;
    address: string | null;
    phone: string | null;
    deferral: number;
  };
  agent: { name: string | null } | null;
  items: { id: string; name: string; qty: number; price: number }[];
  statusLogs: {
    status: string;
    changedAt: string;
    changedBy?: { name: string | null; email: string } | null;
  }[];
  payments: PaymentRow[];
  audit: AuditRow[];
  overdueDays: number;
  overdue: boolean;
}

export default function SellerOrderBoard({
  orders,
  open,
  total,
  editReasons,
}: {
  orders: SellerOrderItem[];
  open: number;
  total: number;
  editReasons: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("ENTERED");
  const [busy, setBusy] = useState(false);
  const todayISO = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD локально

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulk() {
    if (selected.size === 0) {
      alert("Выберите хотя бы один заказ");
      return;
    }
    if (!confirm(`Сменить статус на «${ORDER_STATUS_LABELS[bulkStatus]}» для ${selected.size} заказ(ов)?`))
      return;
    setBusy(true);
    try {
      await bulkChangeStatus(Array.from(selected), bulkStatus);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2">
        <span className="text-sm text-zinc-600">
          Массовая смена статуса ({selected.size} выбрано):
        </span>
        <select
          value={bulkStatus}
          onChange={(e) => setBulkStatus(e.target.value)}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          onClick={applyBulk}
          disabled={busy}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Применить
        </button>
        <span className="ml-auto text-sm text-zinc-500">В работе: {open} из {total}</span>
      </div>

      <div className="space-y-3">
        {orders.length === 0 && <p className="text-sm text-zinc-400">Заказов пока нет</p>}
        {orders.map((o) => (
          <div key={o.id} className="rounded-lg border border-zinc-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4"
                />
                <span className="font-semibold">Заказ №{o.number}</span>
                <span>· {o.buyer.name ?? o.buyer.email}</span>
                {o.agent && <span className="text-zinc-400">· агент: {o.agent.name}</span>}
                <span>· {formatDateTime(new Date(o.createdAt))}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatRub(o.total)}</span>
                <StatusSelect orderId={o.id} current={o.status} role="SELLER" />
              </div>
            </div>

            {(o.overdue || o.buyer.address || o.buyer.phone) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                {o.overdue && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">
                    Просрочено {o.overdueDays} дн.
                  </span>
                )}
                {o.buyer.address && <span>Адрес: {o.buyer.address}</span>}
                {o.buyer.phone && <span>Тел: {o.buyer.phone}</span>}
                {o.buyer.deferral > 0 && <span>Отсрочка: {o.buyer.deferral} дн.</span>}
              </div>
            )}

            <OrderItemsEditor order={o} reasons={editReasons} />

            <StatusHistory items={o.statusLogs} />
            <OrderPaymentsPanel
              buyerId={o.buyerId}
              orderId={o.id}
              total={o.total}
              paid={o.paid}
              status={o.status}
              payments={o.payments}
              audit={o.audit}
              canPay={PAYABLE_STATUSES.includes(o.status)}
              isAdmin={false}
              todayISO={todayISO}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Состав заказа: просмотр + корректировка продавцом (с причиной) */
function OrderItemsEditor({ order, reasons }: { order: SellerOrderItem; reasons: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [qtys, setQtys] = useState<Record<string, number>>(
    Object.fromEntries(order.items.map((i) => [i.id, i.qty])),
  );
  const [reason, setReason] = useState(reasons[0] ?? "");
  const [customReason, setCustomReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const editable = ["NEW", "ENTERED", "ASSEMBLED"].includes(order.status);

  async function save() {
    const finalReason = customReason.trim() || reason;
    if (!finalReason) {
      setError("Укажите причину корректировки");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await editOrderItems({
        orderId: order.id,
        items: order.items.map((i) => ({ orderItemId: i.id, qty: qtys[i.id] ?? i.qty })),
        reason: finalReason,
      });
      setEditing(false);
      setMsg(`Состав скорректирован. Новый итог: ${res.total.toFixed(2)} ₽`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">Состав заказа:</p>
        {editable && !editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">
            Корректировать состав
          </button>
        )}
      </div>
      <table className="mt-1 w-full text-sm">
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-t border-zinc-100">
              <td className="py-1">{i.name}</td>
              {editing ? (
                <>
                  <td className="py-1 text-right">
                    <input
                      type="number"
                      min={0}
                      value={qtys[i.id] ?? i.qty}
                      onChange={(e) => setQtys((q) => ({ ...q, [i.id]: Number(e.target.value) }))}
                      className="w-16 rounded border border-zinc-300 px-1 py-0.5 text-right"
                    />
                  </td>
                  <td className="py-1 text-right text-zinc-400">{formatRub(i.price)}</td>
                  <td className="py-1 text-right font-medium">{formatRub((qtys[i.id] ?? i.qty) * i.price)}</td>
                </>
              ) : (
                <>
                  <td className="py-1 text-right">{i.qty} × {formatRub(i.price)}</td>
                  <td className="py-1 text-right font-medium">{formatRub(i.qty * i.price)}</td>
                </>
              )}
            </tr>
          ))}
          {order.items.length === 0 && (
            <tr><td className="py-2 text-xs text-zinc-400" colSpan={3}>Позиции удалены</td></tr>
          )}
        </tbody>
      </table>
      {editing && (
        <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs">
          <p className="mb-1 text-amber-700">
            Укажите причины списком (админ настраивает список) или впишите свою. Кол-во 0 = позиция удаляется.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {reasons.length > 0 && (
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="rounded border border-zinc-300 px-1 py-0.5"
              >
                <option value="">— причина —</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
            <input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder={reasons.length > 0 ? "или своя причина" : "причина (например: Нет на складе)"}
              className="w-56 rounded border border-zinc-300 px-2 py-0.5"
            />
            <button onClick={save} disabled={busy} className="rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-50">
              {busy ? "…" : "Сохранить"}
            </button>
            <button onClick={() => { setEditing(false); setError(null); }} className="text-zinc-500 hover:underline">отмена</button>
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {msg && <p className="mt-1 text-xs text-green-600">{msg}</p>}
    </div>
  );
}
