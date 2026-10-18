import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireRole } from "@/app/lib/auth";
import {
  listAllBookings,
  type AdminBookingSummary,
  type BookingStatus,
} from "@/app/lib/bookings";
import type { SessionRole } from "@/app/lib/session";
import { AdminCancelBookingButton } from "@/app/ui/admin-cancel-booking-button";
import { ConfirmBookingButton } from "@/app/ui/confirm-booking-button";

export const metadata: Metadata = {
  title: "Брони администратора",
  description: "Все брони и управление их статусами",
};

// Административный список броней (FR-33, CR-44).
//
// `requireRole` вызывается до чтения данных, а `listAllBookings` повторно
// проверяет роль по базе. Наружу уходят слот, статус, даты и email владельца,
// без `passwordHash` и `userId` (NFR-14). Подтверждение доступно только для
// `pending` и ещё не начавшегося слота; отмена — для `pending`/`confirmed`.
//
// Чтение cookie стоит за границей `<Suspense>` — условие Cache Components
// (`next.config.ts`, NFR-7).

const ALLOWED_ROLES: readonly SessionRole[] = ["admin", "super_admin"];

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-4xl flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const LINK_CLASS =
  "font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50";
const LIST_CLASS = "flex flex-col gap-3";
const BOOKING_CLASS =
  "flex flex-col gap-4 rounded-xl border border-black/[.12] p-5 dark:border-white/[.18]";
const SLOT_TIME_CLASS =
  "text-base font-medium text-zinc-950 dark:text-zinc-50";
const TERM_CLASS = "text-xs font-medium text-zinc-500 dark:text-zinc-400";
const VALUE_CLASS = "text-sm text-zinc-950 dark:text-zinc-50";
const STATUS_BADGE_BASE_CLASS =
  "shrink-0 rounded-full px-3 py-1 text-sm font-medium";

const STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
};

const STATUS_BADGE_CLASSES: Readonly<Record<BookingStatus, string>> = {
  pending:
    "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  confirmed:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Окно слота одной строкой: «18 октября 2026 г., 10:00–11:00 UTC». */
function formatSlotWindow(slot: AdminBookingSummary["slot"]): string {
  const date = DATE_FORMATTER.format(slot.startsAt);
  const time = TIME_FORMATTER.formatRange(slot.startsAt, slot.endsAt);
  return `${date}, ${time} UTC`;
}

/** Дата брони в UTC или прочерк, если события ещё не было. */
function formatBookingDate(date: Date | null): string {
  return date === null ? "—" : `${DATE_TIME_FORMATTER.format(date)} UTC`;
}

/** Статическая оболочка страницы: административных данных в ней нет. */
export default function AdminBookingsPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <AdminBookingsContent />
      </Suspense>
    </main>
  );
}

/** Все брони для администратора (FR-33, CR-44). */
async function AdminBookingsContent() {
  const user = await requireRole(ALLOWED_ROLES);
  const bookings = await listAllBookings(user);

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Все брони</h1>
        <p className={TEXT_CLASS}>
          Роль <span className="font-mono">{user.role}</span>. Показаны все брони
          со слотом, статусом и email владельца. Время — UTC.
        </p>
      </div>

      {bookings.length === 0 ? (
        <p className={TEXT_CLASS}>Броней пока нет.</p>
      ) : (
        <ul className={LIST_CLASS}>
          {bookings.map((booking) => (
            <li key={booking.id}>
              <AdminBookingCard booking={booking} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Link className={LINK_CLASS} href="/admin/slots">
          Слоты
        </Link>
        <Link className={LINK_CLASS} href="/admin">
          Администрирование
        </Link>
        <Link className={LINK_CLASS} href="/bookings">
          Мои записи
        </Link>
        <Link className={LINK_CLASS} href="/account">
          Аккаунт
        </Link>
      </div>
    </div>
  );
}

/** Карточка брони: владелец, слот, статус и допустимые действия (FR-33). */
function AdminBookingCard({
  booking,
}: Readonly<{ booking: AdminBookingSummary }>) {
  const canConfirm = booking.status === "pending" && booking.isSlotUpcoming;
  const canCancel =
    booking.status === "pending" || booking.status === "confirmed";

  return (
    <article
      aria-labelledby={`admin-booking-${booking.id}-slot`}
      className={BOOKING_CLASS}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className={SLOT_TIME_CLASS} id={`admin-booking-${booking.id}-slot`}>
            <time dateTime={booking.slot.startsAt.toISOString()}>
              {formatSlotWindow(booking.slot)}
            </time>
          </h2>
          <p className={TEXT_CLASS}>
            Владелец: {booking.ownerDisplayName ?? "Без имени"}
          </p>
          <p className={TEXT_CLASS}>
            Email: {booking.ownerEmail}
          </p>
          <p className={`${TEXT_CLASS} break-all font-mono`}>
            User.id: {booking.ownerId}
          </p>
          <Link
            className={LINK_CLASS}
            href={`/admin/bookings/${booking.id}`}
          >
            Открыть бронь
          </Link>
        </div>
        <p
          className={`${STATUS_BADGE_BASE_CLASS} ${STATUS_BADGE_CLASSES[booking.status]}`}
        >
          {STATUS_LABELS[booking.status]}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Создана</dt>
          <dd className={VALUE_CLASS}>{formatBookingDate(booking.createdAt)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Подтверждена</dt>
          <dd className={VALUE_CLASS}>{formatBookingDate(booking.confirmedAt)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Отменена</dt>
          <dd className={VALUE_CLASS}>{formatBookingDate(booking.cancelledAt)}</dd>
        </div>
      </dl>

      {canConfirm || canCancel ? (
        <div className="flex flex-wrap items-start gap-3">
          {canConfirm ? <ConfirmBookingButton bookingId={booking.id} /> : null}
          {canCancel ? (
            <AdminCancelBookingButton bookingId={booking.id} />
          ) : null}
        </div>
      ) : (
        <p className={TEXT_CLASS}>
          Бронь завершена. Изменение статуса после отмены не выполняется.
        </p>
      )}

      {booking.status === "pending" && !canConfirm ? (
        <p className={TEXT_CLASS}>
          Подтверждение недоступно: слот уже начался. Отменить бронь можно.
        </p>
      ) : null}
    </article>
  );
}

