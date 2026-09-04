// Простой in-memory rate limiter для входа.
// После 3 неудач подряд — блокировка с экспоненциальным ростом:
// 30с, 1мин, 2мин, 4мин ... максимум 1 час.
// Состояние в памяти процесса — достаточно для одного инстанса Next.

export const MAX_ATTEMPTS = 3;
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

function backoffMs(fails: number): number {
  // 3-я неудача -> 30с, 4-я -> 60с, 5-я -> 120с ... (экспонента 2)
  const exponent = Math.max(0, fails - MAX_ATTEMPTS);
  return Math.min(MAX_COOLDOWN_MS, BASE_COOLDOWN_MS * Math.pow(2, exponent));
}

function stateOf(key: string): RateLimitState {
  const entry = store.get(key);
  if (!entry) return { blocked: false, retryAfterMs: 0, attemptsLeft: MAX_ATTEMPTS };
  const blocked = entry.blockedUntil > Date.now();
  return {
    blocked,
    retryAfterMs: blocked ? entry.blockedUntil - Date.now() : 0,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - entry.fails),
  };
}

export function checkRateLimit(key: string): RateLimitState {
  return stateOf(key);
}

export function registerFailure(key: string): RateLimitState {
  const entry = store.get(key) ?? { fails: 0, blockedUntil: 0 };
  entry.fails += 1;
  if (entry.fails >= MAX_ATTEMPTS) {
    entry.blockedUntil = Date.now() + backoffMs(entry.fails);
  }
  store.set(key, entry);
  return stateOf(key);
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