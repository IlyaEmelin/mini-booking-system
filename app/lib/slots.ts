// Серверный слой слотов (FR-20, FR-22, FR-29, NFR-17).
//
// Модуль читает слоты и считает их доступность: список будущих слотов в
// горизонте семи суток (`SLOT_HORIZON_DAYS`), число активных броней
// (`pending` + `confirmed`) и свободную вместимость. Отменённая бронь
// вместимость не занимает.
//
// `listUpcomingSchedule` отдаёт ролевой DTO расписания: `guest`/`user`
// получают только доступность слота, `admin`/`super_admin` — ещё активные
// брони с владельцем. Роль viewer перечитывается из базы, а данные владельца
// не выбираются для публичного DTO (FR-34…FR-36, NFR-20, NFR-21).
//
// `createSlot` и `updateSlot` — административные операции: роль перечитывается
// из базы внутри транзакции, а не берётся из аргументов клиента. Изменение слота
// с активными бронями запрещено, удаление не реализуется. Идентификатор
// пользователя из формы не принимается.
//
// Модуль серверный (`import "server-only"`): идентификатор пользователя он не
// принимает и чужие данные не раскрывает, поэтому из клиентских компонентов
// он недоступен. Соединение с базой закрывают тесты и скрипты, а не этот модуль:
// в приложении используется общий пул `app/lib/db.ts`.

import "server-only";

import { db } from "@/app/lib/db";
import type { SessionRole, SessionUser } from "@/app/lib/session";

/** Статусы, которые занимают вместимость слота (FR-22, CR-35). */
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;

/**
 * Горизонт показа слотов: семь суток вперёд (FR-29, NFR-17).
 * Значение экспортируется, чтобы страница называла тот же горизонт в тексте,
 * а не повторяла число в разметке.
 */
export const SLOT_HORIZON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Роли, которым разрешено создание и изменение слотов (FR-29). */
const ADMIN_ROLES: readonly SessionRole[] = ["admin", "super_admin"];

/** Стабильные коды нарушений административных операций со слотами (FR-29). */
export type SlotErrorCode =
  | "FORBIDDEN"
  | "SLOT_NOT_FOUND"
  | "SLOT_IN_PAST"
  | "SLOT_OUT_OF_HORIZON"
  | "INVALID_SLOT_INTERVAL"
  | "INVALID_SLOT_CAPACITY"
  | "SLOT_HAS_ACTIVE_BOOKINGS"
  | "SLOT_ALREADY_EXISTS";

/** Доменная ошибка слота: код стабилен, текст формирует слой представления. */
export class SlotError extends Error {
  readonly code: SlotErrorCode;

  constructor(code: SlotErrorCode) {
    super(code);
    this.name = "SlotError";
    this.code = code;
  }
}

/** Проверенный набор полей слота для создания и изменения (FR-29). */
export type SlotInput = Readonly<{
  startsAt: Date;
  endsAt: Date;
  capacity: number;
}>;

/** Контекст транзакции Prisma 8; тип выводится из публичного метода `db`. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/**
 * Активная бронь в административном DTO расписания (FR-35, NFR-20).
 *
 * Поля владельца нужны только для административной ячейки и ссылки на
 * `/admin/bookings/[id]`. `passwordHash`, `tokenHash` и служебные поля сюда не
 * входят; отменённые брони в DTO не попадают.
 */
export type ScheduleBookingSummary = Readonly<{
  bookingId: string;
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string | null;
  status: "pending" | "confirmed";
}>;

/**
 * Публичный DTO слота для `guest` и `user` (FR-34, NFR-20): только
 * доступность, без броней и данных владельцев.
 */
export type PublicScheduleSlot = SlotAvailability;

/**
 * Административный DTO слота: публичная доступность и активные брони с
 * владельцами (FR-35, NFR-20).
 */
export type AdminScheduleSlot = Readonly<
  PublicScheduleSlot & {
    activeBookingDetails: readonly ScheduleBookingSummary[];
  }
>;

/**
 * Результат `listUpcomingSchedule`: дискриминированное объединение не даёт
 * перепутать публичный DTO с административным (FR-34, FR-35, NFR-20).
 */
