"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

interface AuthStatus {
  blocked: boolean;
  retryAfterSec: number;
  attemptsLeft: number | null;
}

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);

  // Тикаем часы для обратного отсчёта
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  // Опрашиваем статус лимита при смене email (debounce 600мс)
  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setBlockedUntil(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch("/api/auth-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
        .then((r) => r.json())
        .then((s: AuthStatus) => {
          setBlockedUntil(
            s.blocked && s.retryAfterSec ? Date.now() + s.retryAfterSec * 1000 : null,
          );
        })
        .catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [email]);

  const blockedSec = blockedUntil ? Math.max(0, Math.ceil((blockedUntil - now) / 1000)) : 0;
  const isBlocked = blockedUntil !== null && blockedSec > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      setLoading(false);
      if (!res || res.error) {
        setError("Неверный email или пароль");
        // Обновляем статус лимита сразу после неудачи
        try {
          const s = await fetch("/api/auth-status", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
          }).then((r) => r.json());
          setBlockedUntil(
            s.blocked && s.retryAfterSec ? Date.now() + s.retryAfterSec * 1000 : null,
          );
        } catch {
          // статус недоступен — просто показываем ошибку входа
        }
        return;
      }
      window.location.assign("/");
    } catch {
      setLoading(false);
      setError("Не удалось выполнить вход. Попробуйте ещё раз.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
          placeholder="user@example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Пароль</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-zinc-300 px-3 py-2"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isBlocked && (
        <p className="text-sm text-red-600" role="alert">
          Слишком много попыток. Повторите через {blockedSec} с.
        </p>
      )}
      <button
        type="submit"
        disabled={loading || isBlocked}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white font-medium disabled:opacity-50"
      >
        {loading ? "Вход…" : isBlocked ? `Блокировка: ${blockedSec} с` : "Войти"}
      </button>
    </form>
  );
}