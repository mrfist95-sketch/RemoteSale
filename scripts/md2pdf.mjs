// Конвертация docs/*.md -> PDF через Edge headless
// Markdown парсим простым встроенным конвертером (без зависимостей).
import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const DOCS = join(process.cwd(), "docs");
const TMP = join(process.cwd(), "docs", ".tmp");
const OUT = join(process.cwd(), "docs", "pdf");

mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });

// ---------- минимальный md -> html ----------
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inCode = false;
  let codeLang = "";
  let codeBuf = [];
  let listType = null; // "ul" | "ol"
  let inTable = false;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };
  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (/^```/.test(line)) {
      if (inCode) {
        out.push(`<pre class="code"><code>${esc(codeBuf.join("\n"))}</code></pre>`);
        inCode = false;
        codeBuf = [];
      } else {
        closeList();
        closeTable();
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(raw);
      continue;
    }

    if (/^\s*$/.test(line)) {
      closeList();
      closeTable();
      continue;
    }

    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      closeTable();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      closeList();
      closeTable();
      out.push('<hr class="sep"/>');
      continue;
    }

    if (/^\|/.test(line)) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (/^\|[\s:|-]+\|$/.test(line)) continue; // разделитель шапки
      if (!inTable) {
        closeList();
        out.push('<table class="tbl"><tbody>');
        inTable = true;
        out.push(`<tr class="head">${cells.map((c) => `<th>${inline(c)}</th>`).join("")}</tr>`);
      } else {
        out.push(`<tr>${cells.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`);
      }
      continue;
    }
    closeTable();

    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        out.push("<ul>");
        listType = "ul";
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        out.push("<ol>");
        listType = "ol";
      }
      out.push(`<li>${inline(ol[2])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  closeTable();
  if (inCode) out.push(`<pre class="code"><code>${esc(codeBuf.join("\n"))}</code></pre>`);
  return out.join("\n");
}

const CSS = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: "Segoe UI", "Arial", sans-serif;
  font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; margin: 0;
}
h1 { font-size: 17pt; color: #0b2545; margin: 0 0 4pt; border-bottom: 2.5pt solid #0b2545; padding-bottom: 6pt; }
h2 { font-size: 13pt; color: #0b2545; margin: 16pt 0 6pt; }
h3 { font-size: 11pt; color: #333; margin: 12pt 0 4pt; }
h4 { font-size: 10.5pt; margin: 10pt 0 4pt; }
p { margin: 5pt 0; }
ul, ol { margin: 5pt 0; padding-left: 18pt; }
li { margin: 2.5pt 0; }
hr.sep { border: none; border-top: 0.6pt solid #ccc; margin: 12pt 0; }
code {
  font-family: Consolas, monospace; font-size: 9.5pt;
  background: #f2f4f7; padding: 0.5pt 3pt; border-radius: 2pt;
}
pre.code {
  background: #f2f4f7; border: 0.6pt solid #d8dde3; border-radius: 4pt;
  padding: 7pt 9pt; overflow-x: hidden; page-break-inside: avoid;
}
pre.code code { background: none; padding: 0; font-size: 9pt; line-height: 1.35; }
table.tbl { border-collapse: collapse; width: 100%; margin: 7pt 0; page-break-inside: avoid; }
table.tbl th, table.tbl td { border: 0.6pt solid #c9ced4; padding: 4pt 6pt; text-align: left; vertical-align: top; }
table.tbl tr.head th { background: #eef1f5; color: #0b2545; font-weight: 600; }
table.tbl td { background: #fff; }
strong { color: #000; }
a { color: #0b2545; text-decoration: none; }
`;

// ---------- конвертация ----------
const files = readdirSync(DOCS).filter((f) => f.endsWith(".md") && !f.startsWith("."));
if (files.length === 0) throw new Error("В docs/ нет *.md файлов");

for (const f of files) {
  const md = readFileSync(join(DOCS, f), "utf8");
  const title = /^#\s+(.+)$/m.exec(md)?.[1] ?? f;
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${mdToHtml(md)}</body></html>`;

  const htmlPath = join(TMP, basename(f, ".md") + ".html");
  writeFileSync(htmlPath, html, "utf8");

  const pdfPath = join(OUT, basename(f, ".md") + ".pdf");
  execFileSync(EDGE, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    `--print-to-pdf=${pdfPath}`,
    "--no-pdf-header-footer",
    `file:///${htmlPath.replace(/\\/g, "/")}`,
  ], { timeout: 60000, stdio: "ignore" });

  console.log("PDF:", pdfPath);
}

rmSync(TMP, { recursive: true, force: true });
console.log("PDF_READY:", OUT);