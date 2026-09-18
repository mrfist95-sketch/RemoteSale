"use client";

import { Fragment, useState } from "react";
import { formatRub } from "@/lib/format";

export const MEDALS = ["🥇", "🥈", "🥉"];

function PlaceMark({ index }: { index: number }) {
  if (index < 3) return <span className="text-xl leading-none">{MEDALS[index]}</span>;
  return <span className="text-sm text-zinc-400">{index + 1}</span>;
}

export function AgentLeaderboardRow({
  row,
  index,
}: {
  row: {
    agentId: string;
    agentName: string;
    clientCount: number;
    orderCount: number;
    totalSum: number;
    products: { productId: string; productName: string; orderCount: number; orderedQty: number; orderedSum: number }[];
  };
  index: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Fragment>
      <tr className={`border-t border-zinc-100 ${index < 3 ? "bg-yellow-50/40" : ""}`}>
        <td className="w-10 py-2 text-center">
          <PlaceMark index={index} />
        </td>
        <td className="py-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-left font-medium hover:text-indigo-600"
          >
            <span className="w-4 shrink-0 text-zinc-400">{open ? "▼" : "▶"}</span>
            {row.agentName}
          </button>
        </td>
        <td className="py-2">{row.clientCount}</td>
        <td className="py-2">{row.orderCount}</td>
        <td className="py-2 font-semibold">{formatRub(row.totalSum)}</td>
      </tr>
      {open && (
        <tr className="bg-zinc-50/60">
          <td colSpan={5} className="px-6 py-2">
            <div className="text-xs font-medium text-zinc-600">Проданные товары:</div>
            <table className="mt-1 w-full text-xs">
              <thead className="text-left text-zinc-400">
                <tr>
                  <th className="py-1">Товар</th>
                  <th className="py-1">Заказов</th>
                  <th className="py-1">Кол-во</th>
                  <th className="py-1">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {row.products.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-zinc-400">Нет продаж за период</td>
                  </tr>
                )}
                {row.products.map((p) => (
                  <tr key={p.productId} className="border-t border-zinc-200">
                    <td className="py-1 font-medium">{p.productName}</td>
                    <td className="py-1">{p.orderCount}</td>
                    <td className="py-1">{p.orderedQty}</td>
                    <td className="py-1">{formatRub(p.orderedSum)}</td>
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

export function ProductLeaderboardRow({
  row,
  index,
}: {
  row: {
    productId: string;
    productName: string;
    orderCount: number;
    buyerCount: number;
    orderedQty: number;
    orderedSum: number;
    agents: { agentId: string; agentName: string; orderCount: number; orderedQty: number; orderedSum: number }[];
  };
  index: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Fragment>
      <tr className={`border-t border-zinc-100 ${index < 3 ? "bg-yellow-50/40" : ""}`}>
        <td className="w-10 py-2 text-center">
          <PlaceMark index={index} />
        </td>
        <td className="py-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1 text-left font-medium hover:text-indigo-600"
          >
            <span className="w-4 shrink-0 text-zinc-400">{open ? "▼" : "▶"}</span>
            {row.productName}
          </button>
        </td>
        <td className="py-2">{row.orderCount}</td>
        <td className="py-2">{row.buyerCount}</td>
        <td className="py-2">{row.orderedQty}</td>
        <td className="py-2 font-semibold">{formatRub(row.orderedSum)}</td>
      </tr>
      {open && (
        <tr className="bg-zinc-50/60">
          <td colSpan={6} className="px-6 py-2">
            <div className="text-xs font-medium text-zinc-600">Кто продавал:</div>
            <table className="mt-1 w-full text-xs">
              <thead className="text-left text-zinc-400">
                <tr>
                  <th className="py-1">Торговый представитель</th>
                  <th className="py-1">Заказов</th>
                  <th className="py-1">Кол-во</th>
                  <th className="py-1">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {row.agents.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-zinc-400">
                      Все продажи без представителя
                    </td>
                  </tr>
                )}
                {row.agents.map((a) => (
                  <tr key={a.agentId} className="border-t border-zinc-200">
                    <td className="py-1 font-medium">{a.agentName}</td>
                    <td className="py-1">{a.orderCount}</td>
                    <td className="py-1">{a.orderedQty}</td>
                    <td className="py-1">{formatRub(a.orderedSum)}</td>
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