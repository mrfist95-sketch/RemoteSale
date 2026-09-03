#!/bin/sh
set -e

# Apply schema to the database (works for both SQLite and Postgres via DATABASE_URL)
npx prisma db push

# Seed:
#  - demo-режим (NEXT_PUBLIC_DEMO=true): демо-пользователи + подсказки
#  - обычный режим: только администратор из ADMIN_EMAIL/ADMIN_PASSWORD
if [ "$NEXT_PUBLIC_DEMO" = "true" ]; then
  npx tsx prisma/seed-demo.ts
else
  npm run seed
fi

# Запускаем приложение под присмотром watchdog (контроль живости + перезапуск)
exec node scripts/watchdog.mjs