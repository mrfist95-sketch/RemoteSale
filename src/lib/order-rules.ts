// Чистые бизнес-правила заказа: переходы статусов и реакция на оплаты.
// Без обращения к БД — покрыты юнит-тестами (order-rules.test.ts).
import { ORDER_STATUSES, PAYABLE_STATUSES, ORDER_STATUS_LABELS } from "@/lib/rbac-core";
import { moneyGte, moneyGt, MONEY_EPS } from "@/lib/money";

// Рабочий поток заказа (без финальных PAID/CANCELLED)
export const FLOW = ["NEW", "ENTERED", "ASSEMBLED", "SHIPPED", "DELIVERED"] as const;

export interface TransitionInput {
  from: string;
  to: string;
  role: string;
  paid: number; // сумма оплат по заказу
  total: number;
}

const label = (s: string) => `«${ORDER_STATUS_LABELS[s] ?? s}»`;

/**
 * Можно ли перевести заказ из `from` в `to`. Возвращает текст ошибки или null.
 *  - курьер: только «Отгружен» → «Доставлен»;
 *  - вперёд по потоку — можно с пропуском шагов;
 *  - назад — продавец на один шаг, администратор на любой (но не в черновик);
 *  - «Оплачен» — только при полной оплате; снимается корректировкой оплат;
 *  - «Отменён» — до отгрузки и только без оплат; вернуть может только администратор.
 */
export function transitionError({ from, to, role, paid, total }: TransitionInput): string | null {
  if (!(ORDER_STATUSES as readonly string[]).includes(to)) return "Недопустимый статус";

  if (role === "COURIER") {
    if (to !== "DELIVERED") return "Недопустимый статус";
    if (from !== "SHIPPED") return "Курьер может доставлять только отгруженные заказы";
    return null;
  }
  if (role !== "SELLER" && role !== "ADMIN") return "Недостаточно прав";
  if (from === to) return `Заказ уже в статусе ${label(to)}`;
  if (to === "NEW") return "Вернуть заказ в черновик нельзя";

  if (from === "PAID") {
    return "Статус «Оплачен» снимается только корректировкой или удалением оплаты";
  }
  if (from === "CANCELLED") {
    if (role !== "ADMIN") return "Отменённый заказ может восстановить только администратор";
    if (to !== "ENTERED") return "Отменённый заказ восстанавливается в статус «Внесён»";
    return null;
  }
  if (to === "PAID") {
    if (!moneyGte(paid, total))
      return `Заказ оплачен не полностью (${paid.toFixed(2)} из ${total.toFixed(2)} ₽). Внесите оплату — статус сменится сам.`;
    return null;
  }
  if (to === "CANCELLED") {
    if (!["NEW", "ENTERED", "ASSEMBLED"].includes(from)) return "Отгруженный заказ отменить нельзя";
    if (paid > MONEY_EPS) return "По заказу есть оплаты — сначала удалите их";
    return null;
  }

  const fi = FLOW.indexOf(from as (typeof FLOW)[number]);
  const ti = FLOW.indexOf(to as (typeof FLOW)[number]);
  if (fi < 0 || ti < 0) return "Недопустимый переход статуса";
  if (ti > fi) return null; // вперёд
  // назад
  if (role === "SELLER" && fi - ti > 1) return `Вернуть можно только на один шаг назад (в ${label(FLOW[fi - 1])})`;
  if (paid > MONEY_EPS && !PAYABLE_STATUSES.includes(to))
    return `По заказу есть оплаты — вернуть в ${label(to)} нельзя`;
  return null;
}

/** Статусы, доступные в выпадающем списке для текущего заказа (текущий — первым) */
export function statusOptions(from: string, role: string, paid = 0, total = Number.POSITIVE_INFINITY): string[] {
  const allowed = ORDER_STATUSES.filter(
    (to) => to !== from && transitionError({ from, to, role, paid, total }) === null,
  );
  return [from, ...allowed];
}

/**
 * Статус заказа после изменения оплат.
 *  - полностью оплачен и статус допускает оплату → PAID;
 *  - был PAID, а оплат стало меньше суммы → статус до оплаты (prevStatus) или «Доставлен».
 * Возвращает новый статус или null, если менять не нужно.
 */
export function statusAfterPayments(
  status: string,
  paidNow: number,
  total: number,
  prevStatus?: string | null,
): string | null {
  const full = moneyGte(paidNow, total) && total > 0;
  if (status === "PAID" && !full) {
    return prevStatus && PAYABLE_STATUSES.includes(prevStatus) ? prevStatus : "DELIVERED";
  }
  if (status !== "PAID" && full && PAYABLE_STATUSES.includes(status)) return "PAID";
  return null;
}

/** Превышает ли сумма оплат сумму заказа */
export function isOverpaid(paid: number, total: number): boolean {
  return moneyGt(paid, total);
}
