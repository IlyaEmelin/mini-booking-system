// Серверная подготовка публичного расписания для `/` и `/slots` (FR-34…FR-36,
// NFR-19…NFR-22).
//
// Сессия читается только на сервере: гость получает `viewer = null`, для
// авторизованного пользователя роль повторно проверяется внутри
// `listUpcomingSchedule` (FR-15, NFR-20). Состав DTO определяет серверный слой,
// поэтому данные владельцев в клиент попадают только в административном
// варианте.
//
// Строки, колонки и подписи собираются здесь: клиентский `ScheduleTable`
// получает готовые строки, не пересчитывает доступность и не форматирует даты
// (NFR-21). Строки — только даты с хотя бы одним слотом, колонки — только
// встречающиеся интервалы; пустые строки и диапазоны не создаются.

import { getCurrentUser } from "@/app/lib/auth";
import {
  listUpcomingSchedule,
  SLOT_HORIZON_DAYS,
  type PublicScheduleSlot,
  type ScheduleBookingSummary,
  type UpcomingSchedule,
} from "@/app/lib/slots";
import {
  ScheduleTable,
  type ScheduleAvailableCell,
  type ScheduleCell,
  type ScheduleCellBooking,
  type ScheduleColumn,
  type ScheduleRow,
  type ScheduleTableData,
  type ScheduleViewerKind,
} from "@/app/ui/schedule-table";

const SECTION_CLASS =
  "flex w-full max-w-5xl flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-6 sm:p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";

/** Подпись строки: день недели и дата, например «Понедельник, 28.05». */
const ROW_LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});

/** Время начала и конца интервала в UTC. */
const TIME_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const STATUS_LABELS: Readonly<
  Record<ScheduleBookingSummary["status"], string>
> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждена",
};

/** Слот расписания вместе с готовым списком активных броней. */
type PreparedSlot = Readonly<{
  slot: PublicScheduleSlot;
  bookings: readonly ScheduleCellBooking[];
}>;

/** Уникальный интервал до сортировки: ключ, подпись и минуты начала/конца. */
type ColumnSeed = Readonly<{
  key: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
}>;

/** Ключ календарной даты в UTC: `YYYY-MM-DD`. */
function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Минуты от начала суток в UTC: по ним сортируются колонки. */
function utcMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/**
 * Ключ интервала без даты: одинаковое время на разных днях — одна колонка.
 * В ключ входят только часы и минуты, поэтому даты в колонках не смешиваются.
 */
function timeRangeKey(startsAt: Date, endsAt: Date): string {
  return `${utcMinutes(startsAt)}-${utcMinutes(endsAt)}`;
}

/** Делает первую букву заглавной: «понедельник, 28.05» → «Понедельник, 28.05». */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Переводит административную бронь DTO в безопасную подпись ячейки. */
function toCellBooking(booking: ScheduleBookingSummary): ScheduleCellBooking {
  return {
    bookingId: booking.bookingId,
    ownerId: booking.ownerId,
    ownerEmail: booking.ownerEmail,
    ownerLabel: booking.ownerDisplayName ?? "Без имени",
    statusLabel: STATUS_LABELS[booking.status],
  };
}

/** Готовит слоты обеих ролей: у публичного DTO броней нет. */
function prepareSlots(schedule: UpcomingSchedule): readonly PreparedSlot[] {
  if (schedule.visibility === "admin") {
    return schedule.slots.map((slot) => ({
      slot,
      bookings: slot.activeBookingDetails.map(toCellBooking),
    }));
  }

  return schedule.slots.map((slot) => ({
    slot,
    bookings: [] as readonly ScheduleCellBooking[],
  }));
}

/** Уникальные интервалы, отсортированные по началу, затем по окончанию. */
function buildColumns(slots: readonly PreparedSlot[]): readonly ScheduleColumn[] {
  const columns = new Map<string, ColumnSeed>();

  for (const { slot } of slots) {
    const key = timeRangeKey(slot.startsAt, slot.endsAt);

    if (!columns.has(key)) {
      columns.set(key, {
        key,
        label: TIME_FORMATTER.formatRange(slot.startsAt, slot.endsAt),
        startMinutes: utcMinutes(slot.startsAt),
        endMinutes: utcMinutes(slot.endsAt),
      });
    }
  }

  return [...columns.values()]
    .sort(
      (left, right) =>
        left.startMinutes - right.startMinutes ||
        left.endMinutes - right.endMinutes,
    )
    .map(({ key, label }) => ({ key, label }));
}

