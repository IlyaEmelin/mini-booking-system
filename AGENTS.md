<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
