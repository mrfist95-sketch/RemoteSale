-- CreateTable
-- IF NOT EXISTS: идемпотентно для баз, где таблица уже создана через db push
CREATE TABLE IF NOT EXISTS "LoginEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "browser" TEXT,
    "browserVersion" TEXT,
    "os" TEXT,
    "deviceType" TEXT,
    "language" TEXT,
    "referrer" TEXT,
    "screen" TEXT,
    "viewport" TEXT,
    "timezone" TEXT,
    "platform" TEXT,
    "hardware" TEXT,
    "touch" BOOLEAN,
    "cookiesEnabled" BOOLEAN,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoginEvent_userId_idx" ON "LoginEvent"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoginEvent_email_idx" ON "LoginEvent"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoginEvent_ip_idx" ON "LoginEvent"("ip");