import Papa from "papaparse";
import ExcelJS from "exceljs";
import { normalizeArticle } from "@/lib/article";

export interface ParsedProduct {
  article: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
  category: string;
  manufacturer: string;
}

// ---------- Кодировки ----------

// Windows-1251 таблица (кириллица)
const CP1251_UPPER = "АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
const CP1251_LOWER = "абвгдежзийклмнопрстуфхцчшщъыьэюя";

const CP1251_MAP: Map<number, string> = (() => {
  const m = new Map<number, string>();
  for (let i = 0; i < 32; i++) {
    m.set(0xC0 + i, CP1251_UPPER[i]);
    m.set(0xE0 + i, CP1251_LOWER[i]);
  }
  m.set(0xA8, "Ё");
  m.set(0xB8, "ё");
  return m;
})();

function decodeCp1251(buf: Buffer): string {
  const out: string[] = [];
  for (const byte of buf) {
    out.push(CP1251_MAP.get(byte) ?? String.fromCharCode(byte));
  }
  return out.join("");
}

/** Убираем BOM, если есть */
function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Похоже ли на UTF-8 (валидная последовательность байт) */
export function looksLikeUtf8(buf: Buffer): boolean {
  let i = 0;
  let multi = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b < 0x80) {
      i += 1;
      continue;
    }
    let len = 0;
    if ((b & 0xe0) === 0xc0) len = 1;
    else if ((b & 0xf0) === 0xe0) len = 2;
    else if ((b & 0xf8) === 0xf0) len = 3;
    else return false; // недопустимый стартовый байт
    if (i + len >= buf.length) return false;
    for (let j = 1; j <= len; j++) {
      if ((buf[i + j] & 0xc0) !== 0x80) return false;
    }
    multi++;
    i += len + 1;
  }
  return multi > 0 || buf.every((b) => b < 0x80);
}

/** Декодирует буфер: BOM / UTF-8 / Windows-1251 (fallback) */
export function decodeText(buf: Buffer): { text: string; encoding: string } {
  // UTF-8 BOM
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: stripBom(buf.toString("utf8")), encoding: "utf-8-sig" };
  }
  // UTF-16 LE BOM
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.toString("utf16le").slice(1), encoding: "utf-16le" };
  }
  if (looksLikeUtf8(buf)) {
    return { text: buf.toString("utf8"), encoding: "utf-8" };
  }
  return { text: decodeCp1251(buf), encoding: "windows-1251" };
}

/** Детекция разделителя CSV: ; , \t по первой содержательной строке */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const candidates = [";", ",", "\t", "|"];
  let best = ";";
  let bestCount = 0;
  for (const d of candidates) {
    const c = line.split(d).length - 1;
    if (c > bestCount) {
      bestCount = c;
      best = d;
    }
  }
  return best;
}

/** Парсинг CSV с автодетекцией делимитера */
export function parseCsv(text: string): Record<string, unknown>[] {
  const delimiter = detectDelimiter(text);
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimiter,
  });
  return res.data;
}

/** ExcelJS-лист -> массив объектов (заголовок -> значение) */
export function wsToRows(ws: ExcelJS.Worksheet): Record<string, unknown>[] {
  const headerRow = ws.getRow(1);
  const headers = new Map<number, string>();
  headerRow.eachCell((cell, col) => {
    const h = String(cell.value ?? "").trim();
    if (h) headers.set(col, h);
  });

  const rows: Record<string, unknown>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers.get(col);
      if (!key) return;
      const raw = cell.value;
      let val: unknown = raw;
      if (val !== null && typeof val === "object") {
        if (val instanceof Date) val = val.toISOString();
        else if (typeof (val as { text?: unknown }).text === "string") {
          val = (val as { text?: string }).text;
        } else if (typeof (val as { result?: unknown }).result !== "undefined") {
          val = (val as { result?: unknown }).result;
        } else if (typeof (val as { href?: unknown }).href !== "undefined") {
          val = String((val as { href?: unknown }).href ?? "");
        }
      }
      if (val !== null && val !== undefined && val !== "") {
        obj[key] = val;
        hasValue = true;
      }
    });
    if (hasValue) rows.push(obj);
  });
  return rows;
}

// ---------- Маппинг колонок (RU/EN) ----------

function normalizeKey(k: string): string {
  return k.toLowerCase().trim().replace(/["\u00ab\u00bb]/g, "");
}

export function mapRow(
  row: Record<string, unknown>,
): (ParsedProduct & { rawCategory: string }) | null {
  const keys = new Map<string, string>();
  for (const k of Object.keys(row)) keys.set(normalizeKey(k), k);

  const pick = (...names: string[]): string | undefined => {
    for (const n of names) {
      const key = keys.get(n);
      if (key !== undefined) {
        const v = row[key];
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
      }
    }
    return undefined;
  };

  const article = normalizeArticle(pick("article", "артикул", "артикул товара", "code", "sku", "код"));
  const name = pick("name", "наименование", "товар", "title");
  if (!name) return null;

  const priceRaw = pick("price", "цена", "стоимость", "cost") ?? "0";
  const stockRaw = pick("stock", "остаток", "количество", "qty", "count") ?? "0";
  const unit = pick("unit", "единица", "ед. изм", "ед.изм", "ед изм", "uom") ?? "шт";
  const category = pick("category", "категория", "товарная категория", "группа", "group") ?? "";
  const manufacturer =
    pick("manufacturer", "производитель", "бренд", "brand", "vendor", "поставщик") ?? "";

  return {
    article: article ?? "", // пустой артикул допустим — сгенерируется при применении
    name,
    unit,
    price: Number(String(priceRaw).replace(/\s/g, "").replace(",", ".")) || 0,
    stock: Math.max(0, Math.floor(Number(String(stockRaw).replace(/\s/g, "").replace(",", ".")) || 0)),
    category,
    manufacturer,
    rawCategory: category,
  };
}

// ---------- Публичный API ----------

export interface ParsedRow {
  article: string;
  name: string;
  unit: string;
  price: number;
  stock: number;
  category: string;
  manufacturer: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  encoding: string;
  delimiter?: string;
}

export async function parsePriceFile(file: File): Promise<ParseResult> {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.name.toLowerCase().split(".").pop();

  let rows: Record<string, unknown>[] = [];
  let encoding = "";
  let delimiter: string | undefined;

  if (ext === "csv") {
    const { text, encoding: enc } = decodeText(buf);
    encoding = enc;
    rows = parseCsv(text);
    delimiter = detectDelimiter(text);
  } else if (ext === "xlsx" || ext === "xls") {
    const wb = new ExcelJS.Workbook();
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    await wb.xlsx.load(ab as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("В файле нет листов");
    rows = wsToRows(ws);
    encoding = "xlsx";
  } else {
    throw new Error("Поддерживаются только CSV и XLSX");
  }

  const mapped = rows
    .map(mapRow)
    .filter((r): r is NonNullable<ReturnType<typeof mapRow>> => r !== null)
    .map(({ rawCategory, ...rest }) => ({ ...rest, category: rawCategory }));
  return { rows: mapped, encoding, delimiter };
}