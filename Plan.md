# Plan.md: 4.3.2 Регистрация, вход и роли (auth-lite)

Источник требований — `spec.md`, правила работы агента — `AGENTS.md`, документация запуска — `README.md`.
Обязательный цикл проекта: `spec.md` → **`Plan.md`** → `AGENTS.md` → Code → Check → `README.md` (CR-28).

## 1. Текущий статус

- Приоритет: P0.
- Текущее состояние: локальный проект Mini Booking System создан (`create-next-app`), зависимости установлены, базовые команды работают; Prisma-схемы, миграций, auth-кода, форм, seed и тестов пока нет.
- Цель цикла: собрать минимальный `auth-lite`-фрагмент, который продолжится в уроках 4.3.3 и 4.3.4.
- Ограничение объёма: не расширять продукт до слотов, бронирований, уведомлений, полного booking flow, внешних каналов (OAuth, email, SMS, calendar, desktop) и деплоя; административные функции не реализуются, `/admin` — только проверка роли.
- Контекстные файлы: `spec.md`, `Plan.md`, `AGENTS.md`; финальный runbook — `README.md`.
- Сейчас в работе: **Шаг 4. Выровнять версии Prisma и подготовить `package.json`** (шаги 0–3 закрыты).
- Последняя проверка: Шаг 3 — список файлов сверен с разделом «Структура файлов» `spec.md` (строки 261–283), лишних файлов нет; справка Prisma CLI 8 прочитана (`contract emit`, `migration plan`, `db migrate`, `db update`, `db verify`/`db sign`); документация Next.js 16 прочитана (`01-app/02-guides/forms.md`, `01-app/03-api-reference/04-functions/redirect.md`, `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`, `01-app/02-guides/authentication-with-cache-components.md`); выяснено, что команд `prisma migrate dev` и `prisma db seed` в этой версии CLI нет.
- Ошибки и блокеры: до выравнивания версий Prisma (шаг 4) схема, миграции и генерация клиента не создаются (CR-32); команда `prisma migrate dev`, записанная ранее в Шаге 4, в Prisma 8.0.0-rc.22 отсутствует — заменена на `prisma migration plan` + `prisma db migrate` (уточнение Шага 3).
- Следующий шаг после активного: Шаг 5. Подготовить окружение.

### 1.1 Сверка с репозиторием (факты, проверено)

- Есть: `spec.md`, `AGENTS.md`, `prisma.config.ts`, `.env`, `.env.example`, `.gitignore`, `README.md` (шаблонный), `app/layout.tsx`, `app/page.tsx` (стартовый экран), `app/globals.css`, `app/favicon.ico`.
- Нет: `prisma/schema.prisma`, `prisma/migrations`, каталогов `app/lib/`, `app/actions/`, `app/ui/`, `tests/`, `scripts/`.
- npm-скрипты есть: `dev`, `build`, `start`, `lint`, `postinstall`. Нет: `db:migrate`, `db:seed`, `sessions:cleanup`, `test` (шаг 4).
- Версии Prisma рассинхронизированы: установлены `prisma` 8.0.0-rc.22 и `@prisma/client` 7.10.0 (`npm ls prisma @prisma/client`, `npx prisma --version`; шаг 4).
- `.env.example` содержит рабочий placeholder-пароль `SEED_SUPER_ADMIN_PASSWORD="password"` — по CR-27 недопустимо (шаг 5).
- `.env` и `.env.test` игнорируются шаблоном `.env*` из `.gitignore`; `.env.example` из-под шаблона исключён (проверено `git check-ignore`).
- `AGENTS.md` содержит управляемый блок `nextjs-agent-rules`, правила auth-фазы, правила Git и обязательный цикл работы: шаг 2 закрыт.
- Version-специфика: Next.js 16.4.1, Turbopack, Cache Components; перед кодом читать `node_modules/next/dist/docs/` (правило `AGENTS.md`).
- Тестовый раннер: встроенный `node:test` через установленный `tsx` 4.23.15; новых зависимостей не требуется (NFR-9).
- Prisma CLI 8.0.0-rc.22 — контур v8: `contract emit`, `migration plan`, `db migrate`, `db update`, `db verify`/`db sign`; команд `prisma migrate dev` и `prisma db seed` нет (проверено `npx prisma --help`, `npx prisma contract --help`, `npx prisma migration --help`, `npx prisma migration plan --help`, `npx prisma db --help`, `npx prisma db migrate --help`, `npx prisma db update --help`, `npx prisma migrate dev --help`).
- `useActionState` доступен: в проекте React 19.3.0, экспорт из `react` есть (проверено `node -e "require('react').useActionState"` → `function`).

### 1.2 Целевой сценарий

Пользователь проходит один минимальный маршрут:

