// Интеграционные тесты server actions на настоящей SQLite-базе,
// созданной миграциями (как в production). Сессия подменяется моком.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const env = vi.hoisted(() => {
  const dir = require("node:fs").mkdtempSync(require("node:path").join(require("node:os").tmpdir(), "onsale-test-"));
  const file = require("node:path").join(dir, "test.db");
  process.env.DATABASE_URL = `file:${file}`;
  return { dir, file, me: { id: "", role: "" } as { id: string; role: string } };
});

vi.mock("@/lib/rbac", async () => {
  const core = await vi.importActual<object>("@/lib/rbac-core");
  return { ...core, getSessionUser: async () => (env.me.id ? { ...env.me, email: "x@t", name: "x" } : null) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type Actions = typeof import("@/app/actions");
let A: Actions;
let prisma: typeof import("@/lib/prisma").prisma;
const ids: Record<string, string> = {};
const as = (who: string, role: string) => {
  env.me.id = ids[who];
  env.me.role = role;
};

beforeAll(async () => {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${env.file}` },
    stdio: "ignore",
  });
  ({ prisma } = await import("@/lib/prisma"));
  A = await import("@/app/actions");
  const mk = async (key: string, role: string, extra: object = {}) => {
    const u = await prisma.user.create({ data: { email: `${key}@t.local`, passwordHash: "x", role, ...extra } });
    ids[key] = u.id;
  };
  await mk("admin", "ADMIN");
  await mk("seller", "SELLER");
  await mk("courier", "COURIER");
  await mk("agentA", "AGENT");
  await mk("agentB", "AGENT");
  await mk("buyer1", "BUYER", { agentId: ids.agentA });
  await mk("buyer2", "BUYER", { agentId: ids.agentB });
  await mk("blocked", "BUYER", { blocked: true });
  ids.p1 = (await prisma.product.create({ data: { article: "A1", name: "Товар 1", price: 100.5 } })).id;
  ids.p2 = (await prisma.product.create({ data: { article: "A2", name: "Товар 2", price: 10 } })).id;
  ids.pDel = (await prisma.product.create({ data: { article: "A3", name: "Снят", price: 5, deleted: true } })).id;
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  fs.rmSync(env.dir, { recursive: true, force: true });
});

async function newOrder(buyer: string, items: [string, number][], role = "BUYER", by = buyer) {
  as(by, role);
  const r = await A.createOrder(ids[buyer], items.map(([p, qty]) => ({ productId: ids[p], qty })));
  expect(r).toMatchObject({ ok: true });
  return prisma.order.findFirstOrThrow({ where: { number: (r as { number: number }).number } });
}
async function setStatus(orderId: string, status: string) {
  await prisma.order.update({ where: { id: orderId }, data: { status } });
  await prisma.orderStatusLog.create({ data: { orderId, status } });
}

describe("заказы", () => {
  it("покупатель создаёт заказ: итог по позициям, черновик, журнал статусов", async () => {
    const o = await newOrder("buyer1", [["p1", 2], ["p2", 3]]);
    expect(o.total).toBe(231);
    expect(o.status).toBe("NEW");
    expect(await prisma.orderStatusLog.count({ where: { orderId: o.id } })).toBe(1);
  });

  it("номера уникальны при одновременном оформлении", async () => {
    as("buyer1", "BUYER");
    const rs = await Promise.all(
      Array.from({ length: 6 }, () => A.createOrder(ids.buyer1, [{ productId: ids.p2, qty: 1 }])),
    );
    expect(rs.every((r) => r.ok)).toBe(true);
    const nums = rs.map((r) => (r as { number: number }).number);
    expect(new Set(nums).size).toBe(6);
  });

  it("нельзя заказать снятый товар, дробное/бесконечное количество, за другого", async () => {
    as("buyer1", "BUYER");
    expect(await A.createOrder(ids.buyer1, [{ productId: ids.pDel, qty: 1 }])).toMatchObject({ ok: false, error: expect.stringMatching(/сняты/) });
    expect(await A.createOrder(ids.buyer1, [{ productId: ids.p1, qty: 1.5 }])).toMatchObject({ ok: false, error: expect.stringMatching(/целое/) });
    expect(await A.createOrder(ids.buyer1, [{ productId: ids.p1, qty: Infinity }])).toMatchObject({ ok: false });
    expect(await A.createOrder(ids.buyer2, [{ productId: ids.p1, qty: 1 }])).toMatchObject({ ok: false, error: "Нельзя заказывать за другого" });
  });

  it("агент — только для своих клиентов; заблокированному покупателю заказ не оформить", async () => {
    await newOrder("buyer1", [["p1", 1]], "AGENT", "agentA");
    as("agentA", "AGENT");
    expect(await A.createOrder(ids.buyer2, [{ productId: ids.p1, qty: 1 }])).toMatchObject({ ok: false, error: expect.stringMatching(/не закреплён/) });
    as("admin", "ADMIN");
    expect(await A.createOrder(ids.blocked, [{ productId: ids.p1, qty: 1 }])).toMatchObject({ ok: false, error: expect.stringMatching(/заблокирован/) });
  });

  it("IDOR: чужой заказ нельзя отменить или передать в работу", async () => {
    const o = await newOrder("buyer2", [["p1", 1]]);
    as("buyer1", "BUYER");
    expect(await A.cancelOrder(o.id)).toEqual({ ok: false, error: "Нет доступа" });
    expect(await A.submitOrder(o.id)).toEqual({ ok: false, error: "Нет доступа" });
    as("agentA", "AGENT");
    expect(await A.submitOrder(o.id)).toEqual({ ok: false, error: "Нет доступа" });
    as("agentB", "AGENT");
    expect(await A.submitOrder(o.id)).toEqual({ ok: true });
    expect(await A.submitOrder(o.id)).toMatchObject({ ok: false, error: expect.stringMatching(/только черновик/) });
  });

  it("неавторизованный вызов отклоняется", async () => {
    env.me.id = "";
    expect(await A.cancelOrder("x")).toMatchObject({ ok: false, error: expect.stringMatching(/войдите/) });
  });
});

describe("статусы", () => {
  it("продавец: вперёд с пропуском, назад на шаг; курьер — только доставка", async () => {
    const o = await newOrder("buyer1", [["p1", 1]]);
    await setStatus(o.id, "ENTERED");
    as("seller", "SELLER");
    expect(await A.changeOrderStatus(o.id, "SHIPPED")).toEqual({ ok: true });
    expect(await A.changeOrderStatus(o.id, "ENTERED")).toMatchObject({ ok: false, error: expect.stringMatching(/один шаг/) });
    expect(await A.changeOrderStatus(o.id, "PAID")).toMatchObject({ ok: false, error: expect.stringMatching(/не полностью/) });
    as("courier", "COURIER");
    expect(await A.changeOrderStatus(o.id, "PAID")).toEqual({ ok: false, error: "Недопустимый статус" });
    expect(await A.changeOrderStatus(o.id, "DELIVERED")).toEqual({ ok: true });
    expect(await A.changeOrderStatus(o.id, "DELIVERED")).toMatchObject({ ok: false, error: expect.stringMatching(/Курьер/) });
    as("buyer1", "BUYER");
    expect(await A.changeOrderStatus(o.id, "SHIPPED")).toEqual({ ok: false, error: "Недостаточно прав" });
  });

  it("массовая смена: недопустимые пропускаются с причиной", async () => {
    const a = await newOrder("buyer1", [["p1", 1]]);
    const b = await newOrder("buyer1", [["p1", 1]]);
    await setStatus(a.id, "ENTERED");
    await setStatus(b.id, "DELIVERED");
    as("seller", "SELLER");
    const r = await A.bulkChangeStatus([a.id, b.id], "ASSEMBLED");
    expect(r).toMatchObject({ ok: true, changed: 1 });
    expect((r as { skipped: string[] }).skipped[0]).toMatch(/один шаг/);
  });
});

describe("оплаты", () => {
  it("покупатель оплаты должен совпадать с покупателем заказа", async () => {
    const o = await newOrder("buyer1", [["p1", 1]]);
    await setStatus(o.id, "SHIPPED");
    as("seller", "SELLER");
    expect(await A.createPayment({ buyerId: ids.buyer2, orderId: o.id, amount: 10 })).toMatchObject({ ok: false, error: expect.stringMatching(/не совпадает/) });
  });

  it("частичная → полная оплата переводит в «Оплачен»; переплата отклоняется", async () => {
    const o = await newOrder("buyer1", [["p1", 2]]); // 201
    await setStatus(o.id, "SHIPPED");
    as("seller", "SELLER");
    expect(await A.createPayment({ orderId: o.id, amount: 100 })).toEqual({ ok: true });
    expect(await A.createPayment({ orderId: o.id, amount: 101.01 })).toMatchObject({ ok: false, error: expect.stringMatching(/превышает/) });
    expect(await A.createPayment({ orderId: o.id, amount: 101 })).toEqual({ ok: true });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
  });

  it("одновременные оплаты не приводят к переплате", async () => {
    const o = await newOrder("buyer1", [["p2", 10]]); // 100
    await setStatus(o.id, "DELIVERED");
    as("seller", "SELLER");
    const rs = await Promise.all([1, 2, 3, 4].map(() => A.createPayment({ orderId: o.id, amount: 100 })));
    expect(rs.filter((r) => r.ok).length).toBe(1);
    const sum = await prisma.payment.aggregate({ where: { orderId: o.id }, _sum: { amount: true } });
    expect(sum._sum.amount).toBe(100);
  });

  it("корректировка выше суммы заказа отклоняется; уменьшение откатывает статус к прежнему", async () => {
    const o = await newOrder("buyer1", [["p2", 5]]); // 50
    await setStatus(o.id, "SHIPPED");
    as("seller", "SELLER");
    await A.createPayment({ orderId: o.id, amount: 50 });
    const p = await prisma.payment.findFirstOrThrow({ where: { orderId: o.id } });
    expect(await A.correctPayment({ paymentId: p.id, amount: 60, reason: "ошибка" })).toMatchObject({ ok: false, error: expect.stringMatching(/превысили/) });
    expect(await A.correctPayment({ paymentId: p.id, amount: 20, reason: "ошибка" })).toEqual({ ok: true });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("SHIPPED");
    expect(await A.correctPayment({ paymentId: p.id, amount: 50, reason: "ошибка" })).toEqual({ ok: true });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
    expect(await A.deletePayment(p.id, "дубль")).toEqual({ ok: true });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("SHIPPED");
    // добавление + 2 корректировки + удаление; отклонённая корректировка откатилась вместе с транзакцией
    expect(await prisma.orderAuditLog.count({ where: { orderId: o.id } })).toBe(4);
  });

  it("оплата без заказа: корректировка и удаление работают (раньше падали)", async () => {
    as("seller", "SELLER");
    expect(await A.createPayment({ buyerId: ids.buyer1, amount: 30 })).toEqual({ ok: true });
    const p = await prisma.payment.findFirstOrThrow({ where: { orderId: null } });
    expect(await A.correctPayment({ paymentId: p.id, amount: 35, reason: "уточнение" })).toEqual({ ok: true });
    expect(await A.deletePayment(p.id, "ошибочная")).toEqual({ ok: true });
    expect(await prisma.auditLog.count({ where: { entity: "payment", entityId: p.id } })).toBe(3);
  });

  it("продавец правит только сегодняшние оплаты (по Новосибирску), админ — любые", async () => {
    const o = await newOrder("buyer1", [["p2", 1]]);
    await setStatus(o.id, "DELIVERED");
    const p = await prisma.payment.create({
      data: { buyerId: ids.buyer1, orderId: o.id, amount: 5, date: new Date(Date.now() - 2 * 86_400_000) },
    });
    as("seller", "SELLER");
    expect(await A.deletePayment(p.id, "старая")).toMatchObject({ ok: false, error: expect.stringMatching(/сегодня/) });
    as("admin", "ADMIN");
    expect(await A.deletePayment(p.id, "старая")).toEqual({ ok: true });
  });
});

describe("корректировка состава", () => {
  it("итог пересчитывается по позициям; нельзя уйти ниже оплаченного и удалить всё", async () => {
    const o = await newOrder("buyer1", [["p1", 2], ["p2", 4]]); // 201 + 40
    await setStatus(o.id, "ASSEMBLED");
    const items = await prisma.orderItem.findMany({ where: { orderId: o.id } });
    const i1 = items.find((i) => i.productId === ids.p1)!;
    const i2 = items.find((i) => i.productId === ids.p2)!;
    as("seller", "SELLER");
    await A.createPayment({ orderId: o.id, amount: 150 });
    expect(await A.editOrderItems({ orderId: o.id, items: [{ orderItemId: i1.id, qty: 1 }], reason: "нет" })).toMatchObject({ ok: false, error: expect.stringMatching(/оплачено/) });
    expect(await A.editOrderItems({ orderId: o.id, items: [{ orderItemId: i1.id, qty: 0 }, { orderItemId: i2.id, qty: 0 }], reason: "нет" })).toMatchObject({ ok: false, error: expect.stringMatching(/все позиции/) });
    expect(await A.editOrderItems({ orderId: o.id, items: [{ orderItemId: i2.id, qty: 1 }], reason: "нет на складе" })).toMatchObject({ ok: true, total: 211 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).total).toBe(211);
  });
});

describe("пользователи", () => {
  it("последнего админа нельзя разжаловать/заблокировать, себя — тоже", async () => {
    as("admin", "ADMIN");
    expect(await A.updateUser(ids.admin, { role: "SELLER" })).toMatchObject({ ok: false });
    expect(await A.setUserBlocked(ids.admin, true)).toMatchObject({ ok: false });
  });

  it("пользователя с заказами удалить нельзя — только заблокировать; блокировка отзывает сессию", async () => {
    as("admin", "ADMIN");
    expect(await A.deleteUser(ids.buyer2)).toMatchObject({ ok: false, error: expect.stringMatching(/Заблокируйте/) });
    const { authOptions } = await import("@/lib/auth");
    const jwt = authOptions.callbacks!.jwt!;
    const token = { sub: ids.buyer2, role: "BUYER", sv: 0 };
    expect(await jwt({ token } as never)).not.toHaveProperty("revoked");
    expect(await A.setUserBlocked(ids.buyer2, true)).toEqual({ ok: true });
    expect(await jwt({ token: { ...token } } as never)).toMatchObject({ revoked: true });
    expect(await A.setUserBlocked(ids.buyer2, false)).toEqual({ ok: true });
  });

  it("смена роли действует сразу, смена пароля отзывает сессии", async () => {
    const { authOptions } = await import("@/lib/auth");
    const jwt = authOptions.callbacks!.jwt!;
    as("admin", "ADMIN");
    expect(await A.updateUser(ids.courier, { role: "SELLER" })).toEqual({ ok: true });
    expect(await jwt({ token: { sub: ids.courier, role: "COURIER", sv: 0 } } as never)).toMatchObject({ role: "SELLER" });
    expect(await A.updateUser(ids.courier, { password: "newpassword1" })).toEqual({ ok: true });
    expect(await jwt({ token: { sub: ids.courier, role: "SELLER", sv: 0 } } as never)).toMatchObject({ revoked: true });
  });

  it("валидация: email, пароль, роль, агент", async () => {
    as("admin", "ADMIN");
    expect(await A.createUser({ email: "bad", password: "12345678", role: "BUYER" })).toMatchObject({ ok: false, error: "Некорректный email" });
    expect(await A.createUser({ email: "n@t.local", password: "123", role: "BUYER" })).toMatchObject({ ok: false, error: expect.stringMatching(/8 символов/) });
    expect(await A.createUser({ email: "n@t.local", password: "12345678", role: "ROOT" })).toMatchObject({ ok: false, error: "Недопустимая роль" });
    expect(await A.createUser({ email: "n@t.local", password: "12345678", role: "BUYER", agentId: ids.seller })).toMatchObject({ ok: false, error: expect.stringMatching(/агент/) });
    expect(await A.createUser({ email: "New.User@T.local", password: "12345678", role: "BUYER", agentId: ids.agentA })).toEqual({ ok: true });
    expect(await A.createUser({ email: "new.user@t.local", password: "12345678", role: "BUYER" })).toMatchObject({ ok: false, error: expect.stringMatching(/уже существует/) });
    as("seller", "SELLER");
    expect(await A.createUser({ email: "z@t.local", password: "12345678", role: "ADMIN" })).toEqual({ ok: false, error: "Недостаточно прав" });
  });
});
