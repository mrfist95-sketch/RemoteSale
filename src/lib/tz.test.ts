import { describe, it, expect } from "vitest";
import { dayKey, isSameBusinessDay, startOfBusinessDay, endOfBusinessDay, periodRange } from "@/lib/tz";
import { formatDate } from "@/lib/format";

describe("часовой пояс бизнеса (Новосибирск, UTC+7)", () => {
  it("день считается по Новосибирску, а не по UTC", () => {
    // 2026-10-07 20:30 UTC = 2026-10-08 03:30 по Новосибирску
    expect(dayKey(new Date("2026-10-07T20:30:00Z"))).toBe("2026-10-08");
    expect(isSameBusinessDay(new Date("2026-10-07T20:30:00Z"), new Date("2026-10-08T10:00:00Z"))).toBe(true);
    expect(isSameBusinessDay(new Date("2026-10-07T16:59:00Z"), new Date("2026-10-07T17:01:00Z"))).toBe(false);
  });
  it("границы дня", () => {
    expect(startOfBusinessDay("2026-10-08").toISOString()).toBe("2026-10-07T17:00:00.000Z");
    expect(endOfBusinessDay("2026-10-08").toISOString()).toBe("2026-10-08T16:59:59.999Z");
  });
  it("период фильтра включает последний день целиком и игнорирует мусор", () => {
    const r = periodRange("2026-10-01", "2026-10-07");
    expect(r.from?.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(r.to?.toISOString()).toBe("2026-10-07T16:59:59.999Z");
    expect(periodRange("bad", "")).toEqual({ from: undefined, to: undefined });
  });
  it("форматирование даты не зависит от пояса сервера", () => {
    expect(formatDate(new Date("2026-10-07T20:30:00Z"))).toMatch(/8 окт/);
  });
});
