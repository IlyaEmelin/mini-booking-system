import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/app/lib/auth";
import {
  listUpcomingSlots,
  SLOT_HORIZON_DAYS,
  type SlotAvailability,
} from "@/app/lib/slots";
import { CreateBookingForm } from "@/app/ui/create-booking-form";

export const metadata: Metadata = {
  title: "Свободные слоты",
  description: `Будущие окна записи на ${SLOT_HORIZON_DAYS} дней вперёд`,
};

// Список свободных слотов (FR-30, CR-42).
//
// Страница доступна только при действующей сессии: `requireUser` читает cookie
// и таблицу `Session` до обращения к слотам, поэтому гость уходит на
// `/access-denied`, а разметка списка в ответ не попадает (FR-12, FR-13).
//
// Горизонт семи дней применяется в серверном модуле `app/lib/slots.ts`
// (`listUpcomingSlots`), а не в разметке (NFR-17). Страница получает только
// `SlotAvailability`: брони и данные их владельцев наружу не выходят (FR-30).
//
// Чтение cookie стоит за границей `<Suspense>` — условие Cache Components
// (`next.config.ts`, NFR-7).
//
// Форма записи передаёт Server Action только идентификатор слота, а владельца и
// статус определяет серверный слой броней (FR-23, NFR-14). Заполненный слот
// формы не получает и объясняет, почему запись недоступна (FR-30).

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
const SLOT_CLASS =
  "flex flex-col gap-3 rounded-xl border border-black/[.12] p-5 sm:flex-row sm:items-center sm:justify-between dark:border-white/[.18]";
const SLOT_FULL_CLASS = "opacity-70";
const SLOT_TIME_CLASS =
  "text-base font-medium text-zinc-950 dark:text-zinc-50";
const BADGE_AVAILABLE_CLASS =
  "shrink-0 rounded-full border border-black/[.12] px-3 py-1 text-sm font-medium text-zinc-950 dark:border-white/[.18] dark:text-zinc-50";
const BADGE_FULL_CLASS =
  "shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400";

/** Дата окна в UTC: время форматируется на сервере, клиент его не пересчитывает. */
const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Время начала и конца окна в UTC. */
const TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Окно слота одной строкой: «18 октября 2026 г., 10:00–11:00 UTC». */
function formatSlotWindow(slot: SlotAvailability): string {
  const date = DATE_FORMATTER.format(slot.startsAt);
  const time = TIME_FORMATTER.formatRange(slot.startsAt, slot.endsAt);
  return `${date}, ${time} UTC`;
}

/** Статическая оболочка страницы: данных слотов в ней нет. */
export default function SlotsPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <SlotsContent />
      </Suspense>
    </main>
  );
}

/** Слоты горизонта для текущего пользователя (FR-30, NFR-17). */
async function SlotsContent() {
  await requireUser();
  const slots = await listUpcomingSlots();

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Свободные слоты</h1>
        <p className={TEXT_CLASS}>
          Будущие окна на {SLOT_HORIZON_DAYS} дней вперёд. Время указано в UTC.
          Заполненный слот недоступен для записи.
        </p>
      </div>

      {slots.length === 0 ? (
        <p className={TEXT_CLASS}>
          На ближайшие {SLOT_HORIZON_DAYS} дней свободных слотов нет.
        </p>
      ) : (
        <ul className={LIST_CLASS}>
          {slots.map((slot) => (
            <li key={slot.id}>
              <SlotCard slot={slot} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Link className={LINK_CLASS} href="/bookings">
          Мои записи
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

/** Карточка слота: только публичная доступность, без чужих броней (FR-30). */
function SlotCard({ slot }: Readonly<{ slot: SlotAvailability }>) {
  const isFull = slot.availableCapacity === 0;

  return (
    <article
      aria-labelledby={`slot-${slot.id}-time`}
      className={isFull ? `${SLOT_CLASS} ${SLOT_FULL_CLASS}` : SLOT_CLASS}
    >
      <div className="flex flex-col gap-1">
        <h2 className={SLOT_TIME_CLASS} id={`slot-${slot.id}-time`}>
          <time dateTime={slot.startsAt.toISOString()}>
            {formatSlotWindow(slot)}
          </time>
        </h2>
        <p className={TEXT_CLASS}>
          Вместимость: {slot.capacity}. Активных броней: {slot.activeBookings}.
          Свободно мест: {slot.availableCapacity}.
        </p>
        {isFull ? (
          <p className={TEXT_CLASS}>
            Запись недоступна: все места заняты активными бронями.
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
        <p className={isFull ? BADGE_FULL_CLASS : BADGE_AVAILABLE_CLASS}>
          {isFull ? "Мест нет" : `Свободно: ${slot.availableCapacity}`}
        </p>
        {isFull ? null : <CreateBookingForm slotId={slot.id} />}
      </div>
    </article>
  );
}
