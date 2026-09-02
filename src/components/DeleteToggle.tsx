"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markOrderDeleted } from "@/app/actions";

export default function DeleteToggle({ orderId, deleted }: { orderId: string; deleted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!confirm(deleted ? "Восстановить заказ?" : "Пометить заказ на удаление? Он исчезнет из списков и отчётов."))
      return;
    setBusy(true);
    try {
      await markOrderDeleted(orderId, !deleted);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {deleted ? "Восстановить" : "Удалить"}
    </button>
  );
}
