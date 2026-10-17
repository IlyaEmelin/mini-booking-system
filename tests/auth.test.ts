// Автотесты auth-контура (FR-17, NFR-12, CR-26).
//
// Запуск: `npm test` (`tsx --test tests/**/*.test.ts`) — встроенный `node:test`,
// новых зависимостей нет (NFR-9). Окружение берётся из локального `.env.test`
// (модуль `tests/test-env.ts` подключается первым), поэтому прогон идёт по
// отдельной базе и не меняет данные локальной базы разработки (NFR-12).
//
// Что проверяется: регистрация (нормализация email, роль `user`, уникальность,
// только `passwordHash`), вход (проверка пароля через `bcryptjs.compare`),
// сессия (токен, SHA-256 в базе, срок из `SESSION_TTL_SECONDS`, чтение,
// истечение, выход), единый отказ (неизвестный и истёкший токен дают одинаковый
// `null`, роль читается из базы), идемпотентность seed и очистка истёкших
// сессий. Разграничение доступа на маршрутах проверено HTTP-пробниками шага 11:
// `requireUser`/`requireRole` зависят от контекста запроса (`redirect` бросает
// служебное исключение), поэтому здесь не дублируются.
//
// Пользователи тестовой базы удаляются до и после прогона: каскад
// `Session_userId_fkey` (`onDelete: Cascade`) удаляет сессии вместе с ними.

import "./test-env";

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { db } from "@/app/lib/db";
import { env } from "@/app/lib/env";
import { hashPassword, verifyPassword } from "@/app/lib/password";
import {
  SESSION_COOKIE_NAME,
  issueSession,
  resolveSession,
  revokeSession,
} from "@/app/lib/session";
import { registerSchema } from "@/app/lib/validation";

import {
  testChildEnv,
  testDatabaseName,
  testSeedEmail,
  testSeedPassword,
} from "./test-env";

/** Длина токена: 32 байта энтропии в base64url (FR-7, CR-10). */
const SESSION_TOKEN_LENGTH = 43;

/** Длина SHA-256 в hex: в базе лежит хеш, а не токен (FR-7, CR-10). */
const SESSION_HASH_LENGTH = 64;

/** Заведомо истёкший момент: на минуту раньше текущего (FR-8, FR-16). */
const EXPIRED_AT = new Date(Date.now() - 60_000);

/** Роли `User.role` контракта (spec.md, «Пользователи и роли»). */
type TestRole = "user" | "admin" | "super_admin";

type TestUserInput = Readonly<{
  email: string;
  password: string;
  displayName?: string | null;
  role?: TestRole;
}>;

type ScriptResult = Readonly<{
  code: number | null;
  stdout: string;
  stderr: string;
}>;

/** SHA-256 в hex — так же, как `app/lib/session.ts` хеширует токен (FR-7). */
function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Создаёт пользователя тестовой базы и возвращает его идентификатор и хеш. */
async function createTestUser(
  input: TestUserInput,
): Promise<Readonly<{ id: string; passwordHash: string }>> {
  const passwordHash = await hashPassword(input.password);
  const user = await db.orm.public.User.select("id").create({
    email: input.email,
    passwordHash,
    displayName: input.displayName ?? null,
    role: input.role ?? "user",
  });

  return { id: user.id, passwordHash };
}

/** Полная очистка тестовой базы: пользователи и их сессии (каскад). */
async function deleteAllUsers(): Promise<void> {
  await db.orm.public.User.where((user) => user.id.isNotNull()).deleteAndCount();
}

/** Запускает скрипт проекта отдельным процессом с окружением тестовой базы. */
function runProjectScript(relativePath: string): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", join(process.cwd(), relativePath)],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...testChildEnv },
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

before(async () => {
  // Имя базы уже проверено `tests/test-env.ts`; здесь только фиксируем, что
  // прогон идёт по тестовой базе, а не по базе разработки.
  assert.ok(testDatabaseName.endsWith("_test"));
  await deleteAllUsers();
});

after(async () => {
  await deleteAllUsers();
  // Клиент Prisma 8 держит пул соединений: без close() процесс не завершится.
  await db.close();
});

