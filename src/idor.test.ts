import { describe, it, expect, vi, beforeEach } from "vitest";

// Мокаем prisma ДО импорта actions
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    order: { findUnique: vi.fn(), update: vi.fn() },
    orderStatusLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/rbac", () => ({
  getSessionUser: () => sessionUser,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Утилита типизированного доступа к мокам
function asMock<T extends (...args: never[]) => unknown>(fn: T) {
  return vi.mocked(fn);
}

import { prisma } from "@/lib/prisma";
import { cancelOrder, changeOrderStatus, updateBuyerProfile, submitOrder } from "@/app/actions";

const orderFindUnique = asMock(prisma.order.findUnique);
const userUpdate = asMock(prisma.user.update);
const userFindUnique = asMock(prisma.user.findUnique);
const orderUpdate = vi.mocked(prisma.order.update);

const sessionUser = { id: "u-buyer", email: "b@t.local", name: "B", role: "BUYER" };
const FOREIGN_ID = "someone-elses-order";

describe("IDOR: изоляция данных между пользователями", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sessionUser as { role: string }).role = "BUYER";
  });

  it("BUYER не может отменить чужой заказ", async () => {
    orderFindUnique.mockResolvedValue({
      id: FOREIGN_ID,
      buyerId: "someone-else",
      status: "NEW",
    } as never);
    await expect(cancelOrder(FOREIGN_ID)).rejects.toThrow("Нет доступа");
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it("BUYER меняет профиль только своей записи (id из сессии)", async () => {
    userUpdate.mockResolvedValue({} as never);
    await updateBuyerProfile({ address: "новый адрес" });
    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u-buyer" } }),
    );
  });

  it("COURIER не может доставить заказ не из SHIPPED", async () => {
    (sessionUser as { role: string }).role = "COURIER";
    orderFindUnique.mockResolvedValue({ id: FOREIGN_ID, status: "NEW" } as never);
    await expect(changeOrderStatus(FOREIGN_ID, "DELIVERED")).rejects.toThrow(
      "Курьер может доставлять только отгруженные заказы",
    );
  });

  it("COURIER не может ставить произвольный статус", async () => {
    (sessionUser as { role: string }).role = "COURIER";
    orderFindUnique.mockResolvedValue({ id: "o1", status: "SHIPPED" } as never);
    await expect(changeOrderStatus(FOREIGN_ID, "PAID")).rejects.toThrow("Недопустимый статус");
  });
});

describe("submitOrder: НОВЫЙ (черновик) -> ВНЕСЁН", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sessionUser as { role: string }).role = "BUYER";
  });

  it("BUYER не может передать чужой заказ", async () => {
    orderFindUnique.mockResolvedValue({ id: "o-x", buyerId: "someone-else", status: "NEW" } as never);
    await expect(submitOrder("o-x")).rejects.toThrow("Нет доступа");
    expect(orderUpdate).not.toHaveBeenCalled();
  });

  it("AGENT может передать заказ своего клиента", async () => {
    (sessionUser as { role: string }).role = "AGENT";
    orderFindUnique.mockResolvedValue({ id: "o1", buyerId: "b1", status: "NEW" } as never);
    userFindUnique.mockResolvedValue({ id: "b1", agentId: "u-buyer" } as never);
    orderUpdate.mockResolvedValue({} as never);
    const res = await submitOrder("o1");
    expect(res).toEqual({ ok: true });
    expect(orderUpdate).toHaveBeenCalled();
  });

  it("AGENT не может передать заказ чужого клиента", async () => {
    (sessionUser as { role: string }).role = "AGENT";
    orderFindUnique.mockResolvedValue({ id: "o2", buyerId: "b2", status: "NEW" } as never);
    userFindUnique.mockResolvedValue({ id: "b2", agentId: "other-agent" } as never);
    await expect(submitOrder("o2")).rejects.toThrow("Нет доступа");
  });

  it("передать в работу можно только черновик (NEW)", async () => {
    orderFindUnique.mockResolvedValue({ id: "o3", buyerId: "u-buyer", status: "ASSEMBLED" } as never);
    await expect(submitOrder("o3")).rejects.toThrow("только черновик");
  });
});