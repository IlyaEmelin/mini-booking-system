import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/app/ui/login-form";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в Mini Booking System",
};

// Публичная страница входа для `guest` (FR-6).
// Переход авторизованного пользователя на `/account` добавляется на шаге 11 (FR-19).
export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-black">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Вход
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Введите email и пароль от своей учётной записи.
          </p>
        </div>

        <LoginForm />

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Нет аккаунта?{" "}
          <Link
            className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
            href="/register"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </main>
  );
}
