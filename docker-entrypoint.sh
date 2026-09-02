#!/bin/sh
set -e

# Apply schema to the database (works for both SQLite and Postgres via DATABASE_URL)
npx prisma db push --accept-data-loss

# Seed: создаёт администратора из ADMIN_EMAIL/ADMIN_PASSWORD.
# Без пароля приложение не поднимется — это защита от "пустого" продакшена.
npm run seed

# Запускаем приложение под присмотром watchdog (контроль живости + перезапуск)
exec node scripts/watchdog.mjs