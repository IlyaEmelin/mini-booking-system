import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentUser } from "@/app/lib/auth";
import { LoginForm } from "@/app/ui/login-form";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в Mini Booking System",
};

// Публичная страница входа для `guest` (FR-6).
//
// При действующей сессии запрос уходит на `/account`, а форма не показывается
// (FR-19, CR-31): проверка сессии и разметка формы стоят за одной границей
// `<Suspense>`, поэтому авторизованный пользователь не получает HTML с формой —
// вместо неё приходит meta-тег перехода.
//
// Чтение cookie вне границы — ошибка сборки при включённых Cache Components, а
// форма не должна попадать в статическую оболочку (NFR-7).

/** Маршрут аккаунта: цель перехода авторизованного пользователя (FR-19). */
const ACCOUNT_PATH = "/account";

const PAGE_CLASS =
  "flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black";
const CARD_CLASS =
  "flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black";
const HEADING_CLASS =
  "text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";
const LINK_CLASS =
  "font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50";

export default function LoginPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <LoginCard />
      </Suspense>
    </main>
  );
}

/** Форма входа для гостя; при действующей сессии — переход на `/account` (FR-6, FR-19). */
async function LoginCard() {
  const user = await getCurrentUser();

  if (user !== null) {
    redirect(ACCOUNT_PATH);
  }

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Вход</h1>
        <p className={TEXT_CLASS}>
          Введите email и пароль от своей учётной записи.
        </p>
      </div>

      <LoginForm />

      <p className={TEXT_CLASS}>
        Нет аккаунта?{" "}
        <Link className={LINK_CLASS} href="/register">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}

