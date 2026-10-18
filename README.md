# Mini Booking System — booking flow 4.3.4

Учебный проект сервиса записей (booking) на Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, PostgreSQL и Prisma 8 (`prisma` CLI + `@prisma/orm-postgres`). Валидация — Zod, пароли — `bcryptjs`.

Текущая фаза — **4.3.4 simplified booking flow**: поверх готового слоя данных `Slot`, `Booking`, `Notification` добавлены пользовательские страницы слотов, своих броней и уведомлений, административные разделы и Server Actions. Работает сквозной путь «слот → бронь `pending` → уведомление → подтверждение → уведомление → отмена → уведомление → отметка прочитанным».

## Что уже работает

- `/register` — регистрация: новый пользователь всегда получает роль `user`, в базе лежит только `passwordHash` (`bcryptjs.hash(password, 12)`).
- `/login` — вход по email и паролю через `bcryptjs.compare`; неизвестный email и неверный пароль дают одно сообщение.
- Сессия — запись в таблице `Session` (в базе только SHA-256 токена) и cookie `mb_session` с `HttpOnly`, `SameSite=Lax`, `Path=/`; в production добавляется `Secure`.
- `/account` — только при действующей сессии: email, отображаемое имя, роль, ссылки на записи и уведомления, кнопка выхода.
- `/slots` — будущие слоты на 7 дней вперёд с датой, временем UTC, вместимостью, числом активных броней и свободными местами; свободный слот можно забронировать.
- `/bookings` — только свои брони; владелец отменяет `pending`/`confirmed`, после отмены слот снова доступен.
- `/notifications` — только свои внутренние уведомления; непрочитанные выделены, отметка прочитанным идемпотентна.
- `/admin`, `/admin/slots`, `/admin/bookings` — только `admin`/`super_admin`: создание и изменение свободных слотов, все брони, подтверждение `pending` и отмена `pending`/`confirmed`.
- `/access-denied` — единая страница отказа для гостя и для недостаточной роли: одинаковый вид и одинаковый статус `200`, причина отказа не раскрывается.
- Seed — ровно один `super_admin` и 14 воспроизводимых слотов на 7 дней вперёд.

## Роли и доступ

| Роль | Как появляется | Что доступно |
| --- | --- | --- |
| `guest` — состояние без сессии, не значение в базе | нет действующей сессии | `/`, `/register`, `/login`, `/access-denied` |
| `user` | публичная регистрация через `/register` | `/account`, `/slots`, `/bookings`, `/notifications`; `/admin/*` закрыт |
| `admin` | только прямой записью в базу: интерфейса выдачи роли нет | всё, что у `user`, плюс `/admin`, `/admin/slots`, `/admin/bookings` |
| `super_admin` | `npm run db:seed` (ровно один начальный администратор) | те же административные возможности, что у `admin` |

Роль никогда не берётся из формы, query-параметра или тела запроса: действие `register` всегда записывает `user`. Проверки сессии и роли выполняются на сервере до рендера страниц и до вызова серверных операций, поэтому скрытый элемент интерфейса защитой не считается. Отдельного сценария или интерфейса для `super_admin` нет.

## Требования

- Node.js ≥ 20.9 (требование Next.js 16; проверено на Node.js 24.20.0) и npm.
- Локальный PostgreSQL с доступными в `PATH` командами `psql` и `createdb` (проверено на PostgreSQL 18.6).
- Свободный порт 3000 для `npm run dev`.

## Быстрый старт

```powershell
npm install

createdb mini-booking-system_dev
createdb mini-booking-system_test

Copy-Item .env.example .env
# заполнить в .env: DATABASE_URL, SESSION_TTL_SECONDS, SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD
# seed создаст super_admin и 14 слотов на 7 дней вперёд

Copy-Item .env .env.test
# в .env.test указать DATABASE_URL тестовой базы mini-booking-system_test

npx prisma db migrate --advance-ref db
npm run db:migrate
npm run db:seed
npm run dev
```

