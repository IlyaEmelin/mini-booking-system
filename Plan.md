# Plan.md: 4.3.2 Регистрация, вход и роли (auth-lite)

Источник требований — `spec.md`, правила работы агента — `AGENTS.md`, документация запуска — `README.md`.
Обязательный цикл проекта: `spec.md` → **`Plan.md`** → `AGENTS.md` → Code → Check → `README.md` (CR-28).

## 1. Текущий статус

- Приоритет: P0.
- Текущее состояние: локальный проект Mini Booking System создан (`create-next-app`), зависимости установлены, базовые команды работают; Prisma-контракт и миграция созданы и применены (шаг 6), seed ровно одного `super_admin` работает (шаг 7), формы `/register` и `/login` с серверной Zod-валидацией собраны (шаг 8); записи пользователей в базу, входа и сессии пока нет.
- Цель цикла: собрать минимальный `auth-lite`-фрагмент, который продолжится в уроках 4.3.3 и 4.3.4.
- Ограничение объёма: не расширять продукт до слотов, бронирований, уведомлений, полного booking flow, внешних каналов (OAuth, email, SMS, calendar, desktop) и деплоя; административные функции не реализуются, `/admin` — только проверка роли.
- Контекстные файлы: `spec.md`, `Plan.md`, `AGENTS.md`; финальный runbook — `README.md`.
- Сейчас в работе: **Шаг 10. Реализовать сессию и выход** (шаги 0–9 закрыты).
- Последняя проверка: Шаг 9 — созданы `app/lib/password.ts` (`hashPassword` = `bcryptjs.hash(password, 12)` с константой `BCRYPT_ROUNDS = 12`, `verifyPassword` = `bcryptjs.compare`) и `app/lib/db.ts` (единственный экземпляр клиента Prisma 8: `postgres<Contract>({ contractJson, url })`, контракт — эмитированные `prisma/contract.json` и `prisma/contract.d.ts`, строка подключения — `DATABASE_URL` из `.env`, пустое значение останавливает модуль понятной ошибкой); в `app/actions/auth.ts` действия заполнены: `register` хеширует пароль, создаёт `User` с ролью литералом `user` и превращает нарушение уникальности `User_email_key` в ошибку поля `email` «Этот email уже зарегистрирован» (проверки перед вставкой нет: уникальность держит база, FR-3), `login` ищет пользователя по нормализованному email, проверяет пароль строго через `compare` и на неверный пароль и на неизвестный email отвечает одним сообщением «Неверный email или пароль», выравнивая время ответа сравнением с константным хешем; временный `tsx`-скрипт (`.check-step9.ts`, удалён после запуска) — 28 утверждений, все «ok», exit 0: нормализация `  CHECK-…@EXAMPLE.TEST  ` в нижний регистр, роль `user` при отправленном в форме поле `role=super_admin`, `passwordHash` из 60 символов с префиксом `$2b$12$` и не равный паролю, `bcrypt.compare` подтверждает верный и отклоняет неверный пароль, повторная регистрация того же email не создаёт вторую строку, пароль из 7 символов отклонён без строки в базе, верные данные во входе дают сообщение notice, пароль не возвращается в состояние формы, записей `Session` не появляется, проверочные строки удалены; отдельным пробником на локальной базе подтверждена форма ошибки уникальности Prisma 8 и замерено время ответа входа (427 мс против 407 мс); `npx tsc --noEmit`, `npm run lint`, `npm run build` — без ошибок. Предыдущая проверка (шаг 8) — добавлены `app/lib/validation.ts` (одна Zod-схема: email с `trim()` и `toLowerCase()` и проверкой формата через `z.email`, пароль 8–72 символа и не больше 72 байт UTF-8 через `TextEncoder`, `displayName` не длиннее 80 символов и пустое значение → `null`), `app/actions/auth.ts` (Server Actions `register` и `login` уровня шага 8: только Zod-проверка, в объект для схемы попадают email, пароль и имя, поле `role` из формы не читается), клиентские формы `app/ui/register-form.tsx` и `app/ui/login-form.tsx` на `useActionState` (`<label htmlFor>` и `id` полей совпадают, `required`, `minlength`, `maxlength`, `type="email"`, текст ошибки рядом с полем и `aria-describedby`, `disabled` и «Отправка…» на время `pending`, `aria-live="polite"` для сообщения) и страницы `app/register/page.tsx`, `app/login/page.tsx` для `guest`; временный `tsx`-скрипт (`.check-step8.ts`, удалён после запуска) — 30 утверждений, все «ok», exit 0: пароль 7/8/72/73 символа, ровно 72 байта (`ü`×36) принят и 80 байт (`ü`×40) отклонён, пустые email и пароль, email не по шаблону, нормализация `  User@Example.COM ` → `user@example.com` в регистрации и во входе, пустое имя и имя из пробелов → `null`, имя из 80 и 81 символа, прямые вызовы `register`/`login` с `FormData`; отдельно подтверждено, что пароль не возвращается в состояние формы, а подменённое поле `role=super_admin` не влияет на результат и не попадает в состояние; в статическом HTML сборки `.next/server/app/register.html` и `login.html` есть `minLength="8"`, `maxLength="72"`, `maxLength="80"` (только регистрация), `autoComplete="new-password"`/`"current-password"`, `required`, `type="email"` и совпадающие `<label for=…>`, при этом полей `role` и значения `super_admin` нет, а пользовательских значений в HTML не выводится; производственный сервер на отдельном порту 3109 отдал `/register` и `/login` со статусом 200 и был остановлен (порт свободен); `npx tsc --noEmit`, `npm run lint`, `npm run build` — без ошибок, маршруты `/`, `/_not-found`, `/login`, `/register`; предыдущая проверка (шаг 7): `prisma/seed.ts` запускается командой `npm run db:seed` (`tsx prisma/seed.ts`), читает локальное окружение через `dotenv` (уже заданные в оболочке переменные не перезаписываются, поэтому проверки можно повторять с временными значениями) и проверяет ввод: пустой пароль, заглушка `<change-me-for-local-development>` из `.env.example`, длина вне 8–72 символов, размер больше 72 байт UTF-8 и email не по шаблону отклоняются с exit code 1 и без записи в базу; затем пароль хешируется `bcryptjs.hash(password, 12)`, пользователь ищется по фиксированному `SEED_SUPER_ADMIN_EMAIL` и создаётся или обновляется (`upsert` в Prisma 8 нет), клиент закрывается в `finally` через `db.close()`; два последовательных `npm run db:seed` вернули exit 0 и «пользователь уже был: пароль обновлён, роль сохранена», в `public.User` осталась ровно одна строка `superadmin@mini-booking.me` (среди колонок только одна вида `%password%` — `passwordHash text NOT NULL`), `bcrypt.compare(SEED_SUPER_ADMIN_PASSWORD, passwordHash)` → `true`, `passwordHash` — 60 символов с префиксом `$2b$12$` и не равен паролю; одноразовая проверка временным скриптом с драйвером `pg`: пользователь с ролью `admin` после запуска seed не изменился (распределение `admin:1, super_admin:1`), а после ручного перевода роли seed-пользователя в `admin` повторный запуск вернул `super_admin` с сообщением «роль повышена с admin до super_admin» (итог — `super_admin:1`, всего одна строка); временные скрипты и файлы проверки удалены; консоль печатает только email, роль и результат — ни пароль, ни хеш не выводятся (FR-14, CR-15, CR-16, CR-27, CR-29); `npx tsc --noEmit`, `npm run lint` и `npm run build` — без ошибок, `git status --short` показывает только новый файл `prisma/seed.ts`.
- Ошибки и блокеры: открытых нет. Блокер CR-32 закрыт на шаге 4 (решение A): `@prisma/client` удалён, его место занимает клиент Prisma 8 `@prisma/orm-postgres`, обе записи Prisma в `package.json` точные. Учтено для шага 6: `prisma contract emit` требует секцию `orm` (`adapter`, `family`, `target`) в `prisma.config.ts`, иначе `CLI.CONFIG_SECTION_INVALID`; команды `prisma generate` в Prisma 8 нет; команда `prisma migrate dev` отсутствует — заменена на `prisma migration plan` + `prisma db migrate` (уточнение Шага 3). Закрыто на шаге 6: база `mini-booking-system_dev` создана (`createdb`), миграция применена, схема сверена с контрактом. Осталось к шагу 12: тестовая база `mini-booking-system_test` в локальном PostgreSQL 18 ещё не создана (`psql` показывает `crm_exhibition_dev`, `mini-booking-system_dev`, `postgres`, `template0`, `template1`). Учтено для шагов 8–13: на пустой базе первое применение выполняется командой `npx prisma db migrate --advance-ref db` — `npm run db:migrate` (`prisma migration plan` + `prisma db migrate`) без ссылки `db` падает с `MIGRATION.PLAN_ORIGIN_UNKNOWN`; файл ссылки `prisma/migrations/app/refs/db.json` хранится в репозитории, поэтому на чистом клоне `npm run db:migrate` снова идемпотентен. Артефакты Prisma (`prisma/contract.d.ts`, `prisma/migrations/snapshots/**`) добавлены в `globalIgnores` ESLint, иначе `npm run lint` падал на сгенерированных типах (CR-22). Глобальный `Temporal` и полифилл `temporal-polyfill` не нужны: выбранные presets `temporal.*JsDate()` возвращают обычные `Date`. Шаг 7 прошёл без ошибок: временные скрипты проверки (`.seed-probe.cjs`, `.seed-verify.cjs`) и временные SQL-файлы удалены, локальная база оставлена в состоянии «одна строка `super_admin` с паролем из `.env`». Шаг 8 прошёл без ошибок: временные файлы проверки (`.check-step8.ts`, `.probe-zod.mjs`, `.probe-alias.ts`, `.smoke.txt`, `.smoke-stdout.txt`, `.smoke-stderr.txt`) удалены, сервер проверки остановлен, незакоммиченными остаются только новые каталоги `app/actions/`, `app/lib/`, `app/login/`, `app/register/`, `app/ui/`. Шаг 9 прошёл без ошибок: временные файлы (`.check-step9-probe.ts`, `.check-step9.ts`, `.probe-server-only.ts`, `probe-server-only.ts`, `.tsc-out.txt`) и временный клиентский компонент проверки маркера удалены, в рабочем дереве остались только изменения шага 9. Открытым для шага 10 остаётся маркер `server-only` из NFR-6: факты и варианты решения записаны в разделе 1.1.
- Следующий шаг после активного: Шаг 11. Добавить серверные проверки ролей и контур аккаунта.

