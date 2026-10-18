# Plan.md: публичное расписание, общий `header` и детализация брони

## 1. Текущий статус

- Дата: 18.10.2026.
- Фаза: `6 public schedule, shared header and admin booking detail`.
- Активный пункт: нет — цикл 6 закрыт.
- Шаги 6.1–6.9 выполнены; `spec.md`, реализация, автотесты, smoke-тест и `README.md` согласованы.
- Последнее изменение: шаг 6.9 выполнен — пройдены `tsc`, lint, build и 56/56 автотестов; выполнен HTTP- и headless-browser smoke для `guest`, `user`, `admin` и `super_admin`; проверены исходный HTML, PII, модальные окна и инвалидация расписания; `README.md` обновлён.
- Документ дизайна: [`../../design/home-slots-and-header.md`](../../design/home-slots-and-header.md).
- Предыдущий закрытый цикл: `4.3.4 simplified booking flow`; его план — [`Plan-4.3.4-simplified-booking-flow.md`](Plan-4.3.4-simplified-booking-flow.md).
- Новый объём работ начинается только после обновления `spec.md` и отдельного пункта в новом активном `Plan.md`.


## 2. Назначение

Корневой `Plan.md` содержит только текущий активный план: ближайший шаг, его проверки, ошибки и следующий узкий запрос. История закрытых циклов хранится в `docs/archive/plans/` и не дублируется здесь.

## 3. Порядок работы

1. Прочитать `spec.md`, этот файл и `AGENTS.md`.
2. Взять ровно один активный пункт.
3. Показать затрагиваемые файлы и план правок.
4. Внести изменения только в объёме пункта и прогнать его проверки.
5. Обновить статус, проверки, ошибки и следующий шаг.
6. После закрытия цикла перенести его план в `docs/archive/plans/`, оставив здесь ссылку на архив.

## 4. Завершённый шаг: дизайн `/` и `header`

- [x] Зафиксировать согласованный вариант A: `/` и `/slots` показывают одно расписание для всех ролей.
- [x] Описать матрицу видимости `header` для `guest`, `user`, `admin`, `super_admin`.
- [x] Описать таблицу: строки-даты, колонки со слотами (свободными и занятыми), кнопки свободных слотов, пустые ячейки без интерактива.
- [x] Описать гостевой сценарий: клик по свободному слоту → модальное окно «Войти / Зарегистрироваться / Отмена», без создания брони.
- [x] Описать сценарий авторизованного пользователя и администратора: подтверждение → `pending` → `/bookings`.
- [x] Зафиксировать занятые слоты: `Занято` без PII для `guest`/`user`; владелец и ссылка на `/admin/bookings/[id]` для `admin`/`super_admin`.
- [x] Зафиксировать ролевой DTO `listUpcomingSchedule(viewer)` и серверную фильтрацию PII.
- [x] Зафиксировать защищённую детализацию брони `/admin/bookings/[id]`.
- [x] Зафиксировать доступность модальных окон, адаптивность, ограничения и критерии приёмки.
- [x] Не менять код приложения, модели, роли, статусы и цветовую палитру.

Проверки шага:

- `docs/design/home-slots-and-header.md` создан, прочитан; маркеров-заглушек нет, строк с завершающими пробелами 0.
- `git diff --check` — код возврата 0.
- `git status --short` — `M Plan.md`, новый `docs/design/`; существующий `tmp.md` не изменялся.
- Ошибок нет.

## 5. Завершённый шаг: обновление `spec.md` и дизайна

- [x] В `spec.md` добавлены: публичное расписание `/` и `/slots`, матрица ролей, занятые ячейки без PII для `guest`/`user`, владелец и ссылка для `admin`/`super_admin`.
- [x] Добавлены требования `FR-34…FR-38`, `NFR-20…NFR-22`, критерии `CR-48…CR-53`.
- [x] Обновлены `С9`, `С10`, `С13`, структура файлов, поток данных, ограничения и самопроверка.
- [x] В `docs/design/home-slots-and-header.md` добавлены матрицы состояний ячейки и данных DTO, страница `/admin/bookings/[id]`, правила PII и инвалидации.
- [x] Код приложения, модели, миграции, роли и статусы не изменялись.