Подробности каждого шага — ниже.

## 1. Локальные базы данных

Создать две базы: рабочую и отдельную тестовую.

```powershell
createdb mini-booking-system_dev
createdb mini-booking-system_test
```

Альтернатива через `psql` (SQL передаётся через stdin: в PowerShell 5.1 вложенные кавычки в `-c '…'` теряются):

```powershell
'CREATE DATABASE "mini-booking-system_dev"' | psql -U postgres
'CREATE DATABASE "mini-booking-system_test"' | psql -U postgres
```

Если `psql` запрашивает пароль, задайте его через `PGPASSWORD` или используйте строку подключения вместо `-U`.

Проверить, что сервер доступен: `pg_isready -h localhost -p 5432` → `accepting connections`. Имена баз менять не нужно: на них опираются `.env`, `.env.test` и защита тестового прогона.

## 2. Переменные окружения

Шаблон — `.env.example`. Скопировать его в `.env` и заполнить локальными значениями:

```powershell
Copy-Item .env.example .env
```

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | строка подключения к `mini-booking-system_dev` |
| `SESSION_TTL_SECONDS` | срок жизни сессии и cookie в секундах, положительное целое; в примере `604800` (7 дней) |
| `SEED_SUPER_ADMIN_EMAIL` | email начального пользователя с ролью `super_admin` |
| `SEED_SUPER_ADMIN_PASSWORD` | локальный пароль seed-пользователя: 8–72 символа и не более 72 байт UTF-8; заглушку `<change-me-for-local-development>` seed отклоняет |

При заполнении `.env` замените заглушку `SEED_SUPER_ADMIN_PASSWORD` на рабочий локальный пароль: `npm run db:seed` отклоняет и заглушку, и пустое значение.

`.env` и `.env.test` в репозиторий не попадают: `.gitignore` игнорирует `.env*`, исключение — `.env.example`. В репозитории и в этом runbook нет рабочих паролей и строк подключения.

Тестовое окружение — отдельный локальный файл `.env.test` (его нет в репозитории):

```powershell
Copy-Item .env .env.test
```

В `.env.test` заменить `DATABASE_URL` — на базу `mini-booking-system_test`. Значения `SEED_SUPER_ADMIN_*` можно оставить как в `.env` или задать отдельные: важно, чтобы пароль не был заглушкой из `.env.example` и имел длину 8–72 символа. Имена переменных те же:

```ini
DATABASE_URL="postgresql://<login>:<password>@localhost:5432/mini-booking-system_test"
SESSION_TTL_SECONDS="604800"
SEED_SUPER_ADMIN_EMAIL="superadmin@mini-booking.me"
SEED_SUPER_ADMIN_PASSWORD="<локальный тестовый пароль>"
```

`npm test` читает `.env.test` с `override: true`, поэтому переменные оболочки не уведут прогон на другую базу. Next.js этот файл не читает: разработка идёт по `.env`.

## 3. Миграции и ссылка `db`

На пустой базе разработки первое применение выполняется с фиксацией ссылки `db`:

```powershell
npx prisma db migrate --advance-ref db
```

Команда применяет миграции из `prisma/migrations/app/` и записывает ссылку `db` в `prisma/migrations/app/refs/db.json`. Файл ссылки хранится в репозитории.

В пакете две миграции:

- `20261016T1526_init_auth_lite` — `User`, `Session`, уникальные ограничения, индексы и внешний ключ с `ON DELETE CASCADE` (8 операций).
- `20261017T1509_data_layer` — `Slot`, `Booking`, `Notification`, CHECK-ограничения, внешние ключи, индексы и частичный уникальный индекс активной брони (17 операций).

Дальше используется штатный скрипт — он идемпотентен:

```powershell
npm run db:migrate
```

Повторный запуск на актуальной базе печатает `No changes detected` и `Already up to date`.

Проверки схемы:

```powershell
npx prisma db verify
npx prisma migration status
```

