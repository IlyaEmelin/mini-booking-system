// Seed auth-lite: ровно один начальный администратор с ролью `super_admin`.
//
// Запуск: `npm run db:seed` (tsx prisma/seed.ts) из корня проекта.
// Учётные данные берутся из окружения (`SEED_SUPER_ADMIN_EMAIL`,
// `SEED_SUPER_ADMIN_PASSWORD`); в базу попадает только `passwordHash`
// (`bcryptjs.hash(password, 12)`), пароль в консоль не печатается (FR-14, CR-15, CR-16).

import { readFileSync } from "node:fs";
import { join } from "node:path";

import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";
import postgres from "@prisma/orm-postgres/runtime";

import type { Contract } from "./contract";
import contractJson from "./contract.json" with { type: "json" };

// `.env` читается как локальное окружение (как в `prisma.config.ts`); значения,
// уже заданные в оболочке, не перезаписываются, поэтому проверки шага можно
// запускать с временными переменными.
loadEnv({ quiet: true });

// Политика пароля из `spec.md` (FR-2, CR-29): 8–72 символа; верхняя граница
// дополнительно проверяется по байтам UTF-8, потому что bcrypt учитывает
// только первые 72 байта пароля.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_MAX_BYTES = 72;
const BCRYPT_ROUNDS = 12;

// Роль начального администратора: значение перечисления `Role` из контракта.
const SEED_ROLE = "super_admin";

// Файл-образец окружения: единственный источник заглушки пароля (CR-27).
const ENV_EXAMPLE_FILE = ".env.example";

type SeedConfig = Readonly<{
  email: string;
  password: string;
  databaseUrl: string;
}>;

type SeedUserRow = Readonly<{
  id: string;
  email: string;
  role: string;
}>;

/** Ошибка настройки или запуска seed: сообщение печатается без пароля. */
class SeedError extends Error {}

/**
 * Заглушка `SEED_SUPER_ADMIN_PASSWORD` из `.env.example`.
 * Если файла нет, проверка пропускается: сам шаблон окружения не обязателен
 * для запуска, но при его наличии пароль-заглушка отклоняется.
 */
function readPlaceholderPassword(): string | null {
  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), ENV_EXAMPLE_FILE), "utf8");
  } catch {
    console.warn(
      `seed: ${ENV_EXAMPLE_FILE} не найден — проверка заглушки пароля пропущена`,
    );
    return null;
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*SEED_SUPER_ADMIN_PASSWORD\s*=\s*(.*)$/.exec(line);
    if (match === null) {
      continue;
    }
    const value = (match[1] ?? "").trim();
    const quoted = /^(['"])(.*)\1$/.exec(value);
    return quoted === null ? value : (quoted[2] ?? "");
  }

  return null;
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Читает и проверяет окружение seed: пустой пароль, заглушка и длина — ошибка запуска. */
function readConfig(): SeedConfig {
  const databaseUrl = process.env["DATABASE_URL"]?.trim() ?? "";
  if (databaseUrl === "") {
    throw new SeedError(
      `переменная DATABASE_URL не задана: заполните .env по образцу ${ENV_EXAMPLE_FILE}`,
    );
  }

  const email = process.env["SEED_SUPER_ADMIN_EMAIL"]?.trim() ?? "";
  if (email === "") {
    throw new SeedError(
      `переменная SEED_SUPER_ADMIN_EMAIL не задана: заполните .env по образцу ${ENV_EXAMPLE_FILE}`,
    );
  }
  if (!isEmailLike(email)) {
    throw new SeedError(
      `SEED_SUPER_ADMIN_EMAIL не похож на адрес электронной почты: "${email}"`,
    );
  }

  const password = process.env["SEED_SUPER_ADMIN_PASSWORD"] ?? "";
  if (password.trim() === "") {
    throw new SeedError(
      "SEED_SUPER_ADMIN_PASSWORD пуст: задайте рабочий пароль в .env",
    );
  }

  const placeholder = readPlaceholderPassword();
  if (placeholder !== null && password === placeholder) {
    throw new SeedError(
      `SEED_SUPER_ADMIN_PASSWORD совпадает с заглушкой из ${ENV_EXAMPLE_FILE}: задайте рабочий пароль (CR-27)`,
    );
  }

  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new SeedError(
      `SEED_SUPER_ADMIN_PASSWORD должен быть длиной от ${PASSWORD_MIN_LENGTH} до ${PASSWORD_MAX_LENGTH} символов (CR-29)`,
    );
  }

  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) {
    throw new SeedError(
      `SEED_SUPER_ADMIN_PASSWORD должен занимать не более ${PASSWORD_MAX_BYTES} байт в UTF-8: bcrypt учитывает только первые ${PASSWORD_MAX_BYTES} байта (FR-2)`,
    );
  }

  return { email, password, databaseUrl };
}

/** Отчёт в консоль: email и результат, без пароля и без хеша. */
function report(user: SeedUserRow, outcome: string): void {
  console.log("seed: начальный администратор готов");
  console.log(`  email: ${user.email}`);
  console.log(`  роль:  ${user.role}`);
  console.log(`  итог:  ${outcome}`);
}

/**
 * Создаёт начального `super_admin` или обновляет его пароль.
 * Пользователь определяется по фиксированному email, поэтому второго
 * `super_admin` не появляется; роль существующего пользователя не понижается:
 * она либо сохраняется, либо повышается до `super_admin`.
 */
async function main(): Promise<void> {
  const config = readConfig();
  const db = postgres<Contract>({ contractJson, url: config.databaseUrl });

  try {
    const passwordHash = await bcrypt.hash(config.password, BCRYPT_ROUNDS);
    const existing = await db.orm.public.User.select("id", "email", "role")
      .where({ email: config.email })
      .first();

    if (existing === null) {
      const created = await db.orm.public.User.select("id", "email", "role")
        .create({ email: config.email, passwordHash, role: SEED_ROLE });
      report(created, "пользователь создан с ролью super_admin");
      return;
    }

    if (existing.role === SEED_ROLE) {
      await db.orm.public.User.where({ id: existing.id })
        .select("id", "email", "role")
        .update({ passwordHash });
      report(existing, "пользователь уже был: пароль обновлён, роль сохранена");
      return;
    }

    const promoted = await db.orm.public.User.where({ id: existing.id })
      .select("id", "email", "role")
      .update({ passwordHash, role: SEED_ROLE });
    report(
      promoted ?? existing,
      `роль повышена с ${existing.role} до super_admin, пароль обновлён`,
    );
  } finally {
    // Клиент Prisma 8 держит пул соединений: без close() скрипт не завершится.
    await db.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`seed: ошибка — ${message}`);
  process.exitCode = 1;
});

