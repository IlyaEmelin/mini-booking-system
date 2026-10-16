// Единственный экземпляр клиента Prisma 8 (NFR-8).
//
// Точка входа рантайма: контракт читается из эмитированных `prisma/contract.json`
// и `prisma/contract.d.ts` (`npx prisma contract emit`), строка подключения — из
// переменной окружения `DATABASE_URL` (файл `.env`, в репозиторий не попадает).
// Фабрика `postgres<Contract>(...)` не соединяется с базой при импорте: пул
// открывается на первом запросе.
//
// Модуль серверный: маркер `server-only` из NFR-6 пока не подключён — пакет
// `server-only` в проекте не установлен, а добавлять зависимости нельзя (NFR-9);
// проверено, что под `tsx` такой импорт падает с MODULE_NOT_FOUND, поэтому
// решение по NFR-6 принимается на шаге 10. Импорт этого модуля из клиентского
// компонента и так ломает сборку Next.js: Prisma доходит до встроенных модулей
// Node (`fs`, `dns`, `net`).
//
// Чтение и проверка окружения через `app/lib/env.ts` (FR-18) — шаг 10.

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
