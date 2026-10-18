// Серверный слой броней 4.3.3 (FR-23 … FR-26, FR-28, NFR-13, NFR-14).
//
// Модуль принимает `actor` типа `SessionUser`: в приложении такой объект
// возвращает только `requireUser()`, поэтому владелец брони всегда берётся из
// действующей сессии, а не из формы, query-параметра или тела запроса. Наружу
// отдаётся узкая сводка брони без чужих данных.
//
// Создание брони выполняется в одной транзакции: строка слота блокируется
// (`FOR UPDATE`), затем проверяются будущее время, отсутствие активной брони
// пользователя и свободная вместимость, после чего вставляются бронь и
// внутреннее уведомление. Блокировка сериализует конкурентные создания на одном
// слоте, а частичный уникальный индекс `Booking_active_user_slot_key` остаётся
// защитой на уровне базы.
//
// Переходы статусов тоже выполняются под блокировкой строки брони: конкурентные
// подтверждение и отмена не могут оба увидеть одно и то же исходное состояние.
// Роль администратора читается из базы внутри транзакции, а не принимается из
// аргументов клиента.
//
// Доменные нарушения возвращаются исключением `BookingError` со стабильным
// кодом. Сообщение исключения совпадает с кодом и не предназначено для показа
// пользователю: слой представления 4.3.4 сам решит, какой текст вывести.

import "server-only";

import { db } from "@/app/lib/db";
import { createNotification } from "@/app/lib/notifications";
import type { SessionRole, SessionUser } from "@/app/lib/session";

/** Статусы, которые занимают вместимость слота (FR-22, FR-23, CR-35, CR-37). */
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;

/** Роли, которым разрешено подтверждение и отмена чужой брони (FR-25). */
const ADMIN_ROLES: readonly SessionRole[] = ["admin", "super_admin"];

/** Статусы брони из перечисления `BookingStatus` контракта (FR-24). */
export type BookingStatus = "pending" | "confirmed" | "cancelled";

/** Стабильные коды нарушений слоя данных (FR-28). */
export type BookingErrorCode =
  | "SLOT_NOT_FOUND"
  | "SLOT_IN_PAST"
  | "SLOT_FULL"
  | "DUPLICATE_ACTIVE_BOOKING"
  | "BOOKING_NOT_FOUND"
  | "FORBIDDEN"
  | "INVALID_TRANSITION";

/**
 * Доменная ошибка броней. `code` стабилен и предназначен для обработки
 * вызывающим серверным кодом; `message` не используется как пользовательский
 * текст (FR-28).
 */
export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode) {
    super(code);
    this.name = "BookingError";
    this.code = code;
  }
}

/** Слот в сводке брони: только поля, нужные для показа записи. */
export type BookingSlotSummary = Readonly<{
  id: string;
  startsAt: Date;
  endsAt: Date;
}>;

/**
 * Сводка брони для её владельца. `userId` наружу не входит: вызывающая сторона
 * уже знает, что список ограничен действующей сессией (NFR-14).
 */
export type BookingSummary = Readonly<{
  id: string;
  status: BookingStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  slot: BookingSlotSummary;
}>;

/**
 * Сводка брони для административного списка (FR-33). Владелец представлен
 * только email: `passwordHash`, `userId` и служебные поля наружу не уходят.
 */
export type AdminBookingSummary = Readonly<{
  id: string;
  ownerEmail: string;
  status: BookingStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  slot: BookingSlotSummary;
  /** Слот ещё не начался на момент чтения: условие подтверждения (FR-33). */
  isSlotUpcoming: boolean;
}>;

/** Контекст транзакции Prisma 8; тип выводится из публичного метода `db`. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Строка слота, используемая в проверках и сводке брони. */
type SlotSummaryRow = Readonly<{
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
}>;

type BookingSummaryRow = Readonly<{
  id: string;
  status: BookingStatus;
  createdAt: Date;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  slot: BookingSlotSummary;
}>;

/** Признак роли администратора: подтверждение и отмена чужой брони (FR-25). */
function isAdminRole(role: SessionRole | null): boolean {
  return role !== null && ADMIN_ROLES.includes(role);
}

