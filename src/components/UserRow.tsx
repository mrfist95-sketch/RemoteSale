"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUser, deleteUser } from "@/app/actions";
import { ROLE_LABELS } from "@/lib/rbac";
import { generatePassword } from "@/lib/password";

const ROLES = Object.keys(ROLE_LABELS);

export default function UserRow({
  user,
  agents,
}: {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    agentId: string | null;
    address: string | null;
    phone: string | null;
    comment: string | null;
    deferral: number;
  };
  agents: { id: string; name: string | null; email: string }[];
}) {
  const router = useRouter();
  const [role, setRole] = useState(user.role);
  const [agentId, setAgentId] = useState(user.agentId ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [comment, setComment] = useState(user.comment ?? "");
  const [deferral, setDeferral] = useState(String(user.deferral ?? 0));
  const [password, setPassword] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function genPassword() {
    const p = generatePassword();
    setPassword(p);
    setGenerated(p);
    try {
      navigator.clipboard?.writeText(p);
    } catch {
      /* ignore */
    }
  }

  async function save() {
    setBusy(true);
    try {
      const data: {
        role: string;
        agentId: string | null;
        address?: string;
        phone?: string;
        comment?: string;
        deferral?: number;
        password?: string;
      } = {
        role,
        agentId: role === "BUYER" ? agentId || null : null,
      };
      if (role === "BUYER") {
        data.address = address;
        data.phone = phone;
        data.comment = comment;
        data.deferral = Number(deferral) || 0;
      }
      if (password) data.password = password;
      await updateUser(user.id, data);
      setPassword("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Удалить пользователя ${user.email}?`)) return;
    setBusy(true);
    try {
      await deleteUser(user.id);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="border-t border-zinc-100 align-top">
      <td className="py-2 pr-3">
        <div className="font-medium">{user.name ?? "—"}</div>
        <div className="text-xs text-zinc-400">{user.email}</div>
      </td>
      <td className="py-2 pr-3">
        <select
          value={role}
          disabled={busy}
          onChange={(e) => {
            setRole(e.target.value);
            setTimeout(save, 0);
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <select
          value={agentId}
          disabled={busy || role !== "BUYER"}
          onChange={(e) => {
            setAgentId(e.target.value);
            setTimeout(save, 0);
          }}
          className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
        >
          <option value="">— нет —</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name ?? a.email}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        {role === "BUYER" ? (
          <div className="grid grid-cols-1 gap-1 text-xs">
            <input
              placeholder="Адрес"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1"
            />
            <input
              placeholder="Телефон"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1"
            />
            <input
              placeholder="Комментарий"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="rounded border border-zinc-300 px-2 py-1"
            />
            <label className="flex items-center gap-1">
              Отсрочка, дн.
              <input
                type="number"
                min={0}
                value={deferral}
                onChange={(e) => setDeferral(e.target.value)}
                className="w-16 rounded border border-zinc-300 px-1 py-0.5"
              />
            </label>
          </div>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="py-2 pr-3">
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center gap-1">
            <input
              type="text"
              placeholder="Новый пароль"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setGenerated(null);
              }}
              className="w-32 rounded border border-zinc-300 px-2 py-1"
            />
            <button
              type="button"
              onClick={genPassword}
              className="whitespace-nowrap rounded border border-zinc-300 px-2 py-1 text-zinc-700 hover:bg-zinc-50"
            >
              Сгенерировать
            </button>
          </div>
          {generated && (
            <span className="text-green-700">
              Скопирован: <span className="font-mono">{generated}</span>
            </span>
          )}
          <button
            onClick={save}
            disabled={busy}
            className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </td>
      <td className="py-2 text-right">
        <button onClick={remove} disabled={busy} className="text-xs text-red-600 hover:underline">
          Удалить
        </button>
      </td>
    </tr>
  );
}
