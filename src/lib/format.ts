import { APP_TIME_ZONE } from "@/lib/tz";

const rub = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: APP_TIME_ZONE });
const dateTime = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: APP_TIME_ZONE });

export function formatRub(value: number): string {
  return rub.format(value || 0);
}

// Даты всегда в поясе бизнеса: одинаково на сервере (UTC в Docker) и в браузере
export function formatDate(value: Date | string): string {
  return date.format(typeof value === "string" ? new Date(value) : value);
}

export function formatDateTime(value: Date | string): string {
  return dateTime.format(typeof value === "string" ? new Date(value) : value);
}
