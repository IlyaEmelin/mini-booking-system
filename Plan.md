# Plan.md: активный план

## 1. Текущий статус

- Дата: 18.10.2026.
- Активный пункт: раздел 6 — публичное расписание, общий `header` и детализация брони.
- Последнее изменение: `Plan.md` дополнен шагами 6.1…6.10 по `spec.md` и `docs/design/home-slots-and-header.md`.
- Документ дизайна: [`docs/design/home-slots-and-header.md`](docs/design/home-slots-and-header.md).
- Следующий шаг: 6.1 — сверка API Next.js 16 / Prisma 8 и baseline; код ещё не изменён.
- Последний закрытый цикл: `4.3.4 simplified booking flow`.
- Закрытый план: [`docs/archive/plans/Plan-4.3.4-simplified-booking-flow.md`](docs/archive/plans/Plan-4.3.4-simplified-booking-flow.md).
- Новый объём работ начинается только после обновления `spec.md` и отдельного пункта в этом файле.

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

- Статус: активен; реализация не начата, выполняется шаг 6.1.
- Источники: `spec.md` — FR-30, FR-33…FR-38, NFR-19…NFR-22, CR-42, CR-44, CR-47…CR-53; `docs/design/home-slots-and-header.md` — разделы 2…10.
- Цель: `/` и `/slots` показывают одно публичное расписание всех будущих слотов горизонта; `guest`/`user` не получают PII владельцев, `admin`/`super_admin` видят активные брони и переходят в `/admin/bookings/[id]`; общий серверный `header` строится по роли.
- Границы: не менять модели, миграции, роли, статусы, зависимости, auth-контур и цветовую палитру; не добавлять поиск, фильтры, пагинацию, перенос брони, возврат к слоту после входа и управление пользователями.
- Затрагиваемые файлы:
  - изменить: `app/lib/slots.ts`, `app/lib/bookings.ts`, `app/page.tsx`, `app/slots/page.tsx`, `app/layout.tsx`, `app/admin/bookings/page.tsx`, `app/actions/bookings.ts`, `app/actions/slots.ts`, `README.md`, `tests/slots.test.ts`, `tests/admin.test.ts`;
  - создать: `app/admin/bookings/[id]/page.tsx`, `app/ui/site-header.tsx`, `app/ui/schedule-content.tsx`, `app/ui/schedule-table.tsx`, при необходимости `app/ui/nav-link.tsx`;
  - не изменять: `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, модели `User`/`Session`, `package.json`, `next.config.ts`, `tmp.md`.
- Контракт данных: `listUpcomingSchedule(viewer: SessionUser | null, now?: Date)`; публичный DTO — только `id`, `startsAt`, `endsAt`, `capacity`, `activeBookings`, `availableCapacity`, `isUpcoming`; административный DTO дополнительно содержит активные брони `bookingId`, `ownerId`, `ownerEmail`, `ownerDisplayName` (может быть `null`) и `status`. `passwordHash`, `tokenHash` и служебные поля не возвращаются ни одной роли.

### 6.1. Сверка API и базовый срез

- [ ] Прочитать в `node_modules/next/dist/docs/` разделы о `params` страницы (Promise + `PageProps<'/admin/bookings/[id]'>`), `<Suspense>` и Cache Components, `revalidatePath`; не опираться на память о Next.js 15.
- [ ] Сверить Prisma 8 по скиллу `prisma-8` и `npx prisma --help`: `select`, `include`, `where`, `orderBy`, `forUpdate`, `aggregate` в используемом стиле проекта.
- [ ] Зафиксировать исходное состояние: `git status --short`, `npx tsc --noEmit`, `npm run lint`; ошибок baseline нет.
- [ ] Убедиться, что `tmp.md` не отслеживается и в изменения не попадает.

Проверки шага: команды выполнены, результаты записаны в отчёт; код приложения не изменён.

### 6.2. Ролевой DTO расписания в `app/lib/slots.ts`

- [ ] Сохранить `SlotAvailability`, `listUpcomingSlots(now?)` и `getSlotAvailability(slotId, now?)` без изменения контракта: они нужны `/admin/slots` и существующим тестам.
- [ ] Добавить экспортируемые типы:
  - `ScheduleBookingSummary` — `bookingId`, `ownerId`, `ownerEmail`, `ownerDisplayName: string | null`, `status: "pending" | "confirmed"`;
  - `PublicScheduleSlot` — текущий `SlotAvailability`;
  - `AdminScheduleSlot` — `PublicScheduleSlot` плюс `activeBookingDetails: readonly ScheduleBookingSummary[]`;
  - `UpcomingSchedule` — дискриминированное объединение `{ visibility: "public"; slots: readonly PublicScheduleSlot[] }` и `{ visibility: "admin"; slots: readonly AdminScheduleSlot[] }`.
- [ ] Реализовать `listUpcomingSchedule(viewer, now = new Date())`:
  - `viewer === null` → публичная выборка без `User`, без массива броней;
  - `viewer !== null` → роль перечитать из базы по `viewer.id`; `admin`/`super_admin` → административная выборка, `user` → публичная; роль из формы, query или клиентского состояния не принимается;
  - фильтр `startsAt > now` и `startsAt < now + 7 суток`, сортировка по `startsAt.asc()`, затем по `endsAt.asc()`;
  - публичный запрос выбирает только `Slot.id/startsAt/endsAt/capacity` и считает активные брони (`pending` + `confirmed`); `availableCapacity = max(0, capacity - activeBookings)`;
  - административный запрос одной выборкой включает активные брони с `id`, `status` и владельцем `id`, `email`, `displayName`; отменённые брони исключены; порядок владельцев детерминирован (`createdAt.asc()`, затем `id.asc()`);
  - PII не выбирается и не маппится для `guest`/`user`; фильтрация в разметке или CSS не используется.
- [ ] Не добавлять в DTO `passwordHash`, `tokenHash`, `userId` владельца вне `ownerId` административного DTO и служебные поля.
- [ ] Добавить в `app/lib/slots.ts` краткий комментарий о ролевом DTO и границе PII со ссылками FR-34…FR-36, NFR-20, NFR-21.

Проверки шага: `npx tsc --noEmit`; после появления тестов 6.8 — публичный DTO не содержит ключей `activeBookingDetails`, `ownerEmail`, `ownerId`, `ownerDisplayName`; административный содержит только активные брони.

### 6.3. Административная сводка и `getAdminBooking` в `app/lib/bookings.ts`

- [ ] Расширить `AdminBookingSummary`: `ownerId`, `ownerDisplayName: string | null`, `ownerEmail`; вложенный слот дополнить `capacity` (отдельный административный тип слота, чтобы не расширять `BookingSummary` владельца).
- [ ] В `listAllBookings` выбирать `User.id`, `User.email`, `User.displayName`; маппить `ownerId: row.user.id`, `ownerDisplayName: row.user.displayName`; `passwordHash` не выбирать.
- [ ] Добавить `getAdminBooking(actor: SessionUser, bookingId: string): Promise<AdminBookingSummary | null>`:
  - роль `admin`/`super_admin` перечитать из базы до чтения брони, иначе `BookingError("FORBIDDEN")`;
  - принимать только `bookingId`; `actor.id` не используется как фильтр владельца;
  - выбирать бронь по `id` с `slot` (`id`, `startsAt`, `endsAt`, `capacity`) и `user` (`id`, `email`, `displayName`), включая `cancelled`;
  - неизвестный идентификатор → `null`, а не вымышленный объект; `notFound()` вызывает страница;
  - не возвращать `passwordHash`, `tokenHash`, `userId` и служебные поля.
- [ ] Обновить комментарии и JSDoc типов; не менять транзакции создания, подтверждения и отмены.

Проверки шага: `npx tsc --noEmit`; `getAdminBooking` для `user` даёт `FORBIDDEN`, для неизвестного id — `null`, для `cancelled` возвращает владельца.

### 6.4. Защищённая детализация `/admin/bookings/[id]`

- [ ] Создать `app/admin/bookings/[id]/page.tsx`; тип — `PageProps<"/admin/bookings/[id]">`, `params` читать через `await`.
- [ ] Вызвать `requireRole(["admin", "super_admin"])` до чтения данных; затем `getAdminBooking(actor, id)`; при `null` — `notFound()`.
- [ ] Чтение сессии и данных разместить за границей `<Suspense>` с нейтральным fallback, как на существующих защищённых страницах (NFR-21).
- [ ] Показать: email владельца, `displayName` или `Без имени`, `User.id`, слот (дата, время, вместимость), статус, `createdAt`, `confirmedAt`, `cancelledAt`; форматирование дат — UTC на сервере.
- [ ] Использовать существующие `ConfirmBookingButton` и `AdminCancelBookingButton`; формы содержат только `bookingId`; подтверждение доступно для `pending` и будущего слота, отмена — для `pending`/`confirmed`.
- [ ] В карточке `/admin/bookings` добавить ссылку «Открыть бронь» на `/admin/bookings/${booking.id}`; владельца показывать с `ownerDisplayName` (или `Без имени`), email и `ownerId`.
- [ ] Сохранить текущие правила `/admin/bookings`: `requireRole` до данных, без `passwordHash`, без изменения статусов в разметке.

Проверки шага: `npx tsc --noEmit`; вручную — существующий id открывает детализацию, неизвестный даёт `notFound()`, `user` и гость уходят на `/access-denied` до чтения данных.

### 6.5. Общий `ScheduleTable` и модальные окна

- [ ] Создать серверный `app/ui/schedule-content.tsx`: `getCurrentUser()` → `listUpcomingSchedule(viewer)` → серверная подготовка строк/колонок/ячеек; заголовок «Расписание», пояснение про 7 дней и UTC; при отсутствии слотов — «На ближайшие 7 дней слотов нет» без пустой таблицы.
- [ ] Строки — только даты, где есть хотя бы один слот; подпись — день недели и дата. Колонки — только уникальные интервалы, где есть слот; сортировка по началу, затем по окончанию; пустых диапазонов и строк нет.
- [ ] Создать клиентский `app/ui/schedule-table.tsx`: настоящая `<table>` с `<caption>`, `<thead>`, `<tbody>`, `<th scope="col">` для времени и `<th scope="row">` для даты; sticky первый столбец и горизонтальный скролл на узком экране.
- [ ] Реализовать матрицу ячеек:
  - `availableCapacity > 0` → кнопка `Записаться`; при `availableCapacity > 1` — `Свободно: N`;
  - полностью занят и viewer `guest`/`user` → только неинтерактивный текст `Занято`, без кнопки, ссылки, формы и PII;
  - полностью занят и viewer `admin`/`super_admin` → `Занято` плюс по каждой активной брони `displayName` (или `Без имени`), email, `ownerId` и ссылка `Открыть бронь` на `/admin/bookings/[bookingId]`;
  - частично занят у администратора → кнопка `Записаться` и рядом список активных броней; ссылки не входят в форму записи;
  - собственная активная бронь пользователя на полностью занятом слоте также показывается как `Занято`; детали доступны на `/bookings`;
  - собственная активная бронь на частично занятом слоте не убирает кнопку, но сервер вернёт `DUPLICATE_ACTIVE_BOOKING`; отдельного состояния «Вы записаны» в этом объёме нет;
  - слота нет → пустая структурная `<td>` без текста, фона, рамки и интерактива.
- [ ] Гостевая кнопка открывает `<dialog>` с датой/временем, текстом «Чтобы записаться, войдите или зарегистрируйтесь» и кнопками «Войти» (`/login`), «Зарегистрироваться» (`/register`), «Отмена»; POST брони не выполняется.
- [ ] Для `user`/`admin`/`super_admin` открывается подтверждение с датой, временем и кнопками «Записаться»/«Отмена»; подтверждение отправляет форму только с `slotId` в существующий `createBookingAction`; при успехе — `/bookings`; ошибки `SLOT_FULL`, `DUPLICATE_ACTIVE_BOOKING`, `SLOT_IN_PAST`, `SLOT_NOT_FOUND` показываются в окне через `aria-live="polite"`; кнопка на время отправки блокируется и показывает «Запись…».
- [ ] `<dialog>`: `showModal()`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`; закрытие по «Отмена», `Esc` и клику по фону; фокус возвращается на кнопку-инициатор; занятые ячейки модальных окон не открывают.
- [ ] `showOwners`/аналогичный флаг из серверного DTO использовать только для отображения; права и PII определяются отсутствием данных в DTO, а не флагом.
- [ ] Не передавать в клиентский компонент `Date`-объекты и не пересчитывать доступность на клиенте: только готовые подписи и ISO-строки.

