"use server";

// Server actions. Каждая функция — публичный эндпоинт: проверяем сессию и роль,
// валидируем вход (zod), меняем данные в одной транзакции и возвращаем
// ActionResult ({ ok:true, ... } | { ok:false, error }) вместо исключений.

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeTx } from "@/lib/db-lock";
import { getSessionUser } from "@/lib/rbac";
import { normalizeArticle, nextArticle } from "@/lib/article";
import { PAYABLE_STATUSES, CANCELLABLE_STATUSES } from "@/lib/rbac-core";
import { UserError, type ActionResult } from "@/lib/action-result";
import { roundMoney, moneyGt, fmtMoney } from "@/lib/money";
import { isSameBusinessDay } from "@/lib/tz";
import { transitionError, statusAfterPayments } from "@/lib/order-rules";
import { findUserByEmail } from "@/lib/auth";
import {
  parse,
  createOrderSchema,
  createPaymentSchema,
  correctPaymentSchema,
  reasonSchema,
  createUserSchema,
  updateUserSchema,
  buyerProfileSchema,
  productUpdateSchema,
  productCreateSchema,
  editOrderItemsSchema,
  idList,
  nameSchema,
} from "@/lib/validation";

type Tx = Prisma.TransactionClient;
type Me = { id: string; role: string };

// ---------- инфраструктура ----------

async function assertRole(...roles: string[]): Promise<Me> {
  const u = await getSessionUser();
  if (!u) throw new UserError("Сессия истекла — войдите заново");
  if (!roles.includes(u.role)) throw new UserError("Недостаточно прав");
  return u;
}

function prismaCode(e: unknown): string | undefined {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
}

function isBusy(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : "";
  return prismaCode(e) === "P2034" || /database is locked|SQLITE_BUSY/i.test(msg);
}

async function run<T extends object>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, ...data };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (prismaCode(e) === "P2025") return { ok: false, error: "Запись не найдена — обновите страницу" };
    if (isBusy(e))
      return { ok: false, error: "Данные одновременно меняет другой пользователь. Повторите операцию." };
    console.error("[action]", e);
    return { ok: false, error: "Внутренняя ошибка. Повторите или обратитесь к администратору." };
  }
}


function revalidateOrders() {
  for (const p of ["/seller", "/seller/route-list", "/buyer", "/buyer/orders", "/buyer/payments", "/agent", "/agent/orders", "/analyst", "/courier", "/admin/orders"])
    revalidatePath(p);
}

async function paidSum(tx: Tx, orderId: string): Promise<number> {
  const agg = await tx.payment.aggregate({ where: { orderId }, _sum: { amount: true } });
  return roundMoney(agg._sum.amount ?? 0);
}

/** Проверка доступа покупателя/агента к заказу */
async function assertOrderAccess(tx: Tx, me: Me, order: { buyerId: string }) {
  if (me.role === "BUYER" && order.buyerId !== me.id) throw new UserError("Нет доступа");
  if (me.role === "AGENT") {
    const buyer = await tx.user.findUnique({ where: { id: order.buyerId }, select: { agentId: true } });
    if (buyer?.agentId !== me.id) throw new UserError("Нет доступа");
  }
}

/** После изменения оплат: перевести в «Оплачен» или откатить статус */
async function syncPaymentStatus(tx: Tx, orderId: string, me: Me, note: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true, total: true } });
  if (!order) return;
  const paid = await paidSum(tx, orderId);
  if (moneyGt(paid, order.total)) {
    throw new UserError(
      `Оплаты (${fmtMoney(paid)}) превысили сумму заказа (${fmtMoney(order.total)}). Уменьшите сумму оплаты.`,
    );
  }
  let prev: string | null = null;
  if (order.status === "PAID") {
    const last = await tx.orderStatusLog.findFirst({
      where: { orderId, status: { notIn: ["PAID", "CANCELLED"] } },
      orderBy: { changedAt: "desc" },
      select: { status: true },
    });
    prev = last?.status ?? null;
  }
  const next = statusAfterPayments(order.status, paid, order.total, prev);
  if (next) {
    await tx.order.update({ where: { id: orderId }, data: { status: next } });
    await tx.orderStatusLog.create({ data: { orderId, status: next, changedById: me.id, note } });
  }
}

