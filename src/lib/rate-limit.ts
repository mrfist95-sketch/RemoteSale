// In-memory rate limiter для входа (одного инстанса Next достаточно).
// После maxAttempts неудач подряд — блокировка с экспоненциальным ростом:
// 30с, 1мин, 2мин, 4мин ... максимум 1 час.
// Используется с двумя ключами: email (3 попытки) и IP-адрес (20 попыток),
// чтобы и подбор пароля к одному аккаунту, и перебор аккаунтов с одного
// адреса упирались в лимит.

export const MAX_ATTEMPTS = 3;
export const IP_MAX_ATTEMPTS = 20;
export const BASE_COOLDOWN_MS = 30_000;
export const MAX_COOLDOWN_MS = 3_600_000;

export interface RateLimitState {
  blocked: boolean;
  retryAfterMs: number;
  attemptsLeft: number;
}

interface Entry {
  fails: number;
  blockedUntil: number;
}

const globalForRateLimit = globalThis as unknown as {
  __loginRateLimit?: Map<string, Entry>;
};

const store: Map<string, Entry> =
  globalForRateLimit.__loginRateLimit ?? (globalForRateLimit.__loginRateLimit = new Map());

function backoffMs(fails: number, max: number): number {
  const exponent = Math.max(0, fails - max);
  return Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * Math.pow(2, exponent));
}

function stateOf(key: string, max: number): RateLimitState {
  const entry = store.get(key);
  if (!entry) return { blocked: false, retryAfterMs: 0, attemptsLeft: max };
  const blocked = entry.blockedUntil > Date.now();
  return {
    blocked,
    retryAfterMs: blocked ? entry.blockedUntil - Date.now() : 0,
    attemptsLeft: Math.max(0, max - entry.fails),
  };
}

export function checkRateLimit(key: string, max = MAX_ATTEMPTS): RateLimitState {
  return stateOf(key, max);
}

export function registerFailure(key: string, max = MAX_ATTEMPTS): RateLimitState {
  const entry = store.get(key) ?? { fails: 0, blockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= max) {
    entry.blockedUntil = Date.now() + backoffMs(entry.fails, max);
  }
  store.set(key, entry);
  // Не даём карте расти бесконечно при переборе адресов
  if (store.size > 10_000) {
    const now = Date.now();
    for (const [k, e] of store) if (e.blockedUntil < now - MAX_COOLDOWN_MS) store.delete(k);
  }
  return stateOf(key, max);
}

export function registerSuccess(key: string): void {
  store.delete(key);
}

export function resetRateLimit(key: string): void {
  store.delete(key);
}

export function _clearAllForTests(): void {
  store.clear();
}

export const _testConsts = { MAX_ATTEMPTS, BASE_COOLDOWN_MS, MAX_COOLDOWN_MS };
