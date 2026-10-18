// Data Access Layer auth-контура: чтение текущего пользователя и проверки
// доступа (FR-8, FR-10, FR-12, FR-13, FR-15, NFR-4, NFR-5, NFR-6).
//
// Шаг 11 (`Plan.md`) добавляет ровно три функции, которые страницы и Server
// Actions вызывают до обращения к данным:
//
// - `getCurrentUser` — текущий пользователь по cookie сессии или `null`;
// - `requireUser` — то же, но без действующей сессии запрос уходит на
//   `/access-denied`;
// - `requireRole` — `requireUser` плюс проверка роли по допустимому набору.
//
// Роль читается только из базы данных (`app/lib/session.ts`); из формы,
// query-параметра или заголовка она не берётся (FR-15, NFR-4). Отказ выглядит
// для клиента одинаково: и гость, и недостаточная роль уходят на одну страницу
// `/access-denied`, причина отказа не раскрывается (FR-13, CR-17, CR-18).
//
// `redirect` из `next/navigation` внутри Server Component вставляет meta-тег
// перехода, а не отдаёт 3xx (документация `redirect` установленной версии,
// `next/dist/client/components/redirect.d.ts`), поэтому отказ гостя и отказ из-за
// недостаточной роли одинаковы и по HTTP-статусу `200` (FR-13).
//
// Сессия читается за границей `<Suspense>` страницы: при включённых Cache
// Components (`next.config.ts`) чтение cookie вне границы — ошибка сборки
// (NFR-7, проверено опытом, раздел 1.1 `Plan.md`).
//
// Ни одна функция не принимает идентификатор пользователя: запросить чужой
// аккаунт нечем (NFR-5). Спецификатор `server-only` держит границу «серверное
// не попадает в клиент» (NFR-6), вне сборки он разрешается пустым модулем
// `app/lib/server-only-shim.ts` через `paths` в `tsconfig.json`.

import "server-only";

import { io } from "next/cache";
import { redirect } from "next/navigation";

import {
  loadSessionUser,
  type SessionRole,
  type SessionUser,
} from "@/app/lib/session";

/** Единая страница отказа: одна для гостя и для недостаточной роли (FR-13). */
export const ACCESS_DENIED_PATH = "/access-denied";

/**
 * Текущий пользователь по cookie сессии или `null` (FR-8, FR-10).
 *
 * `await io()` отмечает чтение сессии как операцию времени запроса (NFR-7).
 * Без него Cache Components при проверке статической оболочки доходит до
 * Prisma 8, а её внутренний `crypto.randomUUID()` считается нестабильным
 * значением и попадает в ошибку пререндера. `io()` приостанавливает
 * пререндер до запроса, а во время реального запроса и в Server Actions
 * разрешается сразу, поэтому свежесть проверки доступа не меняется.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  await io();
  return loadSessionUser();
}

/**
 * Требует действующую сессию: без неё запрос уходит на `/access-denied`
 * (FR-10, FR-12, FR-13). Вызывается страницами и Server Actions до обращения к
 * данным, поэтому защищённая разметка в ответ не попадает (CR-20).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();

  if (user === null) {
    // `redirect` объявлен как `never`: дальше выполнение не продолжается.
    redirect(ACCESS_DENIED_PATH);
  }

  return user;
}

/**
 * Требует роль из допустимого набора (FR-12). Набор передаёт вызывающий код, а
 * значение роли приходит из базы данных, поэтому подменить её запросом нельзя
 * (FR-15).
 */
export async function requireRole(
  allowedRoles: readonly SessionRole[],
): Promise<SessionUser> {
  const user = await requireUser();

  if (!allowedRoles.includes(user.role)) {
    redirect(ACCESS_DENIED_PATH);
  }

  return user;
}