// ---------- заказы ----------

export interface OrderItemInput {
  productId: string;
  qty: number;
}

export async function createOrder(buyerId: string, items: OrderItemInput[], note?: string) {
  return run(async () => {
    const me = await assertRole("BUYER", "AGENT", "ADMIN");
    const input = parse(createOrderSchema, { buyerId, items, note });
    if (me.role === "BUYER" && input.buyerId !== me.id) throw new UserError("Нельзя заказывать за другого");

    const buyer = await prisma.user.findUnique({
      where: { id: input.buyerId },
      select: { id: true, role: true, agentId: true, blocked: true },
    });
    if (!buyer || buyer.role !== "BUYER") throw new UserError("Покупатель не найден");
    if (buyer.blocked) throw new UserError("Покупатель заблокирован");
    let agentId: string | null = null;
    if (me.role === "AGENT") {
      if (buyer.agentId !== me.id) throw new UserError("Покупатель не закреплён за вами");
      agentId = me.id;
    }

    // Объединяем повторы одной позиции
    const qtyById = new Map<string, number>();
    for (const i of input.items) if (i.qty > 0) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty);
    if (qtyById.size === 0) throw new UserError("Добавьте хотя бы одну позицию");

    const products = await prisma.product.findMany({
      where: { id: { in: [...qtyById.keys()] }, deleted: false },
      select: { id: true, name: true, price: true },
    });
    if (products.length !== qtyById.size)
      throw new UserError("Некоторые товары сняты с продажи — обновите страницу и соберите заказ заново");

    const ordItems = products.map((p) => ({ productId: p.id, name: p.name, qty: qtyById.get(p.id)!, price: p.price }));
    const total = roundMoney(ordItems.reduce((s, i) => s + i.qty * i.price, 0));

    // Номер — max+1 в транзакции; при гонке ловим конфликт уникальности и повторяем
    let number = 0;
    for (let attempt = 0; ; attempt++) {
      try {
        number = await writeTx(async (tx) => {
          const max = await tx.order.aggregate({ _max: { number: true } });
          const n = (max._max.number ?? 0) + 1;
          await tx.order.create({
            data: {
              number: n,
              buyerId: input.buyerId,
              agentId,
              status: "NEW",
              total,
              note: input.note ?? null,
              items: { create: ordItems },
              statusLogs: { create: { status: "NEW", changedById: me.id } },
            },
          });
          return n;
        });
        break;
      } catch (e) {
        if ((prismaCode(e) === "P2002" || isBusy(e)) && attempt < 4) continue;
        throw e;
      }
    }
    revalidateOrders();
    return { number };
  });
}

// Передача заказа в работу: НОВЫЙ (черновик) -> ВНЕСЁН.
export async function submitOrder(orderId: string) {
  return run(async () => {
    const me = await assertRole("BUYER", "AGENT", "ADMIN");
    await writeTx(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: String(orderId) } });
      if (!order || order.deleted) throw new UserError("Заказ не найден");
      await assertOrderAccess(tx, me, order);
      if (order.status !== "NEW") throw new UserError("Передать в работу можно только черновик (статус «Новый»)");
      await tx.order.update({ where: { id: order.id }, data: { status: "ENTERED" } });
      await tx.orderStatusLog.create({ data: { orderId: order.id, status: "ENTERED", changedById: me.id } });
    });
    revalidateOrders();
    return {};
  });
}

export async function cancelOrder(orderId: string) {
  return run(async () => {
    const me = await assertRole("BUYER", "AGENT", "ADMIN");
    await writeTx(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: String(orderId) } });
      if (!order || order.deleted) throw new UserError("Заказ не найден");
      await assertOrderAccess(tx, me, order);
      if (!CANCELLABLE_STATUSES.includes(order.status))
        throw new UserError("Заказ уже обрабатывается и не может быть отменён");
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      await tx.orderStatusLog.create({ data: { orderId: order.id, status: "CANCELLED", changedById: me.id } });
    });
    revalidateOrders();
    return {};
  });
}

