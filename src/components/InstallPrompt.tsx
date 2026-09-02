"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPhone|iPad|iPod/.test(ua));
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
    <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
      <p className="mb-2 font-medium">Установите приложение OnSale:</p>
      {deferred ? (
        <button
          type="button"
          onClick={install}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
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
