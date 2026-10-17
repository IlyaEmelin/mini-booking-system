import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Нет доступа",
  description: "Запрос отклонён: нужен вход в аккаунт или другая роль",
};

// Единая страница отказа в доступе (FR-13, С3, С5).
//
// Страница публичная и полностью статическая: она не читает cookie и сессию,
// поэтому выглядит одинаково для гостя и для недостаточной роли, не показывает
// защищённые данные и не объясняет причину отказа (CR-17, CR-18). Ответ — обычная
// страница со статусом `200`, а не ошибка: отказ гостя и отказ из-за
// недостаточной роли неразличимы и по коду ответа.
//
// Переход сюда выполняют `requireUser` и `requireRole` из `app/lib/auth.ts`.

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-md flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const LINK_CLASS =
  "font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50";

export default function AccessDeniedPage() {
  return (
    <main className={PAGE_CLASS}>
      <div className={CARD_CLASS}>
        <div className="flex flex-col gap-2">
          <h1 className={HEADING_CLASS}>Нет доступа</h1>
          <p className={TEXT_CLASS}>
            Раздел закрыт: для него нужен действующий вход в аккаунт и
            подходящая роль. Что именно не совпало, страница не сообщает.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            className="flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            href="/login"
          >
            Войти
          </Link>
          <Link
            className="flex h-11 items-center justify-center rounded-full border border-black/[.12] px-5 text-base font-medium text-zinc-950 transition-colors hover:bg-black/[.04] dark:border-white/[.18] dark:text-zinc-50 dark:hover:bg-white/[.08]"
            href="/account"
          >
            Аккаунт
          </Link>
        </div>

        <p className={TEXT_CLASS}>
          <Link className={LINK_CLASS} href="/">
            На главную
          </Link>
        </p>
      </div>
    </main>
  );
}