Ожидаемый результат: `Database marker and schema match contract` и `Up to date`; в статусе обе миграции отмечены `applied`.

Тестовая база мигрируется отдельно, строкой подключения из `.env.test`:

```powershell
npx prisma db migrate --db "postgresql://<login>:<password>@localhost:5432/mini-booking-system_test"
```

Ожидаемый результат: применяются обе миграции, `advancedRef: null` — ссылка `db` остаётся у базы разработки.

В Prisma 8 нет команд `prisma migrate dev` и `prisma db seed`: миграции планируются `prisma migration plan`, применяются `prisma db migrate`, seed остаётся скриптом `tsx prisma/seed.ts`.

## 4. Seed: `super_admin` и слоты

```powershell
npm run db:seed
```

Seed идемпотентен и выполняет две операции.

Пользователь определяется по `SEED_SUPER_ADMIN_EMAIL`, поэтому второго `super_admin` не появляется. Первый запуск создаёт пользователя, повторный обновляет его пароль и сохраняет (или повышает до `super_admin`) роль.

```text
seed: начальный администратор готов
  email: superadmin@mini-booking.me
  роль:  super_admin
  итог:  пользователь создан с ролью super_admin
```

Слоты создаются начиная с завтрашнего дня на 7 дней вперёд, по два окна в день — 10:00 и 15:00 UTC, длительность 60 минут, вместимость 1. Всего 14 окон. Повторный запуск ищет слоты по паре `startsAt` + `endsAt`, поэтому дубликатов не появляется, а существующие слоты и брони не удаляются и не перезаписываются.

```text
seed: слоты готовы
  создано 14, уже было 0
```

При повторном запуске в тот же день ожидается `создано 0, уже было 14`.

Пароль и хеш в консоль не выводятся. Пустой пароль, заглушка из `.env.example`, длина вне 8–72 символов и размер больше 72 байт UTF-8 — ошибка запуска (`seed: ошибка — …`, exit code 1). Роли `admin` и `super_admin` появляются только так, не через регистрацию.

## 5. Запуск приложения

Разработка:

```powershell
npm run dev
```

Приложение: <http://localhost:3000>. Маршруты: `/`, `/register`, `/login`, `/account`, `/slots`, `/bookings`, `/notifications`, `/admin`, `/admin/slots`, `/admin/bookings`, `/access-denied`. Пользовательские и административные страницы проверяют сессию или роль на сервере; гость и `user` без нужной роли уходят на `/access-denied`.

Production-сборка локально:

```powershell
npm run build
npm start
```

Для сборки и запуска тоже нужен заполненный `.env`: переменные окружения читаются при загрузке серверных модулей.

## 6. Booking flow 4.3.4

Prisma-контракт содержит `User`, `Session`, `Slot`, `Booking`, `Notification` и перечисления `BookingStatus`, `NotificationType`. Новых моделей и миграций фаза не добавляет. Пользователь работает со слотами, своими бронями и уведомлениями; администратор — со слотами и всеми бронями.

### Маршруты и доступ

| Маршрут | Проверка до данных | Что показывает и делает |
| --- | --- | --- |
| `/slots` | `requireUser()` | будущие слоты на 7 дней; форма записи передаёт только `slotId` |
| `/bookings` | `requireUser()` | только брони текущего пользователя; отмена своей активной брони |
| `/notifications` | `requireUser()` | только уведомления текущего пользователя; отметка прочитанным |
| `/admin` | `requireRole(["admin", "super_admin"])` | навигация по административным разделам |
| `/admin/slots` | `requireRole(["admin", "super_admin"])` | слоты горизонта, создание и изменение свободных слотов |
| `/admin/bookings` | `requireRole(["admin", "super_admin"])` | все брони, email владельца, подтверждение и отмена |

Все страницы читают cookie внутри `<Suspense>`: при включённых Cache Components это условие сборки. Проверки владельца остаются в серверных модулях, а не в разметке.

