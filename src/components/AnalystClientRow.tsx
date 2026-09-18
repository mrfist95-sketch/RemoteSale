"use client";

import { Fragment, useState } from "react";
import { formatRub, formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS } from "@/lib/rbac-core";
import StatusBadge from "@/components/StatusBadge";

export interface ClientOrderView {
  orderId: string;
  number: number;
  createdAt: string;
  status: string;
  total: number;
  statusHistory: { status: string; changedAt: string; changedByName: string | null }[];
}

export interface ClientRowView {
  buyerId: string;
  buyerName: string;
  buyerAddress: string | null;
  orderCount: number;
  orderSum: number;
  paid: number;
  debt: number;
  overdue: number;
  orders: ClientOrderView[];
}

export function ClientExpandableRow({ c }: { c: ClientRowView }) {
  const [open, setOpen] = useState(false);
  const [openOrder, setOpenOrder] = useState<string | null>(null);

  return (
    <>
      <tr className="border-t border-zinc-100">
        <td className="py-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-start gap-1 text-left font-medium hover:text-indigo-600"
          >
            <span className="w-4 shrink-0 text-zinc-400">{open ? "▼" : "▶"}</span>
            <span>
              {c.buyerName}
              {c.buyerAddress && (
                <span className="block text-xs font-normal text-zinc-500">{c.buyerAddress}</span>
              )}
            </span>
          </button>
        </td>
        <td className="py-2">{c.orderCount}</td>
        <td className="py-2">{formatRub(c.orderSum)}</td>
        <td className="py-2 text-green-700">{formatRub(c.paid)}</td>
        <td className="py-2 text-red-700">{formatRub(c.debt)}</td>
        <td className="py-2 text-orange-700">{c.overdue > 0 ? formatRub(c.overdue) : "—"}</td>
      </tr>
      {open && (
        <>
          <tr className="bg-zinc-50/60">
            <td colSpan={6} className="px-4 py-2 text-xs text-zinc-500">
              {c.orders.length === 0 ? (
                "Заказов за период нет"
              ) : (
                <span>Заказы клиента по датам — раскройте заказ, чтобы увидеть историю статусов:</span>
              )}
            </td>
          </tr>
          {c.orders.map((o) => (
            <Fragment key={o.orderId}>
              <tr className="bg-zinc-50/60 text-sm">
                <td className="px-4 py-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenOrder(openOrder === o.orderId ? null : o.orderId)}
                    className="flex items-center gap-1 text-left hover:text-indigo-600"
                  >
                    <span className="w-3 text-zinc-400">{openOrder === o.orderId ? "▼" : "▶"}</span>
                    <span className="font-medium">№{o.number}</span>
                    <span className="text-zinc-500">· {formatDateTime(new Date(o.createdAt))}</span>
                  </button>
                </td>
                <td className="py-1.5" />
                <td className="py-1.5">{formatRub(o.total)}</td>
                <td className="py-1.5" />
                <td className="py-1.5" />
                <td className="py-1.5">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
              {openOrder === o.orderId && (
                <tr className="bg-white">
                  <td colSpan={6} className="px-8 py-2">
                    <div className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs">
                      <div className="mb-1 font-medium text-zinc-600">
                        История статусов заказа №{o.number}:
                      </div>
                      <ol className="space-y-1">
                        {o.statusHistory.map((h, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-x-2 text-zinc-600">
                            <span className="font-medium">{ORDER_STATUS_LABELS[h.status] ?? h.status}</span>
                            <span>· {formatDateTime(new Date(h.changedAt))}</span>
                            {h.changedByName && <span className="text-zinc-400">· {h.changedByName}</span>}
                          </li>
                        ))}
                        {o.statusHistory.length === 0 && (
                          <li className="text-zinc-400">История пуста</li>
                        )}
                      </ol>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </>
      )}
    </>
  );
}