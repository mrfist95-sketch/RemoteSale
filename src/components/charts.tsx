"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ORDER_STATUS_LABELS } from "@/lib/rbac";

const COLORS = ["#0ea5e9", "#6366f1", "#f59e0b", "#a855f7", "#22c55e", "#ef4444"];

export function MonthlyChart({ data }: { data: { month: string; sum: number; paid?: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-zinc-400">Нет данных</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
        <Legend />
        <Bar dataKey="sum" name="Сумма заказов" fill="#6366f1" />
        <Bar dataKey="paid" name="Оплачено" fill="#22c55e" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClientsChart({
  data,
}: {
  data: { name: string; sum: number; debt: number }[];
}) {
  if (data.length === 0) return <p className="text-sm text-zinc-400">Нет данных</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={120} />
        <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
        <Legend />
        <Bar dataKey="sum" name="Продажи" fill="#6366f1" />
        <Bar dataKey="debt" name="Долг" fill="#ef4444" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusChart({ data }: { data: { status: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-zinc-400">Нет данных</p>;
  const rows = data.map((d) => ({ name: ORDER_STATUS_LABELS[d.status] ?? d.status, value: d.count }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" outerRadius={90} label>
          {rows.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${Number(value).toLocaleString("ru-RU")} ₽`} />
      </PieChart>
    </ResponsiveContainer>
  );
}