1. Создать локальный проект Mini Booking System на стеке Next.js, React, TypeScript, Tailwind CSS, Zod, PostgreSQL, Prisma, npm.
2. Зафиксировать auth-рамку в `spec.md`.
3. Зафиксировать пошаговую работу в `Plan.md`.
4. Обновить `AGENTS.md` под правила auth-фазы.
5. Открыть формы регистрации и входа как `guest`.
6. Зарегистрировать пользователя с ролью `user`.
7. Сохранить только `passwordHash`, созданный через `bcryptjs.hash(password, 12)`.
8. Войти через проверку `bcryptjs.compare(inputPassword, user.passwordHash)`.
9. Попасть в аккаунт только после серверной проверки сессии.
10. Проверить, что `seed`-пользователь с ролью `super_admin` проходит серверную проверку повышенной роли.
11. Выйти и убедиться, что прежняя cookie больше не даёт доступа.
12. Обновить финальный `README.md` с командами запуска и smoke-тестом.

## 2. Требования к результату

- Проект создан локально и запускается командами из `package.json`.
- `spec.md` описывает только регистрацию, вход, сессию, роли и первый контур аккаунта.
- `Plan.md` ведёт работу маленькими проверяемыми шагами и обновляется после каждого пункта.
- `AGENTS.md` запрещает выходить за границы auth-фазы без отдельной задачи.
- Роли зафиксированы как `guest`, `user`, `admin`, `super_admin`.
- Новая регистрация создаёт пользователя с ролью `user`; роль никогда не берётся из формы.
- Ровно один `super_admin` создаётся через `seed`, а не через обычную регистрацию.
- Пароль в базе не хранится в открытом виде; хранится только `passwordHash`.
- Для паролей используется `bcryptjs` строго с 12 раундами; вход проверяется через `bcryptjs.compare`.
- Проверки сессии и ролей выполняются на серверной стороне, а не только в React-компонентах.
- Аккаунт доступен только авторизованному пользователю.
- В аккаунте есть пустой контур будущих записей и внутренних уведомлений, но нет рабочего booking flow.
- `README.md` обновлён в конце и объясняет запуск, `seed`, роли и проверки.
- OAuth, email, SMS, calendar, desktop-уведомления, deploy, slots, bookings и notifications в этом уроке не реализуются.
- Административные функции не реализуются: `/admin` — проверочный маршрут без изменения данных.

## 3. Цикл выполнения (один активный пункт)

Работа идёт строго по одному активному пункту `Plan.md`:

1. Взять из раздела «Активный пункт» ровно один шаг, остальные не начинать.
2. Выполнить действие только этого шага, не забегая в следующий.
3. Запустить проверку, записанную в этом шаге, и сохранить её фактический вывод.
4. Перевести чек-боксы шага из `[ ]` в `[x]`, только если проверка пройдена.
5. Записать в поля шага `Статус`, `Проверка`, `Ошибки`, `Следующий шаг` и добавить строку в журнал (раздел 8).
6. Перевести «Активный пункт» на следующий шаг — и только затем начинать следующий пункт.

Статусы: `todo` — не начат, `in_progress` — активный, `done` — проверка пройдена, `blocked` — есть блокер, который фиксируется в поле `Ошибки`.

Если на шаге появляется блокер, следующий шаг не начинается: блокер фиксируется в `Plan.md`, а шаг либо решается, либо эскалируется разработчику.

Шаг считается завершённым только после выполнения команды проверки, записанной в этом плане.

## 4. Активный пункт

**Шаг 4. Выровнять версии Prisma и подготовить `package.json`.**

Блокирующее условие: схема, миграции и генерация клиента не создаются до выравнивания версий Prisma (шаг 4, CR-32).
Правило порядка: список файлов и порядок правок зафиксированы на шаге 3; далее окружение и схема (шаги 5–6) идут до первого auth-кода (шаги 8–11).
Основание: Шаг 3 закрыт — список файлов сверен со `spec.md` (раздел «Структура файлов»), команды Prisma 8 и API форм Next.js 16 подтверждены по справке CLI и `node_modules/next/dist/docs/`.

## 5. Шаги

### Шаг 0. Сверить каркас проекта и базовые команды — `done`

- [x] Проверить структуру проекта: Next.js App Router (16.4.1), `app/` содержит только `layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico`.
- [x] Проверить зависимости и npm-скрипты: `dev`, `build`, `start`, `lint`, `postinstall`; соседние домены продукта не добавлены.
- [x] Выполнить базовые команды проекта.
- Действие: убедиться, что локальный проект создан и базовые команды работают.
- Результат: минимальный рабочий каркас Mini Booking System; факты о структуре проекта зафиксированы в разделе 1.1.
- Проверка: `npm run lint` — без ошибок; `npm run build` — успешно, маршруты `/` и `/_not-found`.
- Статус: `done`.
- Ошибки: нет.
- Следующий шаг: Шаг 1.

