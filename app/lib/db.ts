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
// Чтение и проверка окружения через `app/lib/env.ts` (FR-18) — шаг 10.

import "server-only";

import postgres from "@prisma/orm-postgres/runtime";

import type { Contract } from "@/prisma/contract";
import contractJson from "@/prisma/contract.json" with { type: "json" };

const databaseUrl = process.env["DATABASE_URL"]?.trim() ?? "";

if (databaseUrl === "") {
  throw new Error(
    "DATABASE_URL не задана: заполните .env по образцу .env.example",
  );
}

/** Клиент базы данных, общий для всех серверных модулей приложения. */
export const db = postgres<Contract>({ contractJson, url: databaseUrl });
