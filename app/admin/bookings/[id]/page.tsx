import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireRole } from "@/app/lib/auth";
import {
  getAdminBooking,
  type AdminBookingSummary,
  type BookingStatus,
} from "@/app/lib/bookings";
import type { SessionRole } from "@/app/lib/session";
import { AdminCancelBookingButton } from "@/app/ui/admin-cancel-booking-button";
import { ConfirmBookingButton } from "@/app/ui/confirm-booking-button";

export const metadata: Metadata = {
  title: "Бронь администратора",
  description: "Детализация брони и управление её статусом",
};

// Защищённая детализация произвольной брони (FR-33, FR-37, NFR-22).
//
// `requireRole` вызывается до чтения данных, затем `getAdminBooking` повторно
// проверяет роль по базе и возвращает `null` для неизвестного идентификатора.
// `notFound()` вызывается только после проверки доступа, поэтому `user` и
// гость уходят на `/access-denied`, а не узнают о существовании брони.
//
// Чтение cookie стоит за границей `<Suspense>` — условие Cache Components
// (`next.config.ts`, NFR-7, NFR-21).

const ALLOWED_ROLES: readonly SessionRole[] = ["admin", "super_admin"];

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const LINK_CLASS =
  "font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50";
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
export default function AdminBookingPage({
  params,
}: PageProps<"/admin/bookings/[id]">) {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <AdminBookingContent params={params} />
      </Suspense>
    </main>
  );
}

/** Детализация брони, доступная только администратору (FR-33, FR-37). */
async function AdminBookingContent({
  params,
}: Readonly<{ params: PageProps<"/admin/bookings/[id]">["params"] }>) {
  const user = await requireRole(ALLOWED_ROLES);
  const { id } = await params;
  const booking = await getAdminBooking(user, id);

  if (booking === null) {
    notFound();
  }

  const ownerName = booking.ownerDisplayName ?? "Без имени";
  const canConfirm = booking.status === "pending" && booking.isSlotUpcoming;
  const canCancel =
    booking.status === "pending" || booking.status === "confirmed";

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <Link className={LINK_CLASS} href="/admin/bookings">
          ← Все брони
        </Link>
        <h1 className={HEADING_CLASS}>Детали брони</h1>
        <p className={TEXT_CLASS}>
          Роль <span className="font-mono">{user.role}</span>. Время указано в
          UTC.
        </p>
      </div>

      <section
        aria-labelledby="admin-booking-slot-heading"
        className="flex flex-col gap-3 rounded-xl border border-black/[.12] p-5 dark:border-white/[.18]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2
              className={SLOT_TIME_CLASS}
              id="admin-booking-slot-heading"
            >
              <time dateTime={booking.slot.startsAt.toISOString()}>
                {formatSlotWindow(booking.slot)}
              </time>
            </h2>
            <p className={TEXT_CLASS}>
              Вместимость слота: {booking.slot.capacity}.
            </p>
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
            <dd className={VALUE_CLASS}>
              {formatBookingDate(booking.createdAt)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Подтверждена</dt>
            <dd className={VALUE_CLASS}>
              {formatBookingDate(booking.confirmedAt)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Отменена</dt>
            <dd className={VALUE_CLASS}>
              {formatBookingDate(booking.cancelledAt)}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="admin-booking-owner-heading"
        className="flex flex-col gap-3"
      >
        <h2
          className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
          id="admin-booking-owner-heading"
        >
          Владелец
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Имя</dt>
            <dd className={VALUE_CLASS}>{ownerName}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Email</dt>
            <dd className={VALUE_CLASS}>{booking.ownerEmail}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>User.id</dt>
            <dd className={`${VALUE_CLASS} break-all font-mono`}>
              {booking.ownerId}
            </dd>
          </div>
        </dl>
      </section>

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
    </div>
  );
}