### Шаг 1. Зафиксировать `spec.md` — `done`

- [x] Описать `auth-lite`: регистрация, вход, серверная сессия в базе, аккаунт, проверки ролей.
- [x] Зафиксировать матрицу ролей `guest`, `user`, `admin`, `super_admin` и правило «роль не берётся из формы».
- [x] Зафиксировать данные пользователя (`passwordHash`, `role`, `displayName`) и модель `Session`.
- [x] Зафиксировать границы урока и критерии готовности (CR-1…CR-32).
- Действие: описать `auth-lite`, матрицу ролей, данные пользователя, границы урока и критерии готовности.
- Результат: `spec.md` — источник требований для auth-фрагмента.
- Проверка: в `spec.md` есть роли `guest`, `user`, `admin`, `super_admin`, запрет plain text пароля, серверные проверки и запрет внешних каналов.
- Статус: `done`.
- Ошибки: нет.
- Следующий шаг: Шаг 2.

### Шаг 2. Обновить `AGENTS.md` под auth-фазу — `done`

- [x] Дополнить `AGENTS.md` проектными правилами auth-фазы: пароль не хранится в открытом виде, используется `bcryptjs`, проверки ролей выполняются только на сервере.
- [x] Запретить выход за границы урока: slots, bookings, notifications, OAuth, email, SMS, calendar, desktop-уведомления, deploy, административные функции.
- [x] Зафиксировать обязательный цикл работы: `spec.md` → `Plan.md` → `AGENTS.md` → Code → Check → `README.md`, один активный пункт `Plan.md`.
- [x] Зафиксировать правило читать справку Prisma CLI и документацию Next.js из `node_modules/next/dist/docs/` до написания кода.
- [x] Разделить зоны: `AGENTS.md` — правила работы, `spec.md` — требования; не дублировать спецификацию целиком.
- Действие: добавить проектные правила для ИИ под текущую auth-фазу.
- Результат: `AGENTS.md` задаёт границы auth-фазы: раздел «Правила `auth-lite`» (роль `user` при регистрации, один `super_admin` через seed, только `passwordHash`, `bcryptjs.hash(password, 12)` и `compare`, серверные проверки), раздел «Вне текущей фазы» (slots, bookings, notifications, OAuth, email, SMS, calendar, desktop, deploy, административные функции, новые зависимости), обязательный цикл, разделение зон `spec.md`/`AGENTS.md` и правило сверяться со справкой Prisma CLI и документацией Next.js 16; управляемый блок `nextjs-agent-rules` восстановлен.
- Проверка: в `AGENTS.md` есть правила auth-фазы и запрет соседних доменов; файл не заменяет `spec.md` и не превращается в общий учебник; `node -e "require('./node_modules/next/dist/server/lib/generate-agent-files.js').hasCurrentAgentRules(process.cwd())"` → `true` (`next dev` не переписывает файл); `npm run lint` — без ошибок; `npm run build` — успешно, маршруты `/` и `/_not-found`.
- Статус: `done`.
- Ошибки: нет.
- Следующий шаг: Шаг 3.

### Шаг 3. Найти реальные точки изменения — `done`

