import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/app/lib/auth";
import {
  listMyNotifications,
  type NotificationSummary,
  type NotificationType,
} from "@/app/lib/notifications";
import { MarkNotificationReadButton } from "@/app/ui/mark-notification-read-button";

export const metadata: Metadata = {
  title: "Уведомления",
  description: "Внутренние уведомления текущей учётной записи Mini Booking System",
};

// Внутренние уведомления (FR-32, CR-46, NFR-14, NFR-15).
//
// Страница доступна только при действующей сессии: `requireUser` читает cookie
// и таблицу `Session` до обращения к уведомлениям, поэтому гость уходит на
// `/access-denied`, а разметка уведомлений в ответ не попадает (FR-12, FR-13).
//
// Выборка ограничена получателем внутри `listMyNotifications(actor)`: страница
// не принимает чужой идентификатор. Кнопка «Прочитать» отправляет только
// `notificationId`; владельца повторно проверяет `markNotificationRead` в
// серверном слое (NFR-14).
//
// Чтение cookie стоит за границей `<Suspense>` — условие Cache Components
// (`next.config.ts`, NFR-7). Внешних каналов и счётчиков в реальном времени нет.

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
const NOTIFICATION_CLASS =
  "flex flex-col gap-3 rounded-xl border border-black/[.12] p-5 dark:border-white/[.18]";
const UNREAD_CLASS =
  "border-l-4 border-l-amber-500 bg-amber-50/60 dark:border-l-amber-400 dark:bg-amber-950/20";
const NOTIFICATION_HEADER_CLASS =
  "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between";
const TYPE_CLASS =
  "text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400";
const MESSAGE_CLASS = "text-base text-zinc-950 dark:text-zinc-50";
const TERM_CLASS = "text-xs font-medium text-zinc-500 dark:text-zinc-400";
const VALUE_CLASS = "text-sm text-zinc-950 dark:text-zinc-50";
const BADGE_BASE_CLASS =
  "shrink-0 rounded-full px-3 py-1 text-sm font-medium";
const UNREAD_BADGE_CLASS =
  "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200";
const READ_BADGE_CLASS =
  "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400";

const TYPE_LABELS: Readonly<Record<NotificationType, string>> = {
  booking_created: "Бронь создана",
  booking_confirmed: "Бронь подтверждена",
  booking_cancelled: "Бронь отменена",
};

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

/** Статическая оболочка страницы: данных уведомлений в ней нет. */
export default function NotificationsPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <NotificationsContent />
      </Suspense>
    </main>
  );
}

/** Уведомления текущего пользователя от новых к старым (FR-32). */
async function NotificationsContent() {
  const actor = await requireUser();
  const notifications = await listMyNotifications(actor);
  const unreadCount = notifications.filter(
    (notification) => notification.readAt === null,
  ).length;

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Уведомления</h1>
        <p className={TEXT_CLASS}>
          Только ваши внутренние уведомления: новые показаны первыми. Время
          указано в UTC. Непрочитанных: {unreadCount}.
        </p>
      </div>

      {notifications.length === 0 ? (
        <p className={TEXT_CLASS}>
          У вас пока нет уведомлений. Они появятся после создания или изменения
          брони.
        </p>
      ) : (
        <ul className={LIST_CLASS}>
          {notifications.map((notification) => (
            <li key={notification.id}>
              <NotificationCard notification={notification} />
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}

/** Карточка уведомления: тип, текст, дата и признак прочтения (FR-32). */
function NotificationCard({
  notification,
}: Readonly<{ notification: NotificationSummary }>) {
  const isUnread = notification.readAt === null;

  return (
    <article
      aria-labelledby={`notification-${notification.id}-message`}
      className={
        isUnread
          ? `${NOTIFICATION_CLASS} ${UNREAD_CLASS}`
          : NOTIFICATION_CLASS
      }
    >
      <div className={NOTIFICATION_HEADER_CLASS}>
        <div className="flex flex-col gap-1">
          <p className={TYPE_CLASS}>{TYPE_LABELS[notification.type]}</p>
          <h2
            className={MESSAGE_CLASS}
            id={`notification-${notification.id}-message`}
          >
            {notification.message}
          </h2>
        </div>
        <p
          className={`${BADGE_BASE_CLASS} ${
            isUnread ? UNREAD_BADGE_CLASS : READ_BADGE_CLASS
          }`}
        >
          {isUnread ? "Непрочитано" : "Прочитано"}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Создано</dt>
          <dd className={VALUE_CLASS}>
            <time dateTime={notification.createdAt.toISOString()}>
              {DATE_TIME_FORMATTER.format(notification.createdAt)} UTC
            </time>
          </dd>
        </div>
        {notification.readAt === null ? null : (
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Прочитано</dt>
            <dd className={VALUE_CLASS}>
              <time dateTime={notification.readAt.toISOString()}>
                {DATE_TIME_FORMATTER.format(notification.readAt)} UTC
              </time>
            </dd>
          </div>
        )}
      </dl>

      {isUnread ? (
        <MarkNotificationReadButton notificationId={notification.id} />
      ) : null}
    </article>
  );
}