/**
 * Приводит строку брони и слота к публичной сводке. Поля пользователя и
 * служебные связи наружу не попадают (NFR-14).
 */
function toBookingSummary(
  booking: BookingSummaryRow,
): BookingSummary {
  return {
    id: booking.id,
    status: booking.status,
    createdAt: booking.createdAt,
    confirmedAt: booking.confirmedAt,
    cancelledAt: booking.cancelledAt,
    slot: {
      id: booking.slot.id,
      startsAt: booking.slot.startsAt,
      endsAt: booking.slot.endsAt,
    },
  };
}

/**
 * Текущая роль пользователя из базы данных. `actor` приходит из сессии, но роль
 * перечитывается внутри транзакции: подтверждение и отмена чужой брони не
 * должны опираться на устаревший снимок сессии (FR-25, NFR-4).
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
 * Нарушение уникальности в создании брони означает вторую активную бронь того
 * же пользователя на тот же слот. Проверка формы ошибки повторяет подход
 * auth-контура: Prisma 8 нормализует SQLSTATE уникальности в `23505`.
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { kind, sqlState } = error as { kind?: unknown; sqlState?: unknown };
  return kind === "sql_query" && sqlState === "23505";
}

/**
 * Слот, на который ссылается бронь. Внешний ключ `Booking_slotId_fkey` с
 * `onDelete: Restrict` не позволяет удалить слот, пока на него есть брони,
 * поэтому отсутствие строки означает нарушение целостности, а не доменный отказ.
 */
async function loadBookingSlot(
  tx: Transaction,
  slotId: string,
): Promise<SlotSummaryRow> {
  const slot = await tx.orm.public.Slot
    .select("id", "startsAt", "endsAt", "capacity")
    .where({ id: slotId })
    .first();

  if (slot === null) {
    throw new Error("Нарушена ссылочная целостность брони: слот не найден");
  }

  return slot;
}

/**
 * Создаёт бронь текущего пользователя на будущий свободный слот (FR-23,
 * CR-36, CR-37).
 *
 * Порядок проверок под блокировкой слота:
 * 1. слот существует;
 * 2. слот ещё не начался;
 * 3. у пользователя нет активной брони на этот слот;
 * 4. вместимость не заполнена.
 *
 * Дубль проверяется раньше вместимости: при `capacity = 1` повторная бронь
 * должна дать `DUPLICATE_ACTIVE_BOOKING`, а не `SLOT_FULL` (CR-37). Бронь и
 * уведомление `booking_created` вставляются в этой же транзакции (FR-26).
 */
export async function createBooking(
  actor: SessionUser,
  slotId: string,
  now?: Date,
): Promise<BookingSummary> {
  try {
    return await db.transaction(async (tx) => {
      const slot = await tx.orm.public.Slot
        .select("id", "startsAt", "endsAt", "capacity")
        .where({ id: slotId })
        .forUpdate()
        .first();

      if (slot === null) {
        throw new BookingError("SLOT_NOT_FOUND");
      }

      // Время фиксируется после получения блокировки: ожидание в очереди не
      // должно позволить создать бронь на слот, который уже начался.
      const checkedAt = now ?? new Date();
      if (slot.startsAt.getTime() <= checkedAt.getTime()) {
        throw new BookingError("SLOT_IN_PAST");
      }

      if (slot.capacity <= 0) {
        // CHECK `Slot_capacity_positive` не пропускает такой слот; проверка
        // защищает слой данных от рассогласованных данных.
        throw new BookingError("SLOT_FULL");
      }

      const userActiveBookings = await tx.orm.public.Booking
        .where({ userId: actor.id, slotId: slot.id })
        .where((booking) => booking.status.in(ACTIVE_BOOKING_STATUSES))
        .aggregate((aggregate) => ({ count: aggregate.count() }));

      if (userActiveBookings.count > 0) {
        throw new BookingError("DUPLICATE_ACTIVE_BOOKING");
      }

      const activeBookings = await tx.orm.public.Booking
        .where({ slotId: slot.id })
        .where((booking) => booking.status.in(ACTIVE_BOOKING_STATUSES))
        .aggregate((aggregate) => ({ count: aggregate.count() }));

      if (activeBookings.count >= slot.capacity) {
        throw new BookingError("SLOT_FULL");
      }

      const booking = await tx.orm.public.Booking
        .select(
          "id",
          "userId",
          "slotId",
          "status",
          "createdAt",
          "confirmedAt",
          "cancelledAt",
        )
        .create({
          // Владелец всегда из действующей сессии; `slotId` — единственное
          // значение, пришедшее из входных данных (FR-23, NFR-14).
          userId: actor.id,
          slotId: slot.id,
          status: "pending",
        });

      await createNotification(tx, booking, "booking_created");

      return toBookingSummary({ ...booking, slot });
    });
  } catch (error) {
    if (error instanceof BookingError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new BookingError("DUPLICATE_ACTIVE_BOOKING");
    }
    throw error;
  }
}

