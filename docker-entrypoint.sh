#!/bin/sh
set -e

# Обновление схемы БД: резервная копия + baseline + `prisma migrate deploy`.
# Никогда не удаляет данные; при ошибке миграции контейнер не стартует.
node scripts/db-migrate.mjs

# Seed: создаёт администратора из ADMIN_EMAIL/ADMIN_PASSWORD (идемпотентно).
# Без пароля приложение не поднимется — это защита от "пустого" продакшена.
npm run seed

# Запускаем приложение под присмотром watchdog (контроль живости + перезапуск)
exec node scripts/watchdog.mjs