Проверки шага: `npx tsc --noEmit`, `npm run lint`; вручную — клавиатурная навигация, `Esc`, возврат фокуса, горизонтальный скролл, отсутствие пустых строк/колонок.

### 6.6. Страницы `/`, `/slots` и общий `header`

- [ ] Переписать `app/page.tsx`: убрать статическую приветственную карточку и ссылки, оставить метаданные и `<Suspense><ScheduleContent /></Suspense>`; страница не вызывает `requireUser`.
- [ ] Переписать `app/slots/page.tsx`: та же таблица и та же серверная подготовка, что на `/`; убрать `requireUser`, карточки слотов и ссылки «Мои записи»/«Аккаунт»/«На главную» из тела; метаданные могут отличаться.
- [ ] Создать `app/ui/site-header.tsx` — серверный компонент: статическая оболочка с логотипом «Mini Booking System» → `/`, а зависящая от сессии навигация — внутри `<Suspense>` с нейтральным placeholder, чтобы не читать cookie вне границы.
- [ ] Навигация по матрице: `guest` — «Расписание» (`/slots`) и «Войти» (`/login`); авторизованные — «Расписание», «Мои записи» (`/bookings`), «Уведомления» (`/notifications`), «Аккаунт» (`/account`), «Выйти»; `admin`/`super_admin` дополнительно «Администрирование» (`/admin`). «Регистрация» отдельным пунктом не выводить.
- [ ] «Выйти» — форма с существующим Server Action `logout` (`LogoutButton`), не GET-ссылка.
- [ ] Подсветка текущего раздела: `/` и `/slots` — «Расписание», `/bookings` — «Мои записи», `/notifications` — «Уведомления», `/admin*` — «Администрирование», `/account` — «Аккаунт». Если для `usePathname` нужен клиентский компонент, он получает только готовый список пунктов с сервера и не решает права.
- [ ] Смонтировать `<SiteHeader />` в `app/layout.tsx` внутри `<body>` перед `{children}`; в `<head>` интерактивных элементов нет.
- [ ] Не добавлять проверки ролей в `header`: защита остаётся на страницах и в серверных модулях; `header` не дублирует формы входа.

