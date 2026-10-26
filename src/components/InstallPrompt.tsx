"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  // На сервере false, в браузере — по user agent (без setState в эффекте и без рассинхрона гидрации)
  const isIOS = useSyncExternalStore(
    noopSubscribe,
    () => /iPhone|iPad|iPod/.test(navigator.userAgent),
    () => false,
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const w = window as unknown as {
      addEventListener: (t: string, h: (e: Event) => void) => void;
      removeEventListener: (t: string, h: (e: Event) => void) => void;
    };
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as unknown as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);
    w.addEventListener("beforeinstallprompt", onPrompt);
    w.addEventListener("appinstalled", onInstalled);
    return () => {
      w.removeEventListener("beforeinstallprompt", onPrompt);
      w.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="mb-2 font-medium">Установите приложение OnSale:</p>
      {deferred ? (
        <button
          type="button"
          onClick={install}
          className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          Установить приложение
        </button>
      ) : isIOS ? (
        <p>Откройте меню <b>Share</b> → <b>«На экран Домой»</b> (Add to Home Screen).</p>
      ) : (
        <p>В меню браузера выберите <b>«Установить приложение»</b> / <b>«Add to Home Screen»</b>.</p>
      )}
    </div>
  );
}
