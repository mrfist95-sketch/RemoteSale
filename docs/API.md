# OnSale — справочник вызовов

Два вида интерфейсов: **server actions** (вся запись данных) и несколько **HTTP-маршрутов** `/api/*`. Чтение данных идёт напрямую из серверных компонентов (`page.tsx`) через Prisma и `src/lib/stats.ts` и отдельного API не имеет.

## 1. Соглашения server actions

* Файлы: `src/app/actions.ts`, `src/app/price-actions.ts`; вызываются из клиентских компонентов как обычные async-функции.
* Возврат: `ActionResult<T>` = `{ ok: true, ...T } | { ok: false, error: string }`. Текст `error` можно показывать пользователю как есть.
* Порядок внутри каждого действия: сессия → роль → zod-валидация → проверка прав на запись → транзакция (изменение + журнал) → сброс кэша страниц.
* Клиент: `const r = unwrap(await changeOrderStatus(id, "SHIPPED"))` — при `ok:false` бросит `Error(error)`, который показывается через `toast.error`.
* Общие ошибки для всех действий: «Сессия истекла — войдите заново», «Недостаточно прав», «Запись не найдена — обновите страницу», «Данные одновременно меняет другой пользователь. Повторите операцию.», «Внутренняя ошибка…».
* Все изменения заказов/оплат сериализуются через `writeTx` (очередь записи, см. ARCHITECTURE §7).

Обозначения ролей: B — BUYER, A — AGENT, S — SELLER, C — COURIER, ADM — ADMIN.

## 2. Заказы

| Действие | Роли | Аргументы | Возвращает |
|---|---|---|---|
| `createOrder(buyerId, items, note?)` | B, A, ADM | `items: {productId, qty}[]` | `{ number }` |
| `submitOrder(orderId)` | B, A, ADM | | `{}` |
| `cancelOrder(orderId)` | B, A, ADM | | `{}` |
| `changeOrderStatus(orderId, status)` | S, ADM, C | | `{}` |
| `bulkChangeStatus(orderIds, status)` | S, ADM | до 5000 id | `{ changed, skipped: string[] }` |
| `editOrderItems({orderId, items, reason})` | S, ADM | `items: {orderItemId, qty}[]` | `{ total, removed, changes }` |
| `markOrderDeleted(orderId, deleted)` | ADM | | `{}` |

**createOrder.** Покупатель заказывает только за себя; агент — только за закреплённых покупателей (`agentId` заказа = агент); админ — за любого. Покупатель не должен быть заблокирован. Повторы позиций суммируются, позиции с qty=0 отбрасываются, нужна хотя бы одна. Товар должен существовать и не быть удалённым (иначе «Некоторые товары сняты с продажи…»). Цена и название копируются в позицию (снимок). Создаётся заказ в статусе `NEW` с записью в `OrderStatusLog`. Номер — `max+1`; при гонке — до 5 повторов.

**submitOrder / cancelOrder.** Доступ только к своему заказу (покупатель) или заказу своего покупателя (агент). Передача в работу — только из `NEW` в `ENTERED`. Отмена — только из `NEW`/`ENTERED`.

**changeOrderStatus.** Допустимость перехода определяет `transitionError` (ARCHITECTURE §8), в том числе: курьер — только `SHIPPED→DELIVERED`; в `PAID` и из `PAID` вручную нельзя; `CANCELLED` — без оплат, восстановление только ADM. Каждая смена пишется в `OrderStatusLog`.

**bulkChangeStatus.** Применяет `changeOrderStatus` к каждому заказу в **отдельной** транзакции; заказы, которым переход запрещён, пропускаются и возвращаются в `skipped` в виде `"№123: причина"`, остальные меняются.

**editOrderItems.** Только `NEW/ENTERED/ASSEMBLED`. `reason` обязателен (из справочника `OrderEditReason` или свой текст). Пересчитывает `total`, пишет `order_edited` в `OrderAuditLog`, при необходимости пересчитывает статус `PAID`. Ошибки: «Нет изменений», «Нельзя удалить все позиции — отмените заказ», «По заказу уже оплачено … больше новой суммы».

## 3. Оплаты (S, ADM)

| Действие | Аргументы | Возвращает |
|---|---|---|
| `createPayment({buyerId?, orderId?, amount, method?, note?})` | `method`: `card` (по умолч.), `cash`, `invoice` | `{}` |
| `correctPayment({paymentId, amount?, method?, note?, reason})` | `reason` ≥ 3 символов | `{}` |
| `deletePayment(paymentId, reason)` | `reason` ≥ 3 символов | `{}` |

* `createPayment` **с `orderId`**: заказ в статусе `ASSEMBLED/SHIPPED/DELIVERED`, сумма ≤ остатка долга по заказу (иначе ошибка с точным остатком). Если `buyerId` передан, он должен совпадать с покупателем заказа. После записи — `syncPaymentStatus` (при полной оплате заказ становится `PAID`, в `OrderStatusLog` запись «Полная оплата»). **Без `orderId`**: нужен `buyerId` покупателя; запись в `AuditLog`.
* `correctPayment` / `deletePayment`: продавец — только оплаты, внесённые сегодня (по `Asia/Novosibirsk`); админ — любые. Пишут `payment_edited` / `payment_deleted` в `OrderAuditLog` (если оплата привязана к заказу) или в `AuditLog`. После изменения статус заказа пересчитывается: оплат стало меньше суммы → откат из `PAID`; оплат стало больше суммы → отказ.
* Все суммы: > 0, ≤ 1 000 000 000, округление до копеек.