- [x] Подтвердить по `spec.md` и фактическому дереву проекта список файлов: `prisma/schema.prisma`, `prisma/seed.ts`, `app/lib/*`, `app/actions/auth.ts`, `app/ui/*-form.tsx`, страницы `/`, `/register`, `/login`, `/account`, `/admin`, `/access-denied`, `scripts/cleanup-sessions.ts`, `tests/`.
- [x] Уточнить синтаксис команд Prisma: `npx prisma contract --help`, `npx prisma migration --help`, `npx prisma db --help`.
- [x] Сверить API форм Next.js 16 по `node_modules/next/dist/docs/` (`useActionState`, Server Actions, `redirect`, Cache Components).
- [x] Записать порядок правок: окружение → схема и миграция → seed → lib → actions → страницы → тесты → README.
- Действие: определить файлы для страниц auth, Server Actions, Prisma-схемы, seed, session helpers и role checks.
- Результат:
  1. **Список файлов** — сверен со `spec.md`, раздел «Структура файлов (плановая)», строки 261–283; лишних файлов нет:
     - `prisma/schema.prisma` — новый: PSL-контракт `User`, `Session`, `enum Role` (шаг 6); `prisma/migrations/` — новый каталог, хранится в репозитории (шаг 6).
     - `prisma/seed.ts` — новый: идемпотентный `super_admin` из `SEED_SUPER_ADMIN_*` (шаг 7).
     - `app/lib/` — новый каталог: `db.ts`, `env.ts`, `password.ts`, `session.ts`, `auth.ts`, `validation.ts` (шаги 8–9).
     - `app/actions/auth.ts` — новый: `register`, `login`, `logout` под `'use server'` (шаги 9–10).
     - `app/ui/` — новый каталог: `register-form.tsx`, `login-form.tsx`, `logout-button.tsx` (шаги 9–12).
     - Страницы: `app/page.tsx` — правится (ссылки на `/login` и `/register`); новые `app/register/page.tsx`, `app/login/page.tsx`, `app/account/page.tsx`, `app/admin/page.tsx`, `app/access-denied/page.tsx` (шаги 9–13).
     - `scripts/cleanup-sessions.ts` — новый (шаг 13); `tests/` — новый каталог (шаг 14).
     - `package.json` — правится: версии Prisma и скрипты (шаг 4); `.env.example` — правится, `.env` и `.env.test` — локальные (шаг 5).
     - `prisma.config.ts` — правится только если v8 требует явно указать PSL-файл или каталог миграций (проверка на шаге 6; `spec.md`, строка 247).
     - Не создаются: `proxy.ts`/`middleware.ts` (`spec.md`, строка 253), `app/api/*`, модели и страницы slots, bookings, notifications (вне фазы).
     - Фактическое дерево: в `app/` только `layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico`; каталогов `app/lib/`, `app/actions/`, `app/ui/`, `tests/`, `scripts/`, `prisma/` нет.
  2. **Команды Prisma 8.0.0-rc.22** (подтверждено справкой CLI): контракт — `npx prisma contract emit` (PSL → `contract.json`, `contract.d.ts`); новая миграция — `npx prisma migration plan --name <slug>` (пакет из изменений контракта, offline, на пустом каталоге baseline от `db`-ref); применение — `npx prisma db migrate` (по on-disk миграциями) либо `npx prisma db update` (по контракту, есть `--dry-run`); состояние — `npx prisma migration status|list|log|check`, `npx prisma db verify|sign`. Команд `prisma migrate dev` и `prisma db seed` нет: `npm run db:migrate` = `prisma migration plan` + `prisma db migrate`, seed остаётся скриптом `tsx prisma/seed.ts` (`spec.md`, строка 248).
  3. **API форм Next.js 16 / React 19** (прочитано в `node_modules/next/dist/docs/`): `useActionState` из `react` — `const [state, formAction, pending] = useActionState(action, initialState)`, `<form action={formAction}>`, `pending` отключает кнопку отправки, ошибки рендерятся из `state` (`aria-live="polite"`) — `01-app/02-guides/forms.md`, строки 190–296; сигнатура Server Action с `useActionState` — `(prevState, formData)` — `forms.md`, строка 194, `01-app/01-getting-started/07-mutating-data.md`, `10-error-handling.md`; `redirect` из `next/navigation` вызывается вне `try/catch` (бросает `NEXT_REDIRECT`), в Server Action по умолчанию `push`, при progressive enhancement — 303 — `01-app/03-api-reference/04-functions/redirect.md`, строки 10–56; Cache Components (`cacheComponents: true`, `partialPrefetching: true` уже в `next.config.ts`) требует читать `cookies()` только внутри `<Suspense>` (иначе ошибка сборки), кеширование — через `use cache` / `use cache: private` / `cacheTag` / `cacheLife`, при этом проверки доступа не кешируются (`spec.md`, NFR-7) — `01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md` и `01-app/02-guides/authentication-with-cache-components.md`, строки 18–117.
  4. **Порядок правок**: окружение (шаг 5) → контракт и миграция (шаг 6) → seed (шаг 7) → `app/lib/*` (шаги 8–9) → `app/actions/auth.ts` (шаги 9–10) → страницы и формы (шаги 9–13) → тесты и `scripts/cleanup-sessions.ts` (шаги 13–14) → `README.md` (шаг 15).
- Проверка: список совпадает с разделом «Структура файлов» в `spec.md` (строки 261–283), лишние файлы не выдуманы; выполнены `npx prisma --version` → `8.0.0-rc.22`, `npx prisma --help`, `npx prisma contract --help`, `npx prisma migration --help`, `npx prisma migration plan --help`, `npx prisma db --help`, `npx prisma db migrate --help`, `npx prisma db update --help`, `npx prisma migrate dev --help` (команды нет: CLI печатает общую справку), `npx prisma db seed --help` (подкоманды нет: печатается справка группы `db`); `npm ls prisma @prisma/client` → `prisma@8.0.0-rc.22`, `@prisma/client@7.10.0`; `node -e "require('react')..."` → `react 19.3.0 useActionState: function`; `Get-ChildItem -Recurse app` → только `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/favicon.ico`.
- Статус: `done`.
- Ошибки: уточнение Шага 3 — команда `prisma migrate dev` в Prisma 8.0.0-rc.22 отсутствует, текст Шага 4 исправлен на `prisma migration plan` + `prisma db migrate`. Блокер CR-32 (рассинхрон `prisma` 8.0.0-rc.22 и `@prisma/client` 7.10.0) не снят и остаётся в Шаге 4.
- Следующий шаг: Шаг 4.

