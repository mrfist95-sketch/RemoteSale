"use client";

import { useEffect, useRef, useState } from "react";
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
  const wasBlockedRef = useRef(false);

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
          if (s.blocked && s.retryAfterSec > 0) {
            setBlockedUntil(Date.now() + s.retryAfterSec * 1000);
            wasBlockedRef.current = true;
          } else {
            setBlockedUntil(null);
          }
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
        // Статус лимита сразу после неудачи: блокировка началась сейчас или остались попытки
        try {
          const s: AuthStatus = await fetch("/api/auth-status", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
          }).then((r) => r.json());

          if (s.blocked && s.retryAfterSec > 0) {
            setBlockedUntil(Date.now() + s.retryAfterSec * 1000);
            // Уведомление о НАЧАЛЕ блокировки — отличается от просто неверного пароля
            setError(
              wasBlockedRef.current
                ? `Вход заблокирован из-за неверных попыток входа. Повторите через ${s.retryAfterSec} с.`
                : `Аккаунт заблокирован на ${s.retryAfterSec} с из-за 3 неверных попыток входа.`,
            );
            wasBlockedRef.current = true;
          } else {
            setError(
              s.attemptsLeft != null && s.attemptsLeft <= 1
                ? `Неверный email или пароль. Осталась ${s.attemptsLeft} попытка — после неё вход будет заблокирован на 30 с.`
                : "Неверный email или пароль",
            );
          }
        } catch {
          setError("Неверный email или пароль");
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
      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {isBlocked && (
        <p className="text-sm font-medium text-red-700" role="alert">
          Блокировка входа: ещё {blockedSec} с.
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