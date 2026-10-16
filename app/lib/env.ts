// Чтение и проверка переменных окружения серверного контура (FR-18, NFR-3).
//
// Единственное место в приложении, где читается `process.env`: значения
// проверяются, а не подставляются молча. Пустое `DATABASE_URL` и
// `SESSION_TTL_SECONDS`, который не является положительным целым числом
// секунд, — ошибка конфигурации, а не молчаливая подстановка (FR-18), поэтому
// модуль падает при импорте.
//
// Модуль серверный: помечен `import "server-only"` (NFR-6). В сборке Next.js
// спецификатор разрешается встроенным алиасом, вне сборки (`tsx`: seed,
// скрипты, `npm test`) — пустым модулем `app/lib/server-only-shim.ts` через
// `paths` в `tsconfig.json` (подробнее — в `app/lib/db.ts`).

import "server-only";

const DATABASE_URL_NAME = "DATABASE_URL";
const SESSION_TTL_SECONDS_NAME = "SESSION_TTL_SECONDS";

/** Проверенная конфигурация серверной части приложения. */
export type ServerEnv = Readonly<{
  /** Строка подключения к локальному PostgreSQL (NFR-3). */
  databaseUrl: string;
  /** Срок жизни сессии в секундах: он же ограничивает срок жизни cookie (FR-18, NFR-2). */
  sessionTtlSeconds: number;
  /** Признак production: в production cookie сессии получает флаг `Secure` (NFR-2). */
  isProduction: boolean;
}>;

/** Обязательная непустая переменная окружения. */
function readRequiredText(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") {
    throw new Error(
      `Переменная ${name} не задана: заполните .env по образцу .env.example (NFR-3)`,
    );
  }
  return value;
}

/**
 * Положительное целое число секунд: пустое, нечисловое, неположительное
 * значение и значение вне безопасного диапазона считаются ошибкой (FR-18).
 */
function readPositiveSeconds(name: string): number {
  const raw = process.env[name]?.trim() ?? "";
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(
      `Переменная ${name} должна быть положительным целым числом секунд (получено "${raw}") — FR-18`,
    );
  }
  return value;
}

/** Конфигурация, прочитанная и проверенная один раз при загрузке модуля. */
export const env: ServerEnv = Object.freeze({
  databaseUrl: readRequiredText(DATABASE_URL_NAME),
  sessionTtlSeconds: readPositiveSeconds(SESSION_TTL_SECONDS_NAME),
  isProduction: process.env.NODE_ENV === "production",
});
