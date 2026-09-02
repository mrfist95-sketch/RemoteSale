"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkChangeStatus } from "@/app/actions";
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from "@/lib/rbac";
import { formatRub, formatDateTime } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import StatusSelect from "@/components/StatusSelect";
import StatusHistory from "@/components/StatusHistory";
import AddPaymentForm from "@/components/AddPaymentForm";

export interface SellerOrderItem {
  id: string;
  buyerId: string;
  number: number;
  status: string;
  total: number;
  createdAt: string;
  buyer: {
    name: string | null;
    email: string;
    address: string | null;
    phone: string | null;
    deferral: number;
  };
  agent: { name: string | null } | null;
  items: { name: string; qty: number; price: number }[];
  statusLogs: {
    status: string;
    changedAt: string;
    changedBy?: { name: string | null; email: string } | null;
  }[];
  overdueDays: number;
  overdue: boolean;
}

export default function SellerOrderBoard({
  orders,
  open,
  total,
}: {
  orders: SellerOrderItem[];
  open: number;
  total: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("ENTERED");
  const [busy, setBusy] = useState(false);

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

            <table className="mt-3 w-full text-sm">
              <tbody>
                {o.items.map((i, idx) => (
                  <tr key={idx} className="border-t border-zinc-100">
                    <td className="py-1">{i.name}</td>
                    <td className="py-1 text-right">{i.qty} × {formatRub(i.price)}</td>
                    <td className="py-1 text-right font-medium">{formatRub(i.qty * i.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <StatusHistory items={o.statusLogs} />
            <div className="mt-3 border-t border-zinc-100 pt-3">
              <AddPaymentForm buyerId={o.buyerId} orderId={o.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
