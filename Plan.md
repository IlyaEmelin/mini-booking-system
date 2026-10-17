# Plan.md: 4.3.3 Слой данных (slots, bookings, notifications)

Источник требований — `spec.md`, правила работы агента — `AGENTS.md`, документация запуска — `README.md`.
Обязательный цикл проекта: `spec.md` → **`Plan.md`** → `AGENTS.md` → Code → Check → `README.md`.

## 1. Текущий статус

- Приоритет: P0.
- Исходное состояние: цикл `4.3.2 auth-lite` закрыт (шаг 14), в локальной базе есть `User` и `Session`, работают регистрация, вход, серверная сессия, роли и контур аккаунта. Моделей `Slot`, `Booking`, `Notification` в проекте нет.
- Цель цикла: собрать серверный слой данных для слотов, броней и внутренних уведомлений — Prisma-контракт, миграции, seed слотов, модули доступа к данным, статусы и серверные инварианты.
- Ограничение объёма: не реализовывать пользовательский booking flow (страницы слотов, формы создания/переноса/отмены брони, экран уведомлений), административные функции, внешние каналы (email, SMS, calendar, desktop), deploy и новые зависимости.
- Контекстные файлы: `spec.md`, `Plan.md`, `AGENTS.md`; финальный runbook — `README.md`.
- `README.md` на шаге 0 может описывать предыдущую фазу; он обновляется только на шаге 8 после реализации и проверок.
- Следующий шаг: **Шаг 6 «Собрать серверный модуль уведомлений»** — `todo`. Шаг 5 закрыт.
- Предыдущая проверка: Шаг 4 — `app/lib/slots.ts` возвращает только будущие слоты по возрастанию `startsAt`, считает `activeBookings` (`pending` + `confirmed`) и `availableCapacity`, для неизвестного id — `null`; `tests/slots.test.ts` на тестовой базе проверил прошедший слот, сортировку, вместимость, отменённую бронь, прошедший слот с `isUpcoming = false` и `null`; `npx tsc --noEmit`, `npm run lint`, `npm run build` — exit 0; `npm test` — 16/16 дважды.
- Последняя проверка: Шаг 5 — `app/lib/bookings.ts` создаёт бронь только для `actor.id` на будущий свободный слот, проверяет дубль раньше вместимости, блокирует слот через `FOR UPDATE`, создаёт `pending` и `booking_created` в одной транзакции; `cancelBooking`/`confirmBooking` блокируют бронь, проверяют роль по базе и допустимый переход, пишут `cancelledAt`/`confirmedAt` и уведомление в той же транзакции; `listMyBookings` фильтрует только по `actor.id`; временный smoke-скрипт (удалён после прогона) на тестовой базе прошёл все доменные коды, изоляцию и конкурентный сценарий `capacity = 1` — ровно одна успешная бронь, вторая получила `SLOT_FULL`; `npx tsc --noEmit`, `npm run lint`, `npm run build` — exit 0; `npm test` — 16/16.

- История 4.3.2: подробные шаги, проверки и журнал — в Git (`b42f50e` — итоговая проверка, `8bda8e0` — runbook, `96701d9` — автотесты и очистка сессий, `563ecc1` — проверки ролей и аккаунт, `1ab4383` — сессия и выход).

## 1.1 Исходное состояние (проверено)

- `prisma/schema.prisma` (`// use prisma-8`): `enum Role`, `User` (email unique, `passwordHash`, `displayName?`, `role`, `createdAt`, `updatedAt`, `sessions`) и `Session` (`tokenHash` unique, `userId` с `onDelete: Cascade`, `expiresAt`, `createdAt`, индексы `userId` и `expiresAt`).
- `prisma/seed.ts`: идемпотентный ровно один `super_admin` из `SEED_SUPER_ADMIN_EMAIL` и `SEED_SUPER_ADMIN_PASSWORD`; пароль проверяется по политике 8–72 символа и 72 байта UTF-8; `bcryptjs.hash(password, 12)`.
- `app/lib/`: `db.ts` (единственный клиент Prisma), `env.ts`, `password.ts`, `session.ts`, `auth.ts` (`getCurrentUser`, `requireUser`, `requireRole`), `validation.ts`; все серверные модули помечены `import "server-only"`.
- `app/account/page.tsx`: данные текущего пользователя и статические блоки «Мои записи» и «Уведомления» с пометкой «появится позже».
- `tests/`: `test-env.ts` (отдельная база `mini-booking-system_test`, `override: true`) и `auth.test.ts` (11 проверок, 5 наборов).
- npm-скрипты: `dev`, `build`, `start`, `lint`, `postinstall`, `db:migrate` (`prisma migration plan` + `prisma db migrate`), `db:seed` (`tsx prisma/seed.ts`), `sessions:cleanup`, `test` (`tsx --test tests/**/*.test.ts`).
- Версии Prisma: CLI `8.0.0-rc.22`, клиент `@prisma/orm-postgres` `8.0.0-rc.18`, обе записи точные; `@prisma/client` не используется.
- Команды Prisma 8: `npx prisma contract emit`, `npx prisma migration plan --name <slug>`, `npx prisma db migrate` (в том числе `--db <url>` и `--advance-ref <name>`), `npx prisma db verify`, `npx prisma migration status`; команд `prisma migrate dev` и `prisma db seed` нет.
- Проверенное состояние базы разработки: `User` и `Session` созданы, `npx prisma db verify` — `Database marker and schema match contract`, `npx prisma migration status` — `Up to date`.

