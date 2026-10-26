// Безопасное обновление схемы БД при старте контейнера (вместо `prisma db push --accept-data-loss`).
//  1. Если база уже есть — делаем её копию в <папка базы>/backups/pre-migrate-<время>.db (хранятся 10 последних).
//  2. Если база создана старым способом (db push) и истории миграций нет — помечаем базовую
//     миграцию как применённую (baseline): её схема совпадает с такой базой.
//  3. Применяем только недостающие миграции: `prisma migrate deploy`. Он никогда не удаляет данные
//     сам по себе и падает, если миграция не проходит, — тогда приложение не стартует, а копия остаётся.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const BASELINE = "20260828031841_init";
const KEEP_BACKUPS = 10;

function log(msg) {
  console.log(`[db-migrate] ${msg}`);
}

function dbFile() {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("file:")) return null; // не SQLite — только migrate deploy
  const p = url.slice("file:".length).split("?")[0];
  // Относительные пути Prisma считает от папки со schema.prisma
  return path.isAbsolute(p) ? p : path.resolve("prisma", p);
}

function prisma(...args) {
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", ...args], { stdio: "inherit" });
}

function backup(file) {
  const dir = path.join(path.dirname(file), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(dir, `pre-migrate-${ts}.db`);
  fs.copyFileSync(file, dest);
  log(`backup: ${dest}`);
  const old = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("pre-migrate-") && f.endsWith(".db"))
    .sort()
    .reverse()
    .slice(KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(dir, f));
  return dest;
}

async function inspect() {
  const client = new PrismaClient();
  try {
    const tables = await client.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
    const names = new Set(tables.map((t) => t.name));
    let userCols = new Set();
    if (names.has("User")) {
      const cols = await client.$queryRawUnsafe(`PRAGMA table_info("User")`);
      userCols = new Set(cols.map((c) => c.name));
    }
    let applied = 0;
    if (names.has("_prisma_migrations")) {
      const r = await client.$queryRawUnsafe(
        "SELECT count(*) AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL",
      );
      applied = Number(r[0].n);
    }
    return { names, userCols, applied };
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const file = dbFile();
  let backupPath = null;
  if (file && fs.existsSync(file) && fs.statSync(file).size > 0) {
    backupPath = backup(file);
    const { names, userCols, applied } = await inspect();
    if (names.has("User") && applied === 0) {
      log(`existing database without migration history — baseline ${BASELINE}`);
      prisma("migrate", "resolve", "--applied", BASELINE);
      if (userCols.has("blocked") && userCols.has("sessionVersion") && names.has("AuditLog")) {
        // База уже приведена к новой схеме через db push — отмечаем и следующую миграцию
        prisma("migrate", "resolve", "--applied", "20261008120000_user_blocking_audit");
      }
    }
  } else {
    log("new database — creating schema from migrations");
  }

  try {
    prisma("migrate", "deploy");
  } catch (e) {
    console.error("[db-migrate] MIGRATION FAILED. Database was not modified beyond the failed step.");
    if (backupPath) console.error(`[db-migrate] Pre-migration copy: ${backupPath}`);
    throw e;
  }
  log("schema is up to date");
}

main().catch(() => process.exit(1));
