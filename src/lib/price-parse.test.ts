import { describe, it, expect } from "vitest";
import { decodeText, detectDelimiter, parseCsv, mapRow, looksLikeUtf8 } from "@/lib/price-parse";

function cp1251(str: string): Buffer {
  const upper = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
  const lower = "абвгдежзийклмнопрстуфхцчшщъыьэюя";
  const map = new Map<string, number>();
  for (let i = 0; i < 32; i++) {
    map.set(lower[i], 0xe0 + i);
    map.set(upper[i], 0xc0 + i);
  }
  map.set("ё", 0xb8);
  map.set("Ё", 0xa8);
  const bytes: number[] = [];
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    if (code < 128) bytes.push(code);
    else if (map.has(ch)) bytes.push(map.get(ch)!);
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}

describe("decodeText: кодировки CSV", () => {
  it("UTF-8 с BOM", () => {
    const buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("артикул;цена", "utf8")]);
    const r = decodeText(buf);
    expect(r.encoding).toBe("utf-8-sig");
    expect(r.text).toContain("артикул");
  });

  it("UTF-8 без BOM", () => {
    const r = decodeText(Buffer.from("article;price;name\nA1;Болт;10", "utf8"));
    expect(r.encoding).toBe("utf-8");
    expect(r.text).toContain("Болт");
  });

  it("Windows-1251 (1С/Excel рус-локаль)", () => {
    const buf = cp1251("артикул;наименование;цена\r\nTST001;Болт оцинкованный;15,50");
    const r = decodeText(buf);
    expect(r.encoding).toBe("windows-1251");
    expect(r.text).toContain("артикул");
    expect(r.text).toContain("Болт оцинкованный");
  });

  it("UTF-16 LE с BOM (экспорт из Excel)", () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("article;price\r\nA1;5", "utf16le")]);
    const r = decodeText(buf);
    expect(r.encoding).toBe("utf-16le");
    expect(r.text).toContain("article");
  });
});

describe("detectDelimiter", () => {
  it("точка с запятой", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
  });
  it("запятая", () => {
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
  });
  it("табуляция", () => {
    expect(detectDelimiter("a\tb\tc\n1\t2\t3")).toBe("\t");
  });
});

describe("parseCsv", () => {
  it("парсит с ; и кириллицей", () => {
    const rows = parseCsv("артикул;наименование;цена\r\nA1;Болт;10");
    expect(rows).toHaveLength(1);
    expect(rows[0]["артикул"]).toBe("A1");
   });
});

describe("mapRow: маппинг RU/EN колонок", () => {
  it("русские заголовки + категория + производитель", () => {
    const r = mapRow({
      "артикул": "T1",
      "наименование": "Болт М8",
      "ед. изм": "шт",
      "цена": "15,50",
      "остаток": "100",
      "товарная категория": "Крепёж",
      "производитель": "ООО Метиз",
    });
    expect(r).not.toBeNull();
    expect(r!.article).toBe("T1");
    expect(r!.price).toBeCloseTo(15.5);
    expect(r!.stock).toBe(100);
    expect(r!.rawCategory).toBe("Крепёж");
    expect(r!.manufacturer).toBe("ООО Метиз");
  });

  it("английские заголовки + бренд", () => {
    const r = mapRow({ article: "X1", name: "Washer", unit: "pc", price: "3.2", stock: "50", category: "Fasteners", brand: "ACME" });
    expect(r!.rawCategory).toBe("Fasteners");
    expect(r!.manufacturer).toBe("ACME");
  });

  it("без категории и производителя — пустые строки", () => {
    const r = mapRow({ article: "X2", name: "Гайка" });
    expect(r!.rawCategory).toBe("");
    expect(r!.manufacturer).toBe("");
  });

  it("артикул необязателен: без него строка принимается с пустым article", () => {
    const r = mapRow({ name: "Винт", price: "5", article: "" });
    expect(r).not.toBeNull();
    expect(r!.article).toBe("");
    expect(r!.name).toBe("Винт");
  });

  it("артикул из одних пробелов трактуется как пустой", () => {
    const r = mapRow({ name: "Винт", article: "   " });
    expect(r!.article).toBe("");
  });

  it("без наименования строка отбрасывается даже с артикулом", () => {
    expect(mapRow({ article: "A", price: "1" })).toBeNull();
  });
});

describe("looksLikeUtf8", () => {
  it("cp1251 байты кириллицы не валидный utf-8", () => {
    expect(looksLikeUtf8(cp1251("Болт"))).toBe(false);
  });
  it("utf-8 кириллица валидна", () => {
    expect(looksLikeUtf8(Buffer.from("Болт", "utf8"))).toBe(true);
  });
  it("чистый ASCII валиден", () => {
    expect(looksLikeUtf8(Buffer.from("abc;123"))).toBe(true);
  });
});