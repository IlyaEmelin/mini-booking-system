"use server";

// Server Actions пользовательского и административного booking flow (FR-23,
// FR-25, FR-26, FR-30, FR-32, FR-33).
//
// Шаг 3 (`Plan.md`): создание своей брони и отмена своей брони. Шаг 4: отметка
// своего уведомления прочитанным. Шаг 5: подтверждение и административная
// отмена любой брони. Пользовательские действия начинаются с `requireUser()`,
// административные — с `requireRole(["admin", "super_admin"])`; роль повторно
// проверяется внутри серверного слоя. Из входных данных принимается только
// `slotId`, `bookingId` или `notificationId`; `userId`, роль и статус схемой не
// предусмотрены.
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
  confirmBooking,
  createBooking,
  type BookingErrorCode,
} from "@/app/lib/bookings";
import { requireRole, requireUser } from "@/app/lib/auth";
import type { SessionRole } from "@/app/lib/session";
import {
  cancelBookingFormSchema,
  createBookingFormSchema,
  markNotificationReadFormSchema,
  type BookingFormState,
  type NotificationFormState,
} from "@/app/lib/booking-validation";
import {
  NotificationError,
  markNotificationRead,
  type NotificationErrorCode,
} from "@/app/lib/notifications";
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

/**
 * Тексты нарушений отметки уведомления. `NOTIFICATION_NOT_FOUND` и `FORBIDDEN`
 * намеренно совпадают: чужое уведомление неотличимо от несуществующего
 * (NFR-14, FR-32).
 */
const NOTIFICATION_ERROR_MESSAGES: Readonly<
  Record<NotificationErrorCode, string>
> = {
  NOTIFICATION_NOT_FOUND: "Уведомление не найдено.",
  FORBIDDEN: "Уведомление не найдено.",
};

/** Роли, которым разрешены подтверждение и административная отмена (FR-33). */
const ADMIN_ROLES: readonly SessionRole[] = ["admin", "super_admin"];

/** Тексты подтверждения: сообщение о прошедшем слоте отличается от записи. */
const CONFIRM_BOOKING_ERROR_MESSAGES: Readonly<
  Record<BookingErrorCode, string>
> = {
  ...BOOKING_ERROR_MESSAGES,
  SLOT_IN_PAST: "Слот уже начался — подтвердить бронь нельзя.",
};

/** Ошибка формы брони. */
function bookingErrorState(text: string): BookingFormState {
  return { message: { tone: "error", text } };
}

/** Переводит доменную ошибку брони в состояние формы; прочие ошибки пробрасывает. */
function toBookingErrorState(
  error: unknown,
  messages: Readonly<Record<BookingErrorCode, string>> = BOOKING_ERROR_MESSAGES,
): BookingFormState {
  if (error instanceof BookingError) {
    return bookingErrorState(messages[error.code]);
  }

  throw error;
}

/** Инвалидирует пользовательские экраны, читающие слоты, брони и уведомления. */
function revalidateBookingViews(): void {
  revalidatePath("/slots");
  revalidatePath("/bookings");
  revalidatePath("/notifications");
}

/** Инвалидирует административный список броней и затронутые пользовательские экраны. */
function revalidateAdminBookingViews(): void {
  revalidatePath("/admin/bookings");
  revalidateBookingViews();
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

/**
 * Отмечает уведомление текущего пользователя прочитанным (FR-32).
 *
 * Из формы читается только `notificationId`; получатель и проверка владельца
 * остаются в `markNotificationRead`. Неизвестное и чужое уведомление дают один
 * текст, поэтому существование чужой записи не раскрывается. Повторная отметка
 * идемпотентна: `readAt` уже прочитанного уведомления не перезаписывается.
 */
export async function markNotificationReadAction(
  _previousState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const actor = await requireUser();

  const parsed = markNotificationReadFormSchema.safeParse({
    notificationId: readFormText(formData, "notificationId"),
  });

  if (!parsed.success) {
    return bookingErrorState(
      "Не удалось определить уведомление. Обновите страницу и попробуйте ещё раз.",
    );
  }

  try {
    await markNotificationRead(actor, parsed.data.notificationId);
  } catch (error) {
    if (error instanceof NotificationError) {
      return bookingErrorState(NOTIFICATION_ERROR_MESSAGES[error.code]);
    }

    throw error;
  }

  revalidatePath("/notifications");

  return { message: { tone: "notice", text: "Уведомление прочитано." } };
}

/**
 * Подтверждает бронь от имени администратора (FR-33, CR-44).
 *
 * Из формы читается только `bookingId`; роль проверяется дважды: здесь и в
 * `confirmBooking` по базе. Допустим только переход `pending` → `confirmed`
 * для ещё не начавшегося слота; уведомление владельцу создаёт транзакция
 * серверного слоя.
 */
export async function confirmBookingAction(
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const actor = await requireRole(ADMIN_ROLES);

  const parsed = cancelBookingFormSchema.safeParse({
    bookingId: readFormText(formData, "bookingId"),
  });

  if (!parsed.success) {
    return bookingErrorState(
      "Не удалось определить бронь. Обновите страницу и попробуйте ещё раз.",
    );
  }

  try {
    await confirmBooking(actor, parsed.data.bookingId);
  } catch (error) {
    return toBookingErrorState(error, CONFIRM_BOOKING_ERROR_MESSAGES);
  }

  revalidateAdminBookingViews();

  return { message: { tone: "notice", text: "Бронь подтверждена." } };
}

/**
 * Отменяет любую активную бронь от имени администратора (FR-33, CR-44).
 *
 * Из формы читается только `bookingId`. Проверка роли выполняется здесь и в
 * `cancelBooking`; владелец брони получает уведомление `booking_cancelled` в
 * той же транзакции. `cancelled` — конечный статус.
 */
export async function adminCancelBookingAction(
  _previousState: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const actor = await requireRole(ADMIN_ROLES);

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

  revalidateAdminBookingViews();

  return { message: { tone: "notice", text: "Бронь отменена." } };
}
