// Валидация административных форм слотов (FR-29, FR-31, NFR-18).
//
// Поля `startsAt` и `endsAt` приходят из `datetime-local` и трактуются как UTC:
// приложение показывает время слотов в UTC, поэтому пояс браузера не должен
// менять сохранённый момент. Схемы проверяют формат и интервал; роль, горизонт
// и активные брони повторно проверяет `app/lib/slots.ts`.
//
// Модуль не обращается к базе и не содержит секретов, поэтому его можно
// импортировать в клиентские компоненты: оттуда берутся начальное состояние и
// тип сообщения формы, а сами схемы применяются в Server Actions.

import { z } from "zod";

const DATE_TIME_REQUIRED_MESSAGE = "Укажите дату и время";
const DATE_TIME_INVALID_MESSAGE = "Укажите корректные дату и время (UTC)";
const CAPACITY_INVALID_MESSAGE = "Вместимость должна быть целым числом больше 0";
const INTERVAL_INVALID_MESSAGE = "Окончание должно быть позже начала";
const IDENTIFIER_REQUIRED_MESSAGE = "Идентификатор слота не указан";

/** `datetime-local` без секунд: `YYYY-MM-DDTHH:mm`. */
const UTC_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Разбирает значение `datetime-local` как UTC. Обратное сравнение компонентов
 * отсекает перекатывание дат вроде 31 февраля, которое `Date.UTC` исправляет
 * молча.
 */
function parseUtcDateTime(value: string): Date | null {
  const match = UTC_DATE_TIME_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return date;
}

const utcDateTimeSchema = z
  .string()
  .trim()
  .min(1, { error: DATE_TIME_REQUIRED_MESSAGE })
  .refine((value) => parseUtcDateTime(value) !== null, {
    error: DATE_TIME_INVALID_MESSAGE,
  })
  .transform((value) => {
    const date = parseUtcDateTime(value);
    if (date === null) {
      // Недостижимо после `refine`; нужно только для типа результата.
      throw new Error("Некорректная дата слота");
    }
    return date;
  });

const capacitySchema = z.coerce
  .number({ error: CAPACITY_INVALID_MESSAGE })
  .int({ error: CAPACITY_INVALID_MESSAGE })
  .positive({ error: CAPACITY_INVALID_MESSAGE });

/** Общие поля формы слота: даты разбираются как UTC, вместимость — число. */
const slotFieldsSchema = z
  .object({
    startsAt: utcDateTimeSchema,
    endsAt: utcDateTimeSchema,
    capacity: capacitySchema,
  })
  .refine((value) => value.endsAt.getTime() > value.startsAt.getTime(), {
    error: INTERVAL_INVALID_MESSAGE,
    path: ["endsAt"],
  });

/** Схема создания слота: поля формы без идентификатора (FR-29). */
export const createSlotFormSchema = slotFieldsSchema;

/** Схема изменения слота: идентификатор и те же проверяемые поля (FR-29). */
export const updateSlotFormSchema = slotFieldsSchema.and(
  z.object({
    slotId: z
      .string()
      .trim()
      .min(1, { error: IDENTIFIER_REQUIRED_MESSAGE })
      .max(64, { error: "Некорректный идентификатор слота" }),
  }),
);

/** Поля формы, к которым привязываются сообщения об ошибках (NFR-18). */
export type SlotField = "slotId" | "startsAt" | "endsAt" | "capacity";

/** По одному сообщению на поле. */
export type SlotFieldErrors = Partial<Record<SlotField, string>>;

/** Значения формы, возвращаемые в состояние после ошибки. */
export type SlotFormValues = Readonly<{
  startsAt: string;
  endsAt: string;
  capacity: string;
}>;

/** Состояние формы слота для `useActionState`. */
export type SlotFormState = Readonly<{
  errors: SlotFieldErrors;
  values: SlotFormValues;
  message: Readonly<{ tone: "notice" | "error"; text: string }> | null;
}>;

/** Начальное состояние формы из переданных значений. */
export function createSlotFormState(values: SlotFormValues): SlotFormState {
  return { errors: {}, values, message: null };
}

/** Начальное состояние формы создания: все поля пустые. */
export const INITIAL_SLOT_FORM_STATE: SlotFormState = createSlotFormState({
  startsAt: "",
  endsAt: "",
  capacity: "1",
});

const SLOT_FIELDS: readonly SlotField[] = [
  "slotId",
  "startsAt",
  "endsAt",
  "capacity",
];

function isSlotField(value: PropertyKey): value is SlotField {
  return (
    typeof value === "string" &&
    (SLOT_FIELDS as readonly string[]).includes(value)
  );
}

/** Превращает ошибки Zod в сообщения по полям формы: первое на поле. */
export function toSlotFieldErrors(error: z.ZodError): SlotFieldErrors {
  const errors: SlotFieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (!isSlotField(field) || errors[field] !== undefined) {
      continue;
    }
    errors[field] = issue.message;
  }
  return errors;
}

/** Значение `Date` для `datetime-local` без секунд: всегда в UTC. */
export function toUtcDateTimeInputValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}