## 1.2 Целевой сценарий

1. Зафиксировать в `spec.md` модели `Slot`, `Booking`, `Notification`, статусы брони и серверные инварианты.
2. Обновить `AGENTS.md` под фазу `4.3.3`: разрешить слой данных, но не UI booking flow и не административные функции.
3. Расширить `prisma/schema.prisma` моделями и перечислениями, эмитировать контракт.
4. Создать и применить миграцию с CHECK-ограничениями, внешними ключами, индексами и уникальностью активной брони.
5. Расширить `prisma/seed.ts`: слоты начиная с завтрашнего дня на 7 дней вперёд, идемпотентно, рядом с существующим `super_admin`.
6. Собрать серверный модуль слотов: список будущих слотов и расчёт доступной вместимости.
7. Собрать серверный модуль броней: создание, подтверждение, отмена и допустимые переходы статусов.
8. Собрать серверный модуль уведомлений: создание в транзакции брони, чтение только своих, отметка прочитанным.
9. Покрыть слой данных автотестами на отдельной тестовой базе.
10. Обновить `README.md` и пройти финальные проверки.

## 2. Требования к результату

- `spec.md` описывает `Slot`, `Booking`, `Notification`, перечисления `BookingStatus` и `NotificationType`, ER-связи, правила переходов и серверные инварианты.
- `Plan.md` ведёт работу маленькими проверяемыми шагами и обновляется после каждого пункта.
- `AGENTS.md` разрешает работу со слоем данных и запрещает выходить за границы фазы без отдельной задачи.
- В `prisma/schema.prisma` есть модели `Slot`, `Booking`, `Notification` и связи с `User`; контракт эмитируется без диагностик.
- Миграция создаёт таблицы, CHECK `endsAt > startsAt`, CHECK `capacity > 0`, внешние ключи, индексы и частичный уникальный индекс активной брони.
- `npm run db:seed` идемпотентно создаёт слоты начиная с завтрашнего дня на 7 дней вперёд и не дублирует существующие; `super_admin` создаётся как раньше.
- `app/lib/slots.ts` возвращает будущие слоты с вместимостью и числом активных броней; расчёт доступности серверный.
- `app/lib/bookings.ts` создаёт бронь только для текущего пользователя, только на будущий слот и только при свободной вместимости; повторная активная бронь того же пользователя на тот же слот отклоняется.
- Статусы брони: `pending` при создании, `confirmed` после подтверждения, `cancelled` после отмены; `cancelled` — конечный статус, недопустимые переходы отклоняются.
- Подтверждение брони доступно только роли `admin` или `super_admin` и только как серверная функция слоя данных; маршрута, формы, Server Action и API для неё нет.
- Пользователь видит и отменяет только свои брони; чужие брони и уведомления недоступны.
- Уведомление создаётся в той же транзакции, что и создание, подтверждение или отмена брони, и адресуется владельцу брони; внешние каналы не подключаются.
- `app/lib/notifications.ts` отдаёт только уведомления текущего пользователя и позволяет отметить своё уведомление прочитанным.
- `npm test` покрывает слоты, создание и отмену брони, вместимость, переходы статусов, изоляцию владельца и уведомления; прогон не меняет базу разработки.
- `README.md` объясняет новые команды, seed слотов, статусы и границы фазы.
- Пользовательский booking flow, административные функции, OAuth, email, SMS, calendar, desktop-уведомления, deploy и новые зависимости не добавляются.

## 3. Цикл выполнения (один активный пункт)

Работа идёт строго по одному активному пункту `Plan.md`:

1. Взять из раздела «Следующий активный пункт» ровно один шаг, остальные не начинать.
2. Выполнить действие только этого шага, не забегая в следующий.
3. Запустить проверку, записанную в этом шаге, и сохранить её фактический вывод.
4. Перевести чек-боксы шага из `[ ]` в `[x]`, только если проверка пройдена.
5. Записать в поля шага `Статус`, `Проверка`, `Ошибки`, `Следующий шаг` и добавить строку в журнал (раздел 8).
6. Перевести «Следующий активный пункт» на следующий шаг — и только затем начинать следующий пункт.

Статусы: `todo` — не начат, `in_progress` — активный, `done` — проверка пройдена, `blocked` — есть блокер, который фиксируется в поле `Ошибки`.

Если на шаге появляется блокер, следующий шаг не начинается: блокер фиксируется в `Plan.md`, а шаг либо решается, либо эскалируется разработчику.

Шаг считается завершённым только после выполнения команды проверки, записанной в этом плане.

## 4. Следующий активный пункт

**Следующий активный пункт: Шаг 3 «Расширить seed слотами» — `todo`.**

