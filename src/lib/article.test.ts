import { describe, it, expect } from "vitest";
import { nextArticle, parseArticleNumber, formatArticle, normalizeArticle, ARTICLE_PREFIX } from "@/lib/article";

describe("normalizeArticle", () => {
  it("пустая строка/пробелы/null -> null", () => {
    expect(normalizeArticle("")).toBeNull();
    expect(normalizeArticle("   ")).toBeNull();
    expect(normalizeArticle(null)).toBeNull();
    expect(normalizeArticle(undefined)).toBeNull();
  });
  it("обрезает пробелы", () => {
    expect(normalizeArticle(" A-1 ")).toBe("A-1");
  });
});

describe("formatArticle / parseArticleNumber", () => {
  it("формат АРТ-XXXXXX", () => {
    expect(formatArticle(1)).toBe("АРТ-000001");
    expect(formatArticle(123456)).toBe("АРТ-123456");
    expect(formatArticle(1234567)).toBe("АРТ-1234567"); // не обрезаем
  });
  it("парсинг своих артикулов", () => {
    expect(parseArticleNumber("АРТ-000042")).toBe(42);
    expect(parseArticleNumber("АРТ-7")).toBe(7);
  });
  it("чужой формат -> null", () => {
    expect(parseArticleNumber("A-001")).toBeNull();
    expect(parseArticleNumber("")).toBeNull();
    expect(parseArticleNumber("АРТ-abc")).toBeNull();
  });
});

describe("nextArticle: счётчик по максимуму", () => {
  it("пустая база -> АРТ-000001", () => {
    expect(nextArticle([])).toBe("АРТ-000001");
  });
  it("продолжает с максимального", () => {
    expect(nextArticle(["АРТ-000001", "АРТ-000007", "A-XX"])).toBe("АРТ-000008");
    // А-XX не парсится и не мешает
  });
  it("максимум только среди артикулов формата АРТ-", () => {
    expect(nextArticle(["АРТ-000009", "АРТ-000003"])).toBe("АРТ-000010");
  });
  it("пропуски не используются повторно", () => {
    expect(nextArticle(["АРТ-000005"])).toBe("АРТ-000006");
  });
  it("префикс константен", () => {
    expect(ARTICLE_PREFIX).toBe("АРТ-");
  });
});