async function changeStatusTx(tx: Tx, me: Me, orderId: string, status: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, status: true, total: true, deleted: true },
  });
  if (!order || order.deleted) throw new UserError("Заказ не найден");
  const paid = await paidSum(tx, order.id);
  const err = transitionError({ from: order.status, to: status, role: me.role, paid, total: order.total });
  if (err) throw new UserError(err);
  await tx.order.update({ where: { id: order.id }, data: { status } });
  await tx.orderStatusLog.create({ data: { orderId: order.id, status, changedById: me.id } });
  return order.number;
}

export async function changeOrderStatus(orderId: string, status: string) {
  return run(async () => {
    const me = await assertRole("SELLER", "ADMIN", "COURIER");
    await writeTx((tx) => changeStatusTx(tx, me, String(orderId), String(status)));
    revalidateOrders();
    return {};
  });
}

// Массовая смена статуса: заказы, которым переход не разрешён, пропускаются с причиной
export async function bulkChangeStatus(orderIds: string[], status: string) {
  return run(async () => {
    const me = await assertRole("SELLER", "ADMIN");
    const ids = parse(idList, orderIds);
    let changed = 0;
    const skipped: string[] = [];
    for (const id of ids) {
      try {
        await writeTx((tx) => changeStatusTx(tx, me, id, String(status)));
        changed++;
      } catch (e) {
        if (!(e instanceof UserError)) throw e;
        const o = await prisma.order.findUnique({ where: { id }, select: { number: true } });
        skipped.push(`№${o?.number ?? "?"}: ${e.message}`);
      }
    }
    revalidateOrders();
    return { changed, skipped };
  });
}

// ---------- оплаты ----------

export async function createPayment(raw: {
  buyerId?: string;
  orderId?: string;
  amount: number;
  method?: string;
  note?: string;
}) {
  return run(async () => {
    const me = await assertRole("SELLER", "ADMIN");
    const input = parse(createPaymentSchema, raw);
    const amount = roundMoney(input.amount);

    if (input.orderId) {
      const orderId = input.orderId;
      await writeTx(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, status: true, total: true, buyerId: true, deleted: true },
        });
        if (!order || order.deleted) throw new UserError("Заказ не найден");
        if (input.buyerId && input.buyerId !== order.buyerId)
          throw new UserError("Покупатель не совпадает с покупателем заказа");
        if (!PAYABLE_STATUSES.includes(order.status))
          throw new UserError("Оплату можно вносить только по заказам в статусах «Собран», «Отгружен» или «Доставлен»");

        const paid = await paidSum(tx, order.id);
        const debt = roundMoney(order.total - paid);
        if (moneyGt(amount, debt)) {
          throw new UserError(
            `Сумма превышает задолженность по заказу на ${(amount - debt).toFixed(2)} ₽ ` +
              `(задолженность: ${debt.toFixed(2)} ₽ из ${order.total.toFixed(2)} ₽). ` +
              `Внесите ровно ${debt.toFixed(2)} ₽ или меньше.`,
          );
        }
        await tx.payment.create({
          data: { buyerId: order.buyerId, orderId: order.id, amount, method: input.method, note: input.note ?? null, createdById: me.id },
        });
        await tx.orderAuditLog.create({
          data: {
            orderId: order.id,
            action: "payment_added",
            amount,
            details: `Внесена оплата ${fmtMoney(amount)} (${input.method})`,
            userId: me.id,
          },
        });
        await syncPaymentStatus(tx, order.id, me, "Полная оплата");
      });
    } else {
      if (!input.buyerId) throw new UserError("Не указан покупатель");
      const buyerId = input.buyerId;
      await writeTx(async (tx) => {
        const buyer = await tx.user.findUnique({ where: { id: buyerId }, select: { role: true } });
        if (!buyer || buyer.role !== "BUYER") throw new UserError("Покупатель не найден");
        const p = await tx.payment.create({
          data: { buyerId, amount, method: input.method, note: input.note ?? null, createdById: me.id },
        });
        await tx.auditLog.create({
          data: { entity: "payment", entityId: p.id, action: "payment_added", amount, details: `Оплата без заказа ${fmtMoney(amount)}`, userId: me.id },
        });
      });
    }
    revalidateOrders();
    return {};
  });
}

