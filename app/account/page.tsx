import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireUser } from "@/app/lib/auth";
import { LogoutButton } from "@/app/ui/logout-button";

export const metadata: Metadata = {
  title: "Аккаунт",
  description: "Данные учётной записи Mini Booking System",
};

// Аккаунт: доступен только при действующей сессии (FR-10, FR-11, С3).
//
// Проверка доступа выполняется на сервере до рендера данных: `requireUser`
// читает cookie сессии и таблицу `Session`, а без действующей сессии уводит
// запрос на `/access-denied`, поэтому разметка аккаунта в ответ не попадает, а
// ссылка в интерфейсе защитой не считается (FR-12, FR-13, CR-20).
//
// Чтение cookie стоит за границей `<Suspense>`: при включённых Cache Components
// (`next.config.ts`) чтение cookie вне границы — ошибка сборки, а результат
// чтения сессии не должен попадать в статическую оболочку (NFR-7).
//
// Выборка всегда ограничена текущим пользователем: `requireUser` не принимает
// идентификатор, поэтому запросить чужой аккаунт нечем (NFR-5). Блок «Мои
// записи» ведёт на `/bookings`; блок уведомлений остаётся статическим до шага 4
// `Plan.md`, внешние каналы не подключаются (FR-11, NFR-15).

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const SECTION_HEADING_CLASS =
  "text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const LINK_CLASS =
  "font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50";
const TERM_CLASS = "text-sm font-medium text-zinc-500 dark:text-zinc-400";
const VALUE_CLASS = "text-base break-all text-zinc-950 dark:text-zinc-50";
const PANEL_CLASS =
  "flex flex-col gap-2 rounded-xl border border-dashed border-black/[.12] p-5 dark:border-white/[.18]";

/** Статическая оболочка страницы: данных пользователя в ней нет. */
export default function AccountPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <AccountContent />
      </Suspense>
    </main>
  );
}

/** Данные текущего пользователя, кнопка выхода и контур будущих разделов (FR-10, FR-11). */
async function AccountContent() {
  const user = await requireUser();

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Аккаунт</h1>
        <p className={TEXT_CLASS}>
          Данные текущей учётной записи. Другого пользователя страница показать
          не может: выборка ограничена действующей сессией.
        </p>
      </div>

      <dl className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Email</dt>
          <dd className={VALUE_CLASS}>{user.email}</dd>
        </div>

        {user.displayName === null ? null : (
          <div className="flex flex-col gap-1">
            <dt className={TERM_CLASS}>Отображаемое имя</dt>
            <dd className={VALUE_CLASS}>{user.displayName}</dd>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Роль</dt>
          <dd className={`${VALUE_CLASS} font-mono`}>{user.role}</dd>
        </div>
      </dl>

      <section
        aria-labelledby="account-bookings-heading"
        className={PANEL_CLASS}
      >
        <h2 className={SECTION_HEADING_CLASS} id="account-bookings-heading">
          Мои записи
        </h2>
        <p className={TEXT_CLASS}>
          Брони текущей учётной записи: время слота, статус и отмена активной
          записи.
        </p>
        <Link className={LINK_CLASS} href="/bookings">
          Перейти к моим записям
        </Link>
      </section>

      <section
        aria-labelledby="account-notifications-heading"
        className={PANEL_CLASS}
      >
        <h2 className={SECTION_HEADING_CLASS} id="account-notifications-heading">
          Уведомления
        </h2>
        <p className={TEXT_CLASS}>
          Уведомлений пока нет. Раздел появится позже, отдельным этапом; внешние
          каналы в текущей фазе не подключаются.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <LogoutButton />
        <Link className={LINK_CLASS} href="/slots">
          Свободные слоты
        </Link>
        <Link className={LINK_CLASS} href="/admin">
          Проверка роли на /admin
        </Link>
        <Link className={LINK_CLASS} href="/">
          На главную
        </Link>
      </div>
    </div>
  );
}
