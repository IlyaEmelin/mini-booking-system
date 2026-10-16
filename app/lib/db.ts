// Единственный экземпляр клиента Prisma 8 (NFR-8).
//
// Точка входа рантайма: контракт читается из эмитированных `prisma/contract.json`
// и `prisma/contract.d.ts` (`npx prisma contract emit`), строка подключения — из
// переменной окружения `DATABASE_URL` (файл `.env`, в репозиторий не попадает).
// Фабрика `postgres<Contract>(...)` не соединяется с базой при импорте: пул
// открывается на первом запросе.
//
// Модуль серверный: помечен `import "server-only"` (NFR-6). В сборке Next.js
// спецификатор разрешается встроенным алиасом: в клиентском графе сборка падает
// на этом импорте, поэтому модуль нельзя затянуть в клиентский компонент (сама
// Prisma тоже доходит до встроенных модулей Node — `fs`, `dns`, `net`). Вне
// сборки (`tsx`: seed, скрипты, `npm test`) спецификатор разрешается пустым
// модулем `app/lib/server-only-shim.ts` через `paths` в `tsconfig.json`, поэтому
// пакет `server-only` не нужен (NFR-9).
//
// Строка подключения приходит из проверенного окружения `app/lib/env.ts`:
// чтение `DATABASE_URL` и разбор `SESSION_TTL_SECONDS` собраны там (FR-18),
// здесь остаётся только создание клиента.

import "server-only";

import postgres from "@prisma/orm-postgres/runtime";

import { env } from "@/app/lib/env";
import type { Contract } from "@/prisma/contract";
import contractJson from "@/prisma/contract.json" with { type: "json" };

/** Клиент базы данных, общий для всех серверных модулей приложения. */
export const db = postgres<Contract>({ contractJson, url: env.databaseUrl });
