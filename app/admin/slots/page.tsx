import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireRole } from "@/app/lib/auth";
import {
  listUpcomingSlots,
  SLOT_HORIZON_DAYS,
  type SlotAvailability,
} from "@/app/lib/slots";
import type { SessionRole } from "@/app/lib/session";
import { toUtcDateTimeInputValue } from "@/app/lib/slot-validation";
import { CreateSlotForm } from "@/app/ui/create-slot-form";
import { UpdateSlotForm } from "@/app/ui/update-slot-form";

export const metadata: Metadata = {
  title: "Слоты администратора",
  description: `Управление слотами на ${SLOT_HORIZON_DAYS} дней вперёд`,
};

// Административное управление слотами (FR-29, CR-45).
//
// `requireRole` вызывается до чтения слотов: гость и `user` уходят на
// `/access-denied`, административная разметка в ответ не попадает (FR-12,
// FR-13). Роль дополнительно проверяется внутри `createSlot`/`updateSlot`.
//
// Горизонт семи дней применяется в `listUpcomingSlots`, а не в разметке
// (NFR-17). Слот с активными бронями показывается без формы изменения: сервер
// вернул бы `SLOT_HAS_ACTIVE_BOOKINGS`. Удаления слотов нет.
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
const SLOT_CLASS =
  "flex flex-col gap-4 rounded-xl border border-black/[.12] p-5 dark:border-white/[.18]";
const SLOT_TIME_CLASS =
  "text-base font-medium text-zinc-950 dark:text-zinc-50";
const BADGE_CLASS =
  "shrink-0 rounded-full border border-black/[.12] px-3 py-1 text-sm font-medium text-zinc-950 dark:border-white/[.18] dark:text-zinc-50";

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

/** Окно слота одной строкой: «18 октября 2026 г., 10:00–11:00 UTC». */
function formatSlotWindow(slot: SlotAvailability): string {
  const date = DATE_FORMATTER.format(slot.startsAt);
  const time = TIME_FORMATTER.formatRange(slot.startsAt, slot.endsAt);
  return `${date}, ${time} UTC`;
}

/** Статическая оболочка страницы: административных данных в ней нет. */
export default function AdminSlotsPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <AdminSlotsContent />
      </Suspense>
    </main>
  );
}

/** Слоты горизонта и формы администратора (FR-29, CR-45). */
async function AdminSlotsContent() {
  const user = await requireRole(ALLOWED_ROLES);
  const slots = await listUpcomingSlots();

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Слоты</h1>
        <p className={TEXT_CLASS}>
          Управление доступно роли <span className="font-mono">{user.role}</span>.
          Показаны будущие окна на {SLOT_HORIZON_DAYS} дней вперёд. Время — UTC.
        </p>
      </div>

      <section aria-labelledby="create-slot-heading" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50" id="create-slot-heading">
          Новый слот
        </h2>
        <CreateSlotForm />
      </section>

      <section aria-labelledby="existing-slots-heading" className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50" id="existing-slots-heading">
          Слоты горизонта
        </h2>

        {slots.length === 0 ? (
          <p className={TEXT_CLASS}>
            На ближайшие {SLOT_HORIZON_DAYS} дней слотов нет. Создайте первое окно
            формой выше.
          </p>
        ) : (
          <ul className={LIST_CLASS}>
            {slots.map((slot) => (
              <li key={slot.id}>
                <AdminSlotCard slot={slot} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link className={LINK_CLASS} href="/admin/bookings">
          Брони
        </Link>
        <Link className={LINK_CLASS} href="/admin">
          Администрирование
        </Link>
        <Link className={LINK_CLASS} href="/slots">
          Пользовательский список
        </Link>
        <Link className={LINK_CLASS} href="/account">
          Аккаунт
        </Link>
      </div>
    </div>
  );
}

/** Карточка слота: доступность и форма изменения, если броней нет (FR-29). */
function AdminSlotCard({ slot }: Readonly<{ slot: SlotAvailability }>) {
  const canEdit = slot.activeBookings === 0;

  return (
    <article
      aria-labelledby={`admin-slot-${slot.id}-time`}
      className={SLOT_CLASS}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className={SLOT_TIME_CLASS} id={`admin-slot-${slot.id}-time`}>
            <time dateTime={slot.startsAt.toISOString()}>
              {formatSlotWindow(slot)}
            </time>
          </h3>
          <p className={TEXT_CLASS}>
            Вместимость: {slot.capacity}. Активных броней: {slot.activeBookings}.
            Свободно мест: {slot.availableCapacity}.
          </p>
        </div>
        <p className={BADGE_CLASS}>
          {canEdit ? "Можно изменить" : "Есть активные брони"}
        </p>
      </div>

      {canEdit ? (
        <UpdateSlotForm
          slotId={slot.id}
          startsAt={toUtcDateTimeInputValue(slot.startsAt)}
          endsAt={toUtcDateTimeInputValue(slot.endsAt)}
          capacity={slot.capacity}
        />
      ) : (
        <p className={TEXT_CLASS}>
          Изменение недоступно: сначала отмените активные брони. Удаление слотов
          не предусмотрено.
        </p>
      )}
    </article>
  );
}

