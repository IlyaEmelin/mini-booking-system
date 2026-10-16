// Серверная валидация форм регистрации и входа (FR-1, FR-2, FR-3, NFR-11).
//
// Модуль не обращается к базе данных и не содержит секретов, поэтому его можно
// импортировать и в клиентские компоненты форм: оттуда берутся только
// предельные длины полей, а сами схемы применяются на сервере — в Server
// Actions и в seed (CR-29, CR-30).

import { z } from "zod";

/** Политика длины пароля (FR-2, CR-29): от 8 до 72 символов. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
/** bcrypt учитывает только первые 72 байта пароля, поэтому байты проверяются отдельно. */
export const PASSWORD_MAX_BYTES = 72;
/** Длина отображаемого имени (FR-2, CR-30): не более 80 символов. */
export const DISPLAY_NAME_MAX_LENGTH = 80;

const EMAIL_REQUIRED_MESSAGE = "Введите email";
const EMAIL_INVALID_MESSAGE = "Введите корректный email";
const PASSWORD_REQUIRED_MESSAGE = "Введите пароль";
const PASSWORD_MIN_MESSAGE = `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`;
const PASSWORD_MAX_MESSAGE = `Пароль должен быть не длиннее ${PASSWORD_MAX_LENGTH} символов`;
const PASSWORD_BYTES_MESSAGE = `Пароль слишком длинный: не более ${PASSWORD_MAX_BYTES} байт в UTF-8`;
const DISPLAY_NAME_MAX_MESSAGE = `Отображаемое имя не длиннее ${DISPLAY_NAME_MAX_LENGTH} символов`;

/**
 * Email нормализуется одинаково для регистрации и входа: обрезка пробелов и
 * нижний регистр (FR-3). Проверка формата выполняется после нормализации.
 */
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: EMAIL_REQUIRED_MESSAGE })
  .pipe(z.email({ error: EMAIL_INVALID_MESSAGE }));

/**
 * Единая проверка пароля: непустое значение, 8–72 символа и не больше 72 байт
 * в UTF-8 (FR-2, CR-29). Тот же набор границ применяется при входе: пароли
 * попадают в базу только через эту схему (регистрация) и seed.
 */
const passwordSchema = z
  .string()
  .min(1, { error: PASSWORD_REQUIRED_MESSAGE })
  .min(PASSWORD_MIN_LENGTH, { error: PASSWORD_MIN_MESSAGE })
  .max(PASSWORD_MAX_LENGTH, { error: PASSWORD_MAX_MESSAGE })
  .refine(
    (value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES,
    { error: PASSWORD_BYTES_MESSAGE },
  );

/** Необязательное отображаемое имя: пустое значение становится `null` (CR-30). */
const displayNameSchema = z
  .string()
  .trim()
  .max(DISPLAY_NAME_MAX_LENGTH, { error: DISPLAY_NAME_MAX_MESSAGE })
  .nullish()
  .transform((value) =>
    value === null || value === undefined || value === "" ? null : value,
  );

/** Схема регистрации: поля email, пароль и необязательное отображаемое имя (FR-1). */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});

/** Схема входа: email и пароль (FR-6); нормализация email — как при регистрации. */
export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/** Поля формы, к которым привязываются сообщения об ошибках (NFR-11). */
export type AuthField = "email" | "password" | "displayName";

/** По одному сообщению на поле: остальные замечания той же проверки не дублируются. */
export type AuthFieldErrors = Partial<Record<AuthField, string>>;

/** Сообщение уровня формы: подсказка о результате действия или общая ошибка. */
export type AuthFormMessage = Readonly<{
  tone: "notice" | "error";
  text: string;
}>;

/**
 * Состояние формы для `useActionState`: ошибки по полям, сохранённые значения
 * (пароль не возвращается) и сообщение действия. Форма регистрации и форма
 * входа используют один и тот же контракт.
 */
export type AuthFormState = Readonly<{
  errors: AuthFieldErrors;
  values: Readonly<{ email: string; displayName: string }>;
  message: AuthFormMessage | null;
}>;

/** Подпись Server Action, совместимая с `useActionState` (prevState, formData). */
export type AuthFormAction = (
  previousState: AuthFormState,
  formData: FormData,
) => Promise<AuthFormState>;

/** Начальное состояние формы: пустые поля и отсутствие сообщений. */
export const INITIAL_AUTH_FORM_STATE: AuthFormState = {
  errors: {},
  values: { email: "", displayName: "" },
  message: null,
};

/** Значение поля из `FormData`: отсутствующие и файловые значения дают пустую строку. */
export function readFormText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const AUTH_FIELDS: readonly AuthField[] = ["email", "password", "displayName"];

function isAuthField(value: PropertyKey): value is AuthField {
  return (
    typeof value === "string" &&
    (AUTH_FIELDS as readonly string[]).includes(value)
  );
}

/** Превращает ошибки Zod в сообщения по полям формы: по одному сообщению на поле. */
export function toFieldErrors(error: z.ZodError): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (!isAuthField(field) || errors[field] !== undefined) {
      continue;
    }
    errors[field] = issue.message;
  }
  return errors;
}
