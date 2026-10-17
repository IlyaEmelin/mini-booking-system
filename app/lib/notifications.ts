// Серверный слой внутренних уведомлений 4.3.3 (FR-26, FR-27, FR-28, NFR-15).
//
// Чтение и отметка прочтения ограничены `actor.id`: идентификатор пользователя
// приходит только из действующей сессии, поэтому чужое уведомление нельзя ни
// прочитать, ни отметить. Наружу отдаётся узкая сводка без `userId` и служебных
// связей.
//
// `createNotification` — внутренняя операция записи: она принимает контекст
// транзакции и владельца изменяемой брони, поэтому отдельного публичного
// создания уведомлений нет. Вызывается она только из транзакций
// `app/lib/bookings.ts`, где бронь и уведомление должны фиксироваться вместе
// (FR-26).
//
// `markNotificationRead` выполняется в транзакции с блокировкой строки
// (`FOR UPDATE`): `readAt` выставляется один раз, а повторная отметка не меняет
// исходное значение и остаётся идемпотентной (FR-27). Неизвестное уведомление
// даёт `NOTIFICATION_NOT_FOUND`, чужое — `FORBIDDEN`.

import "server-only";

import { db } from "@/app/lib/db";
import type { SessionUser } from "@/app/lib/session";

/** Тип уведомления из перечисления `NotificationType` контракта (FR-26). */
export type NotificationType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled";

/** Стабильный текст уведомления; пользовательский ввод сюда не попадает. */
const NOTIFICATION_MESSAGES: Readonly<Record<NotificationType, string>> = {
  booking_created: "Бронь создана и ожидает подтверждения.",
  booking_confirmed: "Бронь подтверждена.",
  booking_cancelled: "Бронь отменена.",
};

/** Стабильные коды нарушений слоя уведомлений (FR-27, FR-28). */
export type NotificationErrorCode = "NOTIFICATION_NOT_FOUND" | "FORBIDDEN";

/**
 * Доменная ошибка уведомлений. `code` стабилен и предназначен для обработки
 * вызывающим серверным кодом; `message` не используется как пользовательский
 * текст.
 */
export class NotificationError extends Error {
  readonly code: NotificationErrorCode;

  constructor(code: NotificationErrorCode) {
    super(code);
    this.name = "NotificationError";
    this.code = code;
  }
}

/**
 * Сводка уведомления для его владельца. `id` нужен, чтобы отметить уведомление
 * прочитанным; `userId` наружу не входит, так как список уже ограничен
 * действующей сессией (NFR-14).
 */
export type NotificationSummary = Readonly<{
  id: string;
  type: NotificationType;
  message: string;
  bookingId: string | null;
  readAt: Date | null;
  createdAt: Date;
}>;

/** Контекст транзакции Prisma 8; тип выводится из публичного метода `db`. */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Строка уведомления, используемая в сводке и проверке владельца. */
type NotificationRow = Readonly<{
  id: string;
  userId: string;
  bookingId: string | null;
  type: NotificationType;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}>;

/** Приводит строку уведомления к публичной сводке без `userId` (NFR-14). */
function toNotificationSummary(
  notification: NotificationRow,
): NotificationSummary {
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    bookingId: notification.bookingId,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

/**
 * Внутреннее уведомление владельцу брони в текущей транзакции (FR-26, CR-40).
 *
 * Функция помечена `@internal` и не является публичным API: она принимает
 * контекст транзакции броней и объект изменяемой брони. Получатель всегда
 * совпадает с `booking.userId`, поэтому адрес уведомления не берётся из формы,
 * query-параметра или тела запроса. Отдельной функции создания уведомления для
 * страниц и Server Actions нет.
 *
 * @internal
 */
export async function createNotification(
  tx: Transaction,
  booking: Readonly<{ id: string; userId: string }>,
  type: NotificationType,
): Promise<void> {
  await tx.orm.public.Notification.select("id").create({
    userId: booking.userId,
    bookingId: booking.id,
    type,
    message: NOTIFICATION_MESSAGES[type],
  });
}

/**
 * Уведомления текущего пользователя от новых к старым (FR-27, NFR-14).
 *
 * Фильтр строится только по `actor.id`; параметра с чужим идентификатором у
 * функции нет. Наружу уходят `id`, тип, текст, ссылка на бронь, `readAt` и
 * `createdAt`, без `userId`.
 */
export async function listMyNotifications(
  actor: SessionUser,
): Promise<readonly NotificationSummary[]> {
  const rows = await db.orm.public.Notification
    .select(
      "id",
      "userId",
      "bookingId",
      "type",
      "message",
      "readAt",
      "createdAt",
    )
    .where({ userId: actor.id })
    .orderBy((notification) => notification.createdAt.desc())
    .all();

  return rows.map(toNotificationSummary);
}

/**
 * Отмечает уведомление прочитанным (FR-27).
 *
 * Строка блокируется до проверки владельца и записи, поэтому конкурентные
 * вызовы не могут перезаписать `readAt` второго раза. Уже прочитанное
 * уведомление возвращается как есть: повторная отметка идемпотентна.
 * Неизвестное уведомление даёт `NOTIFICATION_NOT_FOUND`, чужое — `FORBIDDEN`.
 */
export async function markNotificationRead(
  actor: SessionUser,
  notificationId: string,
  now?: Date,
): Promise<NotificationSummary> {
  return db.transaction(async (tx) => {
    const notification = await tx.orm.public.Notification
      .select(
        "id",
        "userId",
        "bookingId",
        "type",
        "message",
        "readAt",
        "createdAt",
      )
      .where({ id: notificationId })
      .forUpdate()
      .first();

    if (notification === null) {
      throw new NotificationError("NOTIFICATION_NOT_FOUND");
    }

    if (notification.userId !== actor.id) {
      throw new NotificationError("FORBIDDEN");
    }

    // `readAt` фиксируется один раз: повторный вызов не перезаписывает его.
    if (notification.readAt !== null) {
      return toNotificationSummary(notification);
    }

    const updated = await tx.orm.public.Notification
      .where({ id: notification.id, userId: actor.id })
      .select(
        "id",
        "userId",
        "bookingId",
        "type",
        "message",
        "readAt",
        "createdAt",
      )
      .update({
        readAt: now ?? new Date(),
      });

    if (updated === null) {
      // Строка была заблокирована и не могла исчезнуть до обновления.
      throw new NotificationError("NOTIFICATION_NOT_FOUND");
    }

    return toNotificationSummary(updated);
  });
}

