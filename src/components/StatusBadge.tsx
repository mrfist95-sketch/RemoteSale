import { ORDER_STATUS_LABELS } from "@/lib/rbac";

const COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  ENTERED: "bg-blue-100 text-blue-700",
  ASSEMBLED: "bg-amber-100 text-amber-700",
  SHIPPED: "bg-purple-100 text-purple-700",
  PAID: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function StatusBadge({ status }: { status: string }) {
  const cls = COLORS[status] ?? "bg-zinc-100 text-zinc-700";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
