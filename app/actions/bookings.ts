"use server";

// Server Actions пользовательского booking flow (FR-23, FR-25, FR-26, FR-30).
//
// Шаг 3 (`Plan.md`): создание своей брони и отмена своей брони. Каждое действие
// начинается с `requireUser()`, поэтому владелец всегда берётся из действующей
// сессии, а не из формы (FR-23, NFR-14). Из входных данных принимается только
// `slotId` или `bookingId`; `userId`, роль и статус схемой не предусмотрены.
//
// Транзакции, проверка вместимости, переходы статусов и уведомления остаются в
// `app/lib/bookings.ts`: действия только валидируют идентификатор, вызывают
// серверную функцию и переводят доменный код в текст формы (FR-28).
//
// `BOOKING_NOT_FOUND` и `FORBIDDEN` дают одно сообщение: чужая бронь для роли
// `user` неотличима от несуществующей (NFR-14). После успешной операции
// инвалидируются все пользовательские экраны, которые читают изменённые данные.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  BookingError,
  cancelBooking,
  createBooking,
  type BookingErrorCode,
} from "@/app/lib/bookings";
import { requireUser } from "@/app/lib/auth";
import {
  cancelBookingFormSchema,
  createBookingFormSchema,
  type BookingFormState,
} from "@/app/lib/booking-validation";
import { readFormText } from "@/app/lib/validation";

/** Маршрут «Мои записи»: цель перехода после успешного создания брони. */
const BOOKINGS_PATH = "/bookings";

/** Понятные пользователю тексты доменных нарушений (FR-28). */
const BOOKING_ERROR_MESSAGES: Readonly<Record<BookingErrorCode, string>> = {
  SLOT_NOT_FOUND: "Слот не найден. Обновите список слотов.",
  SLOT_IN_PAST: "Слот уже начался — записаться на него нельзя.",
  SLOT_FULL: "На этот слот больше нет свободных мест.",
  DUPLICATE_ACTIVE_BOOKING: "У вас уже есть активная бронь на этот слот.",
  BOOKING_NOT_FOUND: "Бронь не найдена.",
  // Чужая бронь неотличима от несуществующей (NFR-14).
  FORBIDDEN: "Бронь не найдена.",
  INVALID_TRANSITION: "Состояние брони уже изменилось. Обновите страницу.",
};

/** Ошибка формы брони. */
function bookingErrorState(text: string): BookingFormState {
  return { message: { tone: "error", text } };
}

/** Переводит доменную ошибку брони в состояние формы; прочие ошибки пробрасывает. */
function toBookingErrorState(error: unknown): BookingFormState {
  if (error instanceof BookingError) {
    return bookingErrorState(BOOKING_ERROR_MESSAGES[error.code]);
  }

  throw error;
}

/** Инвалидирует пользовательские экраны, читающие слоты, брони и уведомления. */
function revalidateBookingViews(): void {
  revalidatePath("/slots");
  revalidatePath("/bookings");
  revalidatePath("/notifications");
}

/**
 * Создаёт бронь текущего пользователя на выбранный слот (FR-23, FR-26).
 *
 * Из формы читается только `slotId`; владелец берётся из `requireUser()`.
 * При успехе бронь получает `pending`, а владельцу в той же транзакции
 * создаётся уведомление `booking_created`. После обновления экранов действие
 * переходит на `/bookings`, где новая запись уже видна.
 */
export async function createBookingAction(
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const actor = await requireUser();

  const parsed = createBookingFormSchema.safeParse({
    slotId: readFormText(formData, "slotId"),
  });

  if (!parsed.success) {
    return bookingErrorState(
      "Не удалось определить слот. Обновите страницу и попробуйте ещё раз.",
    );
  }

  try {
    await createBooking(actor, parsed.data.slotId);
  } catch (error) {
    return toBookingErrorState(error);
  }

  revalidateBookingViews();
  redirect(BOOKINGS_PATH);
}

/**
 * Отменяет бронь текущего пользователя (FR-25, FR-26).
 *
 * Из формы читается только `bookingId`. Владельца и допустимость перехода
 * проверяет `cancelBooking`; роль `user` не может отменить чужую бронь, а
 * отменённая бронь повторно не отменяется. При успехе владельцу создаётся
 * уведомление `booking_cancelled`, а слот снова становится доступен.
 */
export async function cancelBookingAction(
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const actor = await requireUser();

  const parsed = cancelBookingFormSchema.safeParse({
    bookingId: readFormText(formData, "bookingId"),
  });

  if (!parsed.success) {
    return bookingErrorState(
      "Не удалось определить бронь. Обновите страницу и попробуйте ещё раз.",
    );
  }

  try {
    await cancelBooking(actor, parsed.data.bookingId);
  } catch (error) {
    return toBookingErrorState(error);
  }

  revalidateBookingViews();

  return { message: { tone: "notice", text: "Бронь отменена." } };
}
