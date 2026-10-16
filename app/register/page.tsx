import type { Metadata } from "next";
import Link from "next/link";

import { RegisterForm } from "@/app/ui/register-form";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Создание учётной записи в Mini Booking System",
};

// Публичная страница регистрации для `guest` (FR-1).
// Переход авторизованного пользователя на `/account` добавляется на шаге 11 (FR-19).
export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Регистрация
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Публичная регистрация создаёт пользователя с ролью user.
          </p>
        </div>

        <RegisterForm />

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Уже есть аккаунт?{" "}
          <Link
            className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
            href="/login"
          >
            Войти
          </Link>
        </p>
      </div>
    </main>
  );
}
