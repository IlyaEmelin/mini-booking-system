import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import {
  listMyBookings,
  type BookingStatus,
  type BookingSummary,
} from "@/app/lib/bookings";
import { requireUser } from "@/app/lib/auth";
import { CancelBookingButton } from "@/app/ui/cancel-booking-button";

export const metadata: Metadata = {
  title: "Мои записи",
  description: "Брони текущей учётной записи Mini Booking System",
};

// «Мои записи» (FR-23, FR-25, FR-30, NFR-14).
//
// Страница доступна только при действующей сессии: `requireUser` читает cookie
// и таблицу `Session` до обращения к броням, поэтому гость уходит на
// `/access-denied`, а разметка записей в ответ не попадает (FR-12, FR-13).
//
// Выборка ограничена владельцем внутри `listMyBookings(actor)`: страница не
// принимает чужой идентификатор и показывает только слот, статус и даты своей
// брони (NFR-14). Кнопка отмены есть только у активных статусов `pending` и
// `confirmed`; `cancelled` — конечный статус (FR-24).
//
// Чтение cookie стоит за границей `<Suspense>` — условие Cache Components
// (`next.config.ts`, NFR-7).

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-3xl flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
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

const STATUS_LABELS: Readonly<Record<BookingStatus, string>> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
};

const STATUS_BADGE_BASE_CLASS =
  "shrink-0 rounded-full px-3 py-1 text-sm font-medium";
const STATUS_BADGE_CLASSES: Readonly<Record<BookingStatus, string>> = {
  pending:
    "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  confirmed:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400",
};

/** Дата окна без времени: время выводится отдельным диапазоном. */
const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Дата и время в UTC: форматирование выполняется на сервере. */
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Время начала и конца окна. */
const TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Окно слота одной строкой: «18 октября 2026 г., 10:00–11:00 UTC». */
function formatSlotWindow(slot: BookingSummary["slot"]): string {
  const date = DATE_FORMATTER.format(slot.startsAt);
  const time = TIME_FORMATTER.formatRange(slot.startsAt, slot.endsAt);
  return `${date}, ${time} UTC`;
}

/** Дата брони или null, если событие ещё не произошло. */
function formatBookingDate(value: Date | null): string | null {
  if (value === null) {
    return null;
  }

  return `${DATE_TIME_FORMATTER.format(value)} UTC`;
}

/** Статическая оболочка страницы: данных броней в ней нет. */
export default function BookingsPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <BookingsContent />
      </Suspense>
    </main>
  );
}

/** Брони текущего пользователя (FR-23, FR-25, NFR-14). */
async function BookingsContent() {
  const actor = await requireUser();
  const bookings = await listMyBookings(actor);

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Мои записи</h1>
        <p className={TEXT_CLASS}>
          Только ваши брони: новые записи показаны первыми. Время слотов указано
          в UTC. Отменить можно бронь в статусе «Ожидает подтверждения» или
          «Подтверждена».
        </p>
      </div>

      {bookings.length === 0 ? (
        <p className={TEXT_CLASS}>
          У вас пока нет записей. Выберите свободный слот, чтобы создать бронь.
        </p>
      ) : (
        <ul className={LIST_CLASS}>
          {bookings.map((booking) => (
            <li key={booking.id}>
              <BookingCard booking={booking} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Link className={LINK_CLASS} href="/slots">
          Свободные слоты
        </Link>
        <Link className={LINK_CLASS} href="/account">
          Аккаунт
        </Link>
        <Link className={LINK_CLASS} href="/">
          На главную
        </Link>
      </div>
    </div>
  );
}

/** Карточка брони: слот, статус, даты и отмена активной брони (FR-25). */
function BookingCard({ booking }: Readonly<{ booking: BookingSummary }>) {
  const canCancel =
    booking.status === "pending" || booking.status === "confirmed";
  const confirmedAt = formatBookingDate(booking.confirmedAt);
  const cancelledAt = formatBookingDate(booking.cancelledAt);

  return (
    <article
      aria-labelledby={`booking-${booking.id}-slot`}
      className={BOOKING_CLASS}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className={SLOT_TIME_CLASS} id={`booking-${booking.id}-slot`}>
            <time dateTime={booking.slot.startsAt.toISOString()}>
              {formatSlotWindow(booking.slot)}
            </time>
          </h2>
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
        {confirmedAt === null ? null : (
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Подтверждена</dt>
            <dd className={VALUE_CLASS}>{confirmedAt}</dd>
          </div>
        )}
        {cancelledAt === null ? null : (
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Отменена</dt>
            <dd className={VALUE_CLASS}>{cancelledAt}</dd>
          </div>
        )}
      </dl>

      {canCancel ? (
        <CancelBookingButton bookingId={booking.id} />
      ) : (
        <p className={TEXT_CLASS}>
          Отменённая бронь завершена и больше не занимает место в слоте.
        </p>
      )}
    </article>
  );
}