Проверки шага: `npx tsc --noEmit`, `npm run lint`, `npm run build`; `/` и `/slots` без cookie не редиректят на `/access-denied`; в исходном HTML гостя нет защищённых пунктов и PII.

### 6.7. Инвалидация расписания

- [ ] В `app/actions/bookings.ts` добавить `revalidatePath("/")` в `revalidateBookingViews()`; она вызывается при создании и отмене брони.
- [ ] В `revalidateAdminBookingViews()` добавить `revalidatePath("/admin/bookings/[id]", "page")` и сохранить инвалидацию `/admin/bookings`, `/`, `/slots`, `/bookings`, `/notifications`.
- [ ] В `app/actions/slots.ts` добавить `revalidatePath("/")` в `revalidateSlotViews()` рядом с `/slots` и `/admin/slots`.
- [ ] Не менять контракт `createBookingAction`: только `slotId`; владелец и статус — на сервере; успех — `redirect("/bookings")`.

Проверки шага: после создания, подтверждения и отмены брони, а также после создания и изменения слота обновляются `/`, `/slots`, `/bookings`, `/notifications` и административные страницы.

### 6.8. Автотесты

- [ ] `tests/slots.test.ts`: добавить проверки `listUpcomingSchedule` для `viewer = null` и `user` — публичный DTO, нет `activeBookingDetails`/PII; для `admin` и `super_admin` — есть `activeBookingDetails` с `ownerId`, `ownerEmail`, `ownerDisplayName`, `status`; отменённые брони отсутствуют; границы горизонта, сортировка, `availableCapacity` не ниже нуля сохраняются.
- [ ] `tests/admin.test.ts`: добавить `getAdminBooking` — `user` → `FORBIDDEN`, неизвестный id → `null`, `admin`/`super_admin` получают владельца (`ownerId`, `ownerEmail`, `ownerDisplayName`), слот с `capacity`, даты и статус; `cancelled` возвращается; `passwordHash`/`tokenHash`/`userId` отсутствуют.
- [ ] Обновить существующую проверку `listAllBookings`: вместо отсутствия `userId` проверять отсутствие `passwordHash` и корректные `ownerId`/`ownerDisplayName`.
- [ ] Если серверная подготовка ячеек вынесена в чистую функцию, добавить тест матрицы: занятый слот для `guest`/`user` без PII; для `admin` — владелец и `bookingId`; пустая ячейка без контента; строки/колонки только с слотами.
- [ ] Тесты используют отдельную `_test`-базу и не меняют данные разработки; даты фиксированы в 2099 году; фикстуры удаляются до и после прогона.

