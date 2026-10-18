"use server";

// Server Actions администратора для слотов (FR-29, FR-31, NFR-18).
//
// Каждое действие начинается с `requireRole(["admin", "super_admin"])`: скрытая
// форма защитой не считается, а роль повторно проверяется внутри
// `app/lib/slots.ts` по базе. Из формы принимаются только `startsAt`, `endsAt`,
// `capacity` и `slotId`; роль и владелец не читаются.
//
// Даты приходят из `datetime-local` и трактуются как UTC. Zod проверяет формат
// и интервал, доменный модуль — будущее время, горизонт семи дней, вместимость,
// активные брони и уникальность пары `startsAt` + `endsAt`.

import { revalidatePath } from "next/cache";

import { requireRole } from "@/app/lib/auth";
import type { SessionRole } from "@/app/lib/session";
import {
  SlotError,
  createSlot,
  updateSlot,
  type SlotErrorCode,
} from "@/app/lib/slots";
import {
  createSlotFormSchema,
  toSlotFieldErrors,
  updateSlotFormSchema,
  type SlotFormState,
} from "@/app/lib/slot-validation";
import { readFormText } from "@/app/lib/validation";

/** Роли, которым разрешены административные операции со слотами (FR-29). */
const ALLOWED_ROLES: readonly SessionRole[] = ["admin", "super_admin"];

/** Тексты доменных нарушений слота для формы (FR-29). */
const SLOT_ERROR_MESSAGES: Readonly<Record<SlotErrorCode, string>> = {
  FORBIDDEN: "Недостаточно прав для изменения слотов.",
  SLOT_NOT_FOUND: "Слот не найден. Обновите страницу.",
  SLOT_IN_PAST: "Начало слота должно быть в будущем.",
  SLOT_OUT_OF_HORIZON: "Начало слота должно быть в пределах 7 дней.",
  INVALID_SLOT_INTERVAL: "Окончание должно быть позже начала.",
  INVALID_SLOT_CAPACITY: "Вместимость должна быть целым числом больше 0.",
  SLOT_HAS_ACTIVE_BOOKINGS:
    "Слот с активными бронями изменить нельзя: сначала отмените брони.",
  SLOT_ALREADY_EXISTS: "Слот с таким временем уже существует.",
};

/** Инвалидирует административный список и пользовательский список слотов. */
function revalidateSlotViews(): void {
  revalidatePath("/admin/slots");
  revalidatePath("/slots");
}

/** Переводит доменную ошибку слота в состояние формы. */
function toSlotErrorState(
  error: unknown,
  values: SlotFormState["values"],
): SlotFormState {
  if (error instanceof SlotError) {
    return {
      errors: {},
      values,
      message: { tone: "error", text: SLOT_ERROR_MESSAGES[error.code] },
    };
  }

  throw error;
}

/** Создаёт слот от имени администратора (FR-29, CR-45). */
export async function createSlotAction(
  _previousState: SlotFormState,
  formData: FormData,
): Promise<SlotFormState> {
  const actor = await requireRole(ALLOWED_ROLES);

  const values = {
    startsAt: readFormText(formData, "startsAt"),
    endsAt: readFormText(formData, "endsAt"),
    capacity: readFormText(formData, "capacity"),
  };

  const parsed = createSlotFormSchema.safeParse(values);
  if (!parsed.success) {
    return {
      errors: toSlotFieldErrors(parsed.error),
      values,
      message: null,
    };
  }

  try {
    await createSlot(actor, parsed.data);
  } catch (error) {
    return toSlotErrorState(error, values);
  }

  revalidateSlotViews();

  return {
    errors: {},
    values,
    message: { tone: "notice", text: "Слот создан." },
  };
}

/** Изменяет свободный слот от имени администратора (FR-29, CR-45). */
export async function updateSlotAction(
  _previousState: SlotFormState,
  formData: FormData,
): Promise<SlotFormState> {
  const actor = await requireRole(ALLOWED_ROLES);

  const values = {
    startsAt: readFormText(formData, "startsAt"),
    endsAt: readFormText(formData, "endsAt"),
    capacity: readFormText(formData, "capacity"),
  };

  const parsed = updateSlotFormSchema.safeParse({
    slotId: readFormText(formData, "slotId"),
    ...values,
  });
  if (!parsed.success) {
    return {
      errors: toSlotFieldErrors(parsed.error),
      values,
      message: null,
    };
  }

  try {
    await updateSlot(
      actor,
      parsed.data.slotId,
      {
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        capacity: parsed.data.capacity,
      },
    );
  } catch (error) {
    return toSlotErrorState(error, values);
  }

  revalidateSlotViews();

  return {
    errors: {},
    values,
    message: { tone: "notice", text: "Слот изменён." },
  };
}