### Модели и ограничения

- `Slot`: `startsAt`, `endsAt`, `capacity`; CHECK `endsAt > startsAt` и `capacity > 0`; уникальность пары `startsAt + endsAt`. Статуса слота нет: доступность вычисляется по времени и активным броням.
- `Booking`: владелец `userId`, слот `slotId`, статус `BookingStatus`, `confirmedAt`, `cancelledAt`. Частичный уникальный индекс `(userId, slotId) WHERE status IN ('pending', 'confirmed')` не даёт создать вторую активную бронь на тот же слот.
- `Notification`: получатель `userId`, необязательная ссылка `bookingId`, тип, текст, `readAt`. Создаётся сервером в той же транзакции, что и изменение брони.

### Статусы брони

| Текущий статус | Действие | Новый статус | Кто выполняет |
| --- | --- | --- | --- |
| — | создание | `pending` | текущий пользователь из сессии |
| `pending` | подтверждение | `confirmed` | `admin`, `super_admin`; слот ещё не начался |
| `pending` | отмена | `cancelled` | владелец, `admin`, `super_admin` |
| `confirmed` | отмена | `cancelled` | владелец, `admin`, `super_admin` |
| `cancelled` | любое | — | запрещено: `cancelled` конечен |

Статус не принимается из формы: создание всегда даёт `pending`, остальные переходы выполняют серверные функции.

### Серверные модули и Server Actions

- `app/lib/slots.ts` — горизонт 7 дней, `listUpcomingSlots`, `getSlotAvailability`, `createSlot(actor, input)`, `updateSlot(actor, slotId, input)`. Роль перечитывается из базы; `startsAt` должен быть в будущем и внутри горизонта, `endsAt > startsAt`, `capacity > 0`. Слот с активными бронями не изменяется (`SLOT_HAS_ACTIVE_BOOKINGS`); удаления нет. Ошибки — `SlotError` с кодами `FORBIDDEN`, `SLOT_NOT_FOUND`, `SLOT_IN_PAST`, `SLOT_OUT_OF_HORIZON`, `INVALID_SLOT_INTERVAL`, `INVALID_SLOT_CAPACITY`, `SLOT_HAS_ACTIVE_BOOKINGS`, `SLOT_ALREADY_EXISTS`.
- `app/lib/bookings.ts` — `createBooking`, `confirmBooking`, `cancelBooking`, `listMyBookings`, `listAllBookings`. Создание блокирует слот через `FOR UPDATE`, проверяет будущее время, дубль и вместимость, затем в одной транзакции вставляет бронь и уведомление `booking_created`. `listAllBookings` проверяет роль по базе и отдаёт email владельца, статус, слот и `isSlotUpcoming`, без `passwordHash` и `userId`.
- `app/lib/notifications.ts` — `listMyNotifications(actor)` и `markNotificationRead(actor, notificationId)`; чтение и запись ограничены `actor.id`. `markNotificationRead` блокирует строку, проверяет владельца, выставляет `readAt` один раз и повторно не меняет его. Неизвестное и чужое уведомление дают одинаковый отказ.
- `app/actions/slots.ts` — `createSlotAction`, `updateSlotAction`; `requireRole(["admin", "super_admin"])` до вызова модуля, Zod-валидация полей, `datetime-local` трактуется как UTC.
- `app/actions/bookings.ts` — `createBookingAction`, `cancelBookingAction` (`requireUser()`), `confirmBookingAction`, `adminCancelBookingAction`, `markNotificationReadAction` (`requireRole` для административных, `requireUser` для остальных). Из формы читаются только `slotId`, `bookingId` или `notificationId`.
- После успешных действий вызывается `revalidatePath` затронутых маршрутов: `/slots`, `/bookings`, `/notifications`, `/admin/slots`, `/admin/bookings`.

### Уведомления

