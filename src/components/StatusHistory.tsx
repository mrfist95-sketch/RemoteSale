import { ORDER_STATUS_LABELS } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";

export default function StatusHistory({
  items,
}: {
  items: {
    status: string;
    changedAt: string | Date;
    changedBy?: { name: string | null; email: string } | null;
  }[];
}) {
  if (!items || items.length === 0)
    return <p className="text-xs text-zinc-400">История изменений пуста</p>;
  return (
    <ol className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
      {items.map((it, idx) => (
        <li key={idx} className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">{ORDER_STATUS_LABELS[it.status] ?? it.status}</span>
          <span>{formatDateTime(typeof it.changedAt === "string" ? new Date(it.changedAt) : it.changedAt)}</span>
          {it.changedBy && (
            <span className="text-zinc-400">· {it.changedBy.name ?? it.changedBy.email}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
