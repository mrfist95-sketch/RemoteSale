# SalesRemote — B2B платформа продаж

Веб-приложение для оптовых продаж товаров по прайс-листу. 5 ролей с раздельным доступом.

## Стек

- **Next.js 16** (App Router, TypeScript) — фронтенд и API в одном проекте
- **Prisma 6** + **SQLite** (локально) / **Postgres** (в Docker, через `DATABASE_URL`)
- **Auth.js (NextAuth v4)** — аутентификация и RBAC по полю `role`
- **Tailwind CSS**, **Recharts** (графики), **papaparse** + **xlsx** (загрузка прайс-листа)

## Роли и права

| Роль | Возможности |
|------|-------------|
| Покупатель | Каталог, оформление заказа из прайс-листа, отмена необработанных заказов, история оплат, задолженность, статистика |
| Торговый агент | Закреплённые клиенты, оформление заказа за клиента, статистика продаж/долгов в разрезе клиентов |
| Продавец | Очередь заказов, смена статусов, оплаты, статистика |
| Аналитик | Только агрегированная статистика по периодам (read-only) |
| Администратор | Всё выше + управление пользователями/ролями, загрузка/правка прайс-листа |

Статусы заказа: `Новый → Внесён → Собран → Отгружен → Оплачен`. `Отменён` — только до обработки продавцом.

## Демо-доступы (пароль для всех: `password123`)

- admin@demo.ru — Администратор
- seller@demo.ru — Продавец
- agent@demo.ru — Торговый агент
- buyer1@demo.ru / buyer2@demo.ru — Покупатели
- analyst@demo.ru — Аналитик

## Локальный запуск (Windows / Linux)

```bash
npm install
cp .env .env.local   # при необходимости
npx prisma generate
npx prisma migrate dev   # или: npx prisma db push
npm run seed             # демо-данные (пользователи, прайс-лист, заказы)
npm run dev             # http://localhost:3000
```

Переменные в `.env`:
- `DATABASE_URL="file:./dev.db"` — для Postgres укажите `postgresql://...`
- `NEXTAUTH_SECRET` / `AUTH_SECRET` — секрет сессий (сгенерируйте свой)
- `NEXTAUTH_URL` — базовый URL

## Запуск через Docker (перенос на Ubuntu)

```bash
docker compose up --build
```

Контейнер сам применит схему (`prisma db push`), заполнит демо-данные и запустит приложение на `:3000`.
База (SQLite) хранится в volume `app-data` — перенос на другой хост = копия `docker-compose.yml` + volume.
Для Postgres: замените `DATABASE_URL` в `docker-compose.yml` на строку подключения и добавьте сервис `db`.

## Структура

```
src/
  app/
    (auth)/login        — вход
    buyer|agent|seller|analyst|admin  — кабинеты по ролям
    api/auth/[...nextauth] — Auth.js handler
    actions.ts, price-actions.ts      — server actions (мутации)
  lib/   prisma, auth, rbac, stats, format
  components/  AppShell, charts, формы заказов/оплат/прайс-листа
prisma/  schema.prisma, seed.ts, migrations/
```
