import { describe, it, expect } from "vitest";
import { generatePassword } from "@/lib/password";

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}<>?";
const ALLOWED = new Set((LOWER + UPPER + DIGITS + SYMBOLS).split(""));

describe("generatePassword", () => {
  it("всегда содержит малые, заглавные, цифры и символы; длина 8..12", () => {
    for (let i = 0; i < 500; i++) {
      const p = generatePassword();
      expect(p.length).toBeGreaterThanOrEqual(8);
      expect(p.length).toBeLessThanOrEqual(12);
      expect(/[a-z]/.test(p)).toBe(true);
      expect(/[A-Z]/.test(p)).toBe(true);
      expect(/[0-9]/.test(p)).toBe(true);
      expect(SYMBOLS.split("").some((c) => p.includes(c))).toBe(true);
      for (const ch of p) expect(ALLOWED.has(ch)).toBe(true);
    }
  });

  it("генерирует разные значения", () => {
    const set = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(set.size).toBeGreaterThan(1);
  });
});
