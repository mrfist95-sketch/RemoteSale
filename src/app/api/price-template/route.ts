import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const SAMPLE = [
  { article: "A001", name: "Болт М8 оцинкованный", unit: "шт", price: 15.5, stock: 100, category: "Крепёж", manufacturer: "ООО Метиз" },
  { article: "A002", name: "Гайка М8", unit: "шт", price: 8.3, stock: 200, category: "Крепёж", manufacturer: "ООО Метиз" },
  { article: "B001", name: "Профиль 20x20", unit: "м", price: 540, stock: 80, category: "Металлопрокат", manufacturer: "Профиль-Сталь" },
  { article: "C001", name: "Краска молотковая", unit: "баллон", price: 1750, stock: 40, category: "ЛКП", manufacturer: "ХимКолор" },
];

const HEADERS_EN = ["article", "name", "unit", "price", "stock", "category", "manufacturer"];

export async function GET(req: NextRequest) {
  const me = req.headers.get("cookie"); // requireRole в route нельзя, проверим вручную ниже
  void me;
  const session = await (await import("@/lib/rbac")).getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "csv";

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "OnSale";
    const ws = wb.addWorksheet("Прайс-лист");
    ws.addRow(HEADERS_EN);
    for (const s of SAMPLE) ws.addRow([s.article, s.name, s.unit, s.price, s.stock, s.category, s.manufacturer]);
    ws.columns.forEach((col) => {
      col.width = 24;
    });
    const ab = await wb.xlsx.writeBuffer();
    return new NextResponse(ab as ArrayBuffer, {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": 'attachment; filename="pricelist-template.xlsx"',
      },
    });
  }

  // CSV: UTF-8 с BOM (чтобы Excel правильно открыл кириллицу), разделитель ;
  const csvRows = [
    HEADERS_EN.join(";"),
    ...SAMPLE.map((s) => [s.article, s.name, s.unit, s.price, s.stock, s.category, s.manufacturer].join(";")),
  ];
  // CRLF + BOM для совместимости с Excel на Windows
  const csv = "\uFEFF" + csvRows.join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="pricelist-template.csv"',
    },
  });
}