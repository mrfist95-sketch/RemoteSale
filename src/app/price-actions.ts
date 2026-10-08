"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { parsePriceFile, type ParsedRow } from "@/lib/price-parse";
import { parseArticleNumber, formatArticle } from "@/lib/article";
import { z } from "zod";
import { stagedProductSchema } from "@/lib/validation";
import { roundMoney } from "@/lib/money";
import { writeTx } from "@/lib/db-lock";

export interface StagedProduct {
  article: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
  category: string;
  manufacturer: string;
}

export interface ParseResponse {
  ok: true;
  encoding: string;
  delimiter?: string;
  totalRows: number;
  skipped: number;
  products: StagedProduct[];
  categories: string[]; // уникальные категории из файла
  existingCategories: string[]; // уже в справочнике
}

export interface ApplyInput {
  products: StagedProduct[];
  // решение по каждой НОВОЙ категории: "create" | имя существующей категории
  categoryChoices: Record<string, string>;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024;

async function assertAdmin() {
  const me = await getSessionUser();
  if (!me || me.role !== "ADMIN") throw new Error("Недостаточно прав");
  return me;
}

/** Фаза 1: распарсить файл и вернуть данные + список категорий для решения */
export async function stagePriceList(
  formData: FormData,
): Promise<
  | { ok: true; data: ParseResponse }
  | { ok: false; error: string }
> {
  try {
    const me = await assertAdmin();
    void me;
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Файл не выбран");
    if (file.size > MAX_FILE_SIZE) throw new Error("Файл слишком большой (максимум 15 МБ)");

    const parsed = await parsePriceFile(file);
    if (parsed.rows.length === 0) {
      throw new Error(
        `Не найдено ни одной позиции (кодировка: ${parsed.encoding}). Проверьте колонки article/артикул и name/наименование.`,
      );
    }

    const categories = [...new Set(parsed.rows.map((r) => r.category).filter(Boolean))].sort();
    const existing = await prisma.category.findMany({
      where: { name: { in: categories } },
      select: { name: true },
    });
    const existingNames = existing.map((c) => c.name);

    return {
      ok: true,
      data: {
        ok: true,
        encoding: parsed.encoding,
        delimiter: parsed.delimiter,
        totalRows: parsed.rows.length,
        skipped: 0,
        products: parsed.rows,
        categories,
        existingCategories: existingNames,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка разбора файла" };
  }
}

/** Фаза 2: применить с решениями по категориям */
export async function applyPriceList(input: {
  products: StagedProduct[];
  categoryChoices: Record<string, "create" | string>;
}): Promise<
  | { ok: true; created: number; updated: number; categoriesCreated: number; articlesGenerated: number }
  | { ok: false; error: string }
> {
  try {
    const me = await assertAdmin();

    // Данные пришли с клиента — проверяем каждую строку заново
    const parsed = z
      .object({
        products: z.array(stagedProductSchema).max(20_000, "Слишком много позиций (максимум 20 000)"),
        categoryChoices: z.record(z.string(), z.string().max(120)),
      })
      .safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const row = typeof issue?.path[1] === "number" ? ` (строка ${issue.path[1] + 1})` : "";
      throw new Error(`${issue?.message ?? "Некорректные данные"}${row}`);
    }
    const products = parsed.data.products.map((p) => ({ ...p, price: roundMoney(p.price) }));
    const categoryChoices = parsed.data.categoryChoices;

    // Всё в одной транзакции: при ошибке на любой строке база остаётся как была
    const { created, updated, articlesGenerated, catCache } = await writeTx(
      async (tx) => {
        const catCache = new Map<string, string | null>();
        for (const [name, choice] of Object.entries(categoryChoices)) {
          const target = choice === "create" ? name : choice;
          if (!target) {
            catCache.set(name, null);
            continue;
          }
          const cat = await tx.category.upsert({ where: { name: target }, update: {}, create: { name: target } });
          catCache.set(name, cat.id);
        }
        // Категории из файла без явного решения — ищем по имени среди существующих
        for (const p of products) {
          if (p.category && !catCache.has(p.category)) {
            const cat = await tx.category.findUnique({ where: { name: p.category } });
            catCache.set(p.category, cat?.id ?? null);
          }
        }

        let created = 0;
        let updated = 0;
        let articlesGenerated = 0;
        const categoryIdOf = (p: { category: string }) => (p.category ? (catCache.get(p.category) ?? null) : null);

        // Позиции с пустым артикулом создаются всегда; артикулы — от максимума существующих
        const toCreate = products.filter((p) => !p.article);
        const toUpsert = products.filter((p) => !!p.article);
        if (toCreate.length > 0) {
          const existing = await tx.product.findMany({
            where: { article: { startsWith: "АРТ-" } },
            select: { article: true },
          });
          let current = parseArticleNumberSafe(existing.map((e) => e.article));
          for (const p of toCreate) {
            current += 1;
            await tx.product.create({
              data: {
                article: formatArticle(current),
                name: p.name,
                unit: p.unit || "шт",
                price: p.price,
                stock: p.stock,
                manufacturer: p.manufacturer || null,
                categoryId: categoryIdOf(p),
                priceListId: null,
              },
            });
            created++;
            articlesGenerated++;
          }
        }

        const existingArticles = new Set(
          (
            await tx.product.findMany({
              where: { article: { in: toUpsert.map((p) => p.article) } },
              select: { article: true },
            })
          ).map((p) => p.article),
        );
        for (const p of toUpsert) {
          const data = {
            name: p.name,
            unit: p.unit || "шт",
            price: p.price,
            stock: p.stock,
            manufacturer: p.manufacturer || null,
            categoryId: categoryIdOf(p),
          };
          if (existingArticles.has(p.article)) {
            await tx.product.update({ where: { article: p.article }, data });
            updated++;
          } else {
            await tx.product.create({ data: { article: p.article, ...data, priceListId: null } });
            existingArticles.add(p.article);
            created++;
          }
        }
        return { created, updated, articlesGenerated, catCache };
      },
      { maxWait: 10_000, timeout: 120_000 },
    );

    void me;
    revalidatePath("/admin/price-list");
    revalidatePath("/buyer/catalog");
    revalidatePath("/buyer/order/new");
    return {
      ok: true,
      created,
      updated,
      categoriesCreated: [...catCache.values()].filter(Boolean).length,
      articlesGenerated,
    };
  } catch (e) {
    console.error("[applyPriceList]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка сохранения" };
  }
}

// ---------- helpers ----------

// Максимальный номер среди артикулов формата "АРТ-N" (0, если таких нет)
function parseArticleNumberSafe(articles: (string | null)[]): number {
  let max = 0;
  for (const a of articles) {
    const n = parseArticleNumber(a);
    if (n !== null && n > max) max = n;
  }
  return max;
}