### Шаг 4. Выровнять версии Prisma и подготовить `package.json` — `todo`

- [ ] В `package.json` привести `prisma` и `@prisma/client` к точной версии `8.0.0-rc.22` (без диапазона `^`).
- [ ] Выполнить `npm install`; убедиться, что установленный клиент совпадает с CLI.
- [ ] Добавить скрипты: `db:migrate` (`prisma migration plan` + `prisma db migrate`), `db:seed` (`tsx prisma/seed.ts`), `sessions:cleanup` (`tsx scripts/cleanup-sessions.ts`), `test` (`tsx --test tests/**/*.test.ts`).
- Уточнение Шага 3: команд `prisma migrate dev` и `prisma db seed` в установленной версии CLI нет; миграция создаётся `prisma migration plan --name <slug>` и применяется `prisma db migrate`, seed остаётся `tsx`-скриптом (`spec.md`, строка 248). Если конфигурация не подхватывает `DATABASE_URL`, применять `prisma db migrate --db "$DATABASE_URL"` — фактические флаги подтвердить на шаге 6 через `prisma db migrate --help`.
- Действие: выровнять версии Prisma и подготовить команды проекта.
- Результат: CLI и клиент на одной версии, есть команды миграции, seed, очистки сессий и тестов.
- Проверка: `npx prisma --version`; обе записи версий в `package.json` совпадают; имена скриптов совпадают со `spec.md` (CR-32).
- Статус: `todo`.
- Ошибки: — (команда `prisma migrate dev` из ранней редакции шага исправлена по итогам Шага 3).
- Следующий шаг: Шаг 5.

### Шаг 5. Подготовить окружение — `todo`

