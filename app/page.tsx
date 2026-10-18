import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mini Booking System",
  description: "Учебный сервис записей: регистрация, вход и аккаунт",
};

// Публичная точка входа (шаг 11, `Plan.md`): стартовый экран `create-next-app`
// заменён ссылками на формы.
//
// Страница статическая и намеренно не читает сессию: это публичный вход, а не
// защищённый маршрут, поэтому для гостя и для авторизованного пользователя
// ответ одинаков. Переход авторизованного пользователя касается только `/login`
// и `/register` (FR-19, CR-31).

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-md flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-base text-zinc-600 dark:text-zinc-400";
const PRIMARY_LINK_CLASS =
  "flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]";
const SECONDARY_LINK_CLASS =
  "flex h-11 items-center justify-center rounded-full border border-black/[.12] px-5 text-base font-medium text-zinc-950 transition-colors hover:bg-black/[.04] dark:border-white/[.18] dark:text-zinc-50 dark:hover:bg-white/[.08]";

export default function HomePage() {
  return (
    <main className={PAGE_CLASS}>
      <div className={CARD_CLASS}>
        <div className="flex flex-col gap-2">
          <h1 className={HEADING_CLASS}>Mini Booking System</h1>
          <p className={TEXT_CLASS}>
            Учебный auth-контур: регистрация, вход, локальная сессия и роли.
            Свободные слоты и свои записи доступны авторизованным пользователям.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link className={PRIMARY_LINK_CLASS} href="/login">
            Войти
          </Link>
          <Link className={SECONDARY_LINK_CLASS} href="/register">
            Зарегистрироваться
          </Link>
          <Link className={SECONDARY_LINK_CLASS} href="/slots">
            Свободные слоты
          </Link>
          <Link className={SECONDARY_LINK_CLASS} href="/bookings">
            Мои записи
          </Link>
        </div>
      </div>
    </main>
  );
}
