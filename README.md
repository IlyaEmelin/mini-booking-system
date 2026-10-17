# Mini Booking System — слой данных 4.3.3

Учебный проект сервиса записей (booking) на Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4, PostgreSQL и Prisma 8 (`prisma` CLI + `@prisma/orm-postgres`). Валидация — Zod, пароли — `bcryptjs`.

Текущая фаза — **4.3.3 data layer**: Prisma-контракт и миграции для `Slot`, `Booking` и `Notification`, seed слотов, серверные модули доступа к данным, статусы брони и внутренние уведомления. Пользовательского booking flow, экрана уведомлений и административных функций в этой фазе нет: они остаются на `4.3.4`.

## Что уже работает

- `/register` — регистрация: новый пользователь всегда получает роль `user`, в базе лежит только `passwordHash` (`bcryptjs.hash(password, 12)`).
- `/login` — вход по email и паролю через `bcryptjs.compare`; неизвестный email и неверный пароль дают одно сообщение.
- Сессия — запись в таблице `Session` (в базе только SHA-256 токена) и cookie `mb_session` с `HttpOnly`, `SameSite=Lax`, `Path=/`; в production добавляется `Secure`.
- `/account` — только при действующей сессии: email, отображаемое имя, роль, пустые блоки будущих записей и уведомлений, кнопка выхода.
- `/admin` — проверочный маршрут для ролей `admin` и `super_admin`: подтверждение доступа без административных функций и без изменения данных.
- `/access-denied` — единая страница отказа для гостя и для недостаточной роли: одинаковый вид и одинаковый статус `200`, причина отказа не раскрывается.
- Серверный слой данных — `Slot`, `Booking`, `Notification`: чтение будущих слотов, создание/подтверждение/отмена брони, переходы статусов, внутренние уведомления и изоляция владельца. Публичных страниц и API этих операций пока нет.
- Seed — ровно один `super_admin` и 14 воспроизводимых слотов на 7 дней вперёд; слоты создаются через seed, а не через интерфейс.

## Роли и доступ

| Роль | Как появляется | Что доступно |
| --- | --- | --- |
| `guest` — состояние без сессии, не значение в базе | нет действующей сессии | `/`, `/register`, `/login`, `/access-denied` |
| `user` | публичная регистрация через `/register` | `/account`; `/admin` закрыт |
| `admin` | только прямой записью в базу: интерфейса и API для выдачи роли нет | `/account`, `/admin` (подтверждение доступа) |
| `super_admin` | `npm run db:seed` (ровно один начальный администратор) | `/account`, `/admin` (подтверждение доступа) |

Роль никогда не берётся из формы, query-параметра или тела запроса: действие `register` всегда записывает `user`. Проверки сессии и роли выполняются на сервере до рендера страниц, поэтому скрытый элемент интерфейса защитой не считается.

В серверном слое данных `user` создаёт и отменяет только свои брони и читает только свои уведомления, а `admin` и `super_admin` могут подтверждать и отменять любую бронь. Публичных маршрутов для этих операций в фазе 4.3.3 нет: роли проверяются внутри серверных функций.

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

Приложение: <http://localhost:3000>. Маршруты: `/`, `/register`, `/login`, `/account`, `/admin`, `/access-denied`.

Production-сборка локально:

```powershell
npm run build
npm start
```

Для сборки и запуска тоже нужен заполненный `.env`: переменные окружения читаются при загрузке серверных модулей.

## 6. Слой данных 4.3.3

Prisma-контракт содержит модели `Slot`, `Booking`, `Notification` и перечисления `BookingStatus`, `NotificationType`. Слой доступен только серверному коду: публичных страниц, маршрутов, Server Actions и API для слотов, броней и уведомлений в этой фазе нет.

### Модели и ограничения

