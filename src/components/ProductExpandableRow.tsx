"use client";

import { Fragment, useState } from "react";
import { formatRub } from "@/lib/format";

export interface ProductDetailRow {
  buyerId: string;
  buyerName: string;
  agentName: string;
  orderCount: number;
  orderedQty: number;
  orderedSum: number;
}

export interface ProductRowView {
  productId: string;
  name: string;
  unit: string | null;
  manufacturer: string | null;
  orderedQty: number;
  orderedSum: number;
  orderCount: number;
  buyerCount: number;
  paidSum: number;
  unpaidSum: number;
  overdueSum: number;
  details: ProductDetailRow[];
}

export default function ProductExpandableRow({ p }: { p: ProductRowView }) {
  const [open, setOpen] = useState(false);

  return (
    <Fragment>
      <tr className="border-t border-zinc-100">
        <td className="py-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-left font-medium hover:text-indigo-600"
          >
            <span className="w-4 shrink-0 text-zinc-400">{open ? "▼" : "▶"}</span>
            <span>
              {p.name}
              {p.unit ? <span className="text-zinc-400"> ({p.unit})</span> : null}
            </span>
          </button>
        </td>
        <td className="py-2 text-zinc-600">{p.manufacturer ?? "—"}</td>
        <td className="py-2">{p.orderedQty}</td>
        <td className="py-2">{formatRub(p.orderedSum)}</td>
        <td className="py-2">{p.orderCount}</td>
        <td className="py-2">{p.buyerCount}</td>
        <td className="py-2 text-green-700">{formatRub(p.paidSum)}</td>
        <td className="py-2 text-red-700">{formatRub(p.unpaidSum)}</td>
        <td className="py-2 text-orange-700">{p.overdueSum > 0 ? formatRub(p.overdueSum) : "—"}</td>
      </tr>
      {open && (
        <tr className="bg-zinc-50/60">
          <td colSpan={9} className="px-6 py-2">
            <div className="text-xs font-medium text-zinc-600">
              Кто и кому продавал этот товар:
            </div>
            <table className="mt-1 w-full text-xs">
              <thead className="text-left text-zinc-400">
                <tr>
                  <th className="py-1">Торговый представитель</th>
                  <th className="py-1">Клиент</th>
                  <th className="py-1">Заказов</th>
                  <th className="py-1">Кол-во</th>
                  <th className="py-1">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {p.details.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-2 text-zinc-400">
                      Нет данных за выбранный период
                    </td>
                  </tr>
                )}
                {p.details.map((d) => (
                  <tr key={d.buyerId} className="border-t border-zinc-200">
                    <td className="py-1">{d.agentName}</td>
                    <td className="py-1 font-medium">{d.buyerName}</td>
                    <td className="py-1">{d.orderCount}</td>
                    <td className="py-1">{d.orderedQty}</td>
                    <td className="py-1">{formatRub(d.orderedSum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </Fragment>
  );
}