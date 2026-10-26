// Часовой пояс бизнеса. Сервер в Docker работает в UTC, поэтому все
// «календарные» вычисления (сегодня, начало/конец дня, форматирование дат)
// делаются явно в этом поясе — одинаково на сервере и в браузере.
export const APP_TIME_ZONE = "Asia/Novosibirsk";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(d: Date) {
  const p: Record<string, number> = {};
  for (const { type, value } of partsFmt.formatToParts(d)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Смещение пояса относительно UTC в мс для данного момента */
function offsetMs(d: Date): number {
  const p = zonedParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/** Календарная дата в поясе бизнеса: "YYYY-MM-DD" */
export function dayKey(d: Date): string {
  const p = zonedParts(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Один и тот же календарный день (в поясе бизнеса) */
export function isSameBusinessDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** Начало дня "YYYY-MM-DD" в поясе бизнеса (момент UTC) */
export function startOfBusinessDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  return new Date(guess.getTime() - offsetMs(guess));
}

/** Конец дня "YYYY-MM-DD" в поясе бизнеса (последняя миллисекунда) */
export function endOfBusinessDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = startOfBusinessDay(dayKey(new Date(Date.UTC(y, m - 1, d, 12) + 86_400_000)));
  return new Date(next.getTime() - 1);
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Период фильтра из строк "YYYY-MM-DD": границы включительно, в поясе бизнеса */
export function periodRange(from?: string, to?: string): { from?: Date; to?: Date } {
  return {
    from: from && YMD.test(from) ? startOfBusinessDay(from) : undefined,
    to: to && YMD.test(to) ? endOfBusinessDay(to) : undefined,
  };
}
