"use server";

// Server Actions форм регистрации и входа (FR-1, FR-2, FR-6).
//
// Шаг 8 (`Plan.md`): действие читает поля формы, проверяет их Zod-схемой и
// возвращает ошибки в состояние формы `useActionState`. Создание пользователя,
// `bcryptjs.hash`, `bcryptjs.compare` и сессия добавляются на шагах 9–10 в этих
// же действиях (FR-3, FR-4, FR-7).
//
// Роль из формы не читается: в объект для схемы попадают только email, пароль и
// отображаемое имя, поэтому поле `role` не влияет на результат (FR-5, CR-5).

import {
  loginSchema,
  readFormText,
  registerSchema,
  toFieldErrors,
  type AuthFormState,
} from "@/app/lib/validation";

/**
 * Регистрация: валидация и нормализация email.
 * Некорректные данные возвращаются в состояние формы и не создают пользователя.
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

  // Шаг 9: здесь появятся поиск занятого email, `bcryptjs.hash(password, 12)`,
  // создание `User` с ролью `user`, создание сессии и `redirect('/account')`.
  return {
    errors: {},
    values: {
      email: parsed.data.email,
      displayName: parsed.data.displayName ?? "",
    },
    message: {
      tone: "notice",
      text: "Серверная проверка пройдена: данные корректны. Создание учётной записи появится на шаге 9.",
    },
  };
}

/**
 * Вход: валидация и нормализация email.
 * Проверка пары email/пароль и создание сессии — шаги 9–10 (FR-6, FR-7).
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

  // Шаги 9–10: поиск пользователя по нормализованному email, строгая проверка
  // `bcryptjs.compare(password, passwordHash)`, единое сообщение о неудаче,
  // создание сессии и `redirect('/account')`.
  return {
    errors: {},
    values: { email: parsed.data.email, displayName: "" },
    message: {
      tone: "notice",
      text: "Серверная проверка пройдена: данные корректны. Вход и сессия появятся на шагах 9–10.",
    },
  };
}
