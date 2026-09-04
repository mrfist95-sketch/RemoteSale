import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  registerFailure,
  registerSuccess,
  resetRateLimit,
  _clearAllForTests,
  _testConsts,
} from "@/lib/rate-limit";

const K = "user@test.local";

describe("rate limit: 4 попытки, затем экспоненциальная блокировка", () => {
  beforeEach(() => {
    _clearAllForTests();
  });

  it("первые 2 неудачи не блокируют, 3-я включает блок 30 сек", () => {
    expect(checkRateLimit(K).blocked).toBe(false);

    expect(registerFailure(K).blocked).toBe(false); // 1
    expect(registerFailure(K).blocked).toBe(false); // 2
    const third = registerFailure(K); // 3
    expect(third.blocked).toBe(true);
    // 30 секунд +- погрешность
    expect(third.retryAfterMs).toBeGreaterThan(29_000);
    expect(third.retryAfterMs).toBeLessThanOrEqual(30_000);
    expect(third.attemptsLeft).toBe(0);
  });

  it("блок активен: checkRateLimit показывает retryAfter", () => {
    for (let i = 0; i < 3; i++) registerFailure(K);
    const s = checkRateLimit(K);
    expect(s.blocked).toBe(true);
    expect(s.retryAfterMs).toBeGreaterThan(0);
    expect(s.attemptsLeft).toBe(0);
  });

  it("экспонента: 4-я неудача -> ~60с, 5-я -> ~120с", () => {
    for (let i = 0; i < 4; i++) registerFailure(K);
    const s4 = checkRateLimit(K);
    expect(s4.retryAfterMs).toBeGreaterThan(55_000);
    expect(s4.retryAfterMs).toBeLessThanOrEqual(60_000);

    resetRateLimit(K);
    for (let i = 0; i < 5; i++) registerFailure(K);
    const s5 = checkRateLimit(K);
    expect(s5.blocked).toBe(true);
    // 5 неудач => 30с * 2^(5-3) = 120с
    expect(s5.retryAfterMs).toBeGreaterThan(115_000);
    expect(s5.retryAfterMs).toBeLessThanOrEqual(120_000);
  });

  it("успешный вход после неудач сбрасывает счётчик", () => {
    registerFailure(K);
    registerFailure(K);
    registerFailure(K);
    registerSuccess(K);
    const s = checkRateLimit(K);
    expect(s.blocked).toBe(false);
    expect(s.attemptsLeft).toBe(_testConsts.MAX_ATTEMPTS);
  });

  it("успешный вход внутри серии неудач обнуляет историю", () => {
    registerFailure(K);
    registerFailure(K);
    registerSuccess(K);
    const s = checkRateLimit(K);
    expect(s.attemptsLeft).toBe(_testConsts.MAX_ATTEMPTS);
  });

  it("разные ключи изолированы", () => {
    registerFailure(K);
    registerFailure(K);
    registerFailure(K);
    registerFailure(K);
    expect(checkRateLimit(K).blocked).toBe(true);
    expect(checkRateLimit("other@test.local").blocked).toBe(false);
  });
});