/**
 * Отменяет бронь владельца или любую бронь администратора (FR-25, CR-38,
 * CR-39).
 *
 * Строка брони блокируется, поэтому конкурентные подтверждение и отмена не
 * проходят одновременно. Отменять можно только `pending` и `confirmed`;
 * `cancelled` — конечный статус. Уведомление `booking_cancelled` создаётся в
 * той же транзакции (FR-26). `confirmedAt` уже подтверждённой брони не
 * стирается: отмена фиксируется отдельным `cancelledAt`.
 */
export async function cancelBooking(
  actor: SessionUser,
  bookingId: string,
  now?: Date,
): Promise<BookingSummary> {
  return db.transaction(async (tx) => {
    const booking = await tx.orm.public.Booking
      .select(
        "id",
        "userId",
        "slotId",
        "status",
        "createdAt",
        "confirmedAt",
        "cancelledAt",
      )
      .where({ id: bookingId })
      .forUpdate()
      .first();

    if (booking === null) {
      throw new BookingError("BOOKING_NOT_FOUND");
    }

    const role = await loadCurrentRole(tx, actor.id);
    if (role === null) {
      throw new BookingError("FORBIDDEN");
    }

    // Владелец действует от своего имени, администратор — от роли из базы.
    // Чужая бронь для роли `user` не раскрывает своё содержимое (NFR-14).
    if (booking.userId !== actor.id && !isAdminRole(role)) {
      throw new BookingError("FORBIDDEN");
    }

    if (booking.status === "cancelled") {
      throw new BookingError("INVALID_TRANSITION");
    }

    const updated = await tx.orm.public.Booking
      .where({ id: booking.id })
      .select(
        "id",
        "userId",
        "slotId",
        "status",
        "createdAt",
        "confirmedAt",
        "cancelledAt",
      )
      .update({
        status: "cancelled",
        cancelledAt: now ?? new Date(),
      });

    if (updated === null) {
      // Строка была заблокирована и не могла исчезнуть до обновления.
      throw new BookingError("BOOKING_NOT_FOUND");
    }

    const slot = await loadBookingSlot(tx, booking.slotId);
    await createNotification(tx, updated, "booking_cancelled");

    return toBookingSummary({ ...updated, slot });
  });
}

/**
 * Подтверждает бронь от имени администратора (FR-25, CR-38).
 *
 * Маршрута, формы, Server Action и API у этой функции нет: она вызывается только
 * серверным кодом и автотестами. Роль перечитывается из базы внутри транзакции.
 * Строка брони блокируется, разрешён только переход `pending` → `confirmed`, и
 * слот ещё не должен начаться. `confirmedAt` и уведомление `booking_confirmed`
 * фиксируются в одной транзакции (FR-26).
 */
