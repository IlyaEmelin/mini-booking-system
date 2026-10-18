"use client";

// Общая таблица расписания и модальные окна записи (FR-34…FR-36, NFR-19…NFR-22).
//
// Клиентский компонент отвечает только за интерактив: открытие нативного
// `<dialog>` и отправку формы записи. Строки, колонки, подписи дат и остаток
// мест готовит серверный `ScheduleContent`, поэтому `Date`-объекты сюда не
// попадают и доступность на клиенте не пересчитывается (NFR-21).
//
// Данные владельца приходят только в административном DTO: для `guest` и
// `user` массив броней пуст, а `showOwners` управляет лишь отображением, а не
// правами (FR-35, NFR-20).
//
// Форма подтверждения передаёт Server Action единственное поле `slotId`;
// владельца, роль и статус определяет сервер (FR-23, NFR-14). Гостевая кнопка
// открывает окно входа/регистрации и не отправляет POST.

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { createBookingAction } from "@/app/actions/bookings";
import { INITIAL_BOOKING_FORM_STATE } from "@/app/lib/booking-validation";

/** Активная бронь в административной ячейке: только поля административного DTO. */
export type ScheduleCellBooking = Readonly<{
  bookingId: string;
  ownerId: string;
  ownerEmail: string;
  ownerLabel: string;
  statusLabel: string;
}>;

/** Ячейка матрицы, подготовленная на сервере. */
export type ScheduleCell =
  | Readonly<{ kind: "empty" }>
  | Readonly<{
      kind: "available";
      slotId: string;
      dateTimeLabel: string;
      ariaLabel: string;
      availableLabel: string | null;
      bookings: readonly ScheduleCellBooking[];
    }>
  | Readonly<{
      kind: "full";
      dateTimeLabel: string;
      bookings: readonly ScheduleCellBooking[];
    }>;

/** Свободная ячейка — единственная, которая открывает модальное окно. */
export type ScheduleAvailableCell = Extract<
  ScheduleCell,
  { kind: "available" }
>;

/** Строка таблицы: подпись даты и ячейки в порядке колонок. */
export type ScheduleRow = Readonly<{
  key: string;
  label: string;
  cells: readonly ScheduleCell[];
}>;

/** Колонка таблицы: уникальный интервал времени. */
export type ScheduleColumn = Readonly<{
  key: string;
  label: string;
}>;

/** Кто смотрит расписание: от этого зависит содержимое модального окна. */
export type ScheduleViewerKind = "guest" | "member";

/** Готовые данные таблицы; собираются на сервере. */
export type ScheduleTableData = Readonly<{
  caption: string;
  columns: readonly ScheduleColumn[];
  rows: readonly ScheduleRow[];
  viewerKind: ScheduleViewerKind;
  showOwners: boolean;
}>;

const TABLE_WRAPPER_CLASS =
  "w-full overflow-x-auto rounded-2xl border border-black/[.08] dark:border-white/[.145]";
const TABLE_CLASS = "w-full min-w-[32rem] border-collapse text-left text-sm";
const HEAD_CELL_CLASS =
  "whitespace-nowrap px-4 py-3 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400";
const ROW_HEAD_CLASS =
  "sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm font-medium text-zinc-950 dark:bg-black dark:text-zinc-50";
const CELL_CLASS = "px-4 py-3 align-top";
const SLOT_BUTTON_CLASS =
  "flex w-full min-w-[7rem] flex-col items-start gap-1 rounded-xl border border-black/[.12] px-3 py-2 text-left text-sm font-medium text-zinc-950 transition-colors hover:bg-black/[.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-white/[.18] dark:text-zinc-50 dark:hover:bg-white/[.08] dark:focus-visible:outline-zinc-50";
const SLOT_CAPACITY_CLASS = "text-xs font-normal text-zinc-600 dark:text-zinc-400";
const SLOT_FULL_CLASS = "text-sm font-medium text-zinc-600 dark:text-zinc-400";
const BOOKING_LIST_CLASS =
  "mt-2 flex flex-col gap-3 border-t border-black/[.08] pt-2 dark:border-white/[.145]";