- `Slot`: `startsAt`, `endsAt`, `capacity`; CHECK `endsAt > startsAt` и `capacity > 0`; уникальность пары `startsAt + endsAt` защищает seed от дубликатов. Статуса слота нет: доступность вычисляется по времени и активным броням.
- `Booking`: владелец `userId`, слот `slotId`, статус `BookingStatus`, `confirmedAt`, `cancelledAt`. Частичный уникальный индекс `(userId, slotId) WHERE status IN ('pending', 'confirmed')` не даёт создать вторую активную бронь на тот же слот.
- `Notification`: получатель `userId`, необязательная ссылка `bookingId`, тип `NotificationType`, текст, `readAt`. Уведомление создаётся сервером в транзакции брони и адресуется только её владельцу.

### Статусы брони

| Текущий статус | Действие | Новый статус | Кто выполняет |
| --- | --- | --- | --- |
| — | создание | `pending` | текущий пользователь из сессии |
| `pending` | подтверждение | `confirmed` | `admin`, `super_admin`; слот ещё не начался |
| `pending` | отмена | `cancelled` | владелец, `admin`, `super_admin` |
| `confirmed` | отмена | `cancelled` | владелец, `admin`, `super_admin` |
| `cancelled` | любое | — | запрещено: `cancelled` конечен |

Недопустимые переходы отклоняются на сервере. Создание всегда даёт `pending`; статус не принимается из формы, query-параметра или тела запроса.

### Серверные модули

