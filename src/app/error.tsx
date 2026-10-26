"use client";

import { useEffect } from "react";
import Link from "next/link";

// Непредвиденная ошибка страницы: вместо белого экрана — понятное сообщение и повтор
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-brand-900">Что-то пошло не так</h2>
      <p className="mt-2 text-sm text-slate-500">
        Страницу не удалось загрузить. Попробуйте ещё раз; если ошибка повторяется — сообщите администратору
        {error.digest ? (
          <>
            {" "}код <span className="font-mono">{error.digest}</span>
          </>
        ) : null}
        .
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button onClick={reset} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          Повторить
        </button>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
          На главную
        </Link>
      </div>
    </div>
  );
}