describe("Регистрация (FR-1, FR-3, FR-5, CR-1, CR-5)", () => {
  test("нормализует email и создаёт пользователя с ролью user", async () => {
    const parsed = registerSchema.safeParse({
      email: "  New.User@Example.COM  ",
      password: "correct-horse",
      displayName: "  Иван  ",
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) {
      return;
    }

    assert.equal(parsed.data.email, "new.user@example.com");
    assert.equal(parsed.data.displayName, "Иван");

    const passwordHash = await hashPassword(parsed.data.password);
    assert.notEqual(passwordHash, parsed.data.password);
    assert.match(passwordHash, /^\$2b\$12\$/);
    assert.equal(await verifyPassword(parsed.data.password, passwordHash), true);
    assert.equal(await verifyPassword("wrong-password", passwordHash), false);

    const created = await db.orm.public.User.select(
      "id",
      "email",
      "displayName",
      "role",
      "passwordHash",
    ).create({
      email: parsed.data.email,
      passwordHash,
      displayName: parsed.data.displayName ?? null,
      role: "user",
    });

    assert.equal(created.email, "new.user@example.com");
    assert.equal(created.displayName, "Иван");
    assert.equal(created.role, "user");
    assert.equal(created.passwordHash, passwordHash);
  });

  test("без явной роли база подставляет user", async () => {
    const passwordHash = await hashPassword("default-role-password");
    const created = await db.orm.public.User.select("id", "role").create({
      email: "default-role@example.com",
      passwordHash,
    });

    assert.equal(created.role, "user");
  });

  test("занятый email не создаёт вторую учётную запись", async () => {
    const email = "duplicate@example.com";
    const passwordHash = await hashPassword("duplicate-password");
    await db.orm.public.User.select("id").create({
      email,
      passwordHash,
      role: "user",
    });

    await assert.rejects(
      () => db.orm.public.User.create({ email, passwordHash, role: "user" }),
      (error: unknown) => {
        const sqlError = error as { kind?: string; sqlState?: string };
        assert.equal(sqlError.kind, "sql_query");
        assert.equal(sqlError.sqlState, "23505");
        return true;
      },
    );

    const rows = await db.orm.public.User
      .select("id")
      .where((user) => user.email.eq(email))
      .all();
    assert.equal(rows.length, 1);
  });
});

describe("Вход (FR-4, FR-6, CR-7, CR-8)", () => {
  test("проверяет пароль через bcryptjs.compare", async () => {
    const email = "login.user@example.com";
    const password = "login-password";
    await createTestUser({ email, password, displayName: "Пользователь" });

    const stored = await db.orm.public.User
      .select("id", "passwordHash")
      .where({ email })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }

    assert.equal(await verifyPassword(password, stored.passwordHash), true);
    assert.equal(await verifyPassword("not-the-password", stored.passwordHash), false);
  });

  test("неизвестный email не даёт пользователя для входа", async () => {
    const missing = await db.orm.public.User
      .select("id", "passwordHash")
      .where({ email: "missing.user@example.com" })
      .first();

    assert.equal(missing, null);
  });
});

describe("Сессия (FR-7, FR-8, FR-9, FR-18, CR-9, CR-11, CR-12)", () => {
  test("в базе лежит только SHA-256 токена, срок — из SESSION_TTL_SECONDS", async () => {
    const { id } = await createTestUser({
      email: "session.user@example.com",
      password: "session-password",
    });

    const startedAt = Date.now();
    const issued = await issueSession(id);
    const issuedAt = Date.now();

    assert.equal(SESSION_COOKIE_NAME, "mb_session");
    assert.equal(issued.token.length, SESSION_TOKEN_LENGTH);
    assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);

    const ttlMs = env.sessionTtlSeconds * 1000;
    const expiresIn = issued.expiresAt.getTime() - startedAt;
    assert.ok(
      expiresIn >= ttlMs,
      `expiresAt раньше, чем позволяет SESSION_TTL_SECONDS: ${expiresIn} мс`,
    );
    assert.ok(
      expiresIn <= ttlMs + (issuedAt - startedAt),
      `expiresAt позже, чем позволяет SESSION_TTL_SECONDS: ${expiresIn} мс`,
    );

    const tokenHash = sha256(issued.token);
    assert.equal(tokenHash.length, SESSION_HASH_LENGTH);
    assert.notEqual(tokenHash, issued.token);

    const stored = await db.orm.public.Session
      .select("tokenHash", "userId", "expiresAt")
      .where({ tokenHash })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }

    assert.equal(stored.tokenHash, tokenHash);
    assert.equal(stored.userId, id);
    assert.equal(stored.expiresAt.getTime(), issued.expiresAt.getTime());
  });

  test("действующая сессия читается, неизвестная и истёкшая дают одинаковый отказ", async () => {
    const { id } = await createTestUser({
      email: "resolve.user@example.com",
      password: "resolve-password",
    });

    const active = await issueSession(id);
    assert.deepEqual(await resolveSession(active.token), {
      id,
      email: "resolve.user@example.com",
      displayName: null,
      role: "user",
    });

    const unknownToken = randomBytes(32).toString("base64url");
    assert.equal(await resolveSession(unknownToken), null);

    const expiredToken = randomBytes(32).toString("base64url");
    const expiredHash = sha256(expiredToken);
    await db.orm.public.Session.create({
      tokenHash: expiredHash,
      userId: id,
      expiresAt: EXPIRED_AT,
    });

    // Просроченная запись ещё лежит в базе: отказ не зависит от очистки (FR-8).
    const expiredRow = await db.orm.public.Session
      .select("id")
      .where({ tokenHash: expiredHash })
      .first();
    assert.ok(expiredRow !== null);

    // И неизвестный, и истёкший токен дают одно и то же: причины отказа нет (FR-13).
    assert.equal(await resolveSession(expiredToken), null);
  });

  test("выход удаляет запись сессии", async () => {
    const { id } = await createTestUser({
      email: "logout.user@example.com",
      password: "logout-password",
    });
    const issued = await issueSession(id);

    assert.equal(await revokeSession(issued.token), true);
    assert.equal(await resolveSession(issued.token), null);
    assert.equal(await revokeSession(issued.token), false);
  });

  test("роль берётся из базы для user, admin и super_admin", async () => {
    const roles: readonly TestRole[] = ["user", "admin", "super_admin"];

    for (const role of roles) {
      const { id } = await createTestUser({
        email: `role.${role}@example.com`,
        password: "role-password",
        role,
      });
      const issued = await issueSession(id);
      const resolved = await resolveSession(issued.token);

      assert.equal(resolved?.role, role);
      // Наружу уходит только узкий объект: ни passwordHash, ни tokenHash (NFR-6).
      assert.deepEqual(Object.keys(resolved ?? {}).sort(), [
        "displayName",
        "email",
        "id",
        "role",
      ]);
    }
  });
});