export type UpcomingSchedule =
  | Readonly<{
      visibility: "public";
      slots: readonly PublicScheduleSlot[];
    }>
  | Readonly<{
      visibility: "admin";
      slots: readonly AdminScheduleSlot[];
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

/** Признак роли администратора: создание и изменение слотов (FR-29). */
function isAdminRole(role: SessionRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

/**
 * Текущая роль пользователя из базы данных. `actor` приходит из сессии, но роль
 * перечитывается внутри транзакции: административная операция не должна
 * опираться на устаревший снимок сессии (FR-15, FR-29).
 */
async function loadCurrentRole(
  tx: Transaction,
  userId: string,
): Promise<SessionRole | null> {
  const user = await tx.orm.public.User.select("role")
    .where({ id: userId })
    .first();

  return user?.role ?? null;
}

/**
 * Роль авторизованного viewer для выбора состава расписания (FR-34, FR-35).
 *
 * `viewer` приходит из сессии, но роль перечитывается из базы до выборки
 * данных владельцев: клиентский или устаревший признак роли не участвует в
 * решении о PII. Неизвестный пользователь получает публичный DTO.
 */
async function loadRoleById(userId: string): Promise<SessionRole | null> {
  const user = await db.orm.public.User.select("role")
    .where({ id: userId })
    .first();

  return user?.role ?? null;
}

/**
 * Проверяет поля слота внутри серверной функции (FR-29, NFR-17).
 *
 * Даты принимаются как `Date`, а не как строки формы: преобразование и
 * Zod-валидация выполняются в Server Action. Здесь повторяются доменные
 * инварианты, чтобы их нельзя было обойти прямым вызовом модуля.
 */
function validateSlotInput(input: SlotInput, now: Date): void {
  if (!Number.isInteger(input.capacity) || input.capacity <= 0) {
    throw new SlotError("INVALID_SLOT_CAPACITY");
  }

  const startsAt = input.startsAt.getTime();
  const endsAt = input.endsAt.getTime();
  if (
    Number.isNaN(startsAt) ||
    Number.isNaN(endsAt) ||
    endsAt <= startsAt
  ) {
    throw new SlotError("INVALID_SLOT_INTERVAL");
  }

  if (startsAt <= now.getTime()) {
    throw new SlotError("SLOT_IN_PAST");
  }

  if (startsAt >= slotHorizonEnd(now).getTime()) {
    throw new SlotError("SLOT_OUT_OF_HORIZON");
  }
}

/** Нарушение уникальности пары `startsAt` + `endsAt` (FR-29). */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { kind, sqlState } = error as { kind?: unknown; sqlState?: unknown };
  return kind === "sql_query" && sqlState === "23505";
}

/**
 * Будущие слоты в горизонте семи дней по возрастанию `startsAt`, затем
 * `endsAt` (FR-22, FR-29, NFR-17).
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
    .orderBy([
      (slot) => slot.startsAt.asc(),
      (slot) => slot.endsAt.asc(),
    ])
    .all();

  return rows.map((row) => toSlotAvailability(row, now));
}

/** Владелец активной брони, выбранный для административного DTO (FR-35). */
type ScheduleBookingOwner = Readonly<{
  id: string;
  email: string;
  displayName: string | null;
}>;

/** Строка активной брони в административной выборке расписания. */
type ScheduleBookingRow = Readonly<{
  id: string;
  status: "pending" | "confirmed" | "cancelled";
  user: ScheduleBookingOwner | null;
}>;

/**
 * Приводит активную бронь к административному DTO (FR-35, NFR-20).
 *
 * Функция повторно проверяет статус и владельца: даже при рассогласовании
 * данных наружу не уйдёт отменённая бронь или бронь без владельца.
 */
function toScheduleBookingSummary(
  booking: ScheduleBookingRow,
): ScheduleBookingSummary {
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw new Error("В расписание попала неактивная бронь");
  }

  if (booking.user === null) {
    throw new Error("Нарушена ссылочная целостность брони: владелец не найден");
  }

  return {
    bookingId: booking.id,
    ownerId: booking.user.id,
    ownerEmail: booking.user.email,
    ownerDisplayName: booking.user.displayName,
    status: booking.status,
  };
}

/**
 * Административное расписание одной выборкой (FR-35, NFR-20).
 *
 * Для каждого слота выбираются только активные брони (`pending` + `confirmed`)
 * с владельцем; отменённые брони не попадают в DTO. Порядок броней
 * детерминирован: сначала по `createdAt`, затем по `id`. Сортировка слотов —
 * по `startsAt`, затем по `endsAt`.
 */
async function listAdminSchedule(
  now: Date,
): Promise<readonly AdminScheduleSlot[]> {
  const horizonEnd = slotHorizonEnd(now);
  const rows = await db.orm.public.Slot
    .select("id", "startsAt", "endsAt", "capacity")
    .include("bookings", (bookings) =>
      bookings
        .where((booking) => booking.status.in(ACTIVE_BOOKING_STATUSES))
        .select("id", "status")
        .include("user", (user) => user.select("id", "email", "displayName"))
        .orderBy([
          (booking) => booking.createdAt.asc(),
          (booking) => booking.id.asc(),
        ]),
    )
    .where((slot) => slot.startsAt.gt(now))
    .where((slot) => slot.startsAt.lt(horizonEnd))
    .orderBy([
      (slot) => slot.startsAt.asc(),
      (slot) => slot.endsAt.asc(),
    ])
    .all();

  return rows.map((row) => {
    const activeBookingDetails = row.bookings.map((booking) =>
      toScheduleBookingSummary(booking),
    );

    return {
      ...toSlotAvailability(
        {
          id: row.id,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          capacity: row.capacity,
          bookings: activeBookingDetails.length,
        },
        now,
      ),
      activeBookingDetails,
    };
  });
}

