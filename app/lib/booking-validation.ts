// Валидация пользовательских форм бронирования (FR-23, FR-25, NFR-14).
//
// Формы передают только идентификатор слота или брони. Владелец, роль и статус
// в схемы не входят, поэтому подставить их через `FormData` нельзя: Server
// Actions читают эти значения из действующей сессии и серверного слоя данных.
//
// Модуль не обращается к базе и не содержит секретов, поэтому его можно
// импортировать в клиентские компоненты: оттуда берутся начальное состояние и
// тип сообщения формы, а сами схемы применяются в Server Actions.

import { z } from "zod";

/** Максимальная длина идентификатора CUID2 с запасом на служебные значения. */
const IDENTIFIER_MAX_LENGTH = 64;
const IDENTIFIER_REQUIRED_MESSAGE = "Идентификатор не указан";
const IDENTIFIER_INVALID_MESSAGE = "Некорректный идентификатор";

/**
 * Идентификатор слота или брони: непустая строка без пробелов по краям.
 * Формат значения намеренно не угадывается: неизвестный идентификатор должен
 * дать доменный `SLOT_NOT_FOUND` или `BOOKING_NOT_FOUND`, а не ошибку схемы.
 */
const bookingIdentifierSchema = z
  .string()
  .trim()
  .min(1, { error: IDENTIFIER_REQUIRED_MESSAGE })
  .max(IDENTIFIER_MAX_LENGTH, { error: IDENTIFIER_INVALID_MESSAGE });

/** Схема создания брони: из формы принимается только `slotId` (FR-23). */
export const createBookingFormSchema = z.object({
  slotId: bookingIdentifierSchema,
});

/** Схема отмены брони: из формы принимается только `bookingId` (FR-25). */
export const cancelBookingFormSchema = z.object({
  bookingId: bookingIdentifierSchema,
});

/** Сообщение формы брони: ошибка операции или подтверждение успеха. */
export type BookingFormMessage = Readonly<{
  tone: "notice" | "error";
  text: string;
}>;

/** Состояние формы для `useActionState`; данные формы в него не возвращаются. */
export type BookingFormState = Readonly<{
  message: BookingFormMessage | null;
}>;

/** Начальное состояние формы: сообщений нет. */
export const INITIAL_BOOKING_FORM_STATE: BookingFormState = {
  message: null,
};