function assertSellerSameDay(me: Me, date: Date, what: string) {
  if (me.role === "SELLER" && !isSameBusinessDay(date, new Date()))
    throw new UserError(`Продавец может ${what} только оплаты, внесённые сегодня. Более старые — через администратора.`);
}

// Продавец — только оплаты «день в день»; администратор — любые.
export async function correctPayment(raw: {
  paymentId: string;
  amount?: number;
  method?: string;
  note?: string;
  reason: string;
}) {
  return run(async () => {
    const me = await assertRole("SELLER", "ADMIN");
    const input = parse(correctPaymentSchema, raw);

    await writeTx(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: input.paymentId },
        include: { order: { select: { id: true, total: true } } },
      });
      if (!payment) throw new UserError("Оплата не найдена");
      assertSellerSameDay(me, payment.date, "корректировать");

      const data: Prisma.PaymentUpdateInput = {};
      if (input.amount !== undefined) data.amount = roundMoney(input.amount);
      if (input.method !== undefined) data.method = input.method;
      if (input.note !== undefined) data.note = input.note || null;
      const newAmount = roundMoney(input.amount ?? payment.amount);
      if (
        newAmount === payment.amount &&
        (input.method === undefined || input.method === payment.method) &&
        input.note === undefined
      )
        throw new UserError("Нет изменений");

      await tx.payment.update({ where: { id: payment.id }, data });
      const details =
        `Корректировка оплаты ${fmtMoney(payment.amount)} -> ${fmtMoney(newAmount)}` +
        (input.method && input.method !== payment.method ? ` (${payment.method} -> ${input.method})` : "") +
        `. Причина: ${input.reason}`;

      if (payment.order) {
        await tx.orderAuditLog.create({
          data: { orderId: payment.order.id, action: "payment_edited", amount: newAmount, details, userId: me.id },
        });
        await syncPaymentStatus(tx, payment.order.id, me, "Пересчёт после корректировки оплаты");
      } else {
        await tx.auditLog.create({
          data: { entity: "payment", entityId: payment.id, action: "payment_edited", amount: newAmount, details, userId: me.id },
        });
      }
    });

    revalidateOrders();
    return {};
  });
}

export async function deletePayment(paymentId: string, reason: string) {
  return run(async () => {
    const me = await assertRole("SELLER", "ADMIN");
    const why = parse(reasonSchema, reason);

    await writeTx(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id: String(paymentId) } });
      if (!payment) throw new UserError("Оплата не найдена");
      assertSellerSameDay(me, payment.date, "удалять");

      await tx.payment.delete({ where: { id: payment.id } });
      const details = `Удалена оплата ${fmtMoney(payment.amount)}. Причина: ${why}`;
      if (payment.orderId) {
        await tx.orderAuditLog.create({
          data: { orderId: payment.orderId, action: "payment_deleted", amount: payment.amount, details, userId: me.id },
        });
        await syncPaymentStatus(tx, payment.orderId, me, "Откат после удаления оплаты");
      } else {
        await tx.auditLog.create({
          data: { entity: "payment", entityId: payment.id, action: "payment_deleted", amount: payment.amount, details, userId: me.id },
        });
      }
    });

    revalidateOrders();
    return {};
  });
}

// ---------- корректировка состава заказа ----------

