// Генерация артикула счётчиком: АРТ-000001, АРТ-000002...
// Чистая функция — легко покрыть тестами.

export const ARTICLE_PREFIX = "АРТ-";
export const ARTICLE_PAD = 6;

/** Следующий артикул по максимальному существующему номеру (null-значения игнорируются) */
export function nextArticle(existing: (string | null | undefined)[]): string {
  let max = 0;
  for (const a of existing) {
    const n = parseArticleNumber(a);
    if (n !== null && n > max) max = n;
  }
  return formatArticle(max + 1);
}

/** "АРТ-000123" -> 123; чужие форматы/пустые -> null */
export function parseArticleNumber(article: string | null | undefined): number | null {
  if (!article) return null;
  if (!article.startsWith(ARTICLE_PREFIX)) return null;
  const num = Number(article.slice(ARTICLE_PREFIX.length));
  return Number.isInteger(num) && num > 0 ? num : null;
}

export function formatArticle(n: number): string {
  return `${ARTICLE_PREFIX}${String(n).padStart(ARTICLE_PAD, "0")}`;
}

/** Нормализация введённого артикула: trim; пустая строка -> null */
export function normalizeArticle(input: string | null | undefined): string | null {
  const s = (input ?? "").trim();
  return s === "" ? null : s;
}