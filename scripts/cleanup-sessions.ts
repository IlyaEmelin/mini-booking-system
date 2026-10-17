// Очистка истёкших сессий auth-контура (FR-16, CR-25, NFR-12).
//
// Запуск: `npm run sessions:cleanup` (`tsx scripts/cleanup-sessions.ts`).
// Скрипт удаляет только записи `Session`, у которых `expiresAt` не позже
// текущего момента, и печатает количество удалённых записей. Действующие сессии
// не затрагиваются; токены, их хеши и пароли в консоль не попадают.
// Проверка `expiresAt` при чтении сессии (`app/lib/session.ts`) остаётся
// обязательной, поэтому команда — гигиена таблицы, а не способ закрыть доступ
// (spec.md, раздел «Механизм сессии: сессии в базе данных»).
//
// Окружение читается так же, как в `prisma/seed.ts`: `tsx` не загружает `.env`
// сам, поэтому файл подключается через `dotenv`, а уже заданные в оболочке
// переменные не перезаписываются — тестовый прогон подставляет базу из
// `.env.test` (NFR-12). Клиент Prisma 8 держит пул соединений, поэтому он
// закрывается в `finally`, иначе процесс не завершится.

import postgres from "@prisma/orm-postgres/runtime";
import { config as loadEnv } from "dotenv";

import type { Contract } from "../prisma/contract";
import contractJson from "../prisma/contract.json" with { type: "json" };

loadEnv({ quiet: true });

/** Ошибка запуска скрипта: сообщение печатается без секретов. */
class CleanupError extends Error {}

/** Строка подключения из окружения: пустое значение — ошибка запуска (NFR-3). */
function readDatabaseUrl(): string {
  const databaseUrl = process.env["DATABASE_URL"]?.trim() ?? "";
  if (databaseUrl === "") {
    throw new CleanupError(
      "переменная DATABASE_URL не задана: заполните .env по образцу .env.example",
    );
  }
  return databaseUrl;
}

async function main(): Promise<void> {
  const databaseUrl = readDatabaseUrl();
  const db = postgres<Contract>({ contractJson, url: databaseUrl });

  try {
    // `deleteAndCount` удаляет все строки, попавшие под фильтр, и возвращает их
    // количество; `.delete()` в Prisma 8 удаляет только одну строку
    // (`references/queries-postgres.md` скилла `prisma-8`).
    const deleted = await db.orm.public.Session.where((session) =>
      session.expiresAt.lte(new Date()),
    ).deleteAndCount();

    console.log(`sessions: удалено истёкших сессий: ${deleted}`);
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`sessions: ошибка — ${message}`);
  process.exitCode = 1;
});