### 1.1 Сверка с репозиторием (факты, проверено)

- Есть: `spec.md`, `AGENTS.md`, `prisma.config.ts` (секция `orm` — шаг 6), `.env`, `.env.example`, `.env.test` (создан на шаге 5), `.gitignore`, `README.md` (шаблонный), `app/layout.tsx`, `app/page.tsx` (стартовый экран), `app/globals.css`, `app/favicon.ico`.
- Есть (создано на шаге 6): `prisma/schema.prisma` (PSL-контракт: `User`, `Session`, `enum Role`; первая строка `// use prisma-8`), эмитированные `prisma/contract.json` и `prisma/contract.d.ts`, пакет миграции `prisma/migrations/app/20261016T1526_init_auth_lite/`, снимок `prisma/migrations/snapshots/e4cd2105195ac3c1d6c623657ca70f1f90d4b923f955e9d22ab9aa2284b9bd2b/` и ссылка `prisma/migrations/app/refs/db.json`.
- Нет: каталогов `app/lib/`, `app/actions/`, `app/ui/`, `tests/`, `scripts/` — они появятся на шагах 7–12.
- Конфигурация Prisma (шаг 6): `definePrismaConfig({ orm: ormConfig({ contract: './prisma/schema.prisma', output: './prisma', db: { connection: process.env['DATABASE_URL'] }, migrations: { dir: './prisma/migrations' } }), skills: {...} })`; `ormConfig` — это `defineConfig` из `@prisma/orm-postgres/config`, `definePrismaConfig` — из `prisma/config` (переэкспорт `@prisma/cli-engine`); `import 'dotenv/config'` обязателен, иначе CLI не видит `DATABASE_URL` из `.env`.
- Эмит и миграции (шаг 6): `npx prisma contract emit` пишет `contract.json` и `contract.d.ts` в каталог `output` (`prisma/`) и печатает `storageHash`/`executionHash`/`profileHash`; `npx prisma migration plan --name <slug>` создаёт пакет `prisma/migrations/app/<timestamp>_<slug>/` (`migration.json`, `ops.json`, `migration.ts`) и снимок `prisma/migrations/snapshots/<storageHash>/`; `npx prisma db migrate` применяет пакеты (`--advance-ref <name>` переводит ссылку, `--show` — read-only превью); `npx prisma db verify` и `npx prisma migration check` подтверждают совпадение схемы и целостность пакетов.
- PSL Prisma 8 (шаг 6): `enum Role { user admin super_admin }` (в базе — `text` + CHECK-ограничение), `@default(cuid(2))` (аргумент версии обязателен), поля времени — presets `temporal.createdAtJsDate()`, `temporal.updatedAtJsDate()`, `temporal.timestamptzJsDate()`; атрибут `@updatedAt` в этой версии не поддерживается (`PSL_UNSUPPORTED_FIELD_ATTRIBUTE`), а `@default(cuid())` без аргумента — `PSL_INVALID_ATTRIBUTE_SYNTAX`.
- npm-скрипты есть: `dev`, `build`, `start`, `lint`, `postinstall`, `db:migrate`, `db:seed`, `sessions:cleanup`, `test` (четыре последних добавлены на шаге 4).
- Версии Prisma (шаг 4): установлены `prisma` 8.0.0-rc.22 и `@prisma/orm-postgres` 8.0.0-rc.18, обе записи в `package.json` точные, без `^`; `@prisma/client` удалён (`npm view @prisma/client dist-tags` → `latest: 7.10.1`, `@prisma/client@8.0.0-rc.22` → 404).
- `.env.example` (шаг 5): `SEED_SUPER_ADMIN_PASSWORD="<change-me-for-local-development>"` — заглушка вместо рабочего пароля (CR-27); `DATABASE_URL` — нерабочая заглушка `postgresql://<login>:<password>@localhost:5432/mini-booking-system_dev`; `SESSION_TTL_SECONDS="604800"`.
- `.env` и `.env.test` игнорируются шаблоном `.env*` из `.gitignore`; `.env.example` из-под шаблона исключён (проверено `git check-ignore`).
- Локальное окружение (шаг 5): `.env` содержит все четыре обязательные переменные; `.env.test` создан с отдельной базой `mini-booking-system_test` и теми же именами переменных. Next.js `.env.test` не читает: файл нужен только тестовому прогону (`NODE_ENV=test`, шаг 12).
- Локальный PostgreSQL 18 доступен (`pg_isready -h localhost -p 5432` → `accepting connections`); база `mini-booking-system_dev` создана на шаге 6 и мигрирована (таблицы `User`, `Session`), тестовой базы `mini-booking-system_test` ещё нет — `psql` показывает `crm_exhibition_dev`, `mini-booking-system_dev`, `postgres`, `template0`, `template1` (требование к шагу 12).
- `AGENTS.md` содержит управляемый блок `nextjs-agent-rules`, правила auth-фазы, правила Git и обязательный цикл работы: шаг 2 закрыт.
- Version-специфика: Next.js 16.4.1, Turbopack, Cache Components; перед кодом читать `node_modules/next/dist/docs/` (правило `AGENTS.md`).
- Тестовый раннер: встроенный `node:test` через установленный `tsx` 4.23.15; новых зависимостей не требуется (NFR-9).
- Prisma CLI 8.0.0-rc.22 — контур v8: `contract emit`, `migration plan`, `db migrate`, `db update`, `db verify`/`db sign`; команд `prisma migrate dev` и `prisma db seed` нет (проверено `npx prisma --help`, `npx prisma contract --help`, `npx prisma migration --help`, `npx prisma db --help`, `npx prisma db update --help`, `npx prisma migrate dev --help`). Дополнено на шаге 6: прочитаны `npx prisma contract emit --help`, `npx prisma migration plan --help`, `npx prisma db migrate --help`; выполнены `npx prisma migration ref list`, `npx prisma migration status`, `npx prisma migration check`, `npx prisma db verify`, `npx prisma db migrate --show`.
- Prisma 8: клиент Postgres — `@prisma/orm-postgres` (`npm view @prisma/orm-postgres version` → `8.0.0-rc.18`, описание «Prisma 8 for Postgres: the one package a Postgres application installs»); `postinstall` (`prisma skills sync`) кладёт скилл `prisma-8` в `.agents/skills`, `.claude/skills`, `.cursor/skills`, `.devin/skills`.
- `prisma contract emit` без секции `orm` в `prisma.config.ts` падает: `CLI.CONFIG_SECTION_INVALID` + поля `orm.adapter`, `orm.family`, `orm.target` (проверено запуском из пустого каталога вне репозитория); по скиллу `prisma-8` каноническая раскладка v8 — `contract.prisma`, каталог `migrations/app/`, точка входа рантайма `db.ts` (проверка формы секций и путей — шаг 6).
- `@prisma/orm-postgres` объявляет peer-зависимость `temporal-polyfill`, но она нужна только Temporal-кодекам. В проекте (шаг 6) выбраны presets `temporal.createdAtJsDate()`, `temporal.updatedAtJsDate()` и `temporal.timestamptzJsDate()`: генератор «now» для этого кодека возвращает `new Date()`, а `pg/timestamptz-date@1` декодирует значение обычным `Date`, поэтому глобальный `Temporal` в серверной точке входа не требуется (проверено по исходникам `@prisma/orm-family-sql` и `@prisma/orm-target-postgres`; рантайм-проверка — на шагах 8/10).
- `prisma db migrate --help` (проверено 16.10.2026): опции `--db <url>`, `--to <contract>`, `--advance-ref <name>`, `--show` (read-only превью маршрута), `--from <contract>`; глобальные — `--format`, `--json`, `--log-level`, `--verbose`, `--quiet`, `--yes`, `--confirm`, `--interactive`, `--color`, `--config`. Команда применяет уже лежащие на диске миграции («never invents an edge», «applies pending on-disk migrations»).
- Прямой вызов `prisma` в PowerShell не работает: бинарник лежит в `node_modules\.bin` (`prisma.cmd` есть), но этот каталог не в `PATH` (проверено 16.10.2026). Запускать через `npx prisma …` или через npm-скрипты; для сеанса можно добавить `node_modules\.bin` в `PATH`.
- `useActionState` доступен: в проекте React 19.3.0, экспорт из `react` есть (проверено `node -e "require('react').useActionState"` → `function`).
- Prisma 8 отдаёт нарушение уникальности не кодом вида `P2002`, а ошибкой драйвера: временный пробник на локальной базе (16.10.2026) показал `name: SqlQueryError`, `kind: 'sql_query'`, `sqlState: '23505'`, `constraint: 'User_email_key'`, `table: 'User'`; публичные подпути `@prisma/orm-postgres` этот класс и хелпер `isUniqueConstraintViolation` не реэкспортируют (они лежат в транзитивном `@prisma/orm-family-sql/errors`), поэтому в `app/actions/auth.ts` нарушение распознаётся по форме ошибки, как советует `references/debug.md` скилла `prisma-8`. Там же подтверждено: `db.orm.public.User.where({ email }).delete()` возвращает удалённую строку, а `.create({ ..., role: 'user' })` принимает литерал роли.
- `server-only` (NFR-6) — решение принято на шаге 10 (Вариант 1, после опытов). Пакета `server-only` в `node_modules` нет, но Next.js алиасит импорт на `node_modules/next/dist/compiled/server-only` (`create-compiler-aliases.js`, `createServerOnlyClientOnlyAliases`): серверный граф получает пустой модуль, клиентский — модуль с `throw`. Принято: вне сборки спецификатор разрешается пустым модулем `app/lib/server-only-shim.ts`, на который указывает запись `"server-only": ["./app/lib/server-only-shim.ts"]` в `paths` файла `tsconfig.json`; новых зависимостей не появляется (NFR-9, CR-26). Проверено 16.10.2026: `npx tsx` с маркером в `app/lib/db.ts` и `app/lib/password.ts` выполняет реальный запрос к локальной базе (exit 0), форма `npm test` (`tsx --test tests/**/*.test.ts`) с помеченными модулями даёт `tests 1 / pass 1 / fail 0` (exit 0), а импорт `app/lib/db.ts` из клиентского компонента в `npm run build` по-прежнему падает с `You're importing a module that depends on "server-only" into a React Client Component module` (2 из 9 ошибок — про маркер, остальные 7 — про `dns`/`fs`/`net`/`tls`/`util/types` из `pg`), поэтому защита NFR-6 в сборке сохраняется. Там же подтверждено, что алиас `@/*` из `tsconfig.json` работает под `tsx` (импорт `@/app/lib/db` из пробника прошёл).
- Turbopack приоритетнее `paths` из `tsconfig.json`: при включённой записи `server-only` клиентская сборка всё равно падает на встроенном алиасе Next.js (проверено 16.10.2026 на 16.4.1), поэтому решение из `paths` ослабляет маркер только для инструментов на `tsx`, а не для приложения. Отклонённые варианты того же опыта: (а) установить пакет `server-only` — работал бы только с `--conditions=react-server` у всех трёх `tsx`-команд (`npm test`, `db:seed`, `sessions:cleanup`) и нарушает NFR-9/CR-26; (б) хук `Module._resolveFilename` через `tsx --import` — работает, но требует правки аргументов npm-скриптов и ломается при прямом запуске тестового файла без хука; (в) разделение «помеченного фасада» и ядра без маркера — маркер не покрывает то, что импортируют тесты и скрипты.
- `tsx` не читает `.env` автоматически (в отличие от Next.js): `prisma/seed.ts` загружает его через `dotenv`, а пробник шага 10 получал `DATABASE_URL` из окружения сессии. Скриптам и автотестам шага 12 нужно загружать окружение самим (`.env` — для `sessions:cleanup`, отдельный тестовый файл — для `npm test`, NFR-12).
- TypeScript не сообщает об ошибке неразрешённого side-effect импорта без флага `noUncheckedSideEffectImports`: файл с `import 'server-only'` и даже с `import 'нет-такого-модуля'` даёт `npx tsc --noEmit` → `exit 0`, хотя `--listFiles` показывает файл в программе (проверено 16.10.2026, TS 5.x). Доступность модулей проверяется сборкой (`npm run build`) и запуском (`tsx`), а не только `tsc`.


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

