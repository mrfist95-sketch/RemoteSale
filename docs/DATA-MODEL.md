# OnSale — модель данных

Источник истины — `prisma/schema.prisma`. БД — SQLite (файл `/app/data/prod.db` в Docker, `prisma/dev.db` при локальной разработке). Строковые «перечисления» (роль, статус, метод оплаты) хранятся как `String`; допустимые значения контролируются кодом (`rbac-core.ts`, `validation.ts`).

## Таблицы

### User
| Поле | Тип | Примечание |
|---|---|---|
| id | String (cuid) | PK |
| email | String, unique | всегда в нижнем регистре |
| name | String? | |
| passwordHash | String | bcrypt |
| role | String | `BUYER` `AGENT` `SELLER` `COURIER` `ANALYST` `ADMIN` |
| agentId | String? | для покупателя — закреплённый агент (ссылка на User) |
| address, phone, comment | String? | профиль покупателя |
| deferral | Int, по умолч. 0 | отсрочка оплаты, дней |
| createdAt | DateTime | |
| blocked | Boolean | вход запрещён, сессии сброшены |
| sessionVersion | Int | растёт при смене пароля/блокировке — старые сессии недействительны |

### PriceList / Product / Category
* `PriceList` (fileName, status `active|archived`, uploadedBy) — исторический след загрузок; товары, импортируемые сейчас, создаются с `priceListId = null`.
* `Product`: `article` (unique, необязателен; автогенерация «АРТ-000001»), `name`, `unit` (по умолч. «шт»), `price` (Float), `stock` (Int), `manufacturer`, `deleted` (мягкое удаление — скрыт из каталога и форм заказа), `categoryId`, индексы по категории, производителю, `deleted`.
* `Category`: `name` unique.

### Order
`number` (Int, unique — сквозной номер), `buyerId`, `agentId` (агент, оформивший заказ; null, если оформлял сам покупатель/админ), `status`, `total` (Float, пересчитывается при корректировке), `note`, `deleted` (пометка на удаление — скрыт из списков и отчётов), `createdAt`, `updatedAt`. Индексы: buyer, status, agent, createdAt.

### OrderItem
`orderId` (каскадное удаление), `productId`, **снимок** `name`, `qty` (Float), **снимок** `price` на момент заказа.

### Payment
`buyerId`, `orderId?` (null — оплата без заказа), `amount`, `date`, `method` (`card` `cash` `invoice`), `note`, `createdById`, `createdAt`, `updatedAt`.

### OrderStatusLog
`orderId` (каскад), `status`, `changedAt`, `changedById?`, `note?`. Журнал смен статусов, по нему определяется «статус до оплаты» при откате из `PAID`.

### OrderAuditLog
`orderId` (каскад), `action` (`payment_added` `payment_edited` `payment_deleted` `order_edited`), `details`, `amount?`, `userId?`, `createdAt`.

### AuditLog
Общий журнал: `entity` (`payment`, `user` …), `entityId`, `action` (`payment_added/edited/deleted`, `user_created`, `user_updated`, `user_blocked`, `user_unblocked`, `user_deleted`), `details`, `amount?`, `userId?` (при удалении автора → NULL), `createdAt`. Индексы `[entity, entityId]`, `[createdAt]`.

### OrderEditReason
Справочник причин корректировки (`name` unique); редактирует администратор. Начальные значения создаёт seed: «Нет на складе», «Пересорт», «Ошибка клиента», «Замена по согласованию».

## Связи

```
User(agent) ─1:N─ User(buyer)            agentId
User(buyer) ─1:N─ Order, Payment
User(agent) ─1:N─ Order (agentId)
Order ─1:N─ OrderItem ─N:1─ Product ─N:1─ Category
Order ─1:N─ Payment, OrderStatusLog, OrderAuditLog   (логи удаляются вместе с заказом)
User ─1:N─ AuditLog, PriceList
```

## Инварианты (поддерживаются кодом, не схемой)

1. `Order.total` = Σ `qty × price` по позициям, округлено до копеек.
2. Σ `Payment.amount` по заказу ≤ `Order.total` (с допуском 0.005).
3. `status = PAID` ⇔ заказ оплачен полностью (в допустимых для оплаты статусах).
4. Нельзя отменить заказ с оплатами; нельзя удалить пользователя с заказами/оплатами/прайсами — его блокируют.
5. В системе всегда остаётся хотя бы один активный администратор (нельзя заблокировать/удалить/понизить последнего; нельзя менять роль и блокировать самого себя).
6. Агентом покупателя может быть только пользователь с ролью `AGENT`; агент не бывает у не-покупателя.
7. Товар с историей заказов физически не удаляется (только мягкое удаление).

## Миграции

Папка `prisma/migrations/`:

| Миграция | Что делает |
|---|---|
| `20260828031841_init` | baseline: схема базы «как была» (создана раньше через `db push`) |
| `20261008120000_user_blocking_audit` | аддитивная: `User.blocked`, `User.sessionVersion`, таблица `AuditLog` + индексы, email → нижний регистр |

Как менять схему — см. [`OPERATIONS.md`](OPERATIONS.md#3-изменение-схемы-бд).
