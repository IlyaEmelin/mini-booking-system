"use client";

// Форма изменения свободного слота (FR-29, NFR-18).
//
// Идентификатор слота приходит из серверной разметки и передаётся только как
// `slotId`; роль проверяется в Server Action и в серверном слое. Слот с
// активными бронями не изменяется — сервер вернёт `SLOT_HAS_ACTIVE_BOOKINGS`.

import { useActionState } from "react";

import { updateSlotAction } from "@/app/actions/slots";
import { createSlotFormState } from "@/app/lib/slot-validation";

const LABEL_CLASS = "text-xs font-medium text-zinc-600 dark:text-zinc-400";
const INPUT_CLASS =
  "h-9 w-full rounded-lg border border-black/[.12] bg-white px-2 text-sm text-zinc-950 outline-none focus-visible:border-zinc-950 dark:border-white/[.18] dark:bg-black dark:text-zinc-50 dark:focus-visible:border-zinc-50";
const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";
const NOTICE_CLASS = "text-sm text-emerald-700 dark:text-emerald-300";
const BUTTON_CLASS =
  "flex h-9 items-center justify-center rounded-full border border-black/[.12] px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.18] dark:text-zinc-50 dark:hover:bg-white/[.08]";

export function UpdateSlotForm({
  slotId,
  startsAt,
  endsAt,
  capacity,
}: Readonly<{
  slotId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
}>) {
  const [state, formAction, pending] = useActionState(
    updateSlotAction,
    createSlotFormState({
      startsAt,
      endsAt,
      capacity: String(capacity),
    }),
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg bg-black/[.03] p-3 dark:bg-white/[.05]"
      aria-busy={pending}
    >
      <input type="hidden" name="slotId" value={slotId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS} htmlFor={`slot-${slotId}-starts-at`}>
            Начало (UTC)
          </label>
          <input
            id={`slot-${slotId}-starts-at`}
            name="startsAt"
            type="datetime-local"
            required
            step={60}
            defaultValue={state.values.startsAt}
            aria-invalid={state.errors.startsAt !== undefined}
            className={INPUT_CLASS}
          />
          {state.errors.startsAt === undefined ? null : (
            <p className={ERROR_CLASS}>{state.errors.startsAt}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS} htmlFor={`slot-${slotId}-ends-at`}>
            Окончание (UTC)
          </label>
          <input
            id={`slot-${slotId}-ends-at`}
            name="endsAt"
            type="datetime-local"
            required
            step={60}
            defaultValue={state.values.endsAt}
            aria-invalid={state.errors.endsAt !== undefined}
            className={INPUT_CLASS}
          />
          {state.errors.endsAt === undefined ? null : (
            <p className={ERROR_CLASS}>{state.errors.endsAt}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_CLASS} htmlFor={`slot-${slotId}-capacity`}>
            Вместимость
          </label>
          <input
            id={`slot-${slotId}-capacity`}
            name="capacity"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={state.values.capacity}
            aria-invalid={state.errors.capacity !== undefined}
            className={INPUT_CLASS}
          />
          {state.errors.capacity === undefined ? null : (
            <p className={ERROR_CLASS}>{state.errors.capacity}</p>
          )}
        </div>
      </div>

      {state.message === null ? null : (
        <p
          aria-live="polite"
          className={state.message.tone === "error" ? ERROR_CLASS : NOTICE_CLASS}
        >
          {state.message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`${BUTTON_CLASS} self-start`}
      >
        {pending ? "Сохранение…" : "Сохранить слот"}
      </button>
    </form>
  );
}