/**
 * Ролевой DTO публичного расписания для `/` и `/slots` (FR-34…FR-36,
 * NFR-20, NFR-21).
 *
 * `viewer === null` — гость; для `user` возвращается публичный DTO без данных
 * владельцев. Для `admin`/`super_admin` роль перечитывается из базы до
 * административной выборки. Горизонт и сортировка общие для обеих ролей.
 */
export async function listUpcomingSchedule(
  viewer: SessionUser | null,
  now: Date = new Date(),
): Promise<UpcomingSchedule> {
  if (viewer === null) {
    return {
      visibility: "public",
      slots: await listUpcomingSlots(now),
    };
  }

  const role = await loadRoleById(viewer.id);
  if (isAdminRole(role)) {
    return {
      visibility: "admin",
      slots: await listAdminSchedule(now),
    };
  }

  return {
    visibility: "public",
    slots: await listUpcomingSlots(now),
  };
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

/**
 * Создаёт слот от имени администратора (FR-29, CR-45).
 *
 * Роль перечитывается из базы внутри транзакции: `actor.role` из сессии не
 * используется как единственная защита. `startsAt` должен быть в будущем и
 * внутри горизонта семи дней, `endsAt > startsAt`, `capacity > 0`. Уникальность
 * пары `startsAt` + `endsAt` защищена базой и переводится в стабильный код.
 */
export async function createSlot(
  actor: SessionUser,
  input: SlotInput,
  now: Date = new Date(),
): Promise<SlotAvailability> {
  try {
    return await db.transaction(async (tx) => {
      const role = await loadCurrentRole(tx, actor.id);
      if (!isAdminRole(role)) {
        throw new SlotError("FORBIDDEN");
      }

      validateSlotInput(input, now);

      const slot = await tx.orm.public.Slot
        .select("id", "startsAt", "endsAt", "capacity")
        .create({
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          capacity: input.capacity,
        });

      return toSlotAvailability({ ...slot, bookings: 0 }, now);
    });
  } catch (error) {
    if (error instanceof SlotError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new SlotError("SLOT_ALREADY_EXISTS");
    }
    throw error;
  }
}



/**
 * Изменяет слот от имени администратора (FR-29, CR-45).
 *
 * Строка слота блокируется, затем проверяется число активных броней
 * (`pending` + `confirmed`). Слот с бронью не изменяется: код
 * `SLOT_HAS_ACTIVE_BOOKINGS`. После проверки повторяются инварианты интервала,
 * будущего времени, горизонта и вместимости. Удаление слота не реализуется.
 */
export async function updateSlot(
  actor: SessionUser,
  slotId: string,
  input: SlotInput,
  now: Date = new Date(),
): Promise<SlotAvailability> {
  try {
    return await db.transaction(async (tx) => {
      const role = await loadCurrentRole(tx, actor.id);
      if (!isAdminRole(role)) {
        throw new SlotError("FORBIDDEN");
      }

      const slot = await tx.orm.public.Slot
        .select("id", "startsAt", "endsAt", "capacity")
        .where({ id: slotId })
        .forUpdate()
        .first();

      if (slot === null) {
        throw new SlotError("SLOT_NOT_FOUND");
      }

      const activeBookings = await tx.orm.public.Booking
        .where({ slotId: slot.id })
        .where((booking) => booking.status.in(ACTIVE_BOOKING_STATUSES))
        .aggregate((aggregate) => ({ count: aggregate.count() }));

      if (activeBookings.count > 0) {
        throw new SlotError("SLOT_HAS_ACTIVE_BOOKINGS");
      }

      validateSlotInput(input, now);

      const updated = await tx.orm.public.Slot
        .where({ id: slot.id })
        .select("id", "startsAt", "endsAt", "capacity")
        .update({
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          capacity: input.capacity,
        });

      if (updated === null) {
        // Строка была заблокирована и не могла исчезнуть до обновления.
        throw new SlotError("SLOT_NOT_FOUND");
      }

      return toSlotAvailability({ ...updated, bookings: 0 }, now);
    });
  } catch (error) {
    if (error instanceof SlotError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new SlotError("SLOT_ALREADY_EXISTS");
    }
    throw error;
  }
}