// Разрешено до отгрузки: NEW/ENTERED/ASSEMBLED. Итог пересчитывается по позициям.
export async function editOrderItems(raw: {
  orderId: string;
  items: { orderItemId: string; qty: number }[];
  reason: string;
}) {
  return run(async () => {
    const me = await assertRole("SELLER", "ADMIN");
    const input = parse(editOrderItemsSchema, raw);

    const result = await writeTx(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, status: true, total: true, deleted: true, items: { select: { id: true, qty: true, price: true, name: true } } },
      });
      if (!order || order.deleted) throw new UserError("Заказ не найден");
      if (!["NEW", "ENTERED", "ASSEMBLED"].includes(order.status))
        throw new UserError("Корректировать состав можно только до отгрузки заказа");

      const byId = new Map(order.items.map((i) => [i.id, i]));
      const finalQty = new Map(order.items.map((i) => [i.id, i.qty]));
      const changes: string[] = [];
      const removed: string[] = [];
      for (const upd of input.items) {
        const item = byId.get(upd.orderItemId);
        if (!item || upd.qty === item.qty) continue;
        finalQty.set(item.id, upd.qty);
        if (upd.qty === 0) removed.push(item.name);
        else changes.push(`${item.name}: ${item.qty} -> ${upd.qty}`);
      }
      if (changes.length === 0 && removed.length === 0) throw new UserError("Нет изменений");
      if ([...finalQty.values()].every((q) => q === 0))
        throw new UserError("Нельзя удалить все позиции — отмените заказ");

      const newTotal = roundMoney(order.items.reduce((s, i) => s + (finalQty.get(i.id) ?? 0) * i.price, 0));
      const paid = await paidSum(tx, order.id);
      if (moneyGt(paid, newTotal))
        throw new UserError(
          `По заказу уже оплачено ${fmtMoney(paid)} — это больше новой суммы ${fmtMoney(newTotal)}. Сначала скорректируйте оплату.`,
        );

      for (const [id, q] of finalQty) {
        if (q === byId.get(id)!.qty) continue;
        if (q === 0) await tx.orderItem.delete({ where: { id } });
        else await tx.orderItem.update({ where: { id }, data: { qty: q } });
      }
      await tx.order.update({ where: { id: order.id }, data: { total: newTotal } });
      await tx.orderAuditLog.create({
        data: {
          orderId: order.id,
          action: "order_edited",
          details:
            `Корректировка состава: ${[...changes, ...removed.map((n) => `${n}: удалена`)].join("; ")}. ` +
            `Итог: ${order.total.toFixed(2)} -> ${newTotal.toFixed(2)} ₽. Причина: ${input.reason}`,
          userId: me.id,
        },
      });
      await syncPaymentStatus(tx, order.id, me, "Полная оплата (после корректировки состава)");
      return { total: newTotal, removed, changes };
    });

    revalidateOrders();
    return result;
  });
}

// ---------- справочник причин корректировки (админ) ----------

export async function createEditReason(name: string) {
  return run(async () => {
    await assertRole("ADMIN");
    const n = parse(nameSchema("название причины"), name);
    const dup = await prisma.orderEditReason.findUnique({ where: { name: n } });
    if (dup) throw new UserError("Такая причина уже есть");
    await prisma.orderEditReason.create({ data: { name: n } });
    revalidatePath("/admin/orders");
    revalidatePath("/seller");
    return {};
  });
}

export async function deleteEditReason(id: string) {
  return run(async () => {
    await assertRole("ADMIN");
    await prisma.orderEditReason.delete({ where: { id: String(id) } });
    revalidatePath("/admin/orders");
    revalidatePath("/seller");
    return {};
  });
}

// ---------- пользователи (админ) ----------

async function assertAgent(agentId: string | null | undefined) {
  if (!agentId) return null;
  const a = await prisma.user.findUnique({ where: { id: agentId }, select: { role: true } });
  if (!a || a.role !== "AGENT") throw new UserError("Выбранный агент не найден");
  return agentId;
}

async function otherActiveAdmins(exceptId: string) {
  return prisma.user.count({ where: { role: "ADMIN", blocked: false, id: { not: exceptId } } });
}

