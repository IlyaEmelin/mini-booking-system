"use client";

// Форма создания слота администратором (FR-29, NFR-18).
//
// Поля `startsAt` и `endsAt` — `datetime-local` в UTC. Server Action принимает
// только значения слота; роль и автор действия берутся из сессии. Ошибки полей
// приходят из Zod, доменные ошибки — из `app/lib/slots.ts`.

import { useActionState } from "react";

import { createSlotAction } from "@/app/actions/slots";
import { INITIAL_SLOT_FORM_STATE } from "@/app/lib/slot-validation";

const LABEL_CLASS = "text-sm font-medium text-zinc-950 dark:text-zinc-50";
const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-black/[.12] bg-white px-3 text-sm text-zinc-950 outline-none focus-visible:border-zinc-950 dark:border-white/[.18] dark:bg-black dark:text-zinc-50 dark:focus-visible:border-zinc-50";
const HINT_CLASS = "text-xs text-zinc-500 dark:text-zinc-400";
const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";
const NOTICE_CLASS = "text-sm text-emerald-700 dark:text-emerald-300";
const BUTTON_CLASS =
  "flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]";

export function CreateSlotForm() {
  const [state, formAction, pending] = useActionState(
    createSlotAction,
    INITIAL_SLOT_FORM_STATE,
  );

  const startsAtError = state.errors.startsAt;
  const endsAtError = state.errors.endsAt;
  const capacityError = state.errors.capacity;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-xl border border-dashed border-black/[.12] p-5 dark:border-white/[.18]"
      aria-busy={pending}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={LABEL_CLASS} htmlFor="create-slot-starts-at">
            Начало (UTC)
          </label>
          <input
            id="create-slot-starts-at"
            name="startsAt"
            type="datetime-local"
            required
            step={60}
            defaultValue={state.values.startsAt}
            aria-invalid={startsAtError !== undefined}
            aria-describedby={
              startsAtError === undefined ? undefined : "create-slot-starts-at-error"
            }
            className={INPUT_CLASS}
          />
          {startsAtError === undefined ? null : (
            <p className={ERROR_CLASS} id="create-slot-starts-at-error">
              {startsAtError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={LABEL_CLASS} htmlFor="create-slot-ends-at">
            Окончание (UTC)
          </label>
          <input
            id="create-slot-ends-at"
            name="endsAt"
            type="datetime-local"
            required
            step={60}
            defaultValue={state.values.endsAt}
            aria-invalid={endsAtError !== undefined}
            aria-describedby={
              endsAtError === undefined ? undefined : "create-slot-ends-at-error"
            }
            className={INPUT_CLASS}
          />
          {endsAtError === undefined ? null : (
            <p className={ERROR_CLASS} id="create-slot-ends-at-error">
              {endsAtError}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <label className={LABEL_CLASS} htmlFor="create-slot-capacity">
          Вместимость
        </label>
        <input
          id="create-slot-capacity"
          name="capacity"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={state.values.capacity}
          aria-invalid={capacityError !== undefined}
          aria-describedby={
            capacityError === undefined ? "create-slot-capacity-hint" : "create-slot-capacity-error"
          }
          className={INPUT_CLASS}
        />
        <p className={HINT_CLASS} id="create-slot-capacity-hint">
          Целое число больше 0. Начало слота — в будущем и в пределах 7 дней.
        </p>
        {capacityError === undefined ? null : (
          <p className={ERROR_CLASS} id="create-slot-capacity-error">
            {capacityError}
          </p>
        )}
      </div>

      {state.message === null ? null : (
        <p
          aria-live="polite"
          className={state.message.tone === "error" ? ERROR_CLASS : NOTICE_CLASS}
        >
          {state.message.text}
        </p>
      )}

      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        {pending ? "Создание…" : "Создать слот"}
      </button>
    </form>
  );
}