## 4. Пользователи (только ADM)

| Действие | Аргументы / правила |
|---|---|
| `createUser({email, name?, password, role, agentId?, address?, phone?, comment?, deferral?})` | email уникален (без учёта регистра), пароль 8–128 символов, `agentId` — только для BUYER и только пользователь-AGENT, `deferral` 0–365 дней |
| `updateUser(id, {name?, role?, agentId?, password?, address?, phone?, comment?, deferral?})` | смена роли: не себе, не последнему активному админу; смена пароля увеличивает `sessionVersion` (старые сессии выбрасываются); пишет `AuditLog: user_updated` |
| `setUserBlocked(id, blocked)` | блокировка: не себя, не последнего админа; увеличивает `sessionVersion`; `AuditLog: user_blocked/unblocked` |
| `deleteUser(id)` | нельзя: себя, последнего админа, пользователя с заказами/оплатами/прайс-листами (его блокируют); `AuditLog: user_deleted` |

Все четыре возвращают `{}`; в журнал `createUser` пишет `user_created`.

## 5. Каталог (только ADM)

| Действие | Аргументы | Возвращает |
|---|---|---|
| `createProduct({name, article?, unit?, price?, stock?, manufacturer?, categoryId?})` | пустой артикул → «АРТ-N+1»; занятый → ошибка | `{ id, article }` |
| `updateProduct(id, {name?, price?, stock?, unit?, categoryId?, manufacturer?})` | | `{}` |
| `deleteProducts(ids)` | мягкое удаление (скрыть) | `{ count }` |
| `restoreProducts(ids)` | вернуть | `{ count }` |
| `hardDeleteProducts(ids)` | физическое удаление; товары с историей заказов пропускаются | `{ count, skipped, skippedMessage? }` |
| `createCategory(name)` / `renameCategory(id, name)` / `deleteCategory(id)` | удаление отвязывает товары (категория → null) | `{ id }` / `{}` |
| `mergeCategories(sourceId, targetId)` | товары переносятся в target, source удаляется | `{}` |
| `createEditReason(name)` / `deleteEditReason(id)` | справочник причин корректировки | `{}` |

Изменение цены не затрагивает уже созданные заказы (снимок в `OrderItem`).

## 6. Импорт прайс-листа (только ADM; `price-actions.ts`)

Эти два действия возвращают `{ ok:true, ... } | { ok:false, error }` (без `UserError`).

| Действие | Что делает | Возвращает |
|---|---|---|
| `stagePriceList(formData)` | поле `file` (CSV/XLSX ≤ 15 МБ) → разбор без записи в БД | `{ ok, data: { encoding, delimiter?, totalRows, skipped, products[], categories[], existingCategories[] } }` |
| `applyPriceList({products, categoryChoices})` | повторная валидация каждой строки; одна транзакция (таймаут 120 с); `categoryChoices[имя] = "create" \| имя_существующей \| ""` | `{ ok, created, updated, categoriesCreated, articlesGenerated }` |

Поля строки: `article` (может быть пустым), `name` (обязательно), `unit`, `price` (≥ 0), `stock` (целое ≥ 0), `category`, `manufacturer`. Максимум 20 000 строк.

## 7. Профиль

`updateBuyerProfile({address?, phone?, comment?})` — роль BUYER, меняет только свой профиль → `{}`.

## 8. HTTP-маршруты

| Маршрут | Метод | Доступ | Назначение |
|---|---|---|---|
| `/api/health` | GET | открыт | `200 {ok:true, db:"ok", ts}`; `503 {ok:false, db:"error"}`, если не отвечает БД (`SELECT 1`). Используют Docker healthcheck и watchdog |
| `/api/auth/*` | GET/POST | NextAuth | вход (`/api/auth/callback/credentials`), выход, сессия (`/api/auth/session`), CSRF |
| `/api/auth-status` | POST `{email}` | открыт | `{blocked, retryAfterSec, attemptsLeft}` — состояние лимита попыток для формы входа; без секретов |
| `/api/price-template` | GET `?format=csv\|xlsx` | ADMIN (иначе 403) | шаблон прайс-листа (CSV — UTF-8 с BOM, разделитель `;`) |

## 9. Как добавить новое действие

1. Добавьте zod-схему в `src/lib/validation.ts`.
2. В `actions.ts` напишите функцию по каркасу `run(async () => { assertRole → parse → writeTx → журнал → revalidate })`. Бизнес-правила, не требующие БД, выносите в чистые функции (как `order-rules.ts`) и покрывайте тестами.
3. На клиенте вызывайте через `unwrap()` и показывайте ошибки через `toast`.
4. Добавьте тест в `src/actions.integration.test.ts` (проверьте: чужая роль, чужая запись, неверные данные, гонка).
5. Если действие меняет данные, видимые на страницах, добавьте `revalidatePath`.