- [ ] В `.env.example` заменить рабочий placeholder-пароль на заглушку `<change-me-for-local-development>`; оставить `SESSION_TTL_SECONDS=604800`.
- [ ] Проверить локальный `.env` (в репозиторий не попадает): `DATABASE_URL`, `SESSION_TTL_SECONDS`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`.
- [ ] Подготовить локальный `.env.test` с отдельным `DATABASE_URL` для тестов (файл игнорируется Git).
- Действие: привести переменные окружения в соответствие с `spec.md`.
- Результат: локальное окружение и шаблон `.env.example` безопасны и полны.
- Проверка: `git check-ignore .env .env.test` подтверждает игнорирование; `git check-ignore .env.example` файл не игнорирует; список переменных в `.env` и `.env.example` совпадает (CR-27).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 6.

### Шаг 6. Создать Prisma-контракт и миграцию — `todo`

- [ ] Создать `prisma/schema.prisma`: модели `User` (`email` уникальный, `passwordHash`, `displayName` до 80 символов, `role` с `@default(user)`, `createdAt`, `updatedAt`) и `Session` (`tokenHash` уникальный, `userId` с `onDelete: Cascade`, `expiresAt`, `createdAt`) плюс перечисление `Role`.
- [ ] Применить миграцию: `npm run db:migrate`; каталог `prisma/migrations` попадает в репозиторий.
- [ ] Проверить индексы: `tokenHash` (уникальный), `userId`, `expiresAt`.
- Действие: описать контракт данных в PSL и применить миграцию.
- Результат: база поддерживает `auth-lite`; открытый пароль в схеме отсутствует.
- Проверка: таблицы созданы в локальной базе; повторный `npm run db:migrate` не вносит новых изменений; в схеме есть `passwordHash` и роль, поля `password` нет (NFR-12).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 7.

### Шаг 7. Создать seed ровно одного `super_admin` — `todo`

- [ ] Создать `prisma/seed.ts`: чтение `SEED_SUPER_ADMIN_EMAIL` и `SEED_SUPER_ADMIN_PASSWORD`, проверка пароля (непустой, не заглушка из `.env.example`, 8–72 символа).
- [ ] Хешировать через `bcryptjs.hash(password, 12)` и выполнить `upsert` пользователя с ролью `super_admin`.
- [ ] Не понижать роль и не создавать второго `super_admin`: пользователь определяется по фиксированному email, роль других пользователей не меняется.
- [ ] Не выводить пароль в консоль; выводить только email и результат.
- Действие: добавить идемпотентный seed начального администратора.
- Результат: `super_admin` появляется только через seed, а не через публичную регистрацию.
- Проверка: `npm run db:seed` дважды даёт ровно одну строку `super_admin`; пароль в консоль не выводится (CR-15, CR-16).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 8.

### Шаг 8. Собрать формы и серверную валидацию — `todo`

- [ ] `app/lib/validation.ts`: единая Zod-схема для email (нормализация: нижний регистр, обрезка пробелов), пароля 8–72 символа и `displayName` до 80 символов.
- [ ] `app/ui/register-form.tsx` и `app/ui/login-form.tsx`: формы на `useActionState`, `<label htmlFor>`, `maxlength` у имени, сообщения об ошибках текстом рядом с полем, блокировка кнопки во время отправки.
- [ ] Страницы `/register` и `/login` с формами для `guest`.
- [ ] Серверная валидация обязательна: клиентские ограничения используются только для UX и не заменяют проверку в Server Action.
- Действие: добавить формы регистрации и входа с серверными Zod-проверками и понятными ошибками.
- Результат: `guest` открывает формы, некорректные данные отклоняет сервер.
- Проверка: пустые обязательные поля и пароль из 7 символов не создают пользователя; проверка выполняется не только в клиентском компоненте (FR-1, FR-2, NFR-11, CR-3, CR-29, CR-30).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 9.

### Шаг 9. Реализовать регистрацию и вход — `todo`

- [ ] `app/actions/auth.ts` (`'use server'`): `register` — валидация, нормализация email, `bcryptjs.hash(password, 12)`, создание `User` с ролью `user`, обработка нарушения уникальности email тем же сообщением о занятости адреса.
- [ ] `login` — поиск пользователя по нормализованному email, проверка строго `bcryptjs.compare(password, passwordHash)`, единое сообщение «Неверный email или пароль».
- [ ] Роль всегда `user` при регистрации: роль не читается из формы, query-параметра или тела запроса.
- Действие: реализовать создание учётной записи и вход без внешней auth-библиотеки.
- Результат: пользователь регистрируется и входит; пароль не хранится в открытом виде.
- Проверка: в базе лежит `passwordHash` с префиксом `$2b$12$`, отличный от пароля; подмена поля `role=super_admin` не меняет роль; неверный пароль не создаёт сессию (FR-3, FR-4, CR-1, CR-2, CR-4, CR-5, CR-6, CR-8).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 10.

### Шаг 10. Реализовать сессию и выход — `todo`

- [ ] `app/lib/session.ts`: генерация токена `crypto.randomBytes(32).toString('base64url')`, хранение в базе только SHA-256 (`tokenHash`), `expiresAt` = создание + `SESSION_TTL_SECONDS`, cookie `mb_session` с обязательными `HttpOnly` и `Secure`, содержащая только токен.
- [ ] `app/lib/env.ts`: чтение и проверка окружения, включая положительное числовое `SESSION_TTL_SECONDS`; `app/lib/db.ts`: единственный экземпляр `PrismaClient`.
- [ ] `app/lib/password.ts`: только `hash(password, 12)` и `compare(password, passwordHash)`.
- [ ] `app/actions/auth.ts`: `logout` — удаление записи сессии по `tokenHash`, удаление cookie, `redirect('/login')`.
- [ ] Не логировать пароли и токены.
- Действие: сохранять `passwordHash`, создавать, читать и сбрасывать локальную сессию.
- Результат: пользователь остаётся авторизованным между запросами и выходит по кнопке.
- Проверка: сессия живёт после перезагрузки и в новой вкладке; cookie недоступна из `document.cookie`; после выхода `mb_session` не даёт доступа; при `SESSION_TTL_SECONDS=60` доступ истекает (CR-9, CR-10, CR-12, CR-24).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 11.

### Шаг 11. Добавить серверные проверки ролей и контур аккаунта — `todo`

- [ ] `app/lib/auth.ts`: `getCurrentUser` (узкий объект `{ id, email, displayName, role }`), `requireUser`, `requireRole`; вызовы до обращения к данным.
- [ ] `/account`: доступен только при действующей сессии; показывает email, отображаемое имя (если задано), роль и пустые состояния будущих записей и уведомлений с пометкой «появится позже»; данные всегда ограничены текущим пользователем.
- [ ] `/admin`: `requireRole(['admin', 'super_admin'])`, подтверждение доступа без административных функций и без изменения данных.
- [ ] `/access-denied`: одна страница для гостя и для недостаточной роли, одинаковый HTTP-статус `200`, причина отказа не раскрывается; в аккаунт и на `/admin` при отказе данные не рендерятся.
- [ ] `/`: публичная точка входа со ссылками на `/login` и `/register` (стартовый экран `app/page.tsx` заменяется).
- [ ] При действующей сессии `/login` и `/register` перенаправляют на `/account`.
- Действие: ограничить аккаунт серверной проверкой сессии и различить `user`, `admin`, `super_admin`.
- Результат: аккаунт работает как auth-контур, а не как booking flow.
- Проверка: без сессии `/account` недоступен; `user` не проходит проверку `/admin`; `admin` и `super_admin` проходят; гость и недостаточная роль видят одинаковый ответ (FR-5, FR-12, FR-13, FR-19, CR-11, CR-13, CR-17, CR-18, CR-19, CR-20, CR-31).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 12.

### Шаг 12. Добавить автотесты и очистку сессий — `todo`

- [ ] Создать `tests/` на встроенном `node:test` (доступен без установки): регистрация, вход, роль `user`, чтение и истечение сессии, единый отказ, идемпотентность seed.
- [ ] Подключить отдельную тестовую базу: локальный `.env.test` с собственным `DATABASE_URL` (файл игнорируется Git, как и `.env`); прогон не изменяет данные локальной базы разработки.
- [ ] Создать `scripts/cleanup-sessions.ts`: удаление `Session` с истёкшим `expiresAt`, вывод количества удалённых записей без токенов и паролей.
- [ ] Новые зависимости не добавлять: раннер и TypeScript-запуск обеспечивают установленные `tsx` и Node.js.
- Действие: покрыть серверную логику автотестами и добавить команду очистки сессий.
- Результат: проверки auth-контура воспроизводимы одной командой; таблица сессий очищается вручную.
- Проверка: `npm test` завершается успешно и не меняет локальную базу; `npm run sessions:cleanup` удаляет только истёкшие записи (FR-16, FR-17, NFR-9, NFR-12, CR-25, CR-26).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 13.

### Шаг 13. Обновить `README.md` — `todo`

- [ ] Описать: копирование `.env.example` → `.env` и заполнение значений (включая замену заглушки seed-пароля), `npm run db:migrate`, `npm run db:seed`, `npm run dev`, `npm test`, `npm run sessions:cleanup`.
- [ ] Описать роли, способ появления `super_admin` и smoke-тест auth-контура (регистрация → вход → аккаунт → выход).
- [ ] Убедиться, что имена скриптов совпадают со `spec.md`; секретов в `README.md` нет.
- Действие: обновить runbook фактическими командами и результатами проверки.
- Результат: `README.md` объясняет запуск и проверку текущей версии проекта.
- Проверка: пройти шаги `README.md` на чистой базе; другой человек воспроизводит `auth-lite` локально (CR-23).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: Шаг 14.

### Шаг 14. Провести итоговую проверку готовности — `todo`

- [ ] Пройти CR-1…CR-32 из `spec.md` и зафиксировать результат в журнале (раздел 8).
- [ ] Сверить `spec.md`, `Plan.md`, `AGENTS.md` и `README.md`: FR, NFR, имена npm-скриптов, политика пароля, версии Prisma.
- [ ] Выполнить `npm run lint` и `npm run build` как финальные проверки качества.
- [ ] Проверить границы объёма: slots, bookings, notifications, OAuth, email, SMS, calendar, desktop-уведомления, deploy и административные функции не появились.
- Действие: провести финальную проверку готовности auth-фрагмента.
- Результат: проект готов к продолжению в уроках 4.3.3 и 4.3.4.
- Проверка: все CR-1…CR-32 пройдены, документы не противоречат друг другу (NFR-10, CR-21, CR-22, CR-28, CR-32).
- Статус: `todo`.
- Ошибки: —
- Следующий шаг: —

## 6. Что нельзя ломать и расширять

Нельзя ломать:

- существующий каркас Next.js: команды `dev`, `build`, `start`, `lint` остаются рабочими (проверено на шаге 0);
- `npm run lint` и `npm run build` как обязательные проверки качества (NFR-10);
- правило «пароль в открытом виде не хранится и не логируется» (FR-4, NFR-1);
- правило «проверка сессии и роли выполняется на сервере» (FR-11, FR-13);
- `spec.md` как источник требований: изменения объёма сначала вносятся в `spec.md`;
- игнорирование `.env` и `.env.test` в Git и отсутствие секретов в репозитории (CR-27).

Нельзя расширять в этом уроке:

- booking flow: создание, перенос и отмена записей; сущности `Booking`;
- реальные уведомления, рассылки и история уведомлений;
- подтверждение email, восстановление и смена пароля, смена email;
- OAuth, многофакторная аутентификация, «запомнить меня»;
- административные функции и назначение ролей `admin` и `super_admin` через интерфейс или API;
- ограничение частоты попыток входа, капча, журнал аудита;
- планировщик регулярной очистки сессий и любые фоновые процессы;
- деплой, внешние каналы (email, SMS, calendar, desktop) и новые зависимости.

Блоки записей и уведомлений в аккаунте остаются статическими пустыми состояниями, а не моделями данных.

## 7. Прямые зависимости и проверки

- `spec.md` — источник требований к `auth-lite` и границы урока (FR, NFR, CR-1…CR-32).
- `AGENTS.md` — правила работы агента в проекте (обновляется на шаге 2).
- `prisma.config.ts` — конфигурация Prisma; команды уточнены на шаге 3 (`prisma contract emit`, `prisma migration plan`, `prisma db migrate`), форма секций (PSL-файл, каталог миграций) проверяется на шаге 6 (`spec.md`, строка 247).
- `package.json` — команды `dev`, `build`, `start`, `lint` и добавляемые `db:migrate`, `db:seed`, `sessions:cleanup`, `test`.
- `.env` / `.env.example` / `.env.test` — локальное окружение без публикации секретов; `.env.test` — отдельная тестовая база.
- `prisma/schema.prisma` — модель `User` (роль, `passwordHash`), модель `Session` (сессия в базе).
- Prisma-миграция и `prisma/seed.ts` — воспроизводимость базы и ровно один `super_admin`.
- `app/lib/validation.ts` (Zod) — серверная валидация регистрации и входа.
- `app/lib/password.ts` — `bcryptjs` `hash(password, 12)` и `compare`.
- `app/lib/session.ts`, `app/lib/auth.ts`, `app/actions/auth.ts` — сессия и серверные проверки ролей.
- `tests/` и `scripts/cleanup-sessions.ts` — автотесты и очистка истёкших сессий.
- Браузерная проверка: регистрация, вход, аккаунт, выход, недоступность аккаунта без сессии, `/admin` для `user` и для `super_admin`.
- Документация Next.js 16 из `node_modules/next/dist/docs/` — обязательна до написания кода (правило `AGENTS.md`).

## 8. Журнал выполнения

| Дата | Шаг | Проверка | Результат |
| --- | --- | --- | --- |
| 16.10.2026 | Шаг 0. Сверить каркас и базовые команды | `npm run lint`, `npm run build` | lint без ошибок; build успешен (Next.js 16.4.1, Turbopack, маршруты `/` и `/_not-found`) |
| 16.10.2026 | Шаг 1. Зафиксировать `spec.md` | Сверить роли, `passwordHash`, границы и CR | `spec.md` содержит роли `guest`, `user`, `admin`, `super_admin`, запрет plain text пароля и CR-1…CR-32 |
| 16.10.2026 | Шаг 2. Обновить `AGENTS.md` под auth-фазу | Правила auth-фазы, запрет соседних доменов, `hasCurrentAgentRules()`, `npm run lint`, `npm run build` | `AGENTS.md`: правила `auth-lite`, запрет slots/bookings/notifications, внешних каналов, deploy и административных функций, обязательный цикл, разделение зон `spec.md`/`AGENTS.md`, правило справки Prisma CLI и `node_modules/next/dist/docs/`; блок `nextjs-agent-rules` восстановлен, `hasCurrentAgentRules()` → `true`, lint и build без ошибок |
| 16.10.2026 | Шаг 3. Найти реальные точки изменения | Сверка с `spec.md` (строки 261–283), справка Prisma CLI 8, `npm ls prisma @prisma/client`, `node -e` (React 19.3.0), `node_modules/next/dist/docs/` | Список файлов подтверждён без лишних файлов; команды Prisma 8 — `contract emit`, `migration plan`, `db migrate`/`db update` (команд `migrate dev` и `db seed` нет → правка Шага 4); формы — `useActionState` из `react`, `redirect` вне `try/catch`, `cookies()` только внутри `<Suspense>`; порядок правок: окружение → схема и миграция → seed → lib → actions → страницы → тесты → README |

Строки журнала добавляются по завершении каждого шага вместе с обновлением полей `Статус`, `Проверка`, `Ошибки`, `Следующий шаг`.

## 9. Критерии готовности проекта

- Локальный проект Mini Booking System создан и запускается.
- `spec.md` существует и описывает `auth-lite`.
- `Plan.md` существует, содержит шаги, команды проверки, статусы и журнал выполнения.
- `AGENTS.md` существует и ограничивает работу ИИ текущей auth-фазой.
- Регистрация работает локально.
- Вход работает локально.
- Новый пользователь получает роль `user`.
- Ровно один `super_admin` создаётся через `seed`.
- В базе хранится `passwordHash`, а не пароль в открытом виде.
- Используется `bcryptjs` с 12 раундами хеширования.
- Вход проверяется через `bcryptjs.compare`.
- Сессия создаётся, проверяется на сервере и сбрасывается при выходе.
- Аккаунт доступен только авторизованному пользователю.
- Минимальные проверки ролей выполняются на серверной стороне.
- В аккаунте есть место для будущих записей и внутренних уведомлений.
- `README.md` обновлён после реализации и содержит команды запуска, `seed` и smoke-тест.
- OAuth, email, SMS, calendar, desktop-уведомления, deploy, slots, bookings и notifications в этом уроке не реализуются.

## 10. Правила работы

- Коммит и push выполняет разработчик; агент их не запускает и приводит готовые команды в отчёте (`AGENTS.md`).
- Схема, миграции и генерация клиента не создаются до выравнивания версий Prisma (шаг 4, CR-32).
- Секреты не попадают в репозиторий, логи и документацию; пароли и токены не логируются.
- Один активный пункт `Plan.md`: выполнение, проверка, обновление статуса и только затем следующий пункт.