Основание: Шаг 2 закрыт — миграция `20261017T1509_data_layer` применена к dev- и test-базе, `db verify` подтверждает контракт `storageHash 2c4bfdd…`, `migration status` — `Up to date`.
Правило порядка: шаг 3 меняет только `prisma/seed.ts`; DAL, тесты и `README.md` начинаются только после проверки идемпотентного seed.
Ограничение шага: не менять `prisma/schema.prisma`, `prisma/migrations/`, `app/`, `tests/`, `package.json` и `README.md`; новых зависимостей и переменных окружения не вводить (NFR-9, CR-26). Команды Prisma 8 и seed сверять по `package.json` и `npx prisma --help`.

## 5. Шаги

### Шаг 0. Обновить `spec.md` под слой данных — `done`

- [x] Описать модели `Slot`, `Booking`, `Notification`, перечисления `BookingStatus` и `NotificationType`, ER-связи и правила владения.
- [x] Зафиксировать статусы брони и допустимые переходы: `pending` → `confirmed`/`cancelled`, `confirmed` → `cancelled`, `cancelled` — конечный.
- [x] Зафиксировать серверные инварианты: будущий слот, свободная вместимость, одна активная бронь пользователя на слот, владелец из сессии, уведомление в транзакции.
- [x] Обновить матрицу ролей, структуру файлов, поток данных и критерии готовности `CR-33`…`CR-41`.
- [x] Обновить `AGENTS.md` под фазу `4.3.3` и снять прежний запрет на `slots/bookings/notifications`.
- Действие: зафиксировать требования слоя данных до написания кода.
- Результат: `spec.md` — источник требований для Prisma-схемы, seed, DAL и автотестов; `AGENTS.md` задаёт границы фазы.
- Проверка: в `spec.md` есть `Slot`, `Booking`, `Notification`, `BookingStatus`, `NotificationType`, ER-диаграмма, таблица переходов, инварианты и `CR-33`…`CR-41`; `AGENTS.md` содержит фазу `4.3.3` и запрет на UI booking flow, административные функции и внешние каналы; `Plan.md` не содержит активного пункта 4.3.2; `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm test` — exit 0 (11/11); `git diff --check` — без замечаний.
- Статус: `done`.
- Ошибки: нет.
- Следующий шаг: Шаг 1.

### Шаг 1. Расширить Prisma-контракт — `done`

- [x] Добавить `enum BookingStatus { pending confirmed cancelled }` и `enum NotificationType { booking_created booking_confirmed booking_cancelled }`.
- [x] Добавить `Slot`: `id`, `startsAt`, `endsAt`, `capacity` (`Int`, по умолчанию 1), `createdAt`, `updatedAt`, связь `bookings`; уникальность `[startsAt, endsAt]`, индекс по `startsAt`.
- [x] Добавить `Booking`: `id`, `userId`, `slotId`, `status` (`@default(pending)`), `createdAt`, `updatedAt`, `confirmedAt?`, `cancelledAt?`; связи `user` (`onDelete: Cascade`) и `slot` (`onDelete: Restrict`), индексы `[userId, status]` и `[slotId, status]`.
- [x] Добавить `Notification`: `id`, `userId`, `bookingId?`, `type`, `message`, `readAt?`, `createdAt`; связи `user` (`onDelete: Cascade`) и `booking` (`onDelete: SetNull`), индексы `[userId, readAt]` и `[bookingId]`.
- [x] Дополнить `User` связями `bookings Booking[]` и `notifications Notification[]`.
- [x] Объявить частичный уникальный индекс активной брони в PSL: ``@@index([userId, slotId], unique: true, where: sql`status IN ('pending', 'confirmed')`, name: "Booking_active_user_slot_key")``; проверить, что он попал в контракт.
- [x] Объявить CHECK-ограничения в PSL: ``@@check(expression: sql`"endsAt" > "startsAt"`, name: "Slot_endsAt_after_startsAt")`` и ``@@check(expression: sql`"capacity" > 0`, name: "Slot_capacity_positive")``; quoted identifiers обязательны, иначе PostgreSQL ищет `endsat`/`startsat`; проверить, что они попали в контракт.
- [x] Использовать spelling Prisma 8: `@default(cuid(2))`, `temporal.createdAtJsDate()`, `temporal.updatedAtJsDate()`, `temporal.timestamptzJsDate()`; для nullable-дат — `TimestamptzJsDate?`, потому что preset `temporal.timestamptzJsDate()` не принимает `?`.
- [x] Изменять только `prisma/schema.prisma` и эмитированные артефакты контракта; не создавать миграцию, seed, DAL, тесты и не менять `README.md`.
- Действие: описать слой данных в PSL и эмитировать контракт.
- Результат: контракт содержит три модели, два перечисления, типы связей, индексы и CHECK-ограничения; база пока не меняется.
- Проверка: `npx prisma contract emit` — успешно, без диагностик (первичный emit — `storageHash a8a421d6…`; после исправления CHECK в шаге 2 — `storageHash 2c4bfdd…`, `executionHash a7fc921b…`, `profileHash 3916f444…`); в `prisma/contract.json` есть таблицы `Booking`, `Notification`, `Slot` и value sets `BookingStatus`, `NotificationType`; индекс `Booking_active_user_slot_key_b8a2666e` имеет `unique: true` и `where: "status IN ('pending','confirmed')"`; CHECK `Slot_capacity_positive_a3711091` и `Slot_endsAt_after_startsAt_20c1ac54` присутствуют; в `prisma/contract.d.ts` есть типы `Slot`, `Booking`, `Notification`, статус `'pending' | 'confirmed' | 'cancelled'` и nullable-даты с кодеком `pg/timestamptz-date@1`; `npx tsc --noEmit` — exit 0; `npm run lint` — exit 0; `npm run build` — exit 0; `npm test` — 11/11, exit 0; новых файлов миграции, seed, DAL и тестов нет (`git status` показывает только `AGENTS.md`, `Plan.md`, `spec.md`, `prisma/schema.prisma`, `prisma/contract.json`, `prisma/contract.d.ts`); `git diff --check` — без замечаний (только предупреждения LF/CRLF).
- Статус: `done`.
- Ошибки: первый emit отклонён с `PSL_PRESET_NOT_OPTIONAL` для `temporal.timestamptzJsDate()?` в `Booking.confirmedAt`, `Booking.cancelledAt`, `Notification.readAt`; поля переведены на `TimestamptzJsDate?`, повторный emit прошёл.
- Следующий шаг: Шаг 2.