export async function createUser(raw: {
  email: string;
  name?: string;
  password: string;
  role: string;
  agentId?: string | null;
  address?: string;
  phone?: string;
  comment?: string;
  deferral?: number;
}) {
  return run(async () => {
    const me = await assertRole("ADMIN");
    const input = parse(createUserSchema, raw);
    if (await findUserByEmail(input.email)) throw new UserError("Пользователь с таким email уже существует");
    const isBuyer = input.role === "BUYER";
    const agentId = isBuyer ? await assertAgent(input.agentId) : null;
    const passwordHash = await bcrypt.hash(input.password, 10);
    try {
      const u = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name ?? null,
          passwordHash,
          role: input.role,
          agentId,
          address: isBuyer ? input.address ?? null : null,
          phone: input.phone ?? null,
          comment: input.comment ?? null,
          deferral: isBuyer ? input.deferral : 0,
        },
      });
      await prisma.auditLog.create({
        data: { entity: "user", entityId: u.id, action: "user_created", details: `${u.email} (${u.role})`, userId: me.id },
      });
    } catch (e) {
      if (prismaCode(e) === "P2002") throw new UserError("Пользователь с таким email уже существует");
      throw e;
    }
    revalidatePath("/admin/users");
    return {};
  });
}

export async function updateUser(
  id: string,
  raw: {
    name?: string;
    role?: string;
    agentId?: string | null;
    password?: string;
    address?: string;
    phone?: string;
    comment?: string;
    deferral?: number;
  },
) {
  return run(async () => {
    const me = await assertRole("ADMIN");
    const input = parse(updateUserSchema, raw);
    const target = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!target) throw new UserError("Пользователь не найден");

    const data: Prisma.UserUpdateInput = {};
    const log: string[] = [];
    if (input.name !== undefined) data.name = input.name || null;

    const newRole = input.role ?? target.role;
    if (newRole !== target.role) {
      if (target.id === me.id) throw new UserError("Нельзя изменить собственную роль");
      if (target.role === "ADMIN" && (await otherActiveAdmins(target.id)) === 0)
        throw new UserError("Это последний администратор — роль изменить нельзя");
      data.role = newRole;
      log.push(`роль ${target.role} -> ${newRole}`);
    }
    if (newRole === "BUYER") {
      if (input.agentId !== undefined) {
        const agentId = await assertAgent(input.agentId || null);
        data.agent = agentId ? { connect: { id: agentId } } : { disconnect: true };
      }
      if (input.address !== undefined) data.address = input.address || null;
      if (input.deferral !== undefined) data.deferral = input.deferral;
    } else if (target.agentId) {
      data.agent = { disconnect: true };
    }
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.comment !== undefined) data.comment = input.comment || null;
    if (input.password) {
      data.passwordHash = await bcrypt.hash(input.password, 10);
      data.sessionVersion = { increment: 1 }; // выкидываем старые сессии
      log.push("пароль изменён");
    }

    await writeTx(async (tx) => {
      await tx.user.update({ where: { id: target.id }, data });
      if (log.length)
        await tx.auditLog.create({
          data: { entity: "user", entityId: target.id, action: "user_updated", details: `${target.email}: ${log.join(", ")}`, userId: me.id },
        });
    });
    revalidatePath("/", "layout");
    return {};
  });
}

export async function setUserBlocked(id: string, blocked: boolean) {
  return run(async () => {
    const me = await assertRole("ADMIN");
    const target = await prisma.user.findUnique({ where: { id: String(id) } });
    if (!target) throw new UserError("Пользователь не найден");
    if (blocked) {
      if (target.id === me.id) throw new UserError("Нельзя заблокировать самого себя");
      if (target.role === "ADMIN" && (await otherActiveAdmins(target.id)) === 0)
        throw new UserError("Это последний администратор — заблокировать нельзя");
    }
    await writeTx(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: { blocked: !!blocked, sessionVersion: { increment: 1 } },
      });
      await tx.auditLog.create({
        data: { entity: "user", entityId: target.id, action: blocked ? "user_blocked" : "user_unblocked", details: target.email, userId: me.id },
      });
    });
    revalidatePath("/admin/users");
    return {};
  });
}