- `app/lib/slots.ts` — `listUpcomingSlots(now?)` и `getSlotAvailability(slotId, now?)`. Возвращают слот, число активных броней (`pending` + `confirmed`), остаток вместимости и признак будущего слота. Заполненный слот не скрывается: у него `availableCapacity = 0`; неизвестный слот даёт `null`.
- `app/lib/bookings.ts` — `createBooking(actor, slotId)`, `confirmBooking(actor, bookingId)`, `cancelBooking(actor, bookingId)`, `listMyBookings(actor)`. `actor` — `SessionUser` из действующей сессии; идентификатор пользователя не принимается аргументом из запроса. Создание блокирует слот через `FOR UPDATE`, проверяет будущее время, дубль и свободную вместимость, затем в одной транзакции вставляет бронь и уведомление `booking_created`. Доменные нарушения возвращают `BookingError` с кодом `SLOT_NOT_FOUND`, `SLOT_IN_PAST`, `SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `BOOKING_NOT_FOUND`, `FORBIDDEN` или `INVALID_TRANSITION`.
- `app/lib/notifications.ts` — `listMyNotifications(actor)` и `markNotificationRead(actor, notificationId)`; чтение и запись ограничены `actor.id`. `markNotificationRead` блокирует строку, проверяет владельца, выставляет `readAt` один раз и повторно не меняет его; наружу выходят `NOTIFICATION_NOT_FOUND` и `FORBIDDEN`. Внутренний `createNotification(tx, booking, type)` вызывается только из транзакций броней.
- Внешних каналов нет: email, SMS, calendar, desktop и push не подключаются. Уведомление остаётся записью в таблице `Notification`.

`confirmBooking` существует только как серверная функция слоя данных: маршрута, формы, Server Action и API подтверждения нет. `/admin` по-прежнему только проверяет роль и не изменяет данные.

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

`npm test` требует выполненного шага 2 (`.env.test`) и мигрированной тестовой базы. Прогон защищён от порчи данных разработки: имя базы из `.env.test` обязано оканчиваться на `_test` и отличаться от имени базы из `.env`, иначе тесты падают до первого запроса. Тесты запускаются последовательно (`--test-concurrency=1`): они используют общую тестовую базу. Ожидаемый итог — 39 проверок в 16 наборах, около 27 секунд:

```text
ℹ tests 39
ℹ suites 16
ℹ pass 39
ℹ fail 0
```

До и после прогона тестовые фикстуры удаляются; seed-слоты и seed-пользователь, уже существовавшие в тестовой базе, могут сохраняться. База разработки не изменяется.

`npm run sessions:cleanup` удаляет только записи `Session` с `expiresAt <= now` и печатает количество:

```
sessions: удалено истёкших сессий: 0
```

Проверка срока жизни при чтении сессии остаётся обязательной: команда — гигиена таблицы, а не способ закрыть доступ.

## 9. Smoke-тест auth-контура

1. `npm run dev`, открыть <http://localhost:3000>.
2. «Зарегистрироваться» → заполнить email и пароль (8–72 символа), имя необязательно → после отправки открывается `/account`, роль — `user`.
3. Перезагрузить `/account` и открыть его в новой вкладке: сессия действует.
4. При действующей сессии открыть `/login` и `/register`: происходит переход на `/account`, формы не показываются.
5. Нажать «Выйти»: переход на `/login`; после выхода `/account` ведёт на `/access-denied`, прежняя cookie доступа не даёт.
6. Войти seed-пользователем (`SEED_SUPER_ADMIN_EMAIL` и пароль из `.env`): `/account` показывает роль `super_admin`, `/admin` — «Доступ подтверждён».
7. Войти обычным `user` и открыть `/admin`: «Нет доступа» — та же страница и тот же статус `200`, что у гостя.
8. `npm run sessions:cleanup`: количество удалённых истёкших сессий (`0`, если истёкших нет).

Слой данных 4.3.3 не имеет пользовательского интерфейса: его проверяет `npm test`, а в браузере остаются только перечисленные маршруты auth-контура.

## 10. Что осталось проверить вручную в браузере

Серверные проверки доступа, cookie и выход подтверждены HTTP-пробниками без браузера. В браузере пока не подтверждены два пункта:

- **CR-10 — `HttpOnly`.** DevTools → Application → Cookies: у `mb_session` стоит `HttpOnly`; в Console `document.cookie` не содержит `mb_session`.
- **CR-24 — истечение сессии.** Указать в `.env` `SESSION_TTL_SECONDS="60"`, перезапустить `npm run dev`, войти заново (срок берётся при создании сессии), подождать больше минуты и перезагрузить `/account`: ожидается переход на `/access-denied`. Затем вернуть `604800`, перезапустить сервер и войти снова.

## 11. Структура проекта

```
app/
  page.tsx                  публичная главная со ссылками на вход и регистрацию
  register/page.tsx         форма регистрации
  login/page.tsx            форма входа
  account/page.tsx          аккаунт: только при действующей сессии
  admin/page.tsx            проверка роли admin/super_admin
  access-denied/page.tsx    единая страница отказа
  actions/auth.ts           Server Actions: register, login, logout
  lib/db.ts                 единственный клиент Prisma 8
  lib/env.ts                чтение и проверка переменных окружения
  lib/password.ts           bcryptjs: hash(password, 12) и compare
  lib/session.ts            выдача, чтение и отзыв сессии
  lib/auth.ts               getCurrentUser, requireUser, requireRole
  lib/slots.ts              будущие слоты и доступность
  lib/bookings.ts           создание, подтверждение, отмена и список броней
  lib/notifications.ts      внутренние уведомления и отметка прочтения
  lib/validation.ts         Zod-схемы и границы полей
  ui/*.tsx                  формы регистрации, входа и кнопка выхода
prisma/
  schema.prisma             User, Session, Slot, Booking, Notification и перечисления
  migrations/               две миграции и ссылка db (хранятся в репозитории)
  seed.ts                   super_admin и 14 слотов; повторный запуск идемпотентен
scripts/cleanup-sessions.ts очистка истёкших сессий
tests/                      test-env.ts, auth.test.ts, slots.test.ts, data-layer.test.ts
```

## 12. Вне объёма фазы

Пользовательский booking flow: страницы списка и выбора слотов, формы создания, переноса и отмены брони, экран уведомлений и Server Actions этих операций. Подтверждение брони через маршрут, форму, Server Action или API; управление слотами через интерфейс или API; административные функции и выдача ролей через интерфейс или API. Внешние уведомления (email, SMS, calendar, desktop, push), OAuth, подтверждение email, восстановление пароля, ограничение частоты попыток входа, планировщик очистки сессий, деплой и новые зависимости.

Слой данных `Slot`, `Booking`, `Notification` в этой фазе уже существует, но доступен только серверному коду и автотестам. Блоки записей и уведомлений в `/account` остаются статическими пустыми состояниями.
