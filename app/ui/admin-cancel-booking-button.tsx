"use client";

// Кнопка административной отмены брони (FR-33, NFR-18).
//
// Форма передаёт только `bookingId`. Роль проверяется в Server Action и в
// `cancelBooking`; отменять можно `pending` и `confirmed`, владелец получает
// уведомление `booking_cancelled` в той же транзакции.

import { useActionState } from "react";

import { adminCancelBookingAction } from "@/app/actions/bookings";
import { INITIAL_BOOKING_FORM_STATE } from "@/app/lib/booking-validation";

const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";
const NOTICE_CLASS = "text-sm text-emerald-700 dark:text-emerald-300";
const BUTTON_CLASS =
  "flex h-9 items-center justify-center rounded-full border border-red-600/30 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-950/40";

export function AdminCancelBookingButton({
  bookingId,
}: Readonly<{ bookingId: string }>) {
  const [state, formAction, pending] = useActionState(
    adminCancelBookingAction,
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
        {pending ? "Отмена…" : "Отменить"}
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
