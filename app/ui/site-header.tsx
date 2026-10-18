// Общий header в корневом layout (FR-38, CR-52).
//
// Статическая оболочка — логотип «Mini Booking System» со ссылкой на `/` —
// prerender-ится и не зависит от сессии. Навигация читает cookie, поэтому
// находится внутри `<Suspense>`: при включённых Cache Components чтение вне
// границы является ошибкой сборки, а статическая оболочка не должна содержать
// данные конкретного пользователя (NFR-7, NFR-21).
//
// Видимость пунктов определяется здесь, на сервере, по действующей сессии и
// роли из базы. Клиентский `SiteHeaderNav` получает готовый список и отвечает
// только за подсветку текущего раздела. Проверок доступа header не выполняет:
// защита остаётся на страницах и в серверных модулях (FR-12, FR-15, CR-52).
//
// «Выйти» — форма с существующим Server Action `logout` (`LogoutButton`), а не
// GET-ссылка. Пункт «Регистрация» отдельно не выводится: он доступен на
// `/login` и в гостевом модальном окне расписания.

import Link from "next/link";
import { Suspense } from "react";

import { getCurrentUser } from "@/app/lib/auth";
import type { SessionRole } from "@/app/lib/session";
import { LogoutButton } from "@/app/ui/logout-button";
import {
  SiteHeaderNav,
  type SiteHeaderNavItem,
} from "@/app/ui/site-header-nav";

const HEADER_CLASS =
  "border-b border-black/[.08] bg-white dark:border-white/[.145] dark:bg-black";
const CONTAINER_CLASS =
  "mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between";
const LOGO_CLASS =
  "text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50";
const NAV_CLASS = "flex flex-wrap items-center gap-x-1 gap-y-2";
const PLACEHOLDER_CLASS =
  "h-11 w-44 rounded-full bg-black/[.04] dark:bg-white/[.08]";

/** Гостевая навигация: расписание и вход (FR-38, CR-52). */
const GUEST_ITEMS: readonly SiteHeaderNavItem[] = [
  { href: "/slots", label: "Расписание" },
  { href: "/login", label: "Войти" },
];

/**
 * Навигация авторизованного пользователя. «Администрирование» добавляется
 * только роли из серверного набора; роль приходит из базы, а не из запроса.
 */
function memberItems(role: SessionRole): readonly SiteHeaderNavItem[] {
  const items: SiteHeaderNavItem[] = [
    { href: "/slots", label: "Расписание" },
    { href: "/bookings", label: "Мои записи" },
    { href: "/notifications", label: "Уведомления" },
  ];

  if (role === "admin" || role === "super_admin") {
    items.push({ href: "/admin", label: "Администрирование" });
  }

  items.push({ href: "/account", label: "Аккаунт" });

  return items;
}

/** Header корневого layout: логотип в статической оболочке, навигация в Suspense. */
export function SiteHeader() {
  return (
    <header className={HEADER_CLASS}>
      <div className={CONTAINER_CLASS}>
        <Link className={LOGO_CLASS} href="/">
          Mini Booking System
        </Link>
        <Suspense
          fallback={<div aria-hidden="true" className={PLACEHOLDER_CLASS} />}
        >
          <HeaderNav />
        </Suspense>
      </div>
    </header>
  );
}

/** Навигация по действующей сессии; читает cookie только внутри Suspense. */
async function HeaderNav() {
  const user = await getCurrentUser();
  const items = user === null ? GUEST_ITEMS : memberItems(user.role);

  return (
    <nav aria-label="Основная навигация" className={NAV_CLASS}>
      <SiteHeaderNav items={items} />
      {user === null ? null : <LogoutButton />}
    </nav>
  );
}
