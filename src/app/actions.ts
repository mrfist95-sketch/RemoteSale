"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import Papa from "papaparse";
import { normalizeArticle, nextArticle } from "@/lib/article";

async function assertRole(...roles: string[]) {
  const u = await getSessionUser();
  if (!u) throw new Error("Не авторизован");
  if (!roles.includes(u.role)) throw new Error("Недостаточно прав");
  return u;
}

export interface OrderItemInput {
  productId: string;
  qty: number;
}

export async function createOrder(
  buyerId: string,
  items: OrderItemInput[],
  note?: string,
) {
  const me = await assertRole("BUYER", "AGENT", "ADMIN");
  let agentId: string | null = null;

  if (me.role === "BUYER") {
    if (buyerId !== me.id) throw new Error("Нельзя заказывать за другого");
  } else if (me.role === "AGENT") {
    const buyer = await prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer || buyer.agentId !== me.id)
      throw new Error("Покупатель не закреплён за вами");
    agentId = me.id;
  }

  const valid = items.filter((i) => i.qty > 0 && i.productId);
  if (valid.length === 0) throw new Error("Добавьте хотя бы одну позицию");

  const products = await prisma.product.findMany({
    where: { id: { in: valid.map((i) => i.productId) } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const ordItems = valid.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw new Error("Товар не найден");
    return { productId: p.id, name: p.name, qty: i.qty, price: p.price };
  });
  const total = ordItems.reduce((s, i) => s + i.qty * i.price, 0);
  const count = await prisma.order.count();

  const order = await prisma.order.create({
    data: {
      number: count + 1,
      buyerId,
      agentId: agentId ?? undefined,
      status: "NEW",
      total,
      note: note || null,
      items: { create: ordItems },
    },
  });
  await prisma.orderStatusLog.create({
    data: { orderId: order.id, status: "NEW", changedById: me.id },
  });

  revalidatePath("/buyer/orders");
  revalidatePath("/agent");
  revalidatePath("/seller");
  return { ok: true };
}

// Передача заказа в работу: НОВЫЙ (черновик) -> ВНЕСЁН.
// Покупатель — только свой заказ; агент — только заказ своего клиента.
export async function submitOrder(orderId: string) {
  const me = await assertRole("BUYER", "AGENT", "ADMIN");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Заказ не найден");
  if (me.role === "BUYER" && order.buyerId !== me.id) throw new Error("Нет доступа");
  if (me.role === "AGENT") {
    const buyer = await prisma.user.findUnique({ where: { id: order.buyerId } });
    if (buyer?.agentId !== me.id) throw new Error("Нет доступа");
  }
  if (order.status !== "NEW") throw new Error("Передать в работу можно только черновик (статус «Новый»)");
  await prisma.order.update({ where: { id: orderId }, data: { status: "ENTERED" } });
  await prisma.orderStatusLog.create({
    data: { orderId, status: "ENTERED", changedById: me.id },
  });
  revalidatePath("/buyer/orders");
  revalidatePath("/agent/orders");
  revalidatePath("/seller");
  return { ok: true };
}

export async function cancelOrder(orderId: string) {
  const me = await assertRole("BUYER", "AGENT", "ADMIN");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Заказ не найден");
  if (!["NEW", "ENTERED"].includes(order.status))
    throw new Error("Заказ уже обрабатывается и не может быть отменён");
  if (me.role === "BUYER" && order.buyerId !== me.id)
    throw new Error("Нет доступа");
  if (me.role === "AGENT") {
    const buyer = await prisma.user.findUnique({ where: { id: order.buyerId } });
    if (buyer?.agentId !== me.id) throw new Error("Нет доступа");
  }
  await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
  await prisma.orderStatusLog.create({
    data: { orderId, status: "CANCELLED", changedById: me.id },
  });
  revalidatePath("/buyer/orders");
  revalidatePath("/agent");
  revalidatePath("/seller");
  return { ok: true };
}

export async function changeOrderStatus(orderId: string, status: string) {
  const me = await assertRole("SELLER", "ADMIN", "COURIER");
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Заказ не найден");
  let allowed: string[];
  if (me.role === "COURIER") {
    if (order.status !== "SHIPPED")
      throw new Error("Курьер может доставлять только отгруженные заказы");
    allowed = ["DELIVERED"];
  } else {
    allowed = ["ENTERED", "ASSEMBLED", "SHIPPED", "DELIVERED", "PAID", "CANCELLED"];
  }
  if (!allowed.includes(status)) throw new Error("Недопустимый статус");
  await prisma.order.update({ where: { id: orderId }, data: { status } });
  await prisma.orderStatusLog.create({
    data: { orderId, status, changedById: me.id },
  });
  revalidatePath("/seller");
  revalidatePath("/buyer/orders");
  revalidatePath("/agent");
  revalidatePath("/analyst");
  revalidatePath("/courier");
  return { ok: true };
}

