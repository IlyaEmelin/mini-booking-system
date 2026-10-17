// Тестовое окружение auth-lite (FR-17, NFR-12, CR-26).
//
// Модуль подключается первым импортом в тестовых файлах — до импорта серверных
// модулей приложения: `app/lib/env.ts` читает `process.env` при загрузке, поэтому
// `.env.test` должен быть прочитан раньше. Значения из `.env.test` перекрывают
// переменные оболочки (`override: true`): прогон обязан идти по тестовой базе,
// даже если в сеансе задан `DATABASE_URL` другой базы.
//
// Файл `.env.test` локальный и исключён из Git шаблоном `.env*` (как `.env`):
// в репозитории остаются только имена переменных (CR-27). Next.js `.env.test`
// не читает — файл нужен только тестовому прогону.
//
// Защита от порчи данных разработки: имя базы из `.env.test` должно оканчиваться
// на `_test` и не совпадать с именем базы из `.env`; иначе прогон падает до
// первого запроса (NFR-12, CR-26).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { config as loadEnv, parse as parseEnv } from "dotenv";

const TEST_ENV_FILE = ".env.test";
const DEV_ENV_FILE = ".env";
const TEST_DATABASE_SUFFIX = "_test";

/** Ошибка настройки тестового окружения: сообщение без секретов. */
export class TestEnvError extends Error {}

/** Имя базы из строки подключения. */
function databaseName(databaseUrl: string, source: string): string {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new TestEnvError(`${source}: DATABASE_URL не похож на строку подключения`);
  }

  const name = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (name === "") {
    throw new TestEnvError(`${source}: в DATABASE_URL не указано имя базы данных`);
  }

  return name;
}

/** Имя базы разработки или `null`, если файла `.env` нет. */
function readDevDatabaseName(): string | null {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), DEV_ENV_FILE), "utf8");
  } catch {
    return null;
  }

  const databaseUrl = parseEnv(raw)["DATABASE_URL"]?.trim() ?? "";
  return databaseUrl === "" ? null : databaseName(databaseUrl, DEV_ENV_FILE);
}

const loaded = loadEnv({
  path: join(process.cwd(), TEST_ENV_FILE),
  override: true,
  quiet: true,
});

if (loaded.error !== undefined) {
  throw new TestEnvError(
    `не удалось прочитать ${TEST_ENV_FILE}: создайте его по образцу .env.example и укажите отдельную тестовую базу (NFR-12)`,
  );
}

// `env.isProduction` в тестах ложно: cookie сессии проверяется на уровне ядра
// сессии, а флаг `Secure` относится к production-сборке (NFR-2, шаг 11).
// Приведение типа нужно потому, что в типах Next.js `NODE_ENV` объявлено
// свойством только для чтения.
(process.env as Record<string, string | undefined>)["NODE_ENV"] = "test";

const resolvedDatabaseUrl = process.env["DATABASE_URL"]?.trim() ?? "";
if (resolvedDatabaseUrl === "") {
  throw new TestEnvError(`${TEST_ENV_FILE}: переменная DATABASE_URL не задана`);
}

const resolvedDatabaseName = databaseName(resolvedDatabaseUrl, TEST_ENV_FILE);
if (!resolvedDatabaseName.endsWith(TEST_DATABASE_SUFFIX)) {
  throw new TestEnvError(
    `${TEST_ENV_FILE}: база "${resolvedDatabaseName}" не похожа на тестовую — имя должно оканчиваться на "${TEST_DATABASE_SUFFIX}" (NFR-12)`,
  );
}

const devDatabaseName = readDevDatabaseName();
if (devDatabaseName !== null && devDatabaseName === resolvedDatabaseName) {
  throw new TestEnvError(
    `${TEST_ENV_FILE}: указана та же база, что в ${DEV_ENV_FILE} ("${resolvedDatabaseName}"): тесты изменяют данные (NFR-12, CR-26)`,
  );
}

/** Обязательная непустая переменная тестового окружения. */
function requiredText(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (value === "") {
    throw new TestEnvError(`${TEST_ENV_FILE}: переменная ${name} не задана`);
  }
  return value;
}

const testSessionTtlSeconds = requiredText("SESSION_TTL_SECONDS");
if (!/^\d+$/.test(testSessionTtlSeconds) || Number(testSessionTtlSeconds) <= 0) {
  throw new TestEnvError(
    `${TEST_ENV_FILE}: SESSION_TTL_SECONDS должен быть положительным целым числом секунд (FR-18)`,
  );
}

/** Строка подключения тестовой базы (NFR-12). */
export const testDatabaseUrl: string = resolvedDatabaseUrl;

/** Имя тестовой базы: используется в сообщениях и проверках. */
export const testDatabaseName: string = resolvedDatabaseName;

/** Email начального `super_admin` тестовой базы (CR-15, CR-16). */
export const testSeedEmail: string = requiredText("SEED_SUPER_ADMIN_EMAIL");

/** Пароль начального `super_admin` тестовой базы: в отчёты не печатается. */
export const testSeedPassword: string = requiredText("SEED_SUPER_ADMIN_PASSWORD");

/**
 * Переменные для дочерних процессов (`prisma/seed.ts` и
 * `scripts/cleanup-sessions.ts`): они получают тестовую базу явно, поэтому не
 * зависят от `.env` и от переменных оболочки (NFR-12).
 */
export const testChildEnv: Readonly<Record<string, string>> = Object.freeze({
  NODE_ENV: "test",
  DATABASE_URL: testDatabaseUrl,
  SESSION_TTL_SECONDS: testSessionTtlSeconds,
  SEED_SUPER_ADMIN_EMAIL: testSeedEmail,
  SEED_SUPER_ADMIN_PASSWORD: testSeedPassword,
});
