import { describe, it, expect } from "vitest";
import {
  ROLE_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  DEBT_STATUSES,
  CANCELLABLE_STATUSES,
  COURIER_SETTABLE,
  statusOptionsFor,
  canCancel,
  computeOrderDebtInfo,
} from "@/lib/rbac-core";

describe("rbac constants", () => {
  it("ROLE_LABELS покрывает все роли", () => {
    expect(Object.keys(ROLE_LABELS).sort()).toEqual(
      ["ADMIN", "AGENT", "ANALYST", "BUYER", "COURIER", "SELLER"].sort(),
    );
  });

  it("ORDER_STATUS_LABELS покрывает все статусы", () => {
    expect(Object.keys(ORDER_STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it("DEBT_STATUSES = SHIPPED, DELIVERED, PAID", () => {
    expect(DEBT_STATUSES).toEqual(["SHIPPED", "DELIVERED", "PAID"]);
  });

  it("CANCELLABLE_STATUSES и COURIER_SETTABLE", () => {
    expect(CANCELLABLE_STATUSES).toEqual(["NEW", "ENTERED"]);
    expect(COURIER_SETTABLE).toEqual(["DELIVERED"]);
  });
});

describe("statusOptionsFor / canCancel", () => {
  it("курьер может ставить только DELIVERED", () => {
    expect(statusOptionsFor("COURIER")).toEqual(["DELIVERED"]);
  });

  it("остальные роли видят все статусы", () => {
    expect(statusOptionsFor("SELLER")).toEqual([...ORDER_STATUSES]);
    expect(statusOptionsFor("ADMIN")).toEqual([...ORDER_STATUSES]);
    expect(statusOptionsFor("BUYER")).toEqual([...ORDER_STATUSES]);
  });

  it("canCancel допускает только NEW/ENTERED", () => {
    expect(canCancel("NEW")).toBe(true);
    expect(canCancel("ENTERED")).toBe(true);
    expect(canCancel("SHIPPED")).toBe(false);
    expect(canCancel("PAID")).toBe(false);
  });
});

describe("computeOrderDebtInfo (долг и просрочка)", () => {
  const created = new Date("2026-01-01T00:00:00Z");
  const now = new Date("2026-01-11T00:00:00Z"); // +10 дней

  it("не долговой статус не просрочен даже при просрочке", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "NEW", createdAt: created, deferral: 0, paid: 0 },
      now,
    );
    expect(r.unpaid).toBe(100);
    expect(r.overdue).toBe(false);
    expect(r.overdueDays).toBe(10);
  });

  it("полностью оплаченный долговой заказ не просрочен", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "SHIPPED", createdAt: created, deferral: 0, paid: 100 },
      now,
    );
    expect(r.unpaid).toBe(0);
    expect(r.overdue).toBe(false);
  });

  it("долговой заказ с неоплатой и истёкшей отсрочкой — просрочен", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "SHIPPED", createdAt: created, deferral: 0, paid: 0 },
      now,
    );
    expect(r.unpaid).toBe(100);
    expect(r.overdue).toBe(true);
    expect(r.overdueDays).toBe(10);
  });

  it("в рамках отсрочки просрочки нет (включая границу)", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "SHIPPED", createdAt: created, deferral: 10, paid: 0 },
      now,
    );
    expect(r.overdue).toBe(false);
    expect(r.overdueDays).toBe(0);
  });

  it("доставленный заказ с отсрочкой 30д и возрастом 41д — просрочен", () => {
    const old = new Date("2025-12-01T00:00:00Z");
    const r = computeOrderDebtInfo(
      { total: 500, status: "DELIVERED", createdAt: old, deferral: 30, paid: 0 },
      now,
    );
    expect(r.unpaid).toBe(500);
    expect(r.overdue).toBe(true);
    expect(r.overdueDays).toBe(11);
  });

  it("корректно считает неоплаченный остаток", () => {
    const r = computeOrderDebtInfo(
      { total: 100, status: "SHIPPED", createdAt: created, deferral: 0, paid: 40 },
      now,
    );
    expect(r.unpaid).toBe(60);
  });
});