### Шаг 2. Создать и применить миграцию — `done`

- [x] `npx prisma migration plan --name data_layer`; проверить `ops.json` и `migration.ts`.
- [x] Проверить, что миграция создаёт CHECK-ограничения `"endsAt" > "startsAt"` и `"capacity" > 0`, внешние ключи и индексы из PSL; вручную SQL не дублировать.
- [x] Проверить, что планировщик создаёт частичный уникальный индекс активной брони из PSL (`Booking_active_user_slot_key_b8a2666e`, `WHERE status IN ('pending','confirmed')`); вручную SQL не дублировать, иначе `db verify` увидит лишний индекс.
- [x] Применить миграцию к базе разработки: `npx prisma db migrate --advance-ref db`; затем `npm run db:migrate` — no-op; тестовую базу мигрировать `npx prisma db migrate --db "<url из .env.test>"`.
- [x] Проверить ограничения через `psql` и `npx prisma db verify`/`npx prisma migration status`.
- Действие: применить контракт к PostgreSQL с ограничениями целостности.
- Результат: таблицы `Slot`, `Booking`, `Notification` созданы; недопустимые интервалы, вместимость и вторая активная бронь отклоняются базой; тестовая база мигрирована тем же пакетом.
- Проверка: пакет `prisma/migrations/app/20261017T1509_data_layer` (`from e4cd210… → to 2c4bfdd…`, 17 ops, 0 placeholders) применён к dev- и test-базе; `npx prisma db verify` на обеих базах — `Database marker and schema match contract`; `npx prisma migration status` — `Up to date`; `npm run db:migrate` — `No changes detected` / `Already up to date`; `npx prisma migration check` — `All checks passed`; в `ops.json`/`migration.ts` есть `CHECK ("capacity" > 0)`, `CHECK ("endsAt" > "startsAt")`, CHECK статуса/типа, 4 FK, 9 индексов и `CREATE UNIQUE INDEX ... WHERE (status IN ('pending', 'confirmed'))`; `psql` показывает 29 строк ограничений (включая NOT NULL) и 13 строк индексов (включая PK и unique), а транзакционный сценарий — отказ для `endsAt <= startsAt`, `capacity = 0` и второй активной брони при допустимой `cancelled`; `npx tsc --noEmit`, `npm run lint`, `npm run build` — exit 0; `npm test` — 11/11, exit 0.
- Статус: `done`.
- Ошибки: первый `db migrate` упал с `MIGRATION.RUNNER_FAILED`: CHECK из PSL был без quoted identifiers, PostgreSQL искал `endsat`; транзакция откатилась. Исправлено на `"endsAt" > "startsAt"` и `"capacity" > 0`, контракт переэмитирован (`storageHash 2c4bfdd…`). Повторный `npm run db:migrate` после явного `migration plan` создал форк-дубль `20261017T1508_migration`; оба старых пакета и snapshot `a8a421d…` удалены, миграция пересобрана как `20261017T1509_data_layer`, ref `db` продвинут через `--advance-ref db`.
- Следующий шаг: Шаг 3.

### Шаг 3. Расширить seed слотами — `done`

- [x] Оставить существующее создание/обновление ровно одного `super_admin`.
- [x] Добавить идемпотентное создание слотов начиная с завтрашнего дня на 7 дней вперёд: два окна в день (10:00 и 15:00 UTC), длительность 60 минут, `capacity = 1`.
- [x] Не дублировать слоты: искать по уникальной паре `[startsAt, endsAt]` и создавать только отсутствующие.
- [x] Выводить в консоль количество созданных и уже существующих слотов; не удалять существующие слоты и брони.
- [x] Не добавлять новых переменных окружения и зависимостей.
- Действие: наполнить базу воспроизводимыми слотами.
- Результат: `npm run db:seed` создаёт 14 будущих слотов (7 дней × 2 окна, 10:00/15:00 UTC, 60 минут, `capacity = 1`); повторный запуск не создаёт дубликатов и не удаляет слоты и брони; `super_admin` остаётся один.
- Проверка: `npm run db:seed` трижды — 14 → «создано 0, уже было 14» → количество `Slot` не изменилось; `psql` — 14 слотов, окна 10:00/15:00 UTC, интервалы 60 минут, `capacity = 1`, `super_admin = 1`; `npx prisma db verify`; `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm test` — 11/11; `git diff --check` — exit 0.
- Статус: `done`.
- Ошибки: проверочный `psql` в Windows сначала потерял кавычки идентификаторов (`отношение "slot" не существует`); это ошибка команды проверки, а не seed — SQL повторён через stdin (`psql -f -`) и прошёл. Код seed ошибок не дал.
- Следующий шаг: Шаг 4.

