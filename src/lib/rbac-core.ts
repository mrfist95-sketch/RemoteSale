export const ROLES = {
  BUYER: "BUYER",
  AGENT: "AGENT",
  SELLER: "SELLER",
  COURIER: "COURIER",
  ANALYST: "ANALYST",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<string, string> = {
  BUYER: "Покупатель",
  AGENT: "Торговый агент",
  SELLER: "Продавец",
  COURIER: "Курьер",
  ANALYST: "Аналитик",
  ADMIN: "Администратор",
};

export const ORDER_STATUSES = [
  "NEW",
  "ENTERED",
  "ASSEMBLED",
  "SHIPPED",
  "DELIVERED",
  "PAID",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "Новый (черновик)",
  ENTERED: "Внесён — в работе",
  ASSEMBLED: "Собран",
  SHIPPED: "Отгружен",
  DELIVERED: "Доставлен",
  PAID: "Оплачен",
  CANCELLED: "Отменён",
};

// Заказ можно отменить, пока он не обработан продавцом
export const CANCELLABLE_STATUSES: string[] = ["NEW", "ENTERED"];

// Долг возникает после отгрузки (и сохраняется до оплаты, включая доставку)
export const DEBT_STATUSES: string[] = ["SHIPPED", "DELIVERED", "PAID"];

// Статусы, которые может устанавливать курьер
export const COURIER_SETTABLE: string[] = ["DELIVERED"];

// Допустимые статусы для выпадающего списка смены статуса
export function statusOptionsFor(role: string): string[] {
  if (role === "COURIER") return [...COURIER_SETTABLE];
  return [...ORDER_STATUSES];
}

export function canCancel(status: string): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

// ---------- Долг и просрочка ----------

export const DAY_MS = 86_400_000;

export interface OrderDebtInfo {
  unpaid: number;
  paid: number;
  dueDate: Date;
  overdueDays: number;
  overdue: boolean;
}

export interface OrderDebtInput {
  total: number;
  status: string;
  createdAt: Date;
  deferral: number;
  paid: number;
}

// Чистый расчёт долга/просрочки по заказу с учётом отсрочки покупателя.
// overdue = статус входит в долг И есть неоплаченный остаток И прошёл срок отсрочки.
export function computeOrderDebtInfo(o: OrderDebtInput, now: Date): OrderDebtInfo {
  const unpaid = Math.max(0, o.total - o.paid);
  const paid = Math.min(o.paid, o.total);
  const due = new Date(o.createdAt.getTime() + (o.deferral ?? 0) * DAY_MS);
  const overdueDays =
    now.getTime() > due.getTime() ? Math.floor((now.getTime() - due.getTime()) / DAY_MS) : 0;
  const overdue = DEBT_STATUSES.includes(o.status) && unpaid > 0 && overdueDays > 0;
  return { unpaid, paid, dueDate: due, overdueDays, overdue };
}

// Статусы, в которых разрешён приём оплаты по заказу
export const PAYABLE_STATUSES: string[] = ["ASSEMBLED", "SHIPPED", "DELIVERED"];