Создание брони даёт `booking_created`, подтверждение — `booking_confirmed`, отмена владельцем или администратором — `booking_cancelled`. Уведомление адресуется владельцу брони и создаётся в транзакции изменения. Внешних каналов нет: email, SMS, calendar, desktop, push и счётчики в реальном времени не подключаются.

## 7. Скрипты проекта

| Команда | Что делает |
| --- | --- |
| `npm run dev` | `next dev` — разработка на <http://localhost:3000> |
| `npm run build` | `next build` — production-сборка |
| `npm start` | `next start` — запуск собранного приложения |
| `npm run lint` | `eslint` без ошибок и предупреждений |
| `npm run db:migrate` | `prisma migration plan && prisma db migrate` — план и применение миграций |
| `npm run db:seed` | `tsx prisma/seed.ts` — начальный `super_admin` и 14 слотов на 7 дней |
| `npm run sessions:cleanup` | `tsx scripts/cleanup-sessions.ts` — удаление истёкших сессий |
| `npm test` | `tsx --test --test-concurrency=1 tests/**/*.test.ts` — автотесты на тестовой базе |

`npm install` дополнительно выполняет `postinstall`: `prisma skills sync || exit 0` — синхронизация справочников Prisma для ИИ-агентов; ошибка синхронизации установку не останавливает.

## 8. Проверки

```powershell
npx tsc --noEmit
npm run lint
npm run build
npm run db:migrate
npm run db:seed
npx prisma db verify
npx prisma migration status
npm test
npm run sessions:cleanup
```

`npm run db:migrate` на актуальной базе не применяет миграций, `npm run db:seed` повторно даёт `создано 0, уже было 14`, `db verify` подтверждает совпадение схемы с контрактом, `migration status` показывает `Up to date`.

`npm test` требует выполненного шага 2 (`.env.test`) и мигрированной тестовой базы. Прогон защищён от порчи данных разработки: имя базы из `.env.test` обязано оканчиваться на `_test` и отличаться от имени базы из `.env`, иначе тесты падают до первого запроса. Тесты запускаются последовательно (`--test-concurrency=1`): они используют общую тестовую базу. Ожидаемый итог — 50 проверок в 19 наборах:

```text
ℹ tests 50
ℹ suites 19
ℹ pass 50
ℹ fail 0
```

До и после прогона тестовые фикстуры удаляются; seed-слоты и seed-пользователь, уже существовавшие в тестовой базе, могут сохраняться. База разработки не изменяется.

`npm run sessions:cleanup` удаляет только записи `Session` с `expiresAt <= now` и печатает количество:

```
sessions: удалено истёкших сессий: 0
```

Проверка срока жизни при чтении сессии остаётся обязательной: команда — гигиена таблицы, а не способ закрыть доступ.

## 9. Smoke-тест сквозного сценария

1. `npm run dev`, открыть <http://localhost:3000>, зарегистрировать обычного `user` и войти.
2. Открыть `/slots`: видны будущие слоты на 7 дней, дата и время в UTC, вместимость и свободные места. Заполненный слот недоступен.
3. Нажать «Записаться» на свободном слоте: открывается `/bookings`, бронь в статусе «Ожидает подтверждения». Повторная запись на тот же слот отклоняется.
4. Открыть `/notifications`: есть непрочитанное `booking_created`, кнопка «Прочитать» отмечает его; повторная отметка не меняет дату прочтения.
5. Войти seed-пользователем (`SEED_SUPER_ADMIN_EMAIL` и пароль из `.env`) или `admin`: открыть `/admin/slots`, создать слот в пределах 7 дней, при необходимости изменить свободный слот.
6. Открыть `/admin/bookings`: видны все брони с email владельцев. Подтвердить `pending` — статус «Подтверждена», у владельца появляется `booking_confirmed`.
7. Отменить `pending` или `confirmed` — статус «Отменена», у владельца появляется `booking_cancelled`, слот снова доступен. Повторная отмена отклоняется.
8. Под `user` открыть `/admin` и `/admin/slots` прямым запросом: происходит переход на `/access-denied` без защищённых данных.
9. На `/account` проверить ссылки на `/slots`, `/bookings`, `/notifications` и кнопку выхода.
10. `npm run sessions:cleanup`: количество удалённых истёкших сессий (`0`, если истёкших нет).

