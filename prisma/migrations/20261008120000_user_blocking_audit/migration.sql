-- Миграция написана вручную: только добавление (ALTER TABLE ADD COLUMN / CREATE TABLE),
-- без пересоздания таблицы User — существующие данные и связи не затрагиваются.

-- Блокировка пользователей и версия сессии (смена пароля/блокировка завершают сессии)
ALTER TABLE "User" ADD COLUMN "blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Общий журнал действий (оплаты без заказа, управление пользователями)
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "amount" REAL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Email храним в нижнем регистре (вход без учёта регистра).
-- Обновляем только если это не создаст дубликат.
UPDATE "User" SET "email" = lower("email")
WHERE "email" <> lower("email")
  AND NOT EXISTS (SELECT 1 FROM "User" u2 WHERE u2."email" = lower("User"."email") AND u2."id" <> "User"."id");