### Шаг 4. Собрать серверный модуль слотов — `done`

- [x] Создать `app/lib/slots.ts` с `import "server-only"`.
- [x] Реализовать `listUpcomingSlots(now = new Date())`: только слоты с `startsAt > now`, сортировка по `startsAt`.
- [x] Реализовать `getSlotAvailability(slotId, now = new Date())`: слот, число активных броней (`pending` + `confirmed`), свободная вместимость; для несуществующего слота — `null`.
- [x] Не принимать идентификатор пользователя: модуль не раскрывает чужие данные и не используется клиентскими компонентами.
- [x] Закрывать соединение с базой в тестах и скриптах, а не в модуле приложения.
- Действие: дать серверный API чтения слотов и их доступности.
- Результат: `app/lib/slots.ts` отдаёт будущие слоты с `activeBookings` и `availableCapacity`; `tests/slots.test.ts` проверяет список, доступность и `null` для неизвестного id на отдельной тестовой базе.
- Проверка: `npx tsc --noEmit`, `npm run lint`, `npm run build` — exit 0; `npm test` — 16/16, exit 0; повторный `npm test` — 16/16 (идемпотентность тестовой очистки); `git diff --check` — exit 0. Для последовательного доступа тестовых файлов к одной тестовой базе `npm test` запускается с `--test-concurrency=1`; имена скриптов не изменились.
- Статус: `done`.
- Ошибки: —
- Следующий шаг: Шаг 5.

### Шаг 5. Собрать серверный модуль броней и переходы — `done`