export async function confirmBooking(
  actor: SessionUser,
  bookingId: string,
  now?: Date,
): Promise<BookingSummary> {
  return db.transaction(async (tx) => {
    const role = await loadCurrentRole(tx, actor.id);
    if (!isAdminRole(role)) {
      // Проверка роли стоит до чтения брони: роль `user` не должна узнавать,
      // существует ли бронь с указанным идентификатором (NFR-14).
      throw new BookingError("FORBIDDEN");
    }

    const booking = await tx.orm.public.Booking
      .select(
        "id",
        "userId",
        "slotId",
        "status",
        "createdAt",
        "confirmedAt",
        "cancelledAt",
      )
      .where({ id: bookingId })
      .forUpdate()
      .first();

    if (booking === null) {
      throw new BookingError("BOOKING_NOT_FOUND");
    }

    if (booking.status !== "pending") {
      throw new BookingError("INVALID_TRANSITION");
    }

    const slot = await loadBookingSlot(tx, booking.slotId);
    const checkedAt = now ?? new Date();
    if (slot.startsAt.getTime() <= checkedAt.getTime()) {
      throw new BookingError("SLOT_IN_PAST");
    }

    const updated = await tx.orm.public.Booking
      .where({ id: booking.id })
      .select(
        "id",
        "userId",
        "slotId",
        "status",
        "createdAt",
        "confirmedAt",
        "cancelledAt",
      )
      .update({
        status: "confirmed",
        confirmedAt: checkedAt,
      });

    if (updated === null) {
      // Строка была заблокирована и не могла исчезнуть до обновления.
      throw new BookingError("BOOKING_NOT_FOUND");
    }

    await createNotification(tx, updated, "booking_confirmed");

    return toBookingSummary({ ...updated, slot });
  });
}

/**
 * Список броней текущего пользователя (FR-23, NFR-14).
 *
 * Фильтр строится только по `actor.id`; параметра с чужим идентификатором у
 * функции нет. Новые записи возвращаются первыми. Наружу уходит слот, статус и
 * даты брони, без `userId`, `slotId` и служебных полей.
 */
export async function listMyBookings(
  actor: SessionUser,
): Promise<readonly BookingSummary[]> {
  const rows = await db.orm.public.Booking
    .select("id", "status", "createdAt", "confirmedAt", "cancelledAt")
    .include("slot", (slot) => slot.select("id", "startsAt", "endsAt"))
    .where({ userId: actor.id })
    .orderBy((booking) => booking.createdAt.desc())
    .all();

  return rows.map((row) => {
    if (row.slot === null) {
      throw new Error("Нарушена ссылочная целостность брони: слот не найден");
    }

    return toBookingSummary({ ...row, slot: row.slot });
  });
}

/**
 * Все брони для административного списка (FR-33, CR-44).
 *
 * Роль проверяется по базе внутри функции до чтения броней: роль `user` не
 * должна узнать, существуют ли чужие записи. Наружу уходит email владельца,
 * слот, статус и даты, но не `passwordHash` и не `userId`. Новые брони
 * возвращаются первыми.
 */
export async function listAllBookings(
  actor: SessionUser,
  now?: Date,
): Promise<readonly AdminBookingSummary[]> {
  return db.transaction(async (tx) => {
    const role = await loadCurrentRole(tx, actor.id);
    if (!isAdminRole(role)) {
      throw new BookingError("FORBIDDEN");
    }

    const checkedAt = now ?? new Date();
    const rows = await tx.orm.public.Booking
      .select("id", "status", "createdAt", "confirmedAt", "cancelledAt")
      .include("slot", (slot) => slot.select("id", "startsAt", "endsAt"))
      .include("user", (user) => user.select("email"))
      .orderBy((booking) => booking.createdAt.desc())
      .all();

    return rows.map((row) => {
      if (row.slot === null || row.user === null) {
        throw new Error(
          "Нарушена ссылочная целостность брони: слот или владелец не найден",
        );
      }

      return {
        id: row.id,
        ownerEmail: row.user.email,
        status: row.status,
        createdAt: row.createdAt,
        confirmedAt: row.confirmedAt,
        cancelledAt: row.cancelledAt,
        slot: {
          id: row.slot.id,
          startsAt: row.slot.startsAt,
          endsAt: row.slot.endsAt,
        },
        isSlotUpcoming: row.slot.startsAt.getTime() > checkedAt.getTime(),
      };
    });
  });
}
