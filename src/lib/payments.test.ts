import { describe, it, expect } from "vitest";
import { PAYABLE_STATUSES, computeOrderDebtInfo } from "@/lib/rbac-core";

describe("PAYABLE_STATUSES: оплата только в Собран/Отгружен/Доставлен", () => {
  it("разрешённые статусы", () => {
    expect(PAYABLE_STATUSES).toEqual(["ASSEMBLED", "SHIPPED", "DELIVERED"]);
  });
  it("вносить оплату нельзя в NEW/ENTERED/PAID/CANCELLED", () => {
    expect(PAYABLE_STATUSES.includes("NEW")).toBe(false);
    expect(PAYABLE_STATUSES.includes("ENTERED")).toBe(false);
    expect(PAYABLE_STATUSES.includes("PAID")).toBe(false);
    expect(PAYABLE_STATUSES.includes("CANCELLED")).toBe(false);
  });
});

describe("computeOrderDebtInfo: оплачено/остаток", () => {
  const now = new Date("2026-01-11T00:00:00Z");
  const created = new Date("2026-01-01T00:00:00Z");

  it("оплачено не превышает сумму заказа", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "SHIPPED", createdAt: created, deferral: 0, paid: 130 },
      now,
    );
    expect(r.paid).toBe(100);
    expect(r.unpaid).toBe(0);
  });

  it("частичная оплата: paid + unpaid", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "SHIPPED", createdAt: created, deferral: 0, paid: 40 },
      now,
    );
    expect(r.paid).toBe(40);
    expect(r.unpaid).toBe(60);
  });

  it("полная оплата -> долг 0, просрочки нет", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "SHIPPED", createdAt: created, deferral: 0, paid: 100 },
      now,
    );
    expect(r.unpaid).toBe(0);
    expect(r.overdue).toBe(false);
  });
});