export async function deleteUser(id: string) {
  return run(async () => {
    const me = await assertRole("ADMIN");
    const target = await prisma.user.findUnique({
      where: { id: String(id) },
      include: { _count: { select: { buyOrders: true, agentOrders: true, payments: true, priceLists: true } } },
    });
    if (!target) throw new UserError("Пользователь не найден");
    if (target.id === me.id) throw new UserError("Нельзя удалить самого себя");
    if (target.role === "ADMIN" && (await otherActiveAdmins(target.id)) === 0)
      throw new UserError("Это последний администратор — удалить нельзя");
    const c = target._count;
    if (c.buyOrders + c.agentOrders + c.payments + c.priceLists > 0)
      throw new UserError("У пользователя есть заказы или оплаты — удалить нельзя. Заблокируйте его.");
    await writeTx(async (tx) => {
      await tx.user.delete({ where: { id: target.id } });
      await tx.auditLog.create({
        data: { entity: "user", entityId: target.id, action: "user_deleted", details: `${target.email} (${target.role})`, userId: me.id },
      });
    });
    revalidatePath("/admin/users");
    return {};
  });
}

// ---------- товары и категории (админ) ----------

function revalidateCatalog() {
  for (const p of ["/admin/price-list", "/analyst/price-list", "/buyer/catalog", "/buyer/order/new"]) revalidatePath(p);
}

export async function updateProduct(
  id: string,
  raw: { name?: string; price?: number; stock?: number; unit?: string; categoryId?: string | null; manufacturer?: string | null },
) {
  return run(async () => {
    await assertRole("ADMIN");
    const input = parse(productUpdateSchema, raw);
    const data: Prisma.ProductUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.price !== undefined) data.price = roundMoney(input.price);
    if (input.stock !== undefined) data.stock = input.stock;
    if (input.unit !== undefined) data.unit = input.unit;
    if (input.categoryId !== undefined)
      data.category = input.categoryId ? { connect: { id: input.categoryId } } : { disconnect: true };
    if (input.manufacturer !== undefined) data.manufacturer = input.manufacturer || null;
    await prisma.product.update({ where: { id: String(id) }, data });
    revalidateCatalog();
    return {};
  });
}

// Ручное создание позиции; артикул необязателен — при пустом генерируется счётчиком
export async function createProduct(raw: {
  name: string;
  article?: string;
  unit?: string;
  price?: number;
  stock?: number;
  manufacturer?: string;
  categoryId?: string | null;
}) {
  return run(async () => {
    await assertRole("ADMIN");
    const input = parse(productCreateSchema, raw);
    const article = normalizeArticle(input.article);
    if (article && (await prisma.product.findUnique({ where: { article } })))
      throw new UserError(`Артикул «${article}» уже используется`);
    let finalArticle: string | null = article;
    if (!finalArticle) {
      const generated = await prisma.product.findMany({
        where: { article: { startsWith: "АРТ-" } },
        select: { article: true },
      });
      finalArticle = nextArticle(generated.map((g) => g.article));
    }
    try {
      const prod = await prisma.product.create({
        data: {
          article: finalArticle,
          name: input.name,
          unit: input.unit || "шт",
          price: roundMoney(input.price ?? 0),
          stock: input.stock ?? 0,
          manufacturer: input.manufacturer || null,
          categoryId: input.categoryId || null,
        },
      });
      revalidateCatalog();
      return { id: prod.id, article: prod.article };
    } catch (e) {
      if (prismaCode(e) === "P2002") throw new UserError(`Артикул «${finalArticle}» уже используется`);
      throw e;
    }
  });
}

// Мягкое удаление: товар скрывается из каталога и форм заказа, история заказов сохраняется
export async function deleteProducts(ids: string[]) {
  return run(async () => {
    await assertRole("ADMIN");
    const list = parse(idList, ids);
    const res = await prisma.product.updateMany({ where: { id: { in: list }, deleted: false }, data: { deleted: true } });
    revalidateCatalog();
    return { count: res.count };
  });
}

export async function restoreProducts(ids: string[]) {
  return run(async () => {
    await assertRole("ADMIN");
    const list = parse(idList, ids);
    const res = await prisma.product.updateMany({ where: { id: { in: list }, deleted: true }, data: { deleted: false } });
    revalidateCatalog();
    return { count: res.count };
  });
}

