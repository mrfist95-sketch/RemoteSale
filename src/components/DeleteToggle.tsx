"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markOrderDeleted } from "@/app/actions";
import { unwrap } from "@/lib/action-result";
import { toast } from "@/components/Toaster";

export default function DeleteToggle({ orderId, deleted }: { orderId: string; deleted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (!confirm(deleted ? "Восстановить заказ?" : "Пометить заказ на удаление? Он исчезнет из списков и отчётов."))
      return;
    setBusy(true);
    try {
      unwrap(await markOrderDeleted(orderId, !deleted));
      router.refresh();
    } catch (e) {
      toast.fromError(e);
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
