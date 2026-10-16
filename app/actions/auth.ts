"use server";

// Server Actions форм регистрации, входа и выхода (FR-1, FR-3 … FR-9, NFR-1).
//
// Шаг 9 (`Plan.md`): действие создаёт учётную запись с ролью `user`, сохраняет
// только `passwordHash` (`bcryptjs.hash(password, 12)`) и проверяет вход строго
// через `bcryptjs.compare`.
// Шаг 10 (`Plan.md`): успешные регистрация и вход начинают сессию — запись
// `Session` создаёт модуль `app/lib/session.ts`, он же ставит `HttpOnly`-cookie
// `mb_session`, после чего действие переходит на `/account` (FR-7, FR-19).
// Cookie и сессии трогает только модуль сессии, поэтому здесь нет работы с
// cookie (NFR-8). `redirect` вызывается вне `try/catch`: он завершает действие
// служебным исключением, поэтому его нельзя ставить рядом с обработкой ошибок
// базы данных.
//
// Роль из формы не читается: в объект для схемы попадают только email, пароль и
// отображаемое имя, а роль записывается литералом `user`, поэтому поле `role` не
// влияет на результат (FR-5, FR-15, CR-5, CR-6).

import { redirect } from "next/navigation";

import { db } from "@/app/lib/db";
import { hashPassword, verifyPassword } from "@/app/lib/password";
import { endSession, startSession } from "@/app/lib/session";
import {
  loginSchema,
  readFormText,
  registerSchema,
  toFieldErrors,
  type AuthFormState,
} from "@/app/lib/validation";

/** Единое сообщение о неудачном входе: причина отказа не раскрывается (FR-6, С2). */
const LOGIN_FAILED_MESSAGE = "Неверный email или пароль";

/** Сообщение о занятом email: одинаковое для проверки и для нарушения уникальности (FR-3). */
const EMAIL_TAKEN_MESSAGE = "Этот email уже зарегистрирован";

/** Маршрут аккаунта: цель перехода после успешных регистрации и входа (FR-19). */
const ACCOUNT_PATH = "/account";

/** Маршрут входа: цель перехода после выхода из аккаунта (С4). */
const LOGIN_PATH = "/login";

/**
 * Хеш случайной строки с той же стоимостью bcrypt, что и рабочие пароли.
 * Сравнение с ним выполняется, когда пользователя с таким email нет: время
 * ответа остаётся таким же, как при неверном пароле, поэтому по времени нельзя
 * понять, существует ли аккаунт. Это не пароль, и в базе он не используется.
 */
const TIMING_EQUALIZER_HASH =
  "$2b$12$meB2lBJkkNcOeBkM9buj4ef4PKbWIy2yTQFKq5edBzni1FoDw3xGm";

/**
 * Уникальность email обеспечивает ограничение базы данных (`User_email_key`), а
 * не проверка перед вставкой, поэтому конкурентные регистрации одного адреса не
 * создают вторую учётную запись (FR-3). Prisma 8 отдаёт нарушение ограничения как
 * `SqlQueryError` с нормализованным `sqlState` `23505` (справка скилла
 * `prisma-8`, `references/debug.md`), поэтому проверяется форма ошибки — без
 * `instanceof` по классу драйвера.
 */
function isUniqueEmailViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { kind, sqlState } = error as { kind?: unknown; sqlState?: unknown };
  return kind === "sql_query" && sqlState === "23505";
}

/**
 * Создаёт учётную запись с ролью `user` и возвращает её идентификатор, а при
 * занятом email — `null` (FR-3, FR-5). Вставка выделена из действия `register`:
 * `redirect` и `startSession` вызываются после обработки ошибок, поэтому
 * служебное исключение перехода не попадает в `try/catch` базы данных.
 */
async function createUserWithRoleUser(input: {
  email: string;
  passwordHash: string;
  displayName: string | null;
}): Promise<string | null> {
  try {
    // Роль задаётся только этим литералом: значение из формы, query-параметра
    // или тела запроса не читается (FR-5, FR-15).
    const created = await db.orm.public.User.select("id").create({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: "user",
    });

    return created.id;
  } catch (error: unknown) {
    if (isUniqueEmailViolation(error)) {
      return null;
    }

    throw error;
  }
}

/**
 * Регистрация: валидация, нормализация email и создание учётной записи с ролью
 * `user`. Некорректные данные и занятый email возвращаются в состояние формы и
 * новой учётной записи не создают (FR-1, FR-3, FR-5). При успехе действие
 * начинает сессию и переходит на `/account`, поэтому состояние формы
 * возвращается только при ошибках (FR-7, FR-19).
 */
export async function register(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = {
    email: readFormText(formData, "email"),
    password: readFormText(formData, "password"),
    displayName: readFormText(formData, "displayName"),
  };

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      errors: toFieldErrors(parsed.error),
      values: { email: input.email, displayName: input.displayName },
      message: null,
    };
  }

  const values = {
    email: parsed.data.email,
    displayName: parsed.data.displayName ?? "",
  };

  const passwordHash = await hashPassword(parsed.data.password);

  const userId = await createUserWithRoleUser({
    email: parsed.data.email,
    passwordHash,
    displayName: parsed.data.displayName,
  });

  if (userId === null) {
    return { errors: { email: EMAIL_TAKEN_MESSAGE }, values, message: null };
  }

  // Сессия: запись в базе данных и `HttpOnly`-cookie ставятся на сервере
  // (FR-7, С1). Состояние формы после этого не возвращается — действие
  // завершает переход на страницу аккаунта (FR-19).
  await startSession(userId);
  redirect(ACCOUNT_PATH);
}

/**
 * Вход: поиск пользователя по нормализованному email и строгая проверка пароля
 * через `bcryptjs.compare`. Неизвестный email и неверный пароль дают одно и то
 * же сообщение, а время ответа выравнивается сравнением с константным хешем
 * (FR-4, FR-6, С2). При успехе начинается сессия и действие переходит на
 * `/account` (FR-7, FR-19).
 */
export async function login(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const input = {
    email: readFormText(formData, "email"),
    password: readFormText(formData, "password"),
  };

  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      errors: toFieldErrors(parsed.error),
      values: { email: input.email, displayName: "" },
      message: null,
    };
  }

  const values = { email: parsed.data.email, displayName: "" };

  const user = await db.orm.public.User.select("id", "passwordHash")
    .where({ email: parsed.data.email })
    .first();

  const passwordHash = user?.passwordHash ?? TIMING_EQUALIZER_HASH;
  const passwordMatches = await verifyPassword(parsed.data.password, passwordHash);

  if (user === null || !passwordMatches) {
    return {
      errors: {},
      values,
      message: { tone: "error", text: LOGIN_FAILED_MESSAGE },
    };
  }

  // Сессия: запись в базе данных и `HttpOnly`-cookie ставятся на сервере
  // (FR-7, С2). Роль берётся из базы данных, а не из формы (FR-15).
  await startSession(user.id);
  redirect(ACCOUNT_PATH);
}

/**
 * Выход: удаление записи сессии и cookie `mb_session` (FR-9, С4). Действие
 * вызывается кнопкой на `/account` и завершается переходом на `/login`;
 * сохранённое прежнее значение cookie доступа не даёт (CR-12).
 */
export async function logout(): Promise<void> {
  await endSession();
  redirect(LOGIN_PATH);
}
