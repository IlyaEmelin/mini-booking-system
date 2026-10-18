"use client";

// Кнопка отметки уведомления прочитанным (FR-32, NFR-11).
//
// Форма передаёт Server Action только `notificationId`. Получатель проверяется
// на сервере по действующей сессии, поэтому скрытого `userId` нет. Повторная
// отправка идемпотентна: серверный слой не перезаписывает `readAt`.

import { useActionState } from "react";

import { markNotificationReadAction } from "@/app/actions/bookings";
import { INITIAL_NOTIFICATION_FORM_STATE } from "@/app/lib/booking-validation";

const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";
const NOTICE_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const BUTTON_CLASS =
  "flex h-9 items-center justify-center rounded-full border border-black/[.12] px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/[.18] dark:text-zinc-50 dark:hover:bg-white/[.08]";

export function MarkNotificationReadButton({
  notificationId,
}: Readonly<{ notificationId: string }>) {
  const [state, formAction, pending] = useActionState(
    markNotificationReadAction,
    INITIAL_NOTIFICATION_FORM_STATE,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col items-start gap-2"
      aria-busy={pending}
    >
      <input type="hidden" name="notificationId" value={notificationId} />
      <button type="submit" disabled={pending} className={BUTTON_CLASS}>
        {pending ? "Отметка…" : "Прочитать"}
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
