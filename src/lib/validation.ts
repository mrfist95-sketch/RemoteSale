// Схемы входных данных server actions. Любой аргумент action — это данные
// от клиента, поэтому проверяем типы, диапазоны и длины на сервере.
import { z } from "zod";
import { ROLES } from "@/lib/rbac-core";
import { UserError } from "@/lib/action-result";

const id = z.string().trim().min(1, "Не указан идентификатор").max(64);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Не длиннее ${max} символов`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email("Некорректный email");

export const passwordSchema = z
  .string()
  .min(8, "Пароль — минимум 8 символов")
  .max(128, "Пароль слишком длинный");

export const roleSchema = z.enum(Object.values(ROLES) as [string, ...string[]], {
  error: "Недопустимая роль",
});

const deferral = z.coerce
  .number()
  .int("Отсрочка — целое число дней")
  .min(0, "Отсрочка не может быть отрицательной")
  .max(365, "Отсрочка — не больше 365 дней");

export const money = z.coerce
  .number({ error: "Сумма должна быть числом" })
  .positive("Сумма должна быть больше 0")
  .max(1_000_000_000, "Слишком большая сумма");

const qty = z.coerce
  .number({ error: "Количество должно быть числом" })
  .int("Количество — целое число")
  .min(0)
  .max(1_000_000, "Слишком большое количество");

export const paymentMethod = z.enum(["card", "cash", "invoice"]).default("card");

export const createOrderSchema = z.object({
  buyerId: id,
  items: z
    .array(z.object({ productId: id, qty }))
    .max(2000, "Слишком много позиций"),
  note: optText(1000),
});

export const createPaymentSchema = z.object({
  buyerId: id.optional(),
  orderId: id.optional(),
  amount: money,
  method: paymentMethod,
  note: optText(500),
});

export const correctPaymentSchema = z.object({
  paymentId: id,
  amount: money.optional(),
  method: z.enum(["card", "cash", "invoice"]).optional(),
  note: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(3, "Укажите причину корректировки").max(500),
});

export const reasonSchema = z.string().trim().min(3, "Укажите причину").max(500);

export const createUserSchema = z.object({
  email: emailSchema,
  name: optText(120),
  password: passwordSchema,
  role: roleSchema,
  agentId: id.nullish(),
  address: optText(300),
  phone: optText(50),
  comment: optText(1000),
  deferral: deferral.default(0),
});

export const updateUserSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: roleSchema.optional(),
  agentId: id.nullish().or(z.literal("")),
  password: passwordSchema.optional().or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(50).optional(),
  comment: z.string().trim().max(1000).optional(),
  deferral: deferral.optional(),
});

export const buyerProfileSchema = z.object({
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(50).optional(),
  comment: z.string().trim().max(1000).optional(),
});

const price = z.coerce.number({ error: "Цена должна быть числом" }).min(0, "Цена не может быть отрицательной").max(1_000_000_000);
const stock = z.coerce.number({ error: "Остаток должен быть числом" }).int("Остаток — целое число").min(0).max(1_000_000_000);

export const productUpdateSchema = z.object({
  name: z.string().trim().min(1, "Введите наименование").max(300).optional(),
  price: price.optional(),
  stock: stock.optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  categoryId: id.nullish().or(z.literal("")),
  manufacturer: z.string().trim().max(200).nullish(),
});

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "Введите наименование").max(300),
  article: z.string().trim().max(64).optional(),
  unit: z.string().trim().max(20).optional(),
  price: price.optional(),
  stock: stock.optional(),
  manufacturer: z.string().trim().max(200).optional(),
  categoryId: id.nullish(),
});

export const stagedProductSchema = z.object({
  article: z.string().trim().max(64),
  name: z.string().trim().min(1, "Пустое наименование").max(300),
  unit: z.string().trim().max(20),
  price,
  stock: z.coerce.number({ error: "Остаток должен быть числом" }).min(0).max(1_000_000_000).transform((v) => Math.floor(v)),
  category: z.string().trim().max(120),
  manufacturer: z.string().trim().max(200),
});

export const editOrderItemsSchema = z.object({
  orderId: id,
  items: z.array(z.object({ orderItemId: id, qty })).max(2000),
  reason: z.string().trim().min(1, "Укажите причину корректировки").max(500),
});

export const idList = z.array(id).min(1, "Не выбрано ни одной позиции").max(5000);
export const nameSchema = (what: string) => z.string().trim().min(1, `Введите ${what}`).max(120);

/** Разобрать вход по схеме; ошибка валидации → UserError с первым сообщением */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw new UserError(issue?.message || "Некорректные данные");
  }
  return r.data;
}