// Жёсткое удаление — только товаров без истории заказов
export async function hardDeleteProducts(ids: string[]) {
  return run(async () => {
    await assertRole("ADMIN");
    const list = parse(idList, ids);
    const used = await prisma.orderItem.groupBy({ by: ["productId"], where: { productId: { in: list } } });
    const usedIds = new Set(used.map((u) => u.productId));
    const free = list.filter((id) => !usedIds.has(id));
    const skippedRows = usedIds.size
      ? await prisma.product.findMany({ where: { id: { in: [...usedIds] } }, select: { article: true } })
      : [];
    const skipped = skippedRows.map((p) => p.article ?? "(без артикула)");
    const res = free.length ? await prisma.product.deleteMany({ where: { id: { in: free } } }) : { count: 0 };
    revalidateCatalog();
    return {
      count: res.count,
      skipped,
      skippedMessage: skipped.length
        ? `Не удалены (есть история заказов): ${skipped.join(", ")}. Используйте мягкое удаление.`
        : undefined,
    };
  });
}

export async function createCategory(name: string) {
  return run(async () => {
    await assertRole("ADMIN");
    const n = parse(nameSchema("название категории"), name);
    if (await prisma.category.findUnique({ where: { name: n } })) throw new UserError("Такая категория уже есть");
    const cat = await prisma.category.create({ data: { name: n } });
    revalidateCatalog();
    return { id: cat.id };
  });
}

export async function renameCategory(id: string, name: string) {
  return run(async () => {
    await assertRole("ADMIN");
    const n = parse(nameSchema("название"), name);
    try {
      await prisma.category.update({ where: { id: String(id) }, data: { name: n } });
    } catch (e) {
      if (prismaCode(e) === "P2002") throw new UserError("Такая категория уже есть");
      throw e;
    }
    revalidateCatalog();
    return {};
  });
}

export async function deleteCategory(id: string) {
  return run(async () => {
    await assertRole("ADMIN");
    await writeTx(async (tx) => {
      await tx.product.updateMany({ where: { categoryId: String(id) }, data: { categoryId: null } });
      await tx.category.delete({ where: { id: String(id) } });
    });
    revalidateCatalog();
    return {};
  });
}

export async function mergeCategories(sourceId: string, targetId: string) {
  return run(async () => {
    await assertRole("ADMIN");
    if (sourceId === targetId) throw new UserError("Нельзя объединить категорию с самой собой");
    await writeTx(async (tx) => {
      const [source, target] = await Promise.all([
        tx.category.findUnique({ where: { id: String(sourceId) } }),
        tx.category.findUnique({ where: { id: String(targetId) } }),
      ]);
      if (!source || !target) throw new UserError("Категория не найдена");
      await tx.product.updateMany({ where: { categoryId: source.id }, data: { categoryId: target.id } });
      await tx.category.delete({ where: { id: source.id } });
    });
    revalidateCatalog();
    return {};
  });
}

// Пометка заказа на удаление (администратор)
export async function markOrderDeleted(orderId: string, deleted: boolean) {
  return run(async () => {
    await assertRole("ADMIN");
    await prisma.order.update({ where: { id: String(orderId) }, data: { deleted: deleted === true } });
    revalidateOrders();
    return {};
  });
}

// ---------- профиль покупателя ----------

export async function updateBuyerProfile(raw: { address?: string; phone?: string; comment?: string }) {
  return run(async () => {
    const me = await assertRole("BUYER");
    const input = parse(buyerProfileSchema, raw);
    const data: Prisma.UserUpdateInput = {};
    if (input.address !== undefined) data.address = input.address || null;
    if (input.phone !== undefined) data.phone = input.phone || null;
    if (input.comment !== undefined) data.comment = input.comment || null;
    await prisma.user.update({ where: { id: me.id }, data });
    revalidatePath("/buyer/profile");
    revalidatePath("/buyer");
    revalidateOrders();
    return {};
  });
}