Проверки доступа, cookie, Server Actions и запись данных подтверждены автотестами и smoke-прогонами в dev-базе; временные пользователи, слоты и брони после проверки удалены.

## 10. Что осталось проверить вручную в браузере

Серверные проверки доступа, cookie и выход подтверждены HTTP-пробниками без браузера. В браузере пока не подтверждены два пункта:

- **CR-10 — `HttpOnly`.** DevTools → Application → Cookies: у `mb_session` стоит `HttpOnly`; в Console `document.cookie` не содержит `mb_session`.
- **CR-24 — истечение сессии.** Указать в `.env` `SESSION_TTL_SECONDS="60"`, перезапустить `npm run dev`, войти заново (срок берётся при создании сессии), подождать больше минуты и перезагрузить `/account`: ожидается переход на `/access-denied`. Затем вернуть `604800`, перезапустить сервер и войти снова.

## 11. Структура проекта

```
app/
  page.tsx                  публичная главная со ссылками на вход, слоты и записи
  register/page.tsx         форма регистрации
  login/page.tsx            форма входа
  account/page.tsx          аккаунт и ссылки на разделы
  slots/page.tsx            свободные слоты на 7 дней и форма записи
  bookings/page.tsx         свои брони и отмена
  notifications/page.tsx    свои уведомления и отметка прочитанным
  admin/page.tsx            административная навигация
  admin/slots/page.tsx      слоты, создание и изменение
  admin/bookings/page.tsx   все брони, подтверждение и отмена
  access-denied/page.tsx    единая страница отказа
  actions/auth.ts           Server Actions: register, login, logout
  actions/bookings.ts       создание/отмена, подтверждение, админ-отмена, отметка уведомления
  actions/slots.ts          createSlotAction, updateSlotAction
  lib/db.ts                 единственный клиент Prisma 8
  lib/env.ts                чтение и проверка переменных окружения
  lib/password.ts           bcryptjs: hash(password, 12) и compare
  lib/session.ts            выдача, чтение и отзыв сессии
  lib/auth.ts               getCurrentUser, requireUser, requireRole
  lib/slots.ts              горизонт, доступность, createSlot, updateSlot
  lib/bookings.ts           брони, переходы статусов, listAllBookings
  lib/notifications.ts      внутренние уведомления и отметка прочтения
  lib/validation.ts         Zod-схемы auth-форм
  lib/booking-validation.ts Zod-схемы форм броней и уведомлений
  lib/slot-validation.ts    Zod-схемы административных форм слотов
  ui/*.tsx                  формы, кнопки и клиентские действия
prisma/
  schema.prisma             User, Session, Slot, Booking, Notification и перечисления
  migrations/               две миграции и ссылка db (хранятся в репозитории)
  seed.ts                   super_admin и 14 слотов; повторный запуск идемпотентен
scripts/cleanup-sessions.ts очистка истёкших сессий
tests/                      test-env.ts, auth.test.ts, slots.test.ts, data-layer.test.ts, admin.test.ts
```

## 12. Вне объёма фазы

Внешние уведомления (email, SMS, calendar, desktop, push), перенос брони, повторяющиеся слоты, удаление слотов и броней, управление пользователями и ролями, календарь, оплата, отзывы, поиск, фильтры, экспорт, OAuth, подтверждение email, восстановление и смена пароля, ограничение частоты попыток входа, планировщик очистки сессий, deploy и новые зависимости. Отдельного сценария или интерфейса для `super_admin` нет.

Существующий набор ролей, три статуса брони (`pending`, `confirmed`, `cancelled`), модели и миграции не расширяются без предварительного обновления `spec.md`.