Проверки шага: `npm test`; число проверок в отчёте обновлено; повторный прогон идемпотентен.

### 6.9. Финальные проверки и документация

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] Ручной smoke-тест:
  - гость: `/` и `/slots` без cookie, таблица всех слотов, занятые `Занято`, клик по свободному → окно входа/регистрации, бронь не создаётся;
  - `user`: подтверждение → `pending` → `/bookings`; в HTML нет PII владельцев и ссылок `/admin/bookings/[id]`;
  - `admin`: видит владельца и ссылку в занятой ячейке, открывает `/admin/bookings/[id]`, подтверждает и отменяет; может записаться на свободный слот;
  - `super_admin`: та же матрица, отдельного интерфейса нет;
  - выход → гостевая навигация.
- [ ] Проверить исходный HTML: `<header>` в `<body>`; у `guest`/`user` нет email, `displayName`, `User.id` владельцев и ссылок на детализацию; у `admin` они есть.
- [ ] Проверить инвалидацию: открыть `/` и `/slots` в двух вкладках; создать, подтвердить и отменить бронь, изменить слот — занятость и список обновляются без ручной перезагрузки.
- [ ] Обновить `README.md` после проверки: маршруты `/admin/bookings/[id]`, публичный `/`/`/slots`, новые серверные функции, матрица `header`, количество тестов, smoke-тест, отсутствие PII у `guest`/`user`.
- [ ] Обновить статус этого пункта в `Plan.md`, перечислить проверенное и оставшееся для ручной проверки; при закрытии цикла перенести план в `docs/archive/plans/`.
- [ ] Не выполнять `git commit`/`git push` без прямого указания; в отчёте дать команды для ручного запуска и не включать `tmp.md`.

Проверки пункта: все команды проходят; критерии CR-48…CR-53 подтверждены вручную; `git diff --check` — код возврата 0; изменения не затрагивают `prisma/`, модели, роли, статусы и зависимости.

### 6.10. Следующий узкий запрос

Следующий узкий запрос — выполнить только шаг 6.1 (сверка API и baseline), затем 6.2. Не начинать UI и не менять `prisma/` до завершения серверного DTO и его проверок.
