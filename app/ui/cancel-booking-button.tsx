"use client";

// Кнопка отмены своей брони (FR-25, NFR-11).
//
// Форма передаёт Server Action только `bookingId`. Владелец проверяется на
// сервере по действующей сессии, поэтому скрытое поле с пользователем или
// статусом отсутствует. Ошибка действия выводится рядом с кнопкой; после
// успешной отмены страница обновляется через `revalidatePath`, и бронь
// показывается в статусе `cancelled`.

import { useActionState } from "react";

import { cancelBookingAction } from "@/app/actions/bookings";
import { INITIAL_BOOKING_FORM_STATE } from "@/app/lib/booking-validation";

const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";
const NOTICE_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const BUTTON_CLASS =
  "flex h-10 items-center justify-center rounded-full border border-red-600/30 px-5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-950/40";

export function CancelBookingButton({
  bookingId,
}: Readonly<{ bookingId: string }>) {
  const [state, formAction, pending] = useActionState(
    cancelBookingAction,
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
        {pending ? "Отмена…" : "Отменить бронь"}
      </button>
      {state.message === null ? null : (
        <p
          aria-live="polite"
          className={
            state.message.tone === "error" ? ERROR_CLASS : NOTICE_CLASS
          }
        >
          {state.message.text}
        </p>
      )}
    </form>
  );
}