const BOOKING_ITEM_CLASS =
  "flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400";
const BOOKING_OWNER_CLASS =
  "text-sm font-medium text-zinc-950 dark:text-zinc-50";
const BOOKING_LINK_CLASS =
  "text-xs font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50";
const DIALOG_CLASS =
  "w-[calc(100vw_-_2rem)] max-w-md rounded-2xl border border-black/[.08] bg-white p-0 text-zinc-950 shadow-xl backdrop:bg-black/50 dark:border-white/[.145] dark:bg-black dark:text-zinc-50";
const DIALOG_TITLE_CLASS = "text-lg font-semibold tracking-tight";
const DIALOG_TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const PRIMARY_ACTION_CLASS =
  "flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-[#ccc]";
const SECONDARY_ACTION_CLASS =
  "flex h-10 items-center justify-center rounded-full border border-black/[.12] px-5 text-sm font-medium text-zinc-950 transition-colors hover:bg-black/[.04] dark:border-white/[.18] dark:text-zinc-50 dark:hover:bg-white/[.08]";
const ERROR_CLASS = "text-sm text-red-600 dark:text-red-400";

/** Таблица расписания с модальными окнами записи (FR-34…FR-36). */
export function ScheduleTable({ data }: Readonly<{ data: ScheduleTableData }>) {
  const [activeCell, setActiveCell] = useState<ScheduleAvailableCell | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  /** Запоминает кнопку-инициатор, чтобы вернуть на неё фокус после закрытия. */
  function handleOpen(trigger: HTMLButtonElement, cell: ScheduleAvailableCell) {
    triggerRef.current = trigger;
    setActiveCell(cell);
  }

  /** Закрывает окно и возвращает фокус на кнопку слота. */
  function handleClose() {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    setActiveCell(null);
    trigger?.focus();
  }

  return (
    <>
      <div className={TABLE_WRAPPER_CLASS}>
        <table className={TABLE_CLASS}>
          <caption className="sr-only">{data.caption}</caption>
          <thead>
            <tr className="border-b border-black/[.08] dark:border-white/[.145]">
              <th
                scope="col"
                className={`${HEAD_CELL_CLASS} sticky left-0 z-10 bg-white dark:bg-black`}
              >
                День
              </th>
              {data.columns.map((column) => (
                <th key={column.key} scope="col" className={HEAD_CELL_CLASS}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.key}
                className="border-t border-black/[.08] first:border-t-0 dark:border-white/[.145]"
              >
                <th scope="row" className={ROW_HEAD_CLASS}>
                  {row.label}
                </th>
                {row.cells.map((cell, index) => (
                  <td key={data.columns[index].key} className={CELL_CLASS}>
                    <ScheduleCellContent
                      cell={cell}
                      showOwners={data.showOwners}
                      onOpen={handleOpen}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeCell === null ? null : (
        <ScheduleSlotDialog
          key={activeCell.slotId}
          cell={activeCell}
          viewerKind={data.viewerKind}
          onClose={handleClose}
        />
      )}
    </>
  );
}

/** Содержимое ячейки: кнопка записи, «Занято» или пустая структурная ячейка. */
function ScheduleCellContent({
  cell,
  showOwners,
  onOpen,
}: Readonly<{
  cell: ScheduleCell;
  showOwners: boolean;
  onOpen: (trigger: HTMLButtonElement, cell: ScheduleAvailableCell) => void;
}>) {
  if (cell.kind === "empty") {
    return null;
  }

  const bookings =
    showOwners && cell.bookings.length > 0 ? (
      <ScheduleBookingList bookings={cell.bookings} />
    ) : null;

  if (cell.kind === "full") {
    return (
      <div>
        <p className={SLOT_FULL_CLASS}>Занято</p>
        {bookings}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-label={cell.ariaLabel}
        className={SLOT_BUTTON_CLASS}
        onClick={(event) => onOpen(event.currentTarget, cell)}
      >
        <span>Записаться</span>
        {cell.availableLabel === null ? null : (
          <span className={SLOT_CAPACITY_CLASS}>{cell.availableLabel}</span>
        )}
      </button>
      {bookings}
    </div>
  );
}

/**
 * Активные брони административной ячейки. Ссылка ведёт на защищённую
 * детализацию и не является частью формы записи (FR-35, NFR-20).
 */
function ScheduleBookingList({
  bookings,
}: Readonly<{ bookings: readonly ScheduleCellBooking[] }>) {
  return (
    <ul className={BOOKING_LIST_CLASS}>
      {bookings.map((booking) => (
        <li key={booking.bookingId} className={BOOKING_ITEM_CLASS}>
          <span className={BOOKING_OWNER_CLASS}>{booking.ownerLabel}</span>
          <span>{booking.ownerEmail}</span>
          <span>ID: {booking.ownerId}</span>
          <span>{booking.statusLabel}</span>
          <Link
            className={BOOKING_LINK_CLASS}
            href={`/admin/bookings/${booking.bookingId}`}
          >
            Открыть бронь
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Модальное окно слота на нативном `<dialog>` (раздел 6 дизайна).
 *
 * `showModal()` даёт затемнение, удержание фокуса и закрытие по `Esc`; клик по
 * фону (сам элемент `dialog`) закрывает окно, клик внутри — нет. После
 * закрытия родитель возвращает фокус на кнопку слота.
 */
function ScheduleSlotDialog({
  cell,
  viewerKind,
  onClose,
}: Readonly<{
  cell: ScheduleAvailableCell;
  viewerKind: ScheduleViewerKind;
  onClose: () => void;
}>) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (dialog !== null && !dialog.open) {
      dialog.showModal();
    }
  }, []);

  const titleId = `slot-dialog-${cell.slotId}-title`;
  const descriptionId = `slot-dialog-${cell.slotId}-description`;

  /** Закрывает окно; `onClose` вернёт фокус на кнопку-инициатор. */
  function close() {
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={DIALOG_CLASS}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className={DIALOG_TITLE_CLASS}>
            {cell.dateTimeLabel}
          </h2>
          <p id={descriptionId} className={DIALOG_TEXT_CLASS}>
            {viewerKind === "guest"
              ? "Чтобы записаться, войдите или зарегистрируйтесь."
              : "Проверьте дату и время и подтвердите запись."}
          </p>
        </div>

        {viewerKind === "guest" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link className={PRIMARY_ACTION_CLASS} href="/login">
              Войти
            </Link>
            <Link className={SECONDARY_ACTION_CLASS} href="/register">
              Зарегистрироваться
            </Link>
            <button
              type="button"
              className={SECONDARY_ACTION_CLASS}
              onClick={close}
            >
              Отмена
            </button>
          </div>
        ) : (
          <BookingConfirmForm slotId={cell.slotId} onCancel={close} />
        )}
      </div>
    </dialog>
  );
}

/**
 * Подтверждение записи авторизованного пользователя (FR-23).
 *
 * Из формы уходит только `slotId`; ошибки домена (`SLOT_FULL`,
 * `DUPLICATE_ACTIVE_BOOKING`, `SLOT_IN_PAST`, `SLOT_NOT_FOUND`) остаются в
 * окне и объявляются через `aria-live`. При успехе действие переходит на
 * `/bookings`.
 */
function BookingConfirmForm({
  slotId,
  onCancel,
}: Readonly<{ slotId: string; onCancel: () => void }>) {
  const [state, formAction, pending] = useActionState(
    createBookingAction,
    INITIAL_BOOKING_FORM_STATE,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3" aria-busy={pending}>
      <input type="hidden" name="slotId" value={slotId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="submit"
          disabled={pending}
          className={PRIMARY_ACTION_CLASS}
        >
          {pending ? "Запись…" : "Записаться"}
        </button>
        <button
          type="button"
          className={SECONDARY_ACTION_CLASS}
          onClick={onCancel}
        >
          Отмена
        </button>
      </div>
      {state.message === null ? null : (
        <p aria-live="polite" className={ERROR_CLASS}>
          {state.message.text}
        </p>
      )}
    </form>
  );
}
