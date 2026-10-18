"use client";

// Форма записи на конкретный слот (FR-23, NFR-11).
//
// Клиентский компонент передаёт Server Action только `slotId`; владельца,
// роль и статус форма не содержит. Ошибка доменной операции приходит из
// действия и показывается рядом с кнопкой, а на время отправки кнопка
// блокируется. После успешного создания действие уводит на `/bookings`.

import { useActionState } from "react";

import { createBookingAction } from "@/app/actions/bookings";
import { INITIAL_BOOKING_FORM_STATE } from "@/app/lib/booking-validation";

const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";
const BUTTON_CLASS =
  "flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]";

export function CreateBookingForm({ slotId }: Readonly<{ slotId: string }>) {
  const [state, formAction, pending] = useActionState(
    createBookingAction,
    INITIAL_BOOKING_FORM_STATE,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2 sm:items-end"
      aria-busy={pending}
    >
      <input type="hidden" name="slotId" value={slotId} />
      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        {pending ? "Запись…" : "Записаться"}
      </button>
      {state.message === null ? null : (
        <p aria-live="polite" className={ERROR_CLASS}>
          {state.message.text}
        </p>
      )}
    </form>
  );
}