**Шаг 10. Реализовать сессию и выход.**

Блокирующее условие снято: контракт и миграция применены (шаг 6), seed ровно одного `super_admin` работает (шаг 7), формы и серверная валидация собраны (шаг 8), регистрация и вход работают (шаг 9): учётная запись создаётся с ролью `user`, в базе лежит только `passwordHash` с 12 раундами bcrypt, вход проверяется через `bcryptjs.compare`, нарушение уникальности `User_email_key` превращается в ошибку поля `email`.
Правило порядка: список файлов и порядок правок зафиксированы на шаге 3; после регистрации и входа (шаг 9) добавляется сессия и выход (шаг 10), затем серверные проверки ролей и аккаунт (шаг 11).
Основание: Шаг 9 закрыт — созданы `app/lib/db.ts` (единственный экземпляр клиента Prisma 8 на эмитированном контракте, строка подключения из `.env`) и `app/lib/password.ts` (`bcryptjs.hash(password, 12)` через `BCRYPT_ROUNDS` и `bcryptjs.compare`), действия `register`/`login` заполнены, 28 утверждений временного `tsx`-скрипта пройдены, `npx tsc --noEmit`, `npm run lint`, `npm run build` — без ошибок.
Ограничение шага: сделать `app/lib/session.ts` (токен `crypto.randomBytes(32).toString('base64url')`, в базе только SHA-256 `tokenHash`, `expiresAt` = создание + `SESSION_TTL_SECONDS`, cookie `mb_session` с `HttpOnly`) и `app/lib/env.ts` (чтение и проверка окружения, включая положительное числовое `SESSION_TTL_SECONDS`), создать сессию в `register` и `login`, добавить `logout` и кнопку выхода; `redirect('/account')` — здесь же. Проверки ролей, `/account`, `/admin`, `/access-denied` и `/` — шаг 11: сейчас сессии никто не читает.
Учесть из шага 9: `app/lib/db.ts` и `app/lib/password.ts` уже созданы — в `db.ts` чтение `DATABASE_URL` переносится в `app/lib/env.ts`, а `hashPassword`/`verifyPassword` дополнять не нужно. Фабрика подключается как `postgres<Contract>({ contractJson, url })`, `prisma/contract.json` импортируется с `with { type: 'json' }`, `upsert` в Prisma 8 нет, а клиент держит пул: в скриптах шага 12 нужен `await db.close()`. В действиях уже есть `readFormText`, `toFieldErrors` и семантика `AuthFormState` (`errors`, `values`, `message` с `tone: "notice" | "error"`); нарушение уникальности распознаётся по `kind: 'sql_query'` и `sqlState: '23505'`. Маркер `server-only` из NFR-6 решён в начале этого шага (Вариант 1, раздел 1.1): запись `"server-only": ["./app/lib/server-only-shim.ts"]` в `paths` файла `tsconfig.json` вместе с пустым модулем `app/lib/server-only-shim.ts`, маркер уже стоит в `app/lib/db.ts` и `app/lib/password.ts`; новых зависимостей нет (NFR-9, CR-26), клиентская граница проверена сборкой.

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
- Ошибки: уточнение Шага 3 — команда `prisma migrate dev` в Prisma 8.0.0-rc.22 отсутствует, текст Шага 4 исправлен на `prisma migration plan` + `prisma db migrate`. Блокер CR-32 (рассинхрон `prisma` 8.0.0-rc.22 и `@prisma/client` 7.10.0) на момент шага 3 не снят и перенесён в Шаг 4 — закрыт на шаге 4 решением A.
- Следующий шаг: Шаг 4.