export async function createPayment(input: {
  buyerId: string;
  orderId?: string;
  amount: number;
  method?: string;
  note?: string;
}) {
  const me = await assertRole("SELLER", "ADMIN");
  if (!input.amount || input.amount <= 0) throw new Error("Сумма должна быть больше 0");
  await prisma.payment.create({
    data: {
      buyerId: input.buyerId,
      orderId: input.orderId || null,
      amount: input.amount,
      method: input.method || "card",
      note: input.note || null,
    },
  });
  revalidatePath("/buyer/payments");
  revalidatePath("/seller");
  revalidatePath("/agent");
  revalidatePath("/analyst");
  return { ok: true };
}

// ---------- Администрирование ----------

export async function createUser(input: {
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
  await assertRole("ADMIN");
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new Error("Пользователь уже существует");
  const passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.user.create({
    data: {
      email: input.email,
      name: input.name || null,
      passwordHash,
      role: input.role,
      agentId: input.agentId || null,
      address: input.address || null,
      phone: input.phone || null,
      comment: input.comment || null,
      deferral: input.deferral ?? 0,
    },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateUser(
  id: string,
  input: {
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
  await assertRole("ADMIN");
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name || null;
  if (input.role !== undefined) data.role = input.role;
  if (input.agentId !== undefined) data.agentId = input.agentId || null;
  if (input.address !== undefined) data.address = input.address || null;
  if (input.phone !== undefined) data.phone = input.phone || null;
  if (input.comment !== undefined) data.comment = input.comment || null;
  if (input.deferral !== undefined) data.deferral = input.deferral;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.user.update({ where: { id }, data });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUser(id: string) {
  await assertRole("ADMIN");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateProduct(
  id: string,
  input: {
    name?: string;
    price?: number;
    stock?: number;
    unit?: string;
    categoryId?: string | null;
    manufacturer?: string | null;
  },
) {
  await assertRole("ADMIN");
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.price !== undefined) data.price = input.price;
  if (input.stock !== undefined) data.stock = input.stock;
  if (input.unit !== undefined) data.unit = input.unit;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId || null;
  if (input.manufacturer !== undefined) data.manufacturer = input.manufacturer || null;
  await prisma.product.update({ where: { id }, data });
  revalidatePath("/admin/price-list");
  revalidatePath("/buyer/catalog");
  return { ok: true };
}

// Ручное создание позиции админом; артикул необязателен — при пустом генерируется счётчиком
export async function createProduct(input: {
  name: string;
  article?: string;
  unit?: string;
  price?: number;
  stock?: number;
  manufacturer?: string;
  categoryId?: string | null;
}) {
  await assertRole("ADMIN");
  const name = input.name.trim();
  if (!name) throw new Error("Введите наименование");
  const article = normalizeArticle(input.article);
  if (article) {
    const dup = await prisma.product.findUnique({ where: { article } });
    if (dup) throw new Error(`Артикул «${article}» уже используется`);
  }
  let finalArticle: string | null = article;
  if (!finalArticle) {
    const generated = await prisma.product.findMany({
      where: { article: { startsWith: "АРТ-" } },
      select: { article: true },
    });
    finalArticle = nextArticle(generated.map((g) => g.article));
  }
  const prod = await prisma.product.create({
    data: {
      article: finalArticle,
      name,
      unit: input.unit?.trim() || "шт",
      price: input.price ?? 0,
      stock: Math.max(0, Math.floor(input.stock ?? 0)),
      manufacturer: input.manufacturer?.trim() || null,
      categoryId: input.categoryId || null,
    },
  });
  revalidatePath("/admin/price-list");
  revalidatePath("/buyer/catalog");
  return { ok: true, id: prod.id, article: prod.article };
}

// ---------- Удаление товаров (мягкое, с восстановлением) ----------
// Мягкое удаление: товар скрывается из каталога и форм заказа, история заказов сохраняется
export async function deleteProducts(ids: string[]) {
  await assertRole("ADMIN");
  if (ids.length === 0) throw new Error("Не выбрано ни одной позиции");
  const res = await prisma.product.updateMany({
    where: { id: { in: ids }, deleted: false },
    data: { deleted: true },
  });
  revalidatePath("/admin/price-list");
  revalidatePath("/buyer/catalog");
  revalidatePath("/buyer/order/new");
  return { ok: true, count: res.count };
}

export async function restoreProducts(ids: string[]) {
  await assertRole("ADMIN");
  if (ids.length === 0) throw new Error("Не выбрано ни одной позиции");
  const res = await prisma.product.updateMany({
    where: { id: { in: ids }, deleted: true },
    data: { deleted: false },
  });
  revalidatePath("/admin/price-list");
  return { ok: true, count: res.count };
}

// Жёсткое удаление — ТОЛЬКО если на товар не было заказов (иначе упадёт FK на OrderItem)
export async function hardDeleteProducts(ids: string[]) {
  await assertRole("ADMIN");
  if (ids.length === 0) throw new Error("Не выбрано ни одной позиции");
  let deleted = 0;
  const skipped: string[] = [];
  for (const id of ids) {
    const items = await prisma.orderItem.count({ where: { productId: id } });
    if (items > 0) {
      const p = await prisma.product.findUnique({ where: { id }, select: { article: true } });
      if (p) skipped.push(p.article ?? "(без артикула)");
      continue;
    }
    await prisma.product.delete({ where: { id } });
    deleted++;
  }
  revalidatePath("/admin/price-list");
  return {
    ok: true,
    count: deleted,
    skipped,
    skippedMessage: skipped.length
      ? `Не удалены (есть история заказов): ${skipped.join(", ")}. Используйте мягкое удаление.`
      : undefined,
  };
}

// Справочник товарных категорий
export async function createCategory(name: string) {
  await assertRole("ADMIN");
  const n = name.trim();
  if (!n) throw new Error("Введите название категории");
  const exists = await prisma.category.findUnique({ where: { name: n } });
  if (exists) throw new Error("Такая категория уже есть");
  const cat = await prisma.category.create({ data: { name: n } });
  revalidatePath("/admin/price-list");
  return { ok: true, id: cat.id };
}

export async function renameCategory(id: string, name: string) {
  await assertRole("ADMIN");
  const n = name.trim();
  if (!n) throw new Error("Введите название");
  await prisma.category.update({ where: { id }, data: { name: n } });
  revalidatePath("/admin/price-list");
  return { ok: true };
}

export async function deleteCategory(id: string) {
  await assertRole("ADMIN");
  // товары остаются, но без категории
  await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/price-list");
  return { ok: true };
}

export async function mergeCategories(sourceId: string, targetId: string) {
  await assertRole("ADMIN");
  if (sourceId === targetId) throw new Error("Нельзя объединить категорию с самой собой");
  const [source, target] = await Promise.all([
    prisma.category.findUnique({ where: { id: sourceId } }),
    prisma.category.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) throw new Error("Категория не найдена");
  await prisma.product.updateMany({ where: { categoryId: sourceId }, data: { categoryId: targetId } });
  await prisma.category.delete({ where: { id: sourceId } });
  revalidatePath("/admin/price-list");
  revalidatePath("/buyer/catalog");
  return { ok: true };
}

// Пометка заказа на удаление (администратор)
export async function markOrderDeleted(orderId: string, deleted: boolean) {
  await assertRole("ADMIN");
  await prisma.order.update({ where: { id: orderId }, data: { deleted } });
  revalidatePath("/admin/orders");
  revalidatePath("/seller");
  revalidatePath("/buyer/orders");
  revalidatePath("/agent");
  revalidatePath("/analyst");
  revalidatePath("/courier");
  return { ok: true };
}

// Массовая смена статуса (продавец/администратор)
export async function bulkChangeStatus(orderIds: string[], status: string) {
  const me = await assertRole("SELLER", "ADMIN");
  const allowed = ["ENTERED", "ASSEMBLED", "SHIPPED", "DELIVERED", "PAID", "CANCELLED"];
  if (!allowed.includes(status)) throw new Error("Недопустимый статус");
  for (const id of orderIds) {
    await prisma.order.update({ where: { id }, data: { status } });
    await prisma.orderStatusLog.create({ data: { orderId: id, status, changedById: me.id } });
  }
  revalidatePath("/seller");
  revalidatePath("/buyer/orders");
  revalidatePath("/agent");
  revalidatePath("/analyst");
  revalidatePath("/courier");
  return { ok: true };
}

// Обёртка для вызова из <form>
export async function bulkChangeStatusAction(formData: FormData) {
  const status = String(formData.get("status") || "");
  const orderIds = formData
    .getAll("orderIds")
    .map((v) => String(v))
    .filter(Boolean);
  if (orderIds.length === 0) throw new Error("Не выбрано ни одного заказа");
  return bulkChangeStatus(orderIds, status);
}

// Редактирование профиля покупателем (свои данные; отсрочка — только админ)
export async function updateBuyerProfile(input: {
  address?: string;
  phone?: string;
  comment?: string;
}) {
  const me = await assertRole("BUYER");
  const data: Record<string, unknown> = {};
  if (input.address !== undefined) data.address = input.address || null;
  if (input.phone !== undefined) data.phone = input.phone || null;
  if (input.comment !== undefined) data.comment = input.comment || null;
  await prisma.user.update({ where: { id: me.id }, data });
  revalidatePath("/buyer/profile");
  revalidatePath("/buyer");
  revalidatePath("/seller");
  revalidatePath("/agent");
  revalidatePath("/courier");
  return { ok: true };
}