- [x] Создать `app/lib/bookings.ts` с `import "server-only"`; функции принимают `actor` типа `SessionUser`, которого в приложении возвращает только `requireUser()`, а не идентификатор из формы.
- [x] Реализовать `createBooking(actor, slotId)`: слот существует, `startsAt > now`, `capacity > 0`, активных броней меньше вместимости, у пользователя нет активной брони на этот слот.
- [x] Выполнять проверку вместимости и вставку атомарно в транзакции с блокировкой слота; при гонке двух запросов лишняя бронь не создаётся и частичный уникальный индекс не нарушается.
- [x] Создавать бронь со статусом `pending` и уведомление `booking_created` в той же транзакции.
- [x] Реализовать `cancelBooking(actor, bookingId)`: владелец или `admin`/`super_admin`, только `pending`/`confirmed`; выставить `cancelled`, `cancelledAt` и создать `booking_cancelled`.
- [x] Реализовать `confirmBooking(actor, bookingId)`: только `admin`/`super_admin`, только `pending`; выставить `confirmed`, `confirmedAt` и создать `booking_confirmed`. Маршрут, форма, Server Action и API не создаются.
- [x] Реализовать `listMyBookings(actor)` только по `actor.id`; вернуть слот, статус и даты без чужих данных.
- [x] Запретить переходы `cancelled` → любой, `confirmed` → `pending`, повторное подтверждение и повторную отмену; вернуть стабильные коды ошибок (`SLOT_NOT_FOUND`, `SLOT_IN_PAST`, `SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `BOOKING_NOT_FOUND`, `FORBIDDEN`, `INVALID_TRANSITION`).
- Действие: реализовать создание, подтверждение, отмену и чтение броней с серверными инвариантами.
- Результат: `app/lib/bookings.ts` — серверный модуль с `BookingError` и стабильными кодами; `createBooking` блокирует слот (`FOR UPDATE`), проверяет дубль раньше вместимости и в одной транзакции вставляет `pending` и `booking_created`; `cancelBooking` и `confirmBooking` блокируют строку брони, читают текущую роль из базы, разрешают только допустимые переходы и пишут уведомление в той же транзакции; `listMyBookings` ограничен `actor.id`. Локальный helper уведомлений остаётся в модуле броней; его вынесение в `app/lib/notifications.ts` — шаг 6.
- Проверка: временный smoke-скрипт (удалён после прогона) на тестовой базе проверил создание, `SLOT_NOT_FOUND`, `SLOT_IN_PAST`, `SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `FORBIDDEN`, `INVALID_TRANSITION`, изоляцию `listMyBookings`, типы уведомлений и конкурентное создание на слоте `capacity = 1` (ровно одна успешная бронь, вторая — `SLOT_FULL`, активных броней не больше одной); `npx tsc --noEmit`, `npm run lint`, `npm run build` — exit 0; `npm test` — `tests 16 / suites 7 / pass 16 / fail 0`; `git diff --check` — exit 0.
- Статус: `done`.
- Ошибки: нет; промежуточные замечания TypeScript по nullable-связи слота и неиспользуемому типу устранены до финальных проверок.
- Следующий шаг: Шаг 6.

### Шаг 6. Собрать серверный модуль уведомлений — `todo`

- [ ] Создать `app/lib/notifications.ts` с `import "server-only"`.
- [ ] Реализовать `listMyNotifications(actor)`: только `userId = actor.id`, сортировка от новых к старым, вернуть `type`, `message`, `bookingId`, `readAt`, `createdAt`.
- [ ] Реализовать `markNotificationRead(actor, notificationId)`: только своё уведомление; `readAt` выставляется один раз, повторный вызов идемпотентен.
- [ ] Реализовать внутренний `createNotification(tx, ...)`, который вызывается только из транзакций броней; отдельного публичного создания уведомлений нет.
- [ ] Вернуть `NOTIFICATION_NOT_FOUND` для неизвестного уведомления и `FORBIDDEN` для чужого.
- [ ] Не отправлять email, SMS, calendar и desktop-уведомления; не добавлять внешние сервисы.
- Действие: дать серверный API внутренних уведомлений, создаваемых вместе с бронью.
- Результат: каждое изменение брони оставляет внутреннее уведомление владельцу; чужие уведомления недоступны.
- Проверка: после создания, подтверждения и отмены брони у владельца появляются уведомления соответствующих типов; чужой пользователь их не видит и не может отметить прочитанными; повторная отметка не меняет `readAt`.
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 7.

### Шаг 7. Добавить автотесты слоя данных — `todo`

- [ ] Добавить `tests/data-layer.test.ts` (или разделить на `slots-bookings.test.ts` и `notifications.test.ts`); использовать `tests/test-env.ts` и отдельную базу `mini-booking-system_test`.
- [ ] Покрыть seed слотов: два запуска, отсутствие дубликатов, будущие даты и `capacity`.
- [ ] Покрыть слоты: только будущие, сортировка, остаток вместимости, `null` для неизвестного слота.
- [ ] Покрыть создание брони: успех, прошедший слот, заполненная вместимость, повторная активная бронь, `userId` только из actor.
- [ ] Покрыть переходы: `pending` → `confirmed`/`cancelled`, `confirmed` → `cancelled`, запрет `cancelled` → любой, запрет подтверждения ролью `user`.
- [ ] Покрыть изоляцию: чужую бронь не видно, чужая отмена запрещена, чужие уведомления не читаются и не отмечаются.
- [ ] Покрыть уведомления: `booking_created`, `booking_confirmed`, `booking_cancelled`, идемпотентная отметка `readAt`.
- [ ] Покрыть доменные коды: `SLOT_NOT_FOUND`, `SLOT_IN_PAST`, `SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `BOOKING_NOT_FOUND`, `FORBIDDEN`, `INVALID_TRANSITION`, `NOTIFICATION_NOT_FOUND`.
- [ ] Покрыть конкуренцию: два разных пользователя одновременно бронируют слот с `capacity = 1`; успешна ровно одна бронь, вторая получает `SLOT_FULL`, активных броней не больше вместимости.
- [ ] Проверить временные правила: seed создаёт окна в UTC (`timestamptz`), `createBooking` отклоняет `startsAt <= now` с `SLOT_IN_PAST`, `listUpcomingSlots` не показывает прошедшие слоты.
- [ ] Проверить идемпотентность: повторный `npm run db:seed` не меняет число слотов, повторный `npm test` проходит без ручной очистки.
- [ ] Очищать тестовые строки после прогона; база разработки не должна меняться.
- Действие: закрепить инварианты слоя данных автотестами.
- Результат: `npm test` проверяет весь новый слой данных на тестовой базе.
- Проверка: `npm test` — все проверки проходят, exit 0; конкурентный сценарий стабилен; повторный прогон не требует ручной очистки; число проверок выросло относительно прежних 11; база разработки до и после прогона не изменилась.
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 8.

### Шаг 8. Провести финальную проверку и обновить `README.md` — `todo`

- [ ] Обновить `README.md`: фаза `4.3.3`, модели и статусы, seed слотов, команды проверки, границы фазы, отсутствие UI booking flow и внешних уведомлений.
- [ ] Выполнить `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test`.
- [ ] Выполнить `npm run db:migrate`, `npm run db:seed`, `npx prisma db verify`, `npx prisma migration status`.
- [ ] Сверить `spec.md`, `Plan.md`, `AGENTS.md` и `README.md`: модели, статусы, инварианты, команды и границы совпадают.
- [ ] Проверить, что в проекте нет пользовательского booking flow, административных операций, внешних каналов и новых зависимостей.
- Действие: подтвердить готовность слоя данных и обновить runbook.
- Результат: фаза `4.3.3` закрыта, проект готов к UI booking flow в `4.3.4`.
- Проверка: `tsc`/lint/build/test — exit 0; `db verify` — совпадение схемы и маркера; `migration status` — `Up to date`; seed идемпотентен; `git diff --check` — без замечаний.
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: нет — цикл `4.3.3` завершён.

## 6. Что нельзя ломать и расширять

Нельзя ломать:

- существующий auth-контур: регистрацию, вход, сессию, выход, роли и `/access-denied` (FR-1…FR-19);
- `npm run lint`, `npm run build`, `npx tsc --noEmit` и `npm test` как обязательные проверки качества;
- правило «пароль в открытом виде не хранится и не логируется» (FR-4, NFR-1);
- правило «проверка сессии и роли выполняется на сервере» (FR-12, NFR-4);
- `spec.md` как источник требований: изменения объёма сначала вносятся в `spec.md`;
- игнорирование `.env` и `.env.test` в Git и отсутствие секретов в репозитории (CR-27);
- идемпотентность миграций, seed и автотестов (NFR-12).

Нельзя расширять в этой фазе:

- страницы и формы пользовательского booking flow: список слотов, создание/перенос/отмена брони, экран уведомлений;
- административные функции, управление слотами и назначение ролей через интерфейс или API;
- внешние уведомления: email, SMS, calendar, desktop, push;
- OAuth, многофакторную аутентификацию, восстановление пароля;
- фоновые процессы и планировщики;
- deploy, внешние сервисы и новые зависимости.

`/admin` остаётся проверочным маршрутом без изменения данных. Подтверждение брони живёт только в серверном слое данных и автотестах, но не в маршруте, форме или API.

## 7. Прямые зависимости и проверки

- `spec.md` — источник требований к слою данных: модели, статусы, инварианты, `FR-20`…`FR-28`, `NFR-13`…`NFR-16`, `CR-33`…`CR-41`.
- `AGENTS.md` — правила работы агента в фазе `4.3.3`.
- `prisma/schema.prisma` — единственный PSL-контракт; расширяется моделями `Slot`, `Booking`, `Notification`, перечислениями `BookingStatus`, `NotificationType`, частичным уникальным индексом активной брони и CHECK-ограничениями `Slot`.
- `prisma/contract.json`, `prisma/contract.d.ts` — эмитированные артефакты; руками не правятся.
- `prisma/migrations/app/` — история миграций; новая миграция создаётся `npx prisma migration plan --name data_layer` и применяется `npx prisma db migrate --advance-ref db`; после этого `npm run db:migrate` — no-op.
- `prisma/seed.ts` — существующий `super_admin` плюс идемпотентные слоты начиная с завтрашнего дня на 7 дней вперёд.
- `app/lib/db.ts` — единственный клиент Prisma; новые модули используют его, а не создают второй клиент.
- `app/lib/slots.ts`, `app/lib/bookings.ts`, `app/lib/notifications.ts` — новые серверные модули слоя данных.
- `app/lib/auth.ts` — источник `SessionUser` для проверки владельца и роли; идентификатор пользователя из формы не принимается.
- Доменные коды DAL — `SLOT_NOT_FOUND`, `SLOT_IN_PAST`, `SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `BOOKING_NOT_FOUND`, `FORBIDDEN`, `INVALID_TRANSITION`, `NOTIFICATION_NOT_FOUND`. Коды из `spec.md` (`SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `INVALID_TRANSITION`, `FORBIDDEN`) не переименовываются; остальные — внутренние коды слоя данных, они фиксируются в тестах и не меняют пользовательские требования.
- `tests/test-env.ts` — существующая защита тестовой базы; новые тесты используют её.
- `package.json` — имена скриптов не меняются; новых зависимостей нет.
- `README.md` — обновляется на шаге 8 и объясняет seed слотов, статусы и проверки.

Команды проверки:

```powershell
npx prisma contract emit
npx prisma migration plan --name data_layer
npx prisma db migrate --advance-ref db
npm run db:migrate
npx prisma db migrate --db "<url из .env.test>"
npm run db:seed
npx prisma db verify
npx prisma migration status
npx tsc --noEmit
npm run lint
npm run build
npm test
```

## 8. Журнал выполнения

| Дата | Шаг | Проверка | Результат |
| --- | --- | --- | --- |
| 17.10.2026 | Шаг 0. Обновить `spec.md` под слой данных | Сверка `spec.md`, `AGENTS.md`, `Plan.md`; `npm run lint`; `npx tsc --noEmit`; `npm run build`; `npm test`; `git diff --check` | `spec.md` дополнен `Slot`, `Booking`, `Notification`, `BookingStatus`, `NotificationType`, ER-диаграммой, таблицей переходов, инвариантами и `CR-33`…`CR-41`; `AGENTS.md` переведён на `4.3.3`, запрет на слой данных снят, границы фазы переписаны; `Plan.md` открывает новый цикл; lint/tsc/build — exit 0, `npm test` — 11/11, diff-check без замечаний |
| 17.10.2026 | Шаг 1. Расширить Prisma-контракт | `npx prisma contract emit`; проверка `contract.json`/`contract.d.ts`; `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm test`; `git diff --check`; `git status` | В PSL добавлены `BookingStatus`, `NotificationType`, модели `Slot`, `Booking`, `Notification`, связи `User`, частичный уникальный индекс активной брони и CHECK-ограничения `Slot`; nullable-даты используют `TimestamptzJsDate?`; emit успешен (`storageHash a8a421d6…`), tsc/lint/build — exit 0, `npm test` — 11/11, лишних файлов нет, diff-check без замечаний |
| 17.10.2026 | Шаг 2. Создать и применить миграцию | `npx prisma contract emit`; `npx prisma migration plan --name data_layer`; `npx prisma db migrate --advance-ref db`; `npm run db:migrate`; миграция test-базы; `npx prisma db verify` (dev/test); `npx prisma migration status` (dev/test); `npx prisma migration check`; `psql` — ограничения, индексы и транзакционные проверки; `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm test`; `git diff --check` | Пакет `20261017T1509_data_layer` (17 ops) применён к dev- и test-базе; CHECK `Slot` исправлены на quoted identifiers, контракт `storageHash 2c4bfdd…`; `db verify` — совпадение, `migration status` — `Up to date`, `npm run db:migrate` — no-op; psql подтвердил CHECK/FK/индексы/partial unique и откат недопустимых вставок; tsc/lint/build — exit 0, `npm test` — 11/11, diff-check без замечаний |
| 17.10.2026 | Шаг 3. Расширить seed слотами | `npm run db:seed` (3 запуска); `psql` — 14 слотов, окна/интервалы/capacity, 1 `super_admin`; `npx prisma db verify`; `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm test`; `git diff --check`; `git status` | `prisma/seed.ts` дополнен идемпотентным созданием 14 слотов (7 дней × 2 окна, 10:00/15:00 UTC, 60 минут, `capacity = 1`); первый запуск — `создано 14`, повторные — `создано 0, уже было 14`, количество `Slot` 14 не изменилось; `super_admin` — 1; db verify/tsc/lint/build — exit 0; `npm test` — 11/11; diff-check без замечаний |
| 17.10.2026 | Шаг 4. Собрать серверный модуль слотов | `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm test` (два прогона); `git diff --check` | `app/lib/slots.ts` добавлен: `listUpcomingSlots` фильтрует `startsAt > now`, сортирует по `startsAt`, считает relation-`count()` активных броней и `availableCapacity`; `getSlotAvailability` возвращает `null` для неизвестного id; `tests/slots.test.ts` — 5 проверок на тестовой базе; tsc/lint/build — exit 0; `npm test` — 16/16 дважды; diff-check — exit 0 |
| 17.10.2026 | Шаг 5. Собрать серверный модуль броней и переходы | Временный smoke на тестовой базе (создание, коды, роли, переходы, изоляция, уведомления, конкурентный `capacity = 1`); `npx tsc --noEmit`; `npm run lint`; `npm run build`; `npm test`; `git diff --check` | `app/lib/bookings.ts` добавлен: `createBooking` блокирует слот (`FOR UPDATE`), проверяет будущее, дубль и вместимость, создаёт `pending` + `booking_created` в одной транзакции; `cancelBooking`/`confirmBooking` блокируют бронь, читают роль из базы, разрешают только допустимые переходы и пишут уведомление; `listMyBookings` ограничен `actor.id`; smoke прошёл все доменные коды и конкурентный сценарий (одна успешная бронь, вторая — `SLOT_FULL`); tsc/lint/build — exit 0; `npm test` — 16/16; diff-check — exit 0 |

Строки журнала добавляются по завершении каждого шага вместе с обновлением полей `Статус`, `Проверка`, `Ошибки`, `Следующий шаг`.

## 9. Критерии готовности проекта

- `spec.md` описывает слой данных и не противоречит auth-контуру.
- `Plan.md` содержит шаги, команды проверки, статусы и журнал.
- `AGENTS.md` ограничивает работу ИИ фазой `4.3.3`.
- Prisma-контракт содержит `Slot`, `Booking`, `Notification`, `BookingStatus`, `NotificationType`.
- Миграция создаёт таблицы, CHECK-ограничения, внешние ключи, индексы и частичный уникальный индекс активной брони.
- Seed идемпотентно создаёт слоты начиная с завтрашнего дня на 7 дней вперёд и сохраняет ровно одного `super_admin`.
- Слоты читаются только через серверный модуль; доступность считается по активным броням.
- Бронь создаётся только текущим пользователем, только на будущий слот и только при свободной вместимости.
- Статусы брони меняются только по разрешённым переходам; `cancelled` конечен.
- Подтверждение брони доступно только `admin`/`super_admin` в слое данных и не имеет маршрута, формы или API.
- Пользователь видит и отменяет только свои брони; чужие брони и уведомления недоступны.
- Уведомления создаются в транзакции брони и адресуются владельцу; внешних каналов нет.
- `npm test` покрывает слой данных и проходит на отдельной тестовой базе.
- `npm run lint`, `npm run build`, `npx tsc --noEmit` проходят.
- `README.md` обновлён и описывает новые команды, seed слотов, статусы и границы фазы.
- Пользовательский booking flow, административные функции, внешние уведомления, deploy и новые зависимости не добавлены.

## 10. Правила работы

- Коммит и push выполняет разработчик; агент их не запускает и приводит готовые команды в отчёте (`AGENTS.md`).
- Один активный пункт `Plan.md`: выполнение, проверка, обновление статуса и только затем следующий пункт.
- Секреты не попадают в репозиторий, логи и документацию; пароли и токены не логируются.
- Новые зависимости не добавляются: используются Prisma 8, PostgreSQL, Zod, `tsx`, встроенный `node:test` и существующие пакеты.
- API Prisma 8 и Next.js 16 сверяются со справкой CLI, скиллом `prisma-8` и `node_modules/next/dist/docs/` до написания кода.
- Изменения объёма сначала вносятся в `spec.md`, затем в `Plan.md` и `AGENTS.md`, и только потом в код.
