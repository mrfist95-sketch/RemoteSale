// Сборка дистрибутива OnSale: копирует исходники в dist/onsale-dist,
// исключая секреты (.env), БД, node_modules, .next, тестовые артефакты.
// Запуск: node scripts/make-dist.mjs
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "dist");
const out = join(distDir, "onsale-dist");

console.log("Сборка дистрибутива ->", out);

// 1. Очистка
rmSync(distDir, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 2. Каталоги копируем целиком (кроме мусора)
const dirs = ["src", "prisma", "public", "scripts"];
for (const d of dirs) {
  const src = join(root, d);
  if (!existsSync(src)) throw new Error(`Ожидаемый каталог отсутствует: ${d}`);
  cpSync(src, join(out, d), {
    recursive: true,
    filter: (s) =>
      !/[\\/](node_modules|\.next|\.turbo|coverage|dev\.db.*|.*\.test\.ts)$/.test(s) &&
      !/\.test\.ts$/.test(s) &&
      !/make-dist\.mjs$/.test(s), // сам сборщик в дистрибутив не нужен
  });
}

// 3. Файлы верхнего уровня
const files = [
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "vitest.config.mjs",
  "Dockerfile",
  "docker-compose.yml",
  "docker-entrypoint.sh",
  ".dockerignore",
  ".gitignore",
  ".env.example",
  "INSTALL.md",
  // README.md не включаем: в нём остались демо-доступы старого прототипа;
  // всю документацию по развёртыванию несёт INSTALL.md
];
for (const f of files) {
  const src = join(root, f);
  if (existsSync(src)) cpSync(src, join(out, f));
}

// 3b. Dockerfile дистрибутива: как оригинал, но без RUN npm test
// (тесты исключены из дистрибутива вместе с *.test.ts, а vitest без тестов завершается ошибкой)
{
  const df = readFileSync(join(root, "Dockerfile"), "utf8");
  const patched = df.replace(/\n# Прогон юнит-тестов[^\n]*\nRUN npm test\n/, "\n");
  if (patched === df) throw new Error("Не удалось убрать RUN npm test из Dockerfile — проверьте оригинал");
  writeFileSync(join(out, "Dockerfile"), patched, "utf8");
}

// ВАЖНО: prisma/dev.db в дистрибутив не попадает (только schema.prisma и seed.ts).
// Проверим, что .db случайно не скопировался:
const leaked = readdirSync(join(out, "prisma")).filter((f) => f.endsWith(".db") || f.endsWith(".db-journal"));
if (leaked.length > 0) {
  throw new Error("В дистрибутив попала база данных! Удалите: " + leaked.join(", "));
}

// 4. Сканирование на утечку секретов
// (пароль админа и dev-секреты НЕ должны попадать в дистрибутив;
//  admin@example.com в INSTALL.md/.env.example — документированный пример, не секрет)
const SECRET_MARKERS = [
  "Galer0-RM2026",
  "2aaea3bc95bd8fef2b0307082a27214c07fb4a7e409922d8cb78bb602f414fce",
  "dev-secret-change-me-in-prod",
  "password123",
  "@demo.ru",
  "admin@galero",
];
const offenders = [];
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      scan(p);
    } else if (/\.(ts|tsx|mjs|js|json|yml|sh|md|example|css|html)$|Dockerfile|dockerignore/.test(name)) {
      const content = readFileSync(p, "utf8");
      for (const marker of SECRET_MARKERS) {
        if (content.includes(marker)) offenders.push(`${p} :: ${marker}`);
      }
    }
  }
}
scan(out);

if (offenders.length > 0) {
  console.error("НАЙДЕНЫ УТЕЧКИ СЕКРЕТОВ/ДЕМО-ДАННЫХ:");
  offenders.forEach((o) => console.error("  ", o));
  throw new Error("Сборка прервана: уберите секреты из файлов дистрибутива");
}
console.log("Сканирование секретов: чисто");

// 5. Отчёт
function size(dir) {
  let total = 0;
  let files = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      const r = size(p);
      total += r.total;
      files += r.files;
    } else {
      total += st.size;
      files++;
    }
  }
  return { total, files };
}
const { total, files: fileCount } = size(out);
writeFileSync(
  join(distDir, "MANIFEST.txt"),
  `OnSale dist\nфайлов: ${fileCount}\nразмер: ${(total / 1024 / 1024).toFixed(2)} МБ\nдата: ${new Date().toISOString()}\n`,
  "utf8",
);
console.log(`Готово: ${fileCount} файлов, ${(total / 1024 / 1024).toFixed(2)} МБ`);
console.log("dist/onsale-dist + dist/MANIFEST.txt");