describe("Seed (FR-14, CR-15, CR-16)", () => {
  test("повторный запуск оставляет ровно одного super_admin", async () => {
    await deleteAllUsers();

    const first = await runProjectScript("prisma/seed.ts");
    assert.equal(first.code, 0, first.stderr);
    assert.ok(first.stdout.includes(testSeedEmail));
    assert.ok(
      !first.stdout.includes(testSeedPassword),
      "seed не должен печатать пароль",
    );

    const second = await runProjectScript("prisma/seed.ts");
    assert.equal(second.code, 0, second.stderr);
    assert.ok(second.stdout.includes("уже был"));

    const seeded = await db.orm.public.User
      .select("id", "email", "role", "passwordHash")
      .where((user) => user.email.eq(testSeedEmail))
      .all();
    assert.equal(seeded.length, 1);

    const admin = seeded[0];
    assert.ok(admin !== undefined);
    if (admin === undefined) {
      return;
    }

    assert.equal(admin.role, "super_admin");
    assert.match(admin.passwordHash, /^\$2b\$12\$/);
    assert.notEqual(admin.passwordHash, testSeedPassword);
    assert.equal(await verifyPassword(testSeedPassword, admin.passwordHash), true);

    const superAdmins = await db.orm.public.User
      .select("id")
      .where((user) => user.role.eq("super_admin"))
      .all();
    assert.equal(superAdmins.length, 1);
  });
});

describe("Очистка истёкших сессий (FR-16, CR-25, NFR-12)", () => {
  test("удаляет только истёкшие записи и сообщает количество", async () => {
    await deleteAllUsers();
    const { id } = await createTestUser({
      email: "cleanup.user@example.com",
      password: "cleanup-password",
    });

    const active = await issueSession(id);
    const activeHash = sha256(active.token);
    const expiredToken = randomBytes(32).toString("base64url");
    const expiredHash = sha256(expiredToken);
    await db.orm.public.Session.create({
      tokenHash: expiredHash,
      userId: id,
      expiresAt: EXPIRED_AT,
    });

    const first = await runProjectScript("scripts/cleanup-sessions.ts");
    assert.equal(first.code, 0, first.stderr);
    assert.match(first.stdout, /удалено истёкших сессий: 1/);
    // В консоль не попадают ни токены, ни их хеши (FR-16).
    assert.ok(!first.stdout.includes(expiredToken));
    assert.ok(!first.stdout.includes(active.token));
    assert.ok(!first.stdout.includes(expiredHash));

    const expiredRows = await db.orm.public.Session
      .select("id")
      .where({ tokenHash: expiredHash })
      .all();
    assert.equal(expiredRows.length, 0);

    const activeRows = await db.orm.public.Session
      .select("id")
      .where({ tokenHash: activeHash })
      .all();
    assert.equal(activeRows.length, 1);

    const resolved = await resolveSession(active.token);
    assert.equal(resolved?.id, id);

    // Повторный запуск безопасен и ничего не удаляет (NFR-12).
    const second = await runProjectScript("scripts/cleanup-sessions.ts");
    assert.equal(second.code, 0, second.stderr);
    assert.match(second.stdout, /удалено истёкших сессий: 0/);
  });
});