### Шаг 4. Выровнять версии Prisma и подготовить `package.json` — `done`

- [x] В `package.json` зафиксировать Prisma точными версиями без `^`: CLI `prisma` — `8.0.0-rc.22`, клиент `@prisma/orm-postgres` — `8.0.0-rc.18`; `@prisma/client` удалён (решение A, см. «Уточнение Шага 4» ниже).
- [x] Выполнить `npm install`; убедиться, что установленные пакеты совпадают с записями в `package.json` (CLI `8.0.0-rc.22`, клиент `8.0.0-rc.18`).
- [x] Добавить скрипты: `db:migrate` (`prisma migration plan` + `prisma db migrate`), `db:seed` (`tsx prisma/seed.ts`), `sessions:cleanup` (`tsx scripts/cleanup-sessions.ts`), `test` (`tsx --test tests/**/*.test.ts`).
- Уточнение Шага 4 (блокер CR-32, решение A): исходная редакция требовала привести `prisma` и `@prisma/client` к одной версии `8.0.0-rc.22` — это невозможно: `npm view @prisma/client@8.0.0-rc.22 version` → 404, `npm view @prisma/client dist-tags` → `latest: 7.10.1` (линии 8.x у пакета нет), а в CLI Prisma 8 нет команды `prisma generate`. Клиент линии 8 — `@prisma/orm-postgres` («Prisma 8 for Postgres: the one package a Postgres application installs»), поэтому он занимает место `@prisma/client`, а обе записи Prisma фиксируются точно, без `^`. Решение согласовано с разработчиком и внесено в `spec.md` («Технологический стек», «Работа с Prisma», «Ограничения и допущения», CR-32, таблица самопроверки).
- Уточнение Шага 3: команд `prisma migrate dev` и `prisma db seed` в установленной версии CLI нет; миграция создаётся `prisma migration plan --name <slug>` и применяется `prisma db migrate`, seed остаётся `tsx`-скриптом (`spec.md`, строка 248). Если конфигурация не подхватывает `DATABASE_URL`, применять `prisma db migrate --db "$DATABASE_URL"` — флаги подтверждены (`--db <url>`, `--show` (read-only превью), `--to`, `--advance-ref`, `--from`; см. §1.1), сама проверка остаётся шагом 6.
- Действие: выровнять версии Prisma и подготовить команды проекта.
- Результат: `prisma@8.0.0-rc.22` и `@prisma/orm-postgres@8.0.0-rc.18` установлены точными версиями, `@prisma/client` в проекте нет; добавлены `db:migrate`, `db:seed`, `sessions:cleanup`, `test`.
- Проверка: `npm ls prisma @prisma/orm-postgres @prisma/client --depth=0` → `@prisma/orm-postgres@8.0.0-rc.18`, `prisma@8.0.0-rc.22` (записи `@prisma/client` нет); `npx prisma --version` → `{"version":"8.0.0-rc.22"}`; `npm install` → `added 34 packages, and removed 2 packages`; `package.json` содержит `db:migrate`, `db:seed`, `sessions:cleanup`, `test` с именами из `spec.md` (строки 283, 303; CR-26, CR-32); `npm run lint` → 0 проблем (0 ошибок, 0 предупреждений) после исключения каталогов синхронизированных скиллов в `eslint.config.mjs`.
- Статус: `done`.
- Ошибки: блокер CR-32 закрыт решением A (см. «Уточнение Шага 4»); открытых ошибок нет. Замечено для шага 6: секция `orm` в `prisma.config.ts` обязательна для `prisma contract emit`; канонические пути v8 — `contract.prisma` и `migrations/app/`; колонки `DateTime` возвращают `Temporal` (нужен `temporal-polyfill`). Побочно: скилл `prisma-8` содержит `.ts`-файлы, из-за чего `npm run lint` давал 56 предупреждений из `.agents/skills`, `.claude/skills`, `.cursor/skills`, `.devin/skills`; каталоги добавлены в `globalIgnores` (`eslint.config.mjs`) — это единственная правка вне `package.json` и документации.
- Следующий шаг: Шаг 5.

### Шаг 5. Подготовить окружение — `done`

