"use client";

// Кнопка выхода из аккаунта (FR-9, С4).
//
// Клиентский компонент только вызывает Server Action `logout`: удаление записи
// сессии и cookie выполняется на сервере (NFR-4, NFR-8). Форма отправляется и
// без JavaScript, поэтому действие подключено атрибутом `action`, а не
// обработчиком события.
//
// Компонент создан на шаге 10 и монтируется на странице аккаунта (шаг 11): на
// `/account` он стоит внутри серверной проверки сессии, поэтому кнопка выхода
// доступна только авторизованному пользователю.

import { logout } from "@/app/actions/auth";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex h-11 items-center justify-center rounded-full border border-black/[.12] px-5 text-base font-medium text-zinc-950 transition-colors hover:bg-black/[.04] dark:border-white/[.18] dark:text-zinc-50 dark:hover:bg-white/[.08]"
      >
        Выйти
      </button>
    </form>
  );
}
