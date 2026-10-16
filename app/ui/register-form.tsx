"use client";

// Форма регистрации для `guest` (FR-1, NFR-11).
//
// Клиентские атрибуты (`required`, `minlength`, `maxlength`, `type="email"`)
// отвечают только за UX: те же границы проверяются на сервере той же Zod-схемой
// в Server Action `register` (FR-2, CR-29, CR-30). Пароль в состояние формы не
// возвращается и в HTML не попадает.

import { useActionState } from "react";

import { register } from "@/app/actions/auth";
import {
  DISPLAY_NAME_MAX_LENGTH,
  INITIAL_AUTH_FORM_STATE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/app/lib/validation";

const LABEL_CLASS = "text-sm font-medium text-zinc-950 dark:text-zinc-50";
const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-black/[.12] bg-white px-3 text-base text-zinc-950 outline-none focus-visible:border-zinc-950 dark:border-white/[.18] dark:bg-black dark:text-zinc-50 dark:focus-visible:border-zinc-50";
const HINT_CLASS = "text-xs text-zinc-500 dark:text-zinc-400";
const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    register,
    INITIAL_AUTH_FORM_STATE,
  );

  const emailError = state.errors.email;
  const passwordError = state.errors.password;
  const displayNameError = state.errors.displayName;

  return (
    <form action={formAction} className="flex w-full flex-col gap-5" aria-busy={pending}>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.values.email}
          aria-invalid={emailError !== undefined}
          aria-describedby={emailError === undefined ? undefined : "register-email-error"}
          className={INPUT_CLASS}
        />
        {emailError === undefined ? null : (
          <p className={ERROR_CLASS} id="register-email-error">
            {emailError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor="register-password">
          Пароль
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          aria-invalid={passwordError !== undefined}
          aria-describedby={
            passwordError === undefined
              ? "register-password-hint"
              : "register-password-hint register-password-error"
          }
          className={INPUT_CLASS}
        />
        <p className={HINT_CLASS} id="register-password-hint">
          От {PASSWORD_MIN_LENGTH} до {PASSWORD_MAX_LENGTH} символов и не больше
          72 байт в UTF-8.
        </p>
        {passwordError === undefined ? null : (
          <p className={ERROR_CLASS} id="register-password-error">
            {passwordError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor="register-display-name">
          Отображаемое имя (необязательно)
        </label>
        <input
          id="register-display-name"
          name="displayName"
          type="text"
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoComplete="name"
          defaultValue={state.values.displayName}
          aria-invalid={displayNameError !== undefined}
          aria-describedby={
            displayNameError === undefined ? undefined : "register-display-name-error"
          }
          className={INPUT_CLASS}
        />
        {displayNameError === undefined ? null : (
          <p className={ERROR_CLASS} id="register-display-name-error">
            {displayNameError}
          </p>
        )}
      </div>

      {state.message === null ? null : (
        <p
          aria-live="polite"
          className={
            state.message.tone === "error" ? ERROR_CLASS : "text-sm text-zinc-600 dark:text-zinc-400"
          }
        >
          {state.message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {pending ? "Отправка…" : "Создать аккаунт"}
      </button>
    </form>
  );
}
