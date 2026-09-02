"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/app/actions";
import { ROLE_LABELS } from "@/lib/rbac";
import { generatePassword } from "@/lib/password";

const ROLES = Object.keys(ROLE_LABELS);

export default function CreateUserForm({
  agents,
}: {
  agents: { id: string; name: string | null; email: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("BUYER");
  const [agentId, setAgentId] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [deferral, setDeferral] = useState("0");
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createUser({
        email,
        name: name || undefined,
        password,
        role,
        agentId: role === "BUYER" ? agentId || null : null,
        address: address || undefined,
        phone: phone || undefined,
        comment: comment || undefined,
        deferral: Number(deferral) || 0,
      });
      setEmail("");
      setName("");
      setPassword("");
      setAgentId("");
      setAddress("");
      setPhone("");
      setComment("");
      setDeferral("0");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <input
        placeholder="Имя"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            required
            placeholder="Пароль"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setGenerated(null);
            }}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={genPassword}
            className="whitespace-nowrap rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
          >
            Сгенерировать
          </button>
        </div>
        {generated && (
          <div className="mt-1 text-xs text-green-700">
            Сгенерирован и скопирован: <span className="font-mono">{generated}</span>
          </div>
        )}
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      <select
        value={agentId}
        onChange={(e) => setAgentId(e.target.value)}
        disabled={role !== "BUYER"}
        className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
      >
        <option value="">— агент не выбран —</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name ?? a.email}
          </option>
        ))}
      </select>
      <input
        placeholder="Адрес"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <input
        placeholder="Телефон"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <input
        placeholder="Комментарий"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <label className="flex items-center gap-1 text-sm">
        Отсрочка, дн.
        <input
          type="number"
          min={0}
          value={deferral}
          onChange={(e) => setDeferral(e.target.value)}
          className="w-16 rounded border border-zinc-300 px-1 py-1"
        />
      </label>
      <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {loading ? "Создание…" : "Создать пользователя"}
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}
