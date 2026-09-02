"use server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { parsePriceFile, type ParsedRow } from "@/lib/price-parse";
import { parseArticleNumber, formatArticle } from "@/lib/article";

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

    // Резолвим категории согласно решениям пользователя
    const catCache = new Map<string, string | null>();
    for (const [name, choice] of Object.entries(input.categoryChoices)) {
      if (choice === "create") {
        const cat = await prisma.category.upsert({
          where: { name },
          update: {},
          create: { name },
        });
        catCache.set(name, cat.id);
      } else if (choice && choice !== "create") {
        // объединение с существующей — choice содержит имя целевой категории
        const cat = await prisma.category.upsert({
          where: { name: choice },
          update: {},
          create: { name: choice },
        });
        catCache.set(name, cat.id);
      } else {
        catCache.set(name, null);
      }
    }

    let created = 0;
    let updated = 0;
    let articlesGenerated = 0;

    // Позиции с пустым артикулом создаются всегда (счётчиком), обновлять нечего
    const toCreate = input.products.filter((p) => !p.article);
    const toUpsert = input.products.filter((p) => !!p.article);

    // Генерация артикулов: от максимума существующих, по одному на пустую позицию
    if (toCreate.length > 0) {
      const existing = await prisma.product.findMany({
        where: { article: { startsWith: "АРТ-" } },
        select: { article: true },
      });
      let current = parseArticleNumberSafe(existing.map((e) => e.article));
      for (const p of toCreate) {
        current += 1;
        const article = formatArticle(current);
        await prisma.product.create({
          data: {
            article,
            name: p.name,
            unit: p.unit,
            price: p.price,
            stock: p.stock,
            manufacturer: p.manufacturer || null,
            categoryId: p.category ? (catCache.get(p.category) ?? null) : null,
            priceListId: null,
          },
        });
        created++;
        articlesGenerated++;
      }
    }

    for (const p of toUpsert) {
      const data = {
        name: p.name,
        unit: p.unit,
        price: p.price,
        stock: p.stock,
        manufacturer: p.manufacturer || null,
        categoryId: p.category ? (catCache.get(p.category) ?? null) : null,
      };
      const existing = await prisma.product.findUnique({ where: { article: p.article } });
      if (existing) {
        await prisma.product.update({ where: { article: p.article }, data });
        updated++;
      } else {
        await prisma.product.create({
          data: { article: p.article, ...data, priceListId: null },
        });
        created++;
      }
    }

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