- [x] В `.env.example` заменить рабочий placeholder-пароль на заглушку `<change-me-for-local-development>`; оставить `SESSION_TTL_SECONDS=604800`.
- [x] Проверить локальный `.env` (в репозиторий не попадает): `DATABASE_URL`, `SESSION_TTL_SECONDS`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`.
- [x] Подготовить локальный `.env.test` с отдельным `DATABASE_URL` для тестов (файл игнорируется Git).
- Действие: привести переменные окружения в соответствие с `spec.md`.
- Результат: локальное окружение и шаблон `.env.example` безопасны и полны.
- Заметка: `.env.test` подключается только тестовым прогоном (`NODE_ENV=test`, шаг 12); `next dev` и `next build` его не читают, поэтому локальная разработка продолжает работать с `.env`. Имена переменных в `.env.test` совпадают с `.env` и `.env.example`.
- Заметка для шага 6: локальные базы `mini-booking-system_dev` и `mini-booking-system_test` в PostgreSQL ещё не созданы; база разработки нужна до `npm run db:migrate`, тестовая — до `npm test`. Создание баз выполняет разработчик.
- Проверка: `git check-ignore -v .env .env.test` → оба пути совпадают с правилом `.gitignore:34:.env*`; `git check-ignore -v .env.example` → файл не игнорируется (exit code 1); список переменных в `.env`, `.env.example` и `.env.test` совпадает (`DATABASE_URL`, `SESSION_TTL_SECONDS`, `SEED_SUPER_ADMIN_EMAIL`, `SEED_SUPER_ADMIN_PASSWORD`); `SEED_SUPER_ADMIN_PASSWORD` в `.env.example` — заглушка `<change-me-for-local-development>`, в `.env` — непустое значение, отличное от заглушки; `SESSION_TTL_SECONDS` — положительное целое; `pg_isready -h localhost -p 5432` → `accepting connections` (CR-27, NFR-12).
- Статус: `done`.
- Ошибки: —
- Следующий шаг: Шаг 6.

### Шаг 6. Создать Prisma-контракт и миграцию — `done`

- [x] Создать `prisma/schema.prisma`: модели `User` (`email` уникальный, `passwordHash`, `displayName` до 80 символов, `role` с `@default(user)`, `createdAt`, `updatedAt`) и `Session` (`tokenHash` уникальный, `userId` с `onDelete: Cascade`, `expiresAt`, `createdAt`) плюс перечисление `Role`.
- [x] Применить миграцию: `npm run db:migrate`; каталог `prisma/migrations` попадает в репозиторий.
- [x] Проверить индексы: `tokenHash` (уникальный), `userId`, `expiresAt`.
- Действие: описать контракт данных в PSL и применить миграцию.
- Результат: контракт `prisma/schema.prisma` описывает `User`, `Session` и `Role`; база `mini-booking-system_dev` поддерживает `auth-lite`; открытого пароля в схеме нет. Spelling v8: `@default(cuid(2))`, `temporal.createdAtJsDate()`, `temporal.updatedAtJsDate()`, `temporal.timestamptzJsDate()` — первый emit вернул 3 диагностики (`@updatedAt` не поддерживается, у `cuid()` обязателен аргумент версии), после правки схемы эмит прошёл.
- Проверка: таблицы `User` и `Session` созданы в локальной базе; повторный `npm run db:migrate` даёт `noOp: true` и `migrationsApplied: 0`; в схеме есть `passwordHash` и роль, поля `password` нет; индексы `tokenHash` (уникальный), `userId` и `expiresAt` есть, внешний ключ `Session_userId_fkey` объявлен с `ON DELETE CASCADE` (NFR-12).
- Статус: `done`.
- Ошибки: —
- Следующий шаг: Шаг 7.

### Шаг 7. Создать seed ровно одного `super_admin` — `done`

- [x] Создать `prisma/seed.ts`: чтение `SEED_SUPER_ADMIN_EMAIL` и `SEED_SUPER_ADMIN_PASSWORD`, проверка пароля (непустой, не заглушка из `.env.example`, 8–72 символа, не более 72 байт UTF-8).
- [x] Хешировать через `bcryptjs.hash(password, 12)` и создать или обновить пользователя с ролью `super_admin`; `upsert` в Prisma 8 нет, поэтому сначала `select(...).where({ email }).first()`, затем `create`/`update`.
- [x] Не понижать роль и не создавать второго `super_admin`: пользователь определяется по фиксированному email, роль других пользователей не меняется.
- [x] Не выводить пароль в консоль; выводить только email и результат.
- Действие: добавить идемпотентный seed начального администратора.
- Результат: `super_admin` появляется только через seed, а не через публичную регистрацию.
- Проверка: `npm run db:seed` дважды даёт ровно одну строку `super_admin` — повторные прогоны вернули `exit 0` и «пользователь уже был: пароль обновлён, роль сохранена»; в `public.User` ровно одна строка `superadmin@mini-booking.me`; `passwordHash` — 60 символов с префиксом `$2b$12$`, `bcrypt.compare(SEED_SUPER_ADMIN_PASSWORD, passwordHash)` → `true`; пользователь с ролью `admin` из той же таблицы seed не изменил; пароль в консоль не выводится (CR-15, CR-16).
- Статус: `done`.
- Ошибки: —
- Следующий шаг: Шаг 8.

### Шаг 8. Собрать формы и серверную валидацию — `done`

- [x] `app/lib/validation.ts`: единая Zod-схема для email (нормализация: нижний регистр, обрезка пробелов), пароля 8–72 символа и `displayName` до 80 символов; там же константы длин, тип состояния формы для `useActionState` и сборка сообщений по полям.
- [x] `app/ui/register-form.tsx` и `app/ui/login-form.tsx`: формы на `useActionState`, `<label htmlFor>`, `maxlength` у имени, сообщения об ошибках текстом рядом с полем, блокировка кнопки во время отправки.
- [x] Страницы `/register` и `/login` с формами для `guest`.
- [x] Серверная валидация обязательна: клиентские ограничения используются только для UX и не заменяют проверку в Server Action; действия `register` и `login` в `app/actions/auth.ts` проверяют те же границы и возвращают ошибки в состояние формы (создание пользователя, `bcryptjs.compare` и сессия — шаги 9–10).
- Действие: добавить формы регистрации и входа с серверными Zod-проверками и понятными ошибками.
- Результат: `guest` открывает формы, некорректные данные отклоняет сервер.
- Проверка: временный `tsx`-скрипт — 30 утверждений, все «ok», exit 0 (пустые обязательные поля, пароль из 7 и 73 символов, пароль больше 72 байт UTF-8, подменённое поле `role`, нормализация email, границы `displayName`); прямые вызовы `register`/`login` подтвердили проверку на сервере, а не в клиентском компоненте; `/register` и `/login` отвечают 200 и содержат формы с `minLength`/`maxLength`/`required` и метками; `npx tsc --noEmit`, `npm run lint`, `npm run build` — без ошибок (FR-1, FR-2, NFR-11, CR-3, CR-29, CR-30).
- Статус: `done`.
- Ошибки: нет; замечание — в статическом HTML React 19.3 выводит атрибуты в camelCase (`minLength`, `maxLength`, `autoComplete`), для HTML это допустимо (имена атрибутов регистронезависимы), поведение проверено на собранных страницах.
- Следующий шаг: Шаг 9.

### Шаг 9. Реализовать регистрацию и вход — `done`

- [x] `app/lib/password.ts`: `hashPassword` = `bcryptjs.hash(password, 12)` (константа `BCRYPT_ROUNDS = 12`) и `verifyPassword` = `bcryptjs.compare`; открытый пароль наружу не возвращается. Файл не был указан в этом пункте отдельно, но без него действие не может хешировать пароль; создан здесь, дополнять на шаге 10 не требуется.
- [x] `app/lib/db.ts`: единственный экземпляр клиента Prisma 8 — `postgres<Contract>({ contractJson, url })` на эмитированных `prisma/contract.json` и `prisma/contract.d.ts`, строка подключения из `DATABASE_URL`, пустое значение останавливает модуль понятной ошибкой; чтение окружения переносится в `app/lib/env.ts` на шаге 10.
- [x] `app/actions/auth.ts` (`'use server'`): `register` — валидация, нормализация email, `bcryptjs.hash(password, 12)`, создание `User` с ролью `user`, обработка нарушения уникальности email тем же сообщением о занятости адреса.
- [x] `login` — поиск пользователя по нормализованному email, проверка строго `bcryptjs.compare(password, passwordHash)`, единое сообщение «Неверный email или пароль».
- [x] Роль всегда `user` при регистрации: роль не читается из формы, query-параметра или тела запроса.
- Действие: реализовать создание учётной записи и вход без внешней auth-библиотеки.
- Результат: пользователь регистрируется и входит; пароль не хранится в открытом виде.
- Проверка: временный `tsx`-скрипт `.check-step9.ts` (удалён после запуска) — 28 утверждений, все «ok», exit 0: в базе лежит `passwordHash` из 60 символов с префиксом `$2b$12$` и не равный паролю, `bcrypt.compare(PASSWORD, hash)` → `true`, другой пароль → `false`; отправка формы с полем `role=super_admin` не меняет роль (`role` остаётся `user`); повторная регистрация того же email даёт ошибку поля `email` «Этот email уже зарегистрирован» (нарушение `User_email_key` поймано по `sqlState` `23505`) и второй строки в базе не появляется; пароль из 7 символов отклонён без записи в базу; верные данные во входе дают notice; неверный пароль и неизвестный email дают одно и то же сообщение (замер времени ответа: 427 мс против 407 мс); записи `Session` не создаются ни разу; пароль не возвращается в состояние формы; проверочные строки удалены. Отдельный пробник на локальной базе подтвердил форму ошибки Prisma 8 (`SqlQueryError`, `sqlState: '23505'`). `npx tsc --noEmit`, `npm run lint`, `npm run build` — без ошибок (FR-3, FR-4, CR-1, CR-2, CR-4, CR-5, CR-6, CR-8).
- Статус: `done`.
- Ошибки: нет. Замечание: маркер `server-only` из NFR-6 не подключён — пакет не установлен, а под `tsx` импорт падает с `MODULE_NOT_FOUND`, поэтому решение перенесено на шаг 10 (факты и варианты — раздел 1.1); при этом импорт `app/lib/db.ts` из клиентского компонента и так ломает сборку Next.js.
- Следующий шаг: Шаг 10.

### Шаг 10. Реализовать сессию и выход — `todo`

- [ ] `app/lib/session.ts`: генерация токена `crypto.randomBytes(32).toString('base64url')`, хранение в базе только SHA-256 (`tokenHash`), `expiresAt` = создание + `SESSION_TTL_SECONDS`, cookie `mb_session` с обязательными `HttpOnly` и `Secure`, содержащая только токен.
- [ ] `app/lib/env.ts`: чтение и проверка окружения, включая положительное числовое `SESSION_TTL_SECONDS`; `app/lib/db.ts` — уже создан на шаге 9, здесь к нему добавляется чтение `DATABASE_URL` через `app/lib/env.ts`; `app/lib/password.ts` — уже создан на шаге 9 (только `hash(password, 12)` и `compare(password, passwordHash)`), дополнять не нужно.
- [x] Решён вопрос маркера `server-only` (NFR-6) до написания `session.ts` — Вариант 1: запись `"server-only": ["./app/lib/server-only-shim.ts"]` в `paths` файла `tsconfig.json` и пустой модуль `app/lib/server-only-shim.ts`; решение внесено в `spec.md` (NFR-6, «Структура файлов», самопроверка документа), новых зависимостей нет (NFR-9, CR-26).
- [x] Маркер подключён в уже созданных серверных модулях: `import "server-only"` в `app/lib/db.ts` и `app/lib/password.ts`; в `app/lib/env.ts`, `app/lib/session.ts` и `app/lib/auth.ts` — при их создании на этом и следующем шаге.
- [ ] `app/actions/auth.ts`: `logout` — удаление записи сессии по `tokenHash`, удаление cookie, `redirect('/login')`.
- [ ] Не логировать пароли и токены.
- Действие: сохранять `passwordHash`, создавать, читать и сбрасывать локальную сессию.
- Результат: пользователь остаётся авторизованным между запросами и выходит по кнопке.
- Проверка: сессия живёт после перезагрузки и в новой вкладке; cookie недоступна из `document.cookie`; после выхода `mb_session` не даёт доступа; при `SESSION_TTL_SECONDS=60` доступ истекает (CR-9, CR-10, CR-12, CR-24).
- Статус: `in_progress`.
- Ошибки: нет. Маркер `server-only` (NFR-6) решён в начале шага (Вариант 1): `paths` + `app/lib/server-only-shim.ts`, решение внесено в `spec.md`; замеры и отклонённые варианты — раздел 1.1.
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

- [ ] Описать: создание локальных баз (`createdb mini-booking-system_dev` и `createdb mini-booking-system_test`), копирование `.env.example` → `.env` и заполнение значений (включая замену заглушки seed-пароля, которую seed отклоняет), `npm run db:migrate`, `npm run db:seed`, `npm run dev`, `npm test` (тестовая база и её строка подключения — из локального `.env.test`), `npm run sessions:cleanup`.
- [ ] Зафиксировать порядок миграций: на пустой базе первым запуском идёт `npx prisma db migrate --advance-ref db` (создаёт ссылку `db`), после чего `npm run db:migrate` идемпотентен; ссылка `prisma/migrations/app/refs/db.json` хранится в репозитории; `npx prisma db verify` и `npx prisma migration status` — команды проверки схемы.
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
- `prisma.config.ts` — конфигурация Prisma. Выполнено на шаге 6: `import 'dotenv/config'` + `definePrismaConfig({ orm: ormConfig({ contract: './prisma/schema.prisma', output: './prisma', db: { connection: process.env['DATABASE_URL'] }, migrations: { dir: './prisma/migrations' } }), skills: { agents: [...] } })`, где `ormConfig` — `defineConfig` из `@prisma/orm-postgres/config`. Без секции `orm` команда падала с `CLI.CONFIG_SECTION_INVALID`; каталог миграций задан явно и получает сегмент пространства приложения: `prisma/migrations/app/` (рядом — `migrations/snapshots/`).
- `package.json` — команды `dev`, `build`, `start`, `lint`, `postinstall` и добавленные на шаге 4 `db:migrate` (`prisma migration plan` + `prisma db migrate`), `db:seed` (`tsx prisma/seed.ts`), `sessions:cleanup` (`tsx scripts/cleanup-sessions.ts`), `test` (`tsx --test tests/**/*.test.ts`); зависимости Prisma зафиксированы точно: `prisma` `8.0.0-rc.22`, `@prisma/orm-postgres` `8.0.0-rc.18`, `@prisma/client` не используется.
- `.env` / `.env.example` / `.env.test` — локальное окружение без публикации секретов; `DATABASE_URL` из `.env` указывает на созданную на шаге 6 базу `mini-booking-system_dev`, `.env.test` — на `mini-booking-system_test` (создать к шагу 12).
- `eslint.config.mjs` — на шаге 6 в `globalIgnores` добавлены `prisma/contract.d.ts` и `prisma/migrations/snapshots/**`: сгенерированные типы Prisma не проходят правила `eslint-config-next` и валили `npm run lint` (CR-22, NFR-10).
- `prisma/schema.prisma` — создан на шаге 6: `// use prisma-8`, `enum Role` (`user`, `admin`, `super_admin`), модель `User` (`email @unique`, `passwordHash`, `displayName?`, `role` с `@default(user)`) и модель `Session` (`tokenHash @unique`, `userId` → `onDelete: Cascade`, `expiresAt`, индексы `userId` и `expiresAt`); эмитированные `prisma/contract.json` и `prisma/contract.d.ts` импортирует рантайм-точка `app/lib/db.ts` (создана на шаге 9).
- Prisma-миграция `prisma/migrations/app/20261016T1526_init_auth_lite/` (применена на шаге 6) вместе со ссылкой `prisma/migrations/app/refs/db.json` — воспроизводимость базы; первое применение на пустой базе — `npx prisma db migrate --advance-ref db`, дальше `npm run db:migrate` идемпотентен.
- `prisma/seed.ts` — создан на шаге 7: идемпотентный seed ровно одного `super_admin` (чтение `.env` через `dotenv` без перезаписи уже заданных переменных, отказ на пустом пароле, заглушке `<change-me-for-local-development>` из `.env.example`, длине вне 8–72 символов и размере больше 72 байт UTF-8, `bcryptjs.hash(password, 12)`, поиск по фиксированному email и `create`/`update` вместо отсутствующего в Prisma 8 `upsert`, `db.close()` в `finally`, в консоль — только email, роль и результат); запуск — `npm run db:seed` (`tsx prisma/seed.ts`).
- `app/lib/validation.ts` — создан на шаге 8: одна Zod-схема для регистрации и входа (email с `trim()`/`toLowerCase()` и `z.email`, пароль 8–72 символа и не больше 72 байт UTF-8, `displayName` ≤80 символов и пустое значение → `null`), константы `PASSWORD_MIN_LENGTH`/`PASSWORD_MAX_LENGTH`/`PASSWORD_MAX_BYTES`/`DISPLAY_NAME_MAX_LENGTH`, тип состояния формы для `useActionState` (`AuthFormState`, `AuthFormAction`, `INITIAL_AUTH_FORM_STATE`), чтение полей `FormData` (`readFormText`) и сборка сообщений по полям (`toFieldErrors`); серверная валидация, клиентские формы берут отсюда только предельные длины.
- `app/actions/auth.ts` — создан на шаге 8, заполнен на шаге 9: Server Actions `register` и `login` с подписью `useActionState` `(prevState, formData)`; `register` проверяет данные Zod-схемой, хеширует пароль через `hashPassword` (`bcryptjs.hash(password, 12)`), создаёт `User` со `role: 'user'` (литерал, из формы роль не читается) и превращает нарушение `User_email_key` в ошибку поля `email` (распознавание по `kind: 'sql_query'` и `sqlState: '23505'`); `login` ищет пользователя по нормализованному email, проверяет пароль через `verifyPassword` (`bcryptjs.compare`) и на неверный пароль и на неизвестный email отвечает одним сообщением «Неверный email или пароль», выравнивая время ответа сравнением с константным bcrypt-хешем; сессия, cookie и `redirect('/account')` — шаг 10.
- `app/ui/register-form.tsx`, `app/ui/login-form.tsx` — созданы на шаге 8: клиентские формы на `useActionState` с `<label htmlFor>`, `required`/`minlength`/`maxlength`/`type="email"`, текстом ошибок рядом с полем, `aria-describedby`, `aria-live="polite"` и блокировкой кнопки во время `pending` (FR-1, NFR-11).
- `app/register/page.tsx`, `app/login/page.tsx` — созданы на шаге 8: страницы для `guest` с формами и ссылками друг на друга; переход авторизованного пользователя на `/account` — шаг 11 (FR-19, CR-31).
- `app/lib/password.ts` — создан на шаге 9: единственное место работы с `bcryptjs` — `hashPassword` через константу `BCRYPT_ROUNDS = 12` и `verifyPassword` через `compare`; отдельная соль не хранится, открытый пароль наружу не возвращается; помечен `import "server-only"` (NFR-6, подключён на шаге 10).
- `app/lib/db.ts` — создан на шаге 9: единственный экземпляр клиента Prisma 8 (`postgres<Contract>({ contractJson, url })` на эмитированных `prisma/contract.json` и `prisma/contract.d.ts`), `DATABASE_URL` из `.env` с остановкой на пустом значении; помечен `import "server-only"` (NFR-6, подключён на шаге 10); на шаге 10 сюда добавляется чтение окружения через `app/lib/env.ts`.
- `app/lib/server-only-shim.ts` вместе с записью `server-only` в `paths` файла `tsconfig.json` — созданы на шаге 10 как решение маркера NFR-6 вне сборки: `tsx` приводит спецификатор к пустому модулю, а Turbopack использует собственный алиас и он приоритетнее `paths`, поэтому клиентская граница сохраняется (замеры — раздел 1.1).
- `app/lib/session.ts`, `app/lib/auth.ts`, `app/actions/auth.ts` — сессия и серверные проверки ролей.
- `tests/` и `scripts/cleanup-sessions.ts` — автотесты и очистка истёкших сессий.
- Браузерная проверка: регистрация, вход, аккаунт, выход, недоступность аккаунта без сессии, `/admin` для `user` и для `super_admin`.
- Ручная проверка шага 8 (`npm run dev`): открыть `/register` и `/login`, отправить формы с пустыми полями, паролем из 7 и 73 символов, именем из 81 символа и подменённым полем `role`; ошибки должны выводиться текстом рядом с полями, кнопка — блокироваться на время отправки. Границы в браузере ограничены атрибутами `minlength`/`maxlength`, поэтому серверные пределы дополнительно подтверждены прямыми вызовами действий и схемами. Ручная проверка шага 9 (`npm run dev`): зарегистрировать пользователя через `/register`, повторить отправку того же адреса (ожидается ошибка поля `email` о занятом адресе), войти через `/login` с верным и с неверным паролем (ожидается сообщение «Неверный email или пароль»); после успешной регистрации и входа страница пока сообщает, что сессия появится на шаге 10, — переход в аккаунт ожидается начиная с шага 10.
- Документация Next.js 16 из `node_modules/next/dist/docs/` — обязательна до написания кода (правило `AGENTS.md`).

## 8. Журнал выполнения

| Дата | Шаг | Проверка | Результат |
| --- | --- | --- | --- |
| 16.10.2026 | Шаг 0. Сверить каркас и базовые команды | `npm run lint`, `npm run build` | lint без ошибок; build успешен (Next.js 16.4.1, Turbopack, маршруты `/` и `/_not-found`) |
| 16.10.2026 | Шаг 1. Зафиксировать `spec.md` | Сверить роли, `passwordHash`, границы и CR | `spec.md` содержит роли `guest`, `user`, `admin`, `super_admin`, запрет plain text пароля и CR-1…CR-32 |
| 16.10.2026 | Шаг 2. Обновить `AGENTS.md` под auth-фазу | Правила auth-фазы, запрет соседних доменов, `hasCurrentAgentRules()`, `npm run lint`, `npm run build` | `AGENTS.md`: правила `auth-lite`, запрет slots/bookings/notifications, внешних каналов, deploy и административных функций, обязательный цикл, разделение зон `spec.md`/`AGENTS.md`, правило справки Prisma CLI и `node_modules/next/dist/docs/`; блок `nextjs-agent-rules` восстановлен, `hasCurrentAgentRules()` → `true`, lint и build без ошибок |
| 16.10.2026 | Шаг 3. Найти реальные точки изменения | Сверка с `spec.md` (строки 261–283), справка Prisma CLI 8, `npm ls prisma @prisma/client`, `node -e` (React 19.3.0), `node_modules/next/dist/docs/` | Список файлов подтверждён без лишних файлов; команды Prisma 8 — `contract emit`, `migration plan`, `db migrate`/`db update` (команд `migrate dev` и `db seed` нет → правка Шага 4); формы — `useActionState` из `react`, `redirect` вне `try/catch`, `cookies()` только внутри `<Suspense>`; порядок правок: окружение → схема и миграция → seed → lib → actions → страницы → тесты → README |
| 16.10.2026 | Шаг 4. Выровнять версии Prisma и подготовить `package.json` | `npm ls prisma @prisma/orm-postgres @prisma/client --depth=0`, `npx prisma --version`, `npm install`, `npm view @prisma/client dist-tags` | Версии зафиксированы точно, без `^`: `prisma@8.0.0-rc.22` + `@prisma/orm-postgres@8.0.0-rc.18`; `@prisma/client` удалён (линии 8.x нет, в v8 нет `prisma generate`): блокер CR-32 закрыт решением A, `spec.md` обновлён; добавлены скрипты `db:migrate`, `db:seed`, `sessions:cleanup`, `test` |
| 16.10.2026 | Шаг 5. Подготовить окружение | `git check-ignore -v .env .env.test .env.example`, сверка списка переменных `.env` / `.env.example` / `.env.test`, `pg_isready -h localhost -p 5432` | `.env.example`: `SEED_SUPER_ADMIN_PASSWORD` заменён с рабочего пароля на заглушку `<change-me-for-local-development>` (CR-27), остальные строки без изменений; локальный `.env` проверен — все четыре переменные заполнены, `SESSION_TTL_SECONDS="604800"` положительное целое; создан локальный `.env.test` с отдельной базой `mini-booking-system_test` и теми же именами переменных; `.env` и `.env.test` игнорируются Git, `.env.example` — нет; PostgreSQL принимает соединения, но базы `mini-booking-system_dev` и `mini-booking-system_test` ещё не созданы (передано шагам 6 и 12) |
| 16.10.2026 | Шаг 6. Создать Prisma-контракт и миграцию | `npx prisma contract emit`, `npx prisma migration plan --name init_auth_lite`, `npx prisma db migrate --advance-ref db`, повторный `npm run db:migrate`, `npx prisma db verify`, `npx prisma migration status`/`check`, `psql` (таблицы, индексы, ограничения), `npm run lint`, `npm run build` | Секция `orm` добавлена в `prisma.config.ts`; `prisma/schema.prisma` (`// use prisma-8`, `User`, `Session`, `Role`) эмитирован в `prisma/contract.json` и `prisma/contract.d.ts`; миграция `prisma/migrations/app/20261016T1526_init_auth_lite` (8 операций: таблицы, unique `email`/`tokenHash`, индексы `userId`/`expiresAt`, FK `ON DELETE CASCADE`, CHECK роли) применена к базе `mini-booking-system_dev`; повторный `npm run db:migrate` — no-op, `db verify` — совпадение схемы и маркера, `migration check` — без замечаний; `spec.md` обновлён под spelling v8 (`cuid(2)`, `temporal.*JsDate()`); артефакты Prisma исключены из ESLint; lint и build зелёные |
| 16.10.2026 | Шаг 7. Создать seed ровно одного `super_admin` | Двойной `npm run db:seed`, негативные прогоны с временными переменными окружения, проверка базы (`psql` и драйвер `pg`), `bcryptjs.compare`, `npx tsc --noEmit`, `npm run lint`, `npm run build` | Создан `prisma/seed.ts`: `dotenv` читает `.env`, ввод проверяется (пустой пароль, заглушка из `.env.example`, длина вне 8–72 символов, больше 72 байт UTF-8, email не по шаблону → exit code 1 без записи в базу), пароль хешируется `bcryptjs.hash(password, 12)`, пользователь ищется по фиксированному email и создаётся или обновляется (`upsert` в Prisma 8 нет), клиент закрывается в `finally` через `db.close()`; повторные `npm run db:seed` → `exit 0` и «пользователь уже был: пароль обновлён, роль сохранена», в `public.User` ровно одна строка `superadmin@mini-booking.me` (`role = super_admin`, `passwordHash` — 60 символов с префиксом `$2b$12$`, не равен паролю, `bcrypt.compare(SEED_SUPER_ADMIN_PASSWORD, passwordHash)` → `true`, колонок с открытым паролем нет); одноразовая проверка временным скриптом с драйвером `pg`: пользователь с ролью `admin` не изменился, а после ручного понижения роли seed-пользователя повторный запуск вернул `super_admin` с сообщением «роль повышена с admin до super_admin» (итог `super_admin:1`, всего одна строка); временные файлы проверки удалены, в консоль не попадают ни пароль, ни хеш; `tsc`, lint и build зелёные, незакоммичен только новый файл `prisma/seed.ts` |
| 16.10.2026 | Шаг 8. Собрать формы и серверную валидацию | Временный `tsx`-скрипт (30 утверждений), прямые вызовы `register`/`login`, статический HTML сборки, производственный сервер на порту 3109, `npx tsc --noEmit`, `npm run lint`, `npm run build` | Созданы `app/lib/validation.ts` (одна Zod-схема: email с `trim()`/`toLowerCase()` и `z.email`, пароль 8–72 символа и ≤72 байт UTF-8 через `TextEncoder`, `displayName` ≤80 и пустое → `null`; константы длин, `AuthFormState`/`AuthFormAction`/`INITIAL_AUTH_FORM_STATE`, `readFormText`, `toFieldErrors`), `app/actions/auth.ts` (`register`, `login` — только Zod-проверка и ошибки в состояние формы, без записи в базу, `bcryptjs` и сессии), формы `app/ui/register-form.tsx` и `app/ui/login-form.tsx` на `useActionState` и страницы `/register`, `/login` для `guest`; 30 проверок «ok», exit 0 (пустые поля, пароли 7/8/72/73 символа, ровно 72 байта `ü`×36 принято и 80 байт `ü`×40 отклонено, email не по шаблону, нормализация `  User@Example.COM ` → `user@example.com`, пустое и пробельное имя → `null`, имя 80/81 символ, поле `role=super_admin` не читается и не влияет на результат, пароль не возвращается в состояние формы); `/register` и `/login` отвечают 200, в HTML есть `minLength`/`maxLength`/`autoComplete`/`required` с совпадающими `<label for=…>` и нет поля `role`; `npx tsc --noEmit`, `npm run lint` и `npm run build` зелёные (маршруты `/`, `/_not-found`, `/login`, `/register`); временные файлы проверки удалены, сервер проверки остановлен |
| 16.10.2026 | Шаг 9. Реализовать регистрацию и вход | Пробник формы ошибки Prisma 8 на локальной базе, временный `tsx`-скрипт `.check-step9.ts` (28 утверждений, exit 0), прямой импорт `db.ts` из клиентского компонента (ожидаемая ошибка сборки), `npx tsc --noEmit`, `npm run lint`, `npm run build` | Созданы `app/lib/password.ts` (`hashPassword` = `bcryptjs.hash(password, 12)` с `BCRYPT_ROUNDS = 12`, `verifyPassword` = `compare`) и `app/lib/db.ts` (единственный клиент Prisma 8 `postgres<Contract>({ contractJson, url })` на `prisma/contract.json`/`contract.d.ts`, `DATABASE_URL` из `.env`); в `app/actions/auth.ts` `register` хеширует пароль, создаёт `User` со `role: 'user'` и обрабатывает нарушение `User_email_key`, `login` ищет пользователя по нормализованному email и проверяет пароль строго через `compare` с единым сообщением «Неверный email или пароль»; 28 проверок «ok»: `passwordHash` 60 символов с префиксом `$2b$12$` и не равный паролю (`compare` → `true`, другой пароль → `false`), поле `role=super_admin` в форме не меняет роль, повторная регистрация того же email даёт ошибку поля `email` без второй строки в базе, пароль из 7 символов не создаёт пользователя, верные данные во входе дают notice, время ответа при неверном пароле и неизвестном email совпадает (427 мс против 407 мс), записей `Session` не создаётся, пароль не возвращается в состояние формы, проверочные строки удалены; маркер `server-only` (NFR-6) проверен опытом (сборка Next.js падает при клиентском импорте) и снят до решения на шаге 10, так как под `tsx` импорт падает с `MODULE_NOT_FOUND`; `tsc`, lint и build зелёные, временные файлы удалены |



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
