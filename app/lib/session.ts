// Сессия auth-контура: токен, его хеш в базе данных и cookie `mb_session`
// (FR-7, FR-8, FR-9, NFR-2, NFR-6, NFR-8).
//
// Схема сессии описана в `spec.md` («Механизм сессии: сессии в базе данных,
// вариант A»): браузеру уходит непрозрачный токен из `crypto.randomBytes(32)`,
// а в таблице `Session` лежит SHA-256 этого токена (`tokenHash`), ссылка на
// пользователя и `expiresAt` — момент создания плюс `SESSION_TTL_SECONDS`.
// Токен не подписывается: cookie остаётся валидной только потому, что её хеш
// найден в базе, поэтому `HttpOnly` и `Secure` обязательны.
//
// Модуль серверный (`import "server-only"`, NFR-6) и единственный в
// приложении, кто работает с cookie (NFR-8). Работа с cookie отделена от ядра:
// `issueSession`, `resolveSession` и `revokeSession` не читают и не пишут
// cookie, а `startSession`, `loadSessionUser` и `endSession` — их обёртки для
// Server Actions и Server Components. Благодаря этому серверную логику сессии
// можно проверять вне контекста запроса (`tsx`: автотесты и служебные скрипты,
// шаг 12): `cookies()` вызывается только внутри обёрток.

import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { db } from "@/app/lib/db";
import { env } from "@/app/lib/env";

/** Имя cookie сессии: значение непрозрачно и содержит только токен (CR-10). */
export const SESSION_COOKIE_NAME = "mb_session";

/** Длина токена: 32 байта энтропии (в base64url — 43 символа). */
const SESSION_TOKEN_BYTES = 32;

/** Cookie действует на всём сайте: тот же путь используется и при удалении. */
const SESSION_COOKIE_PATH = "/";

/**
 * Допустимые роли — значения перечисления `Role` контракта. Роль всегда
 * читается из базы данных, а не из запроса (FR-15).
 */
export type SessionRole = "user" | "admin" | "super_admin";

/**
 * Узкий объект пользователя для страниц и действий (NFR-6): наружу не уходят ни
 * `passwordHash`, ни `tokenHash`.
 */
export type SessionUser = Readonly<{
  id: string;
  email: string;
  displayName: string | null;
  role: SessionRole;
}>;

/** Созданная сессия: сам токен уходит только в cookie, в базу идёт его хеш. */
type IssuedSession = Readonly<{
  token: string;
  expiresAt: Date;
}>;

/** Криптографически стойкий токен сессии; клиенту уходит только он (FR-7). */
function generateToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

/** SHA-256 токена: в базе хранится хеш, а не сам токен (FR-7, CR-10). */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Срок действия сессии: момент создания плюс `SESSION_TTL_SECONDS` (FR-18). */
function sessionExpiresAt(now: Date): Date {
  return new Date(now.getTime() + env.sessionTtlSeconds * 1000);
}

/** Срок действия проверяется на сервере при каждом чтении (FR-8, CR-11). */
function isActive(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() > now.getTime();
}

/**
 * Создаёт запись сессии и возвращает токен для cookie. Cookie здесь не
 * ставится: это делает обёртка `startSession` (FR-7).
 */
export async function issueSession(userId: string): Promise<IssuedSession> {
  const token = generateToken();
  const expiresAt = sessionExpiresAt(new Date());

  await db.orm.public.Session.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });

  return { token, expiresAt };
}

/**
 * Читает текущего пользователя по токену: неизвестный и истёкший токен дают
 * `null`, поэтому доступа к защищённым маршрутам нет (FR-8, CR-11). Истёкшие
 * записи удаляются отдельной командой `npm run sessions:cleanup` (FR-16).
 */
export async function resolveSession(token: string): Promise<SessionUser | null> {
  const session = await db.orm.public.Session.select("userId", "expiresAt")
    .where({ tokenHash: hashToken(token) })
    .first();

  if (session === null || !isActive(session.expiresAt, new Date())) {
    return null;
  }

  const user = await db.orm.public.User.select(
    "id",
    "email",
    "displayName",
    "role",
  )
    .where({ id: session.userId })
    .first();

  if (user === null) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

/**
 * Удаляет запись сессии по токену: после выхода прежняя cookie не работает
 * (FR-9, CR-12). Возвращает признак того, что запись была найдена и удалена.
 */
export async function revokeSession(token: string): Promise<boolean> {
  const deleted = await db.orm.public.Session.where({
    tokenHash: hashToken(token),
  }).delete();

  return deleted !== null;
}

/**
 * Ставит cookie сессии: значение — только токен, из клиентского JavaScript
 * cookie не читается (`HttpOnly`), срок жизни совпадает со сроком действия
 * записи в базе, `Secure` включается в production (NFR-2, CR-10).
 */
async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: SESSION_COOKIE_PATH,
    secure: env.isProduction,
    maxAge: env.sessionTtlSeconds,
    expires: expiresAt,
  });
}

/** Токен из cookie текущего запроса или пустая строка, если cookie нет. */
async function readSessionToken(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
}

/**
 * Начинает сессию: создаёт запись в базе данных и ставит cookie `mb_session`.
 * Вызывается из Server Actions регистрации и входа (FR-7, С1, С2).
 */
export async function startSession(userId: string): Promise<void> {
  const { token, expiresAt } = await issueSession(userId);
  await setSessionCookie(token, expiresAt);
}

/** Текущий пользователь по cookie сессии или `null` (FR-8). */
export async function loadSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();

  if (token === "") {
    return null;
  }

  return resolveSession(token);
}

/**
 * Завершает сессию: удаляет запись в базе данных и саму cookie (FR-9, С4).
 * Если cookie нет, действие остаётся безопасным и ничего не удаляет.
 */
export async function endSession(): Promise<void> {
  const token = await readSessionToken();

  if (token !== "") {
    await revokeSession(token);
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
