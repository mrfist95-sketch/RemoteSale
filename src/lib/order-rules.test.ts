import { describe, it, expect } from "vitest";
import { transitionError, statusOptions, statusAfterPayments } from "@/lib/order-rules";

const t = (from: string, to: string, role = "SELLER", paid = 0, total = 1000) =>
  transitionError({ from, to, role, paid, total });

describe("переходы статусов", () => {
  it("вперёд по потоку можно, в т.ч. с пропуском шагов", () => {
    expect(t("ENTERED", "ASSEMBLED")).toBeNull();
    expect(t("ENTERED", "SHIPPED")).toBeNull();
    expect(t("ASSEMBLED", "DELIVERED")).toBeNull();
  });
  it("продавец возвращает только на один шаг", () => {
    expect(t("SHIPPED", "ASSEMBLED")).toBeNull();
    expect(t("SHIPPED", "ENTERED")).toMatch(/один шаг/);
    expect(t("SHIPPED", "ENTERED", "ADMIN")).toBeNull();
  });
  it("в черновик вернуть нельзя никому", () => {
    expect(t("ENTERED", "NEW", "ADMIN")).toMatch(/черновик/);
  });
  it("«Оплачен» только при полной оплате", () => {
    expect(t("DELIVERED", "PAID", "SELLER", 500, 1000)).toMatch(/не полностью/);
    expect(t("DELIVERED", "PAID", "SELLER", 1000, 1000)).toBeNull();
  });
  it("из «Оплачен» вручную не уйти", () => {
    expect(t("PAID", "DELIVERED", "ADMIN", 1000, 1000)).toMatch(/корректировкой/);
  });
  it("отмена — только до отгрузки и без оплат", () => {
    expect(t("ASSEMBLED", "CANCELLED")).toBeNull();
    expect(t("SHIPPED", "CANCELLED")).toMatch(/Отгруженный/);
    expect(t("ASSEMBLED", "CANCELLED", "SELLER", 10, 1000)).toMatch(/оплаты/);
  });
  it("отменённый восстанавливает только админ и только в «Внесён»", () => {
    expect(t("CANCELLED", "ENTERED")).toMatch(/администратор/);
    expect(t("CANCELLED", "ENTERED", "ADMIN")).toBeNull();
    expect(t("CANCELLED", "SHIPPED", "ADMIN")).toMatch(/Внесён/);
  });
  it("при наличии оплат нельзя вернуть заказ до «Собран»", () => {
    expect(t("ASSEMBLED", "ENTERED", "SELLER", 100, 1000)).toMatch(/оплаты/);
  });
  it("курьер: только Отгружен → Доставлен", () => {
    expect(t("SHIPPED", "DELIVERED", "COURIER")).toBeNull();
    expect(t("ENTERED", "DELIVERED", "COURIER")).toMatch(/Курьер/);
    expect(t("SHIPPED", "PAID", "COURIER")).toBe("Недопустимый статус");
  });
  it("прочие роли и неизвестные статусы", () => {
    expect(t("ENTERED", "ASSEMBLED", "BUYER")).toMatch(/прав/);
    expect(t("ENTERED", "HACKED")).toBe("Недопустимый статус");
  });
  it("варианты в списке: текущий первым, только разрешённые", () => {
    expect(statusOptions("SHIPPED", "SELLER", 0, 1000)).toEqual(["SHIPPED", "ASSEMBLED", "DELIVERED"]);
    expect(statusOptions("SHIPPED", "COURIER")).toEqual(["SHIPPED", "DELIVERED"]);
    expect(statusOptions("PAID", "ADMIN", 1000, 1000)).toEqual(["PAID"]);
  });
});

describe("статус после изменения оплат", () => {
  it("полная оплата → PAID", () => {
    expect(statusAfterPayments("DELIVERED", 1000, 1000)).toBe("PAID");
    expect(statusAfterPayments("ASSEMBLED", 999.996, 1000)).toBe("PAID");
  });
  it("частичная — без изменений", () => {
    expect(statusAfterPayments("SHIPPED", 500, 1000)).toBeNull();
  });
  it("откат из PAID в статус до оплаты", () => {
    expect(statusAfterPayments("PAID", 500, 1000, "SHIPPED")).toBe("SHIPPED");
    expect(statusAfterPayments("PAID", 500, 1000, null)).toBe("DELIVERED");
    expect(statusAfterPayments("PAID", 500, 1000, "ENTERED")).toBe("DELIVERED");
  });
  it("черновик/внесённый не переводится в PAID", () => {
    expect(statusAfterPayments("ENTERED", 1000, 1000)).toBeNull();
  });
});
