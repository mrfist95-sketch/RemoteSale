# OnSale — B2B платформа оптовых продаж

Приложение: Next.js 16 + Prisma (SQLite) + NextAuth, PWA, watchdog, Docker.
В дистрибутиве — исходный код, Docker-файлы и инструкции. Секреты и база данных **не входят** в дистрибутив.

---

## Что в комплекте

```
onsale-dist/
├── src/                  # исходный код приложения
├── prisma/               # схема БД и seed (создаёт администратора)
├── public/               # статика (иконки PWA, service worker, офлайн-страница)
├── scripts/              # watchdog.mjs, gen-icons.mjs
├── Dockerfile            # сборка образа (внутри: тесты + build + healthcheck)
├── docker-compose.yml    # запуск одной командой, volume для БД
├── docker-entrypoint.sh  # миграции + seed + watchdog
├── .env.example          # шаблон конфигурации (скопировать в .env)
├── package.json          # зависимости и скрипты
├── INSTALL.md            # ЭТА ИНСТРУКЦИЯ
└── vitest.config.mjs     # тесты (npm test)
```

---

## Способ 1 — Docker (рекомендуется)

Требования: Docker + Docker Compose v2 (Docker Desktop на Windows/macOS или docker engine на Linux).

### Шаг 1. Распаковать и настроить

```bash
# распакуйте архив, перейдите в каталог
cp .env.example .env
```

Откройте `.env` и задайте **обязательно**:

| Переменная | Что указать |
|---|---|
| `NEXTAUTH_SECRET` и `AUTH_SECRET` | случайный ключ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL` | логин администратора (например `admin@example.com`) |
| `ADMIN_PASSWORD` | пароль администратора (минимум 8 символов) |
| `NEXTAUTH_URL` | адрес, по которому будут заходить пользователи: `http://IP-сервера:3000` или домен |

### Шаг 2. Запустить

```bash
docker compose up -d --build
```

Первая сборка занимает 2–5 минут (устанавливаются зависимости, прогоняются тесты, собирается приложение). Затем:

```bash
docker compose ps        # статус: должно быть Up (healthy)
docker compose logs -f app  # логи (Ctrl+C для выхода)
```

Приложение: **http://localhost:3000** (или `http://IP-сервера:3000`).

Вход: учётные данные `ADMIN_EMAIL` / `ADMIN_PASSWORD` из `.env`. Это единственный пользователь в чистой базе — остальных сотрудников и покупателей заводит админ в разделе «Пользователи», пароли можно генерировать кнопкой.

### Шаг 3. Обновление до новой версии

```bash
docker compose down        # остановить (данные останутся в volume)
# заменить файлы дистрибутива на новые
docker compose up -d --build
```

### Полезные команды

```bash
docker compose down        # остановить, данные сохраняются
docker compose down -v     # остановить И стереть базу (осторожно!)
docker compose restart     # перезапуск
```

Данные хранятся в Docker-volume `app-data` (`/app/data/prod.db` внутри контейнера).

---

## Способ 2 — без Docker (Node.js 20+)

```bash
npm ci
cp .env.example .env        # заполнить как в таблице выше; DATABASE_URL="file:./dev.db"
npx prisma db push          # создать/обновить схему БД
npm run seed                # создать администратора из ADMIN_EMAIL/ADMIN_PASSWORD
npm run build
npm start                   # http://0.0.0.0:3000
```

Для разработки: `npm run dev`. Тесты: `npm test`. Иконки PWA: `npm run gen:icons`.

---

## Перенос данных (существующей базы)

База — один файл SQLite. Перенос = копирование файла:

```bash
# из работающего контейнера на хост:
docker compose cp app:/app/data/prod.db ./backup-$(date +%F).db

# восстановить: остановить, скопировать в volume, запустить
docker compose down
docker run --rm -v onsale_app-data:/data -v "$PWD":/src alpine cp /src/prod.db /data/prod.db
docker compose up -d
```

(имя volume может отличаться: `docker volume ls | grep app-data`)

---

## HTTPS / продакшен-заметки

- Приложение слушает порт 3000 по HTTP. Для HTTPS поставьте reverse-proxy (nginx, Traefik, Caddy) и проксируйте на `localhost:3000`; в `NEXTAUTH_URL` укажите публичный `https://...` адрес.
- PWA-установка (Add to Home Screen) и service worker требуют **HTTPS** (или localhost).
- `docker-entrypoint.sh` при каждом старте выполняет `prisma db push` (миграции) и seed (идемпотентно: если админ уже есть — ничего не меняет).
- Watchdog перезапускает приложение при падении; Docker HEALTHCHECK следит за `/api/health` и виден в `docker compose ps`.

## Безопасность — кратко

- Пароли хранятся только как bcrypt-хэши; вход ограничен rate limit'ом (4 попытки, далее блок 30с → 1м → 2м… до 1ч).
- В `.env` реальные секреты; файл исключён из git и дистрибутива.
- Демо-данных в дистрибутиве нет: чистая база содержит только администратора.