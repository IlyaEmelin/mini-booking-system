"use server";

// Server Actions форм регистрации и входа (FR-1, FR-3, FR-4, FR-5, FR-6, NFR-1).
//
// Шаг 9 (`Plan.md`): действие создаёт учётную запись с ролью `user`, сохраняет
// только `passwordHash` (`bcryptjs.hash(password, 12)`) и проверяет вход строго
// через `bcryptjs.compare`. Сессия, cookie и `redirect('/account')` добавляются
// на шаге 10 в этих же действиях (FR-7, FR-9).
//
// Роль из формы не читается: в объект для схемы попадают только email, пароль и
// отображаемое имя, а роль записывается литералом `user`, поэтому поле `role` не
// влияет на результат (FR-5, FR-15, CR-5, CR-6).

import { db } from "@/app/lib/db";
import { hashPassword, verifyPassword } from "@/app/lib/password";
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

/** Итог шага 9: учётная запись создана, но сессия и переход в аккаунт ещё не подключены. */
const REGISTER_OK_MESSAGE =
  "Учётная запись создана. Сессия и переход в аккаунт появятся на шаге 10.";

/** Итог шага 9: пара email и пароль верна, сессия и переход в аккаунт ещё не подключены. */
const LOGIN_OK_MESSAGE =
  "Email и пароль верны. Сессия и переход в аккаунт появятся на шаге 10.";

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
 * Регистрация: валидация, нормализация email и создание учётной записи с ролью
 * `user`. Некорректные данные и занятый email возвращаются в состояние формы и
 * новой учётной записи не создают (FR-1, FR-3, FR-5).
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

  try {
    // Роль задаётся только этим литералом: значение из формы, query-параметра
    // или тела запроса не читается (FR-5, FR-15).
    await db.orm.public.User.create({
      email: parsed.data.email,
      passwordHash,
      displayName: parsed.data.displayName,
      role: "user",
    });
  } catch (error: unknown) {
    if (isUniqueEmailViolation(error)) {
      return { errors: { email: EMAIL_TAKEN_MESSAGE }, values, message: null };
    }
    throw error;
  }

  return {
    errors: {},
    values,
    message: { tone: "notice", text: REGISTER_OK_MESSAGE },
  };
}

/**
 * Вход: поиск пользователя по нормализованному email и строгая проверка пароля
 * через `bcryptjs.compare`. Неизвестный email и неверный пароль дают одно и то
 * же сообщение, а время ответа выравнивается сравнением с константным хешем
 * (FR-4, FR-6, С2). Создание сессии — шаг 10.
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

  return {
    errors: {},
    values,
    message: { tone: "notice", text: LOGIN_OK_MESSAGE },
  };
}
