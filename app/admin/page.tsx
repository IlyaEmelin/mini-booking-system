import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireRole } from "@/app/lib/auth";
import type { SessionRole } from "@/app/lib/session";

export const metadata: Metadata = {
  title: "Администрирование",
  description: "Разделы слотов и броней для admin и super_admin",
};

// `/admin` — административная навигация (FR-33).
//
// Страница сама данные не изменяет, но каждая дочерняя страница и Server Action
// повторно проверяют роль. Гость и `user` получают один и тот же ответ: 200 и
// переход на `/access-denied` без раскрытия причины (FR-13, CR-17, CR-18).
// Роль читается только из базы данных, а не из формы или query-параметра
// (FR-15, NFR-4).
//
// Чтение cookie стоит за границей `<Suspense>` — условие Cache Components
// (NFR-7).

/** Роли, которым маршрут разрешён: сам набор задан здесь, а не в запросе (FR-12). */
const ALLOWED_ROLES: readonly SessionRole[] = ["admin", "super_admin"];

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-2xl flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const LINK_CLASS =
  "font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50";
const TERM_CLASS = "text-sm font-medium text-zinc-500 dark:text-zinc-400";
const VALUE_CLASS = "text-base break-all text-zinc-950 dark:text-zinc-50";

/** Статическая оболочка маршрута: подтверждения доступа в ней нет. */
export default function AdminPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

/** Административная навигация для `admin` и `super_admin` (FR-33). */
async function AdminContent() {
  const user = await requireRole(ALLOWED_ROLES);

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Администрирование</h1>
        <p className={TEXT_CLASS}>
          Проверка роли выполнена на сервере до рендера страницы. Гость и
          пользователь с ролью user сюда не попадают.
        </p>
      </div>

      <dl className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Email</dt>
          <dd className={VALUE_CLASS}>{user.email}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className={TERM_CLASS}>Роль</dt>
          <dd className={`${VALUE_CLASS} font-mono`}>{user.role}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link className={LINK_CLASS} href="/admin/slots">
          Управление слотами
        </Link>
        <Link className={LINK_CLASS} href="/admin/bookings">
          Все брони
        </Link>
      </div>

      <p className={TEXT_CLASS}>
        Доступны создание и изменение свободных слотов, подтверждение броней
        pending и отмена броней pending/confirmed. Роли admin и super_admin
        используют одни и те же возможности и выдаются только вне публичного
        ввода.
      </p>

      <div className="flex flex-wrap items-center gap-4">
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
