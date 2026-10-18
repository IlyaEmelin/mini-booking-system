// Серверный слой слотов (FR-20, FR-22, FR-29, NFR-17).
//
// Модуль только читает слоты и считает их доступность: список будущих слотов
// в горизонте семи суток (`SLOT_HORIZON_DAYS`), число активных броней
// (`pending` + `confirmed`) и свободную вместимость. Отменённая бронь
// вместимость не занимает. Создание и изменение слотов добавляет шаг 5,
// удаление не реализуется; сейчас слоты задаёт `prisma/seed.ts`.
//
// Модуль серверный (`import "server-only"`): идентификатор пользователя он не
// принимает и чужие данные не раскрывает, поэтому из клиентских компонентов
// он недоступен. Соединение с базой закрывают тесты и скрипты, а не этот модуль:
// в приложении используется общий пул `app/lib/db.ts`.

import "server-only";

import { db } from "@/app/lib/db";

/** Статусы, которые занимают вместимость слота (FR-22, CR-35). */
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;

/**
 * Горизонт показа слотов: семь суток вперёд (FR-29, NFR-17).
 * Значение экспортируется, чтобы страница называла тот же горизонт в тексте,
 * а не повторяла число в разметке.
 */
export const SLOT_HORIZON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Доступность слота: сам слот, число активных броней и остаток вместимости.
 * `isUpcoming` позволяет отличать существующий прошедший слот от неизвестного:
 * для неизвестного `getSlotAvailability` возвращает `null` (FR-22).
 */
export type SlotAvailability = Readonly<{
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  activeBookings: number;
  availableCapacity: number;
  isUpcoming: boolean;
}>;

/** Строка слота вместе с редуцированным числом активных броней. */
type SlotAvailabilityRow = Readonly<{
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
  bookings: number;
}>;

/**
 * Приводит строку запроса к публичному типу модуля. Остаток не опускается ниже
 * нуля: даже при рассогласовании данных с вместимостью наружу не уходит
 * отрицательное число свободных мест.
 */
function toSlotAvailability(
  row: SlotAvailabilityRow,
  now: Date,
): SlotAvailability {
  return {
    id: row.id,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    capacity: row.capacity,
    activeBookings: row.bookings,
    availableCapacity: Math.max(0, row.capacity - row.bookings),
    isUpcoming: row.startsAt.getTime() > now.getTime(),
  };
}

/**
 * Граница горизонта: ровно семь суток от `now` (FR-29, NFR-17).
 *
 * Горизонт считается от текущего момента, а не по календарным суткам. Seed
 * создаёт окна на дни +1…+7 (`FR-21`), поэтому последнее окно седьмого дня
 * всегда ближе семи суток и все 14 слотов остаются в списке. Граница не
 * включается: слот, начинающийся ровно через семь суток, уже вне горизонта.
 */
function slotHorizonEnd(now: Date): Date {
  return new Date(now.getTime() + SLOT_HORIZON_DAYS * DAY_MS);
}

/**
 * Будущие слоты в горизонте семи дней по возрастанию `startsAt`
 * (FR-22, FR-29, NFR-17).
 *
 * В выборку попадают только слоты с `startsAt > now` и `startsAt` ближе
 * `now + 7 суток`. Заполненные слоты не скрываются: у них
 * `availableCapacity = 0`, чтобы вызывающая сторона могла показать окно и
 * объяснить, почему запись недоступна.
 */
export async function listUpcomingSlots(
  now: Date = new Date(),
): Promise<readonly SlotAvailability[]> {
  const horizonEnd = slotHorizonEnd(now);
  const rows = await db.orm.public.Slot
    .select("id", "startsAt", "endsAt", "capacity")
    .include("bookings", (bookings) =>
      bookings
        .where((booking) => booking.status.in(ACTIVE_BOOKING_STATUSES))
        .count(),
    )
    .where((slot) => slot.startsAt.gt(now))
    .where((slot) => slot.startsAt.lt(horizonEnd))
    .orderBy((slot) => slot.startsAt.asc())
    .all();

  return rows.map((row) => toSlotAvailability(row, now));
}

/**
 * Доступность одного слота (FR-22, CR-35).
 *
 * Для несуществующего идентификатора возвращается `null`, а не вымышленный
 * объект. Существующий прошедший слот возвращается с `isUpcoming = false`:
 * решение о запрете записи принимает серверная функция бронирования.
 */
export async function getSlotAvailability(
  slotId: string,
  now: Date = new Date(),
): Promise<SlotAvailability | null> {
  const row = await db.orm.public.Slot
    .select("id", "startsAt", "endsAt", "capacity")
    .include("bookings", (bookings) =>
      bookings
        .where((booking) => booking.status.in(ACTIVE_BOOKING_STATUSES))
        .count(),
    )
    .where({ id: slotId })
    .first();

  if (row === null) {
    return null;
  }

  return toSlotAvailability(row, now);
}
