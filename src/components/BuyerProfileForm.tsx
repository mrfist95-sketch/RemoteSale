"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBuyerProfile } from "@/app/actions";

export default function BuyerProfileForm({
  initial,
}: {
  initial: { address: string | null; phone: string | null; comment: string | null };
}) {
  const router = useRouter();
  const [address, setAddress] = useState(initial.address ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [comment, setComment] = useState(initial.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      await updateBuyerProfile({
        address,
        phone,
        comment,
      });
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Адрес доставки
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
        />
      </label>
      <label className="text-sm">
        Телефон
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Комментарий
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-2 py-1"
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {busy ? "Сохранение…" : "Сохранить"}
        </button>
        {saved && <span className="text-xs text-green-600">Сохранено</span>}
      </div>
    </form>
  );
}
