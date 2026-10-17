import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getCurrentUser } from "@/app/lib/auth";
import { RegisterForm } from "@/app/ui/register-form";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Создание учётной записи в Mini Booking System",
};

// Публичная страница регистрации для `guest` (FR-1).
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

export default function RegisterPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Проверка доступа…</p>}>
        <RegisterCard />
      </Suspense>
    </main>
  );
}

/** Форма регистрации для гостя; при действующей сессии — переход на `/account` (FR-1, FR-19). */
async function RegisterCard() {
  const user = await getCurrentUser();

  if (user !== null) {
    redirect(ACCOUNT_PATH);
  }

  return (
    <div className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <h1 className={HEADING_CLASS}>Регистрация</h1>
        <p className={TEXT_CLASS}>
          Публичная регистрация создаёт пользователя с ролью user.
        </p>
      </div>

      <RegisterForm />

      <p className={TEXT_CLASS}>
        Уже есть аккаунт?{" "}
        <Link className={LINK_CLASS} href="/login">
          Войти
        </Link>
      </p>
    </div>
  );
}

