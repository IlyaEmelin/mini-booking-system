<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md: Mini Booking System

## Контекст проекта

- Проект: локальный учебный Mini Booking System.
- Стек: Next.js, React, TypeScript, Tailwind CSS, Zod, PostgreSQL, Prisma, npm.
- Текущая фаза: `4.3.2 auth-lite`.
- Цель фазы: регистрация, вход, локальная сессия, роли и первый контур аккаунта.

## Источники истины

- Перед кодом читать `spec.md` и активный пункт `Plan.md`.
- Зоны не смешивать: `spec.md` — требования (роли, данные, границы урока, FR, NFR, CR); `AGENTS.md` — только правила работы агента. Спецификацию сюда не дублировать и не превращать файл в общий учебник.
- `Plan.md` ведёт текущую работу: статус, шаги, проверки, ошибки и следующий узкий запрос.
- `README.md` обновляется после реализации и проверки как runbook запуска.
- Команды запуска, проверки, миграций и `seed` брать из `package.json` или уже подтверждённого runbook; имена скриптов не выдумывать.
- До кода сверять API со справкой: справка Prisma CLI (`npx prisma --help`, `npx prisma migration --help`, `npx prisma db --help`) и документация Next.js 16 в `node_modules/next/dist/docs/` (см. управляемый блок `nextjs-agent-rules` выше). Не опираться на память о прежних версиях этих библиотек.

## Рабочие правила

- Соблюдать обязательный цикл проекта: `spec.md` → `Plan.md` → `AGENTS.md` → Code → Check → `README.md`.
- Выполнять один активный пункт `Plan.md` за раз: следующий шаг не начинать до проверки текущего и обновления его статуса.
- Перед изменением кода показывать план файлов.
- После изменения указывать, что проверено и что осталось проверить вручную.
- Если меняется способ запуска, миграции, `seed` или smoke-тест, зафиксировать это для финального `README.md`.
- Не переписывать соседние части проекта без явной причины.

## Правила `auth-lite`

- Новая регистрация создаёт пользователя с ролью `user`.
- Через `seed` создаётся ровно один пользователь с ролью `super_admin`.
- В базе хранится только `passwordHash`, а не plain text пароль.
- Для хеширования использовать `bcryptjs.hash(password, 12)`.
- Для входа использовать `bcryptjs.compare(inputPassword, user.passwordHash)`.
- Проверки сессии и ролей выполняются на серверной стороне, а не только в React-компонентах.

## Вне текущей фазы

- Не реализовывать `slots`, `bookings`, `notifications` и полный booking flow.
- Не добавлять OAuth, email, SMS, calendar, desktop-уведомления, deploy и внешний контур.
- Не добавлять административные функции и назначение ролей `admin` и `super_admin` через интерфейс или API: `/admin` — только проверочный маршрут без изменения данных.
- Не вводить новые зависимости и внешние сервисы без отдельного решения в `spec.md`.

## Правила работы с Git

**Коммит и push выполняются только по прямому указанию разработчика.** По умолчанию агент не запускает `git commit` и `git push`: их выполняет сам разработчик. Прямое указание — это явная просьба в текущем сообщении, например «сделай commit and push». После каждой правки агент, независимо от наличия указания, даёт готовые команды для ручного запуска commit и push.

Разрешённые команды (только чтение, состояние репозитория не меняется):

- `git status`, `git diff`, `git log`, `git show`, `git ls-files`, `git check-ignore`, `git rev-parse`, `git remote -v`, `git branch --list`, `git ls-remote`, а также любые из них с `--no-pager`.

Запрещённые команды (меняют индексацию, локальную историю или удалённый репозиторий):

- По прямому указанию разработчика (по умолчанию не выполняются): `git commit` (в том числе `--amend`), `git push` (в том числе `--force`, `--delete`, `--tags`).
- Запрещено всегда, даже при просьбе в чате: `git tag`, `git remote add|remove|rename|set-url`, `git reset`, `git rebase`, `git revert`, `git cherry-pick`, `git merge`, `git checkout -b`, `git switch -c`, `git branch -d|-D`, `git stash drop|clear`, `git clean`, `git config` в режиме записи.
- `git add` — только по отдельной прямой просьбе разработчика и без последующего коммита.

Запуск линтера, сборки и автотестов разрешён: эти проверки не меняют состояние репозитория.

Порядок работы: агент вносит и проверяет изменения в рабочем дереве и оставляет их незакоммиченными. В итоговом отчёте он перечисляет изменённые файлы и даёт готовые команды для ручного запуска commit и push. Если прямого указания агенту не было, коммит и push выполняет разработчик сам.

Эта секция расположена вне блока `nextjs-agent-rules`, поэтому `next dev` её не перезаписывает.