Проверки шага:

- Поиск по `spec.md` и дизайну не находит старых утверждений, что `/slots` требует `requireUser`, что гость уходит с `/slots` на `/access-denied` или что в таблице только свободные слоты.
- `git diff --check` — код возврата 0.
- `git status --short` — изменены `Plan.md`, `spec.md`, `docs/design/home-slots-and-header.md`; `tmp.md` не изменялся.
- Ошибок нет.

## 6. Активный пункт: публичное расписание, общий `header` и детализация брони

- Статус: закрыт; шаги 6.1–6.9 выполнены, активного пункта нет.
- Источники: `spec.md` — FR-30, FR-33…FR-38, NFR-19…NFR-22, CR-42, CR-44, CR-47…CR-53; `docs/design/home-slots-and-header.md` — разделы 2…10.
- Цель: `/` и `/slots` показывают одно публичное расписание всех будущих слотов горизонта; `guest`/`user` не получают PII владельцев, `admin`/`super_admin` видят активные брони и переходят в `/admin/bookings/[id]`; общий серверный `header` строится по роли.
- Границы: не менять модели, миграции, роли, статусы, зависимости, auth-контур и цветовую палитру; не добавлять поиск, фильтры, пагинацию, перенос брони, возврат к слоту после входа и управление пользователями.
- Затрагиваемые файлы:
  - изменить: `app/lib/slots.ts`, `app/lib/bookings.ts`, `app/page.tsx`, `app/slots/page.tsx`, `app/layout.tsx`, `app/admin/bookings/page.tsx`, `app/actions/bookings.ts`, `app/actions/slots.ts`, `README.md`, `tests/slots.test.ts`, `tests/admin.test.ts`;
  - создать: `app/admin/bookings/[id]/page.tsx`, `app/ui/site-header.tsx`, `app/ui/schedule-content.tsx`, `app/ui/schedule-table.tsx`, при необходимости `app/ui/nav-link.tsx`;
  - не изменять: `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, модели `User`/`Session`, `package.json`, `next.config.ts`, `tmp.md`.
- Контракт данных: `listUpcomingSchedule(viewer: SessionUser | null, now?: Date)`; публичный DTO — только `id`, `startsAt`, `endsAt`, `capacity`, `activeBookings`, `availableCapacity`, `isUpcoming`; административный DTO дополнительно содержит активные брони `bookingId`, `ownerId`, `ownerEmail`, `ownerDisplayName` (может быть `null`) и `status`. `passwordHash`, `tokenHash` и служебные поля не возвращаются ни одной роли.

### 6.1. Сверка API и базовый срез

- [x] Прочитать в `node_modules/next/dist/docs/` разделы о `params` страницы (Promise + `PageProps<'/admin/bookings/[id]'>`), `<Suspense>` и Cache Components, `revalidatePath`; не опираться на память о Next.js 15.
  - `page.md`: `params` — `Promise`, читается через `await`; `PageProps<'/route'>` — глобальный helper, типы генерируются `next dev`, `next build` или `next typegen`.
  - `authentication-with-cache-components.md`: чтение cookie/сессии не входит в статическую оболочку, поэтому выполняется только за границей `<Suspense>`; в `layout.tsx` нельзя делать top-level `await` сессии — она передаётся в компонент внутри границы.
  - `revalidatePath.md`: для динамического сегмента используется шаблон маршрута с типом, например `revalidatePath("/admin/bookings/[id]", "page")`; литеральный путь — без типа.
- [x] Сверить Prisma 8 по скиллу `prisma-8` и `npx prisma --help`: `select`, `include`, `where`, `orderBy`, `forUpdate`, `aggregate` в используемом стиле проекта.
  - `npx prisma --help` подтверждает контрактный CLI (`contract`, `db`, `migration`); сгенерированные `prisma/contract.json` и `prisma/contract.d.ts` новее `prisma/schema.prisma`.
  - `queries-postgres.md`: `.select(...)`, `.where(...)` (объект и лямбда), `.orderBy(...)`, `.include(relation, branch)`, вложенный `.include(...)`, `.aggregate((a) => ({ count: a.count() }))`, `.forUpdate().first()`.
  - Ограничение: `.forUpdate()` нельзя комбинировать с `include`, `aggregate`, `groupBy`, `distinct` и мутацией (`ORM.LOCK_INCOMPATIBLE`).
- [x] Зафиксировать исходное состояние: `git status --short`, `npx tsc --noEmit`, `npm run lint`; ошибок baseline нет.
- [x] Убедиться, что `tmp.md` не отслеживается и в изменения не попадает.

Проверки шага:

- `git status --porcelain=v1 -uall` — пустой вывод, код возврата 0; рабочее дерево до правки `Plan.md` было чистым.
- `npx tsc --noEmit` — код возврата 0, ошибок нет.
- `npm run lint` — код возврата 0, предупреждений и ошибок нет.
- `git diff --check` — код возврата 0.
- `tmp.md` отсутствует в рабочем дереве (`Test-Path` → `False`), среди изменённых и неотслеживаемых файлов не значится.
- Код приложения, `prisma/`, модели, роли, статусы и зависимости не изменялись.

### 6.2. Ролевой DTO расписания в `app/lib/slots.ts`

- [x] Сохранить `SlotAvailability`, `listUpcomingSlots(now?)` и `getSlotAvailability(slotId, now?)` без изменения контракта: они нужны `/admin/slots` и существующим тестам.
- [x] Добавить экспортируемые типы:
  - `ScheduleBookingSummary` — `bookingId`, `ownerId`, `ownerEmail`, `ownerDisplayName: string | null`, `status: "pending" | "confirmed"`;
  - `PublicScheduleSlot` — текущий `SlotAvailability`;
  - `AdminScheduleSlot` — `PublicScheduleSlot` плюс `activeBookingDetails: readonly ScheduleBookingSummary[]`;
  - `UpcomingSchedule` — дискриминированное объединение `{ visibility: "public"; slots: readonly PublicScheduleSlot[] }` и `{ visibility: "admin"; slots: readonly AdminScheduleSlot[] }`.
- [x] Реализовать `listUpcomingSchedule(viewer, now = new Date())`:
  - `viewer === null` → публичная выборка без `User`, без массива броней;
  - `viewer !== null` → роль перечитать из базы по `viewer.id`; `admin`/`super_admin` → административная выборка, `user` → публичная; роль из формы, query или клиентского состояния не принимается;
  - фильтр `startsAt > now` и `startsAt < now + 7 суток`, сортировка по `startsAt.asc()`, затем по `endsAt.asc()`;
  - публичный запрос выбирает только `Slot.id/startsAt/endsAt/capacity` и считает активные брони (`pending` + `confirmed`); `availableCapacity = max(0, capacity - activeBookings)`;
  - административный запрос одной выборкой включает активные брони с `id`, `status` и владельцем `id`, `email`, `displayName`; отменённые брони исключены; порядок владельцев детерминирован (`createdAt.asc()`, затем `id.asc()`);
  - PII не выбирается и не маппится для `guest`/`user`; фильтрация в разметке или CSS не используется.
- [x] Не добавлять в DTO `passwordHash`, `tokenHash`, `userId` владельца вне `ownerId` административного DTO и служебные поля.
- [x] Добавить в `app/lib/slots.ts` краткий комментарий о ролевом DTO и границе PII со ссылками FR-34…FR-36, NFR-20, NFR-21.

Проверки шага:

- `npx tsc --noEmit` — код возврата 0, ошибок нет.
- `npm run lint` — код возврата 0, ошибок и предупреждений нет.
- `npm test` — 50 из 50 тестов, 19 suites, `fail 0`; контракты `listUpcomingSlots` и `getSlotAvailability` не изменены.
- Одноразовая проверка на `_test`-базе: гость и `user` получают `visibility: "public"` без `activeBookingDetails`; `admin` получает `visibility: "admin"`, владельца и только активную бронь, отменённая исключена; устаревшая роль в объекте viewer не используется, роль перечитана из базы. Вывод `schedule check: OK`, временный скрипт удалён.
- Сортировка публичной выборки дополнена `endsAt.asc()` как tie-breaker при совпадении `startsAt`; контракт функции не изменён.
- `git --no-pager diff --check` — код возврата 0.
- `git status --short` до обновления этого файла — изменён только `app/lib/slots.ts`; временных файлов нет.
- Ошибок нет.

### 6.3. Административная сводка и `getAdminBooking` в `app/lib/bookings.ts`

- [x] Расширить `AdminBookingSummary`: `ownerId`, `ownerDisplayName: string | null`, `ownerEmail`; вложенный слот дополнить `capacity` (отдельный административный тип слота, чтобы не расширять `BookingSummary` владельца).
- [x] В `listAllBookings` выбирать `User.id`, `User.email`, `User.displayName`; маппить `ownerId: row.user.id`, `ownerDisplayName: row.user.displayName`; `passwordHash` не выбирать.
- [x] Добавить `getAdminBooking(actor: SessionUser, bookingId: string): Promise<AdminBookingSummary | null>`:
  - роль `admin`/`super_admin` перечитать из базы до чтения брони, иначе `BookingError("FORBIDDEN")`;
  - принимать только `bookingId`; `actor.id` не используется как фильтр владельца;
  - выбирать бронь по `id` с `slot` (`id`, `startsAt`, `endsAt`, `capacity`) и `user` (`id`, `email`, `displayName`), включая `cancelled`;
  - неизвестный идентификатор → `null`, а не вымышленный объект; `notFound()` вызывает страница;
  - не возвращать `passwordHash`, `tokenHash`, `userId` и служебные поля.
- [x] Обновить комментарии и JSDoc типов; не менять транзакции создания, подтверждения и отмены.

Проверки шага:
- `npx tsc --noEmit` — код возврата 0, ошибок нет.
- `npm run lint` — код возврата 0, ошибок и предупреждений нет.
- `npm test` — 50 из 50 тестов, 19 suites, `fail 0`; существующие проверки не менялись.
- Одноразовая проверка на `_test`-базе: `getAdminBooking` для `user` даёт `FORBIDDEN`, для неизвестного id — `null`, для `cancelled` возвращает `ownerId`, `ownerEmail`, `ownerDisplayName` и `slot.capacity`, без `userId`/`passwordHash`/`tokenHash`; `listAllBookings` отдаёт новые поля владельца и вместимость. Вывод `getAdminBooking check: OK`, временный скрипт удалён.
- `git --no-pager diff --check` — код возврата 0.
- Ошибок в рабочем коде нет. Разовый проверочный скрипт сначала не запустился из-за top-level `await` в CJS-выводе `tsx`; запуск переведён на `main().catch(...)`, после чего проверка прошла; скрипт удалён.

### 6.4. Защищённая детализация `/admin/bookings/[id]`

- [x] Создать `app/admin/bookings/[id]/page.tsx`; тип — `PageProps<"/admin/bookings/[id]">`, `params` читать через `await`.
- [x] Вызвать `requireRole(["admin", "super_admin"])` до чтения данных; затем `getAdminBooking(actor, id)`; при `null` — `notFound()`.
- [x] Чтение сессии и данных разместить за границей `<Suspense>` с нейтральным fallback, как на существующих защищённых страницах (NFR-21).
- [x] Показать: email владельца, `displayName` или `Без имени`, `User.id`, слот (дата, время, вместимость), статус, `createdAt`, `confirmedAt`, `cancelledAt`; форматирование дат — UTC на сервере.
- [x] Использовать существующие `ConfirmBookingButton` и `AdminCancelBookingButton`; формы содержат только `bookingId`; подтверждение доступно для `pending` и будущего слота, отмена — для `pending`/`confirmed`.
- [x] В карточке `/admin/bookings` добавить ссылку «Открыть бронь» на `/admin/bookings/${booking.id}`; владельца показывать с `ownerDisplayName` (или `Без имени`), email и `ownerId`.
- [x] Сохранить текущие правила `/admin/bookings`: `requireRole` до данных, без `passwordHash`, без изменения статусов в разметке.

Проверки шага:
- `npx next typegen` — типы маршрутов сгенерированы; `npx tsc --noEmit` — код возврата 0, ошибок нет.
- `npm run lint` — код возврата 0, ошибок и предупреждений нет.
- `npm test` — 50 из 50 тестов, 19 suites, `fail 0`; автотесты `getAdminBooking` остаются в шаге 6.8.
- `npm run build` — успешно; маршрут `/admin/bookings/[id]` зарегистрирован как Partial Prerender.
- `git --no-pager diff --check` — код возврата 0.
- Ошибка: первый `npx tsc --noEmit` не видел новый маршрут в `AppRoutes`, потому что `tsconfig.tsbuildinfo` содержал старый снимок. После `npx next typegen` и удаления кэша `tsconfig.tsbuildinfo` проверка прошла; исходный код не менялся.
- Осталось проверить вручную в браузере: существующий id открывает детализацию, неизвестный id даёт `notFound()`, `user` и гость уходят на `/access-denied` до чтения данных.


### 6.5. Общий `ScheduleTable` и модальные окна

- [x] Создать серверный `app/ui/schedule-content.tsx`: `getCurrentUser()` → `listUpcomingSchedule(viewer)` → серверная подготовка строк/колонок/ячеек; заголовок «Расписание», пояснение про 7 дней и UTC; при отсутствии слотов — «На ближайшие 7 дней слотов нет» без пустой таблицы.
- [x] Строки — только даты, где есть хотя бы один слот; подпись — день недели и дата. Колонки — только уникальные интервалы, где есть слот; сортировка по началу, затем по окончанию; пустых диапазонов и строк нет.
- [x] Создать клиентский `app/ui/schedule-table.tsx`: настоящая `<table>` с `<caption>`, `<thead>`, `<tbody>`, `<th scope="col">` для времени и `<th scope="row">` для даты; sticky первый столбец и горизонтальный скролл на узком экране.
- [x] Реализовать матрицу ячеек:
  - `availableCapacity > 0` → кнопка `Записаться`; при `availableCapacity > 1` — `Свободно: N`;
  - полностью занят и viewer `guest`/`user` → только неинтерактивный текст `Занято`, без кнопки, ссылки, формы и PII;
  - полностью занят и viewer `admin`/`super_admin` → `Занято` плюс по каждой активной брони `displayName` (или `Без имени`), email, `ownerId` и ссылка `Открыть бронь` на `/admin/bookings/[bookingId]`;
  - частично занят у администратора → кнопка `Записаться` и рядом список активных броней; ссылки не входят в форму записи;
  - собственная активная бронь пользователя на полностью занятом слоте также показывается как `Занято`; детали доступны на `/bookings`;
  - собственная активная бронь на частично занятом слоте не убирает кнопку, но сервер вернёт `DUPLICATE_ACTIVE_BOOKING`; отдельного состояния «Вы записаны» в этом объёме нет;
  - слота нет → пустая структурная `<td>` без текста, фона, рамки и интерактива.
- [x] Гостевая кнопка открывает `<dialog>` с датой/временем, текстом «Чтобы записаться, войдите или зарегистрируйтесь» и кнопками «Войти» (`/login`), «Зарегистрироваться» (`/register`), «Отмена»; POST брони не выполняется.
- [x] Для `user`/`admin`/`super_admin` открывается подтверждение с датой, временем и кнопками «Записаться»/«Отмена»; подтверждение отправляет форму только с `slotId` в существующий `createBookingAction`; при успехе — `/bookings`; ошибки `SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `SLOT_IN_PAST`, `SLOT_NOT_FOUND` показываются в окне через `aria-live="polite"`; кнопка на время отправки блокируется и показывает «Запись…».
- [x] `<dialog>`: `showModal()`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`; закрытие по «Отмена», `Esc` и клику по фону; фокус возвращается на кнопку-инициатор; занятые ячейки модальных окон не открывают.
- [x] `showOwners`/аналогичный флаг из серверного DTO использовать только для отображения; права и PII определяются отсутствием данных в DTO, а не флагом.
- [x] Не передавать в клиентский компонент `Date`-объекты и не пересчитывать доступность на клиенте: только готовые подписи и ISO-строки.

Проверки шага:

- `npx next typegen` — типы маршрутов сгенерированы, ошибок нет.
- `npx tsc --noEmit` — код возврата 0, ошибок нет.
- `npm run lint` — код возврата 0, предупреждений и ошибок нет.
- `npm test` — 50 из 50 тестов, 19 suites, `fail 0`; новые проверки матрицы относятся к шагу 6.8.
- `npm run build` — успешно; маршруты и Partial Prerender не изменились, `prisma/` не затрагивался.
- `git --no-pager diff --check` — код возврата 0.
- Ошибки: в первом варианте `DIALOG_CLASS` ширина была записана как `calc(100vw-2rem)` без пробелов — невалидный CSS; заменено на `w-[calc(100vw_-_2rem)] max-w-md`. `schedule-table.tsx` создавался тремя частями из-за лимита размера правки; после сборки проверено, что дублей и разрывов нет.
- Осталось проверить вручную после шага 6.6 (когда компонент смонтирован на страницах): клавиатурная навигация и `Esc`, возврат фокуса на кнопку слота, горизонтальный скролл и sticky первый столбец, клик по фону, отсутствие пустых строк/колонок, вид матрицы для `guest`, `user`, `admin` и `super_admin`.

### 6.6. Страницы `/`, `/slots` и общий `header`

- [x] Переписать `app/page.tsx`: убрать статическую приветственную карточку и ссылки, оставить метаданные и `<Suspense><ScheduleContent /></Suspense>`; страница не вызывает `requireUser`.
- [x] Переписать `app/slots/page.tsx`: та же таблица и та же серверная подготовка, что на `/`; убрать `requireUser`, карточки слотов и ссылки «Мои записи»/«Аккаунт»/«На главную» из тела; метаданные могут отличаться.
- [x] Создать `app/ui/site-header.tsx` — серверный компонент: статическая оболочка с логотипом «Mini Booking System» → `/`, а зависящая от сессии навигация — внутри `<Suspense>` с нейтральным placeholder, чтобы не читать cookie вне границы.
- [x] Навигация по матрице: `guest` — «Расписание» (`/slots`) и «Войти» (`/login`); авторизованные — «Расписание», «Мои записи» (`/bookings`), «Уведомления» (`/notifications`), «Аккаунт» (`/account`), «Выйти»; `admin`/`super_admin` дополнительно «Администрирование» (`/admin`). «Регистрация» отдельным пунктом не выводить.
- [x] «Выйти» — форма с существующим Server Action `logout` (`LogoutButton`), не GET-ссылка.
- [x] Подсветка текущего раздела: `/` и `/slots` — «Расписание», `/bookings` — «Мои записи», `/notifications` — «Уведомления», `/admin*` — «Администрирование», `/account` — «Аккаунт». Клиентский `app/ui/site-header-nav.tsx` получает только готовый список пунктов с сервера, читает `usePathname` и не решает права.
- [x] Смонтировать `<SiteHeader />` в `app/layout.tsx` внутри `<body>` перед `{children}`; в `<head>` интерактивных элементов нет.
- [x] Не добавлять проверки ролей в `header`: защита остаётся на страницах и в серверных модулях; `header` не дублирует формы входа.

Проверки шага:

- `npx next typegen` — типы маршрутов сгенерированы, ошибок нет.
- `npx tsc --noEmit` — код возврата 0, ошибок нет.
- `npm run lint` — код возврата 0, предупреждений и ошибок нет.
- `npm run build` — успешно; `/` и `/slots` остаются Partial Prerender, `header` входит в статическую оболочку, `prisma/` не затрагивался.
- `npm test` — 50 из 50 тестов, 19 suites, `fail 0`; тесты шага 6.6 не добавлялись (матрица — шаг 6.8).
- `git --no-pager diff --check` — код возврата 0.
- Проверка production-сервера без cookie (`npx next start -p 3100`): `/` и `/slots` отвечают 200, редиректа на `/access-denied` нет, `<header>` находится внутри `<body>`, гостевая навигация содержит только «Расписание» и «Войти», защищённых пунктов и формы выхода нет. В HTML гостя нет email, `displayName`, `User.id` владельцев и ссылок `/admin/bookings/`.
- Таблица на `/` и `/slots` совпадает побайтно по извлечённому `<table>` (`tableEqual=True`, 10 676 символов): обе страницы используют один `ScheduleContent`.
- Ошибки: редактор оставил лишнюю пустую строку в конце `app/page.tsx` — `git diff --check` её поймал, файл приведён к одному переводу строки; `app/layout.tsx` после правки получил LF-концы строк — приведены к CRLF, предупреждение Git устранено.
- Осталось проверить вручную на шаге 6.9: навигацию для `user`, `admin` и `super_admin`, выход через форму, подсветку на `/bookings`, `/notifications`, `/admin*`, `/account`, а также клавиатуру и фокус модальных окон, sticky-столбец и горизонтальный скролл таблицы.

### 6.7. Инвалидация расписания

- [x] В `app/actions/bookings.ts` добавить `revalidatePath("/")` в `revalidateBookingViews()`; она вызывается при создании и отмене брони.
- [x] В `revalidateAdminBookingViews()` добавить `revalidatePath("/admin/bookings/[id]", "page")` и сохранить инвалидацию `/admin/bookings`, `/`, `/slots`, `/bookings`, `/notifications`.
- [x] В `app/actions/slots.ts` добавить `revalidatePath("/")` в `revalidateSlotViews()` рядом с `/slots` и `/admin/slots`.
- [x] Не менять контракт `createBookingAction`: только `slotId`; владелец и статус — на сервере; успех — `redirect("/bookings")`.

Проверки шага:

- `npx tsc --noEmit` — код возврата 0, ошибок нет.
- `npm run lint` — код возврата 0, предупреждений и ошибок нет.
- `npm run build` — успешно; маршруты и режим Partial Prerender не изменились, `prisma/` не затрагивался.
- `npm test` — 50 из 50 тестов, 19 suites, `fail 0`; тесты шага 6.7 не добавлялись (автотесты — шаг 6.8).
- `git --no-pager diff --check` — код возврата 0.
- Ошибки: нет.
- Осталось проверить вручную на шаге 6.9: после создания, подтверждения и отмены брони, а также после создания и изменения слота открытые `/`, `/slots`, `/bookings`, `/notifications`, `/admin/bookings` и `/admin/bookings/[id]` обновляются без ручной перезагрузки.

### 6.8. Автотесты

- [x] `tests/slots.test.ts`: добавлены проверки `listUpcomingSchedule` для `viewer = null` и `user` — публичный DTO, нет `activeBookingDetails`/PII (включая устаревшую роль `admin` в объекте сессии); для `admin` и `super_admin` — есть `activeBookingDetails` с `ownerId`, `ownerEmail`, `ownerDisplayName`, `status`; отменённые брони отсутствуют; границы горизонта, сортировка, `availableCapacity` не ниже нуля сохраняются.
- [x] `tests/admin.test.ts`: добавлены проверки `getAdminBooking` — `user` → `FORBIDDEN`, неизвестный id → `null`, `admin`/`super_admin` получают владельца (`ownerId`, `ownerEmail`, `ownerDisplayName`), слот с `capacity`, даты и статус; `cancelled` возвращается; `passwordHash`/`tokenHash`/`userId` отсутствуют.
- [x] Обновлена существующая проверка `listAllBookings`: проверяются отсутствие `passwordHash` и корректные `ownerId`/`ownerDisplayName`.
- [x] Отдельный тест матрицы ячеек не требуется: подготовка строк и ячеек не вынесена в экспортируемую чистую функцию; публичный и административный DTO проверены напрямую.
- [x] Тесты используют отдельную `_test`-базу и не меняют данные разработки; даты зафиксированы в 2099 году; фикстуры удаляются до и после прогона.

Проверки шага:

- `npx tsc --noEmit` — код возврата 0.
- `npm test` — 56 из 56 тестов, 21 suite, `fail 0`; повторный прогон — снова 56 из 56, 21 suite, `fail 0`, результаты идемпотентны.
- `git --no-pager diff --check` — код возврата 0.
- Ошибки: нет.
- Осталось проверить вручную на шаге 6.9: полный smoke-тест гостя, `user`, `admin` и `super_admin`, исходный HTML без PII и инвалидацию `/`/`/slots` после изменений броней и слотов.

### 6.9. Финальные проверки и документация

- [x] `npx tsc --noEmit` — код возврата 0.
- [x] `npm run lint` — код возврата 0, ошибок и предупреждений нет.
- [x] `npm run build` — код возврата 0; `/` и `/slots` остаются Partial Prerender, `/admin/bookings/[id]` зарегистрирован.
- [x] `npm test` — 56 из 56 тестов, 21 suite, `fail 0`.
- [x] Ручной smoke-тест в production-режиме (`next start`, отдельный порт):
  - гость: `/` и `/slots` без cookie отвечают 200, таблица побайтно одинаковая, занятые ячейки содержат `Занято`, свободный слот открывает окно «Войти / Зарегистрироваться / Отмена», форма записи в окне отсутствует;
  - `user`: создание брони → `pending` → `/bookings`; в HTML `/` и `/slots` нет email, `displayName`, `User.id` владельца и ссылок `/admin/bookings/[id]`;
  - `admin`: в занятой ячейке видны владелец и ссылка, `/admin/bookings/[id]` открывается, подтверждение и отмена меняют статус, свободный слот доступен для записи администратора;
  - `super_admin`: та же матрица и доступ к детализации, отдельного интерфейса нет;
  - выход через Server Action очищает cookie, старая сессия уводит на `/access-denied`; гостевая навигация восстанавливается.
- [x] Проверен исходный HTML: `<header>` находится в `<body>`; у `guest`/`user` нет PII владельцев и ссылок на детализацию; у `admin`/`super_admin` они есть. В headless Edge проверены модальные окна: фокус внутри `<dialog>`, закрытие по `Esc` и клику по фону, возврат фокуса на кнопку; занятая ячейка неинтерактивна.
- [x] Визуальная проверка светлой/тёмной темы, sticky-первого столбца и горизонтального скролла на узком экране остаётся ручной; серверное и клавиатурное поведение проверено. CR-48…CR-53 от визуальной проверки не зависят.
- [x] Проверена инвалидация: после создания брони занятость в `/` и `/slots` увеличивается, после подтверждения меняется статус в административной ячейке, после отмены слот снова свободен, после изменения слота видна новая вместимость. Обе страницы расписания обновляются без ручной перезагрузки.
- [x] `README.md` обновлён после проверки: публичные `/`/`/slots`, `/admin/bookings/[id]`, ролевой DTO и `getAdminBooking`, матрица `header`, PII, revalidation, 56 тестов в 21 наборе и новый smoke-сценарий.
- [x] Статус 6.9 обновлён, проверенное и оставшиеся ручные проверки зафиксированы; план цикла перенесён в `docs/archive/plans/`.
- [x] `git commit`/`git push` не выполнялись; команды для ручного запуска даны в отчёте, `tmp.md` не включался.

Проверки пункта:

- Все команды прошли с кодом возврата 0; критерии CR-48…CR-53 подтверждены HTTP- и headless-browser smoke-прогоном.
- `git --no-pager diff --check` — код возврата 0.
- `prisma/`, модели, роли, статусы, зависимости и цветовая палитра не изменялись.
- Особенность Cache Components: `redirect()` из защищённой страницы отдаётся статусом 200 с серверным meta-переходом на `/access-denied`, а `notFound()` — статусом 200 с потоковым not-found UI. Проверка выполнена по содержимому ответа; защищённые данные и PII в него не попадают.
- Временные smoke-пользователи, слоты, брони и уведомления удалены; сессии smoke-пользователей удалены каскадом. Dev-база не содержит этих временных записей; seed-пользователь и seed-слоты сохранены. Временные скрипты, логи и профиль браузера удалены.
- Ошибок приложения не выявлено.

### 6.10. Следующий узкий запрос

Цикл 6 закрыт: шаги 6.1–6.9 выполнены. Новый объём работ начинается только после обновления `spec.md` и отдельного пункта в новом активном `Plan.md`. Не изменять `prisma/` и не добавлять роли, статусы, модели или зависимости без отдельного решения.

