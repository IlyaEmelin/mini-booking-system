"use client";

// Форма входа для `guest` (FR-6, NFR-11).
//
// Проверка полей выполняется на сервере той же Zod-схемой, что и при
// регистрации; клиентские атрибуты нужны только для UX (FR-2, CR-29).
// Единое сообщение о неудачном входе добавляется на шаге 9.

import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import {
  INITIAL_AUTH_FORM_STATE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@/app/lib/validation";

const LABEL_CLASS = "text-sm font-medium text-zinc-950 dark:text-zinc-50";
const INPUT_CLASS =
  "h-11 w-full rounded-lg border border-black/[.12] bg-white px-3 text-base text-zinc-950 outline-none focus-visible:border-zinc-950 dark:border-white/[.18] dark:bg-black dark:text-zinc-50 dark:focus-visible:border-zinc-50";
const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(
    login,
    INITIAL_AUTH_FORM_STATE,
  );

  const emailError = state.errors.email;
  const passwordError = state.errors.password;

  return (
    <form action={formAction} className="flex w-full flex-col gap-5" aria-busy={pending}>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor="login-email">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.values.email}
          aria-invalid={emailError !== undefined}
          aria-describedby={emailError === undefined ? undefined : "login-email-error"}
          className={INPUT_CLASS}
        />
        {emailError === undefined ? null : (
          <p className={ERROR_CLASS} id="login-email-error">
            {emailError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL_CLASS} htmlFor="login-password">
          Пароль
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="current-password"
          aria-invalid={passwordError !== undefined}
          aria-describedby={passwordError === undefined ? undefined : "login-password-error"}
          className={INPUT_CLASS}
        />
        {passwordError === undefined ? null : (
          <p className={ERROR_CLASS} id="login-password-error">
            {passwordError}
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
        {pending ? "Отправка…" : "Войти"}
      </button>
    </form>
  );
}
