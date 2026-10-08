#!/bin/sh
set -e

# Обновление схемы БД: резервная копия + baseline + `prisma migrate deploy`.
# Никогда не удаляет данные; при ошибке миграции контейнер не стартует.
node scripts/db-migrate.mjs

# Seed:
#  - demo-режим (NEXT_PUBLIC_DEMO=true): демо-пользователи + подсказки
#  - обычный режим: только администратор из ADMIN_EMAIL/ADMIN_PASSWORD (идемпотентно)
if [ "$NEXT_PUBLIC_DEMO" = "true" ]; then
  npx tsx prisma/seed-demo.ts
else
  npm run seed
fi

# Запускаем приложение под присмотром watchdog (контроль живости + перезапуск)
exec node scripts/watchdog.mjs