/** Ячейка матрицы: слот по дате и интервалу либо пустая структура. */
function toCell(
  prepared: PreparedSlot | undefined,
  dateTimeLabel: string,
): ScheduleCell {
  if (prepared === undefined) {
    return { kind: "empty" };
  }

  const { slot, bookings } = prepared;

  if (slot.availableCapacity > 0) {
    const cell: ScheduleAvailableCell = {
      kind: "available",
      slotId: slot.id,
      dateTimeLabel: `${dateTimeLabel} UTC`,
      ariaLabel: `Записаться на ${dateTimeLabel} UTC. Свободно мест: ${slot.availableCapacity}.`,
      availableLabel:
        slot.availableCapacity > 1
          ? `Свободно: ${slot.availableCapacity}`
          : null,
      bookings,
    };

    return cell;
  }

  return { kind: "full", dateTimeLabel: `${dateTimeLabel} UTC`, bookings };
}

/** Строки — только даты со слотами, ячейки выровнены по колонкам. */
function buildRows(
  slots: readonly PreparedSlot[],
  columns: readonly ScheduleColumn[],
): readonly ScheduleRow[] {
  const byDate = new Map<
    string,
    { label: string; slots: Map<string, PreparedSlot> }
  >();

  for (const prepared of slots) {
    const dateKey = utcDateKey(prepared.slot.startsAt);
    const entry = byDate.get(dateKey) ?? {
      label: capitalize(ROW_LABEL_FORMATTER.format(prepared.slot.startsAt)),
      slots: new Map<string, PreparedSlot>(),
    };

    entry.slots.set(
      timeRangeKey(prepared.slot.startsAt, prepared.slot.endsAt),
      prepared,
    );
    byDate.set(dateKey, entry);
  }

  return [...byDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, entry]) => ({
      key: dateKey,
      label: entry.label,
      cells: columns.map((column) =>
        toCell(entry.slots.get(column.key), `${entry.label}, ${column.label}`),
      ),
    }));
}

/** Собирает готовые данные таблицы; флаг владельцев — только для отображения. */
function buildTableData(
  schedule: UpcomingSchedule,
  viewerKind: ScheduleViewerKind,
): ScheduleTableData {
  const slots = prepareSlots(schedule);
  const columns = buildColumns(slots);

  return {
    caption: `Расписание слотов на ${SLOT_HORIZON_DAYS} дней вперёд, время указано в UTC`,
    columns,
    rows: buildRows(slots, columns),
    viewerKind,
    showOwners: schedule.visibility === "admin",
  };
}

/**
 * Публичное расписание `/` и `/slots` (FR-34…FR-36).
 *
 * Компонент асинхронный и читает сессию, поэтому монтируется внутри границы
 * `<Suspense>` страницы (Cache Components, NFR-7). Заголовок и пояснение видны
 * и гостю, и авторизованному пользователю; при отсутствии слотов таблица не
 * выводится.
 */
export async function ScheduleContent() {
  const viewer = await getCurrentUser();
  const schedule = await listUpcomingSchedule(viewer);
  const viewerKind: ScheduleViewerKind = viewer === null ? "guest" : "member";

  return (
    <section aria-labelledby="schedule-heading" className={SECTION_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS} id="schedule-heading">
          Расписание
        </h1>
        <p className={TEXT_CLASS}>
          Все будущие слоты на {SLOT_HORIZON_DAYS} дней вперёд. Время указано в
          UTC.
        </p>
      </div>

      {schedule.slots.length === 0 ? (
        <p className={TEXT_CLASS}>
          На ближайшие {SLOT_HORIZON_DAYS} дней слотов нет
        </p>
      ) : (
        <ScheduleTable data={buildTableData(schedule, viewerKind)} />
      )}
    </section>
  );
}
