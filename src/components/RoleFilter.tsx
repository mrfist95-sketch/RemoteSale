"use client";

import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/lib/rbac";

const ALL = "ALL";

export default function RoleFilter({ current }: { current: string }) {
  const router = useRouter();
  const roles = [ALL, ...Object.keys(ROLE_LABELS)];
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-zinc-500">Фильтр по роли:</span>
      <select
        value={current}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v && v !== ALL ? `/admin/users?role=${v}` : "/admin/users");
        }}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      >
        <option value={ALL}>Все</option>
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    </label>
  );
}
