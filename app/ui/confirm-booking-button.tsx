"use client";

// Кнопка подтверждения брони (FR-33, NFR-18).
//
// Форма передаёт Server Action только `bookingId`. Роль `admin`/`super_admin`
// проверяется на сервере до вызова `confirmBooking`, переход допустим только
// из `pending`, а владелец получает уведомление в транзакции.

import { useActionState } from "react";

import { confirmBookingAction } from "@/app/actions/bookings";
import { INITIAL_BOOKING_FORM_STATE } from "@/app/lib/booking-validation";

const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";
const NOTICE_CLASS = "text-sm text-emerald-700 dark:text-emerald-300";
const BUTTON_CLASS =
  "flex h-9 items-center justify-center rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]";

export function ConfirmBookingButton({
  bookingId,
}: Readonly<{ bookingId: string }>) {
  const [state, formAction, pending] = useActionState(
    confirmBookingAction,
    INITIAL_BOOKING_FORM_STATE,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2"
      aria-busy={pending}
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        {pending ? "Подтверждение…" : "Подтвердить"}
      </button>
      {state.message === null ? null : (
        <p
          aria-live="polite"
          className={state.message.tone === "error" ? ERROR_CLASS : NOTICE_CLASS}
        >
          {state.message.text}
        </p>
      )}
    </form>
  );
}
