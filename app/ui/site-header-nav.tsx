"use client";

// Клиентская часть общего header: только подсветка текущего раздела (FR-38,
// CR-52).
//
// Список пунктов готовит серверный `site-header.tsx` по действующей сессии и
// роли. Клиент не решает права, не скрывает пункты и не читает сессию: он
// получает готовый список и сравнивает `usePathname()` с адресами ссылок.
//
// `usePathname` — клиентский хук Next.js. При включённых Cache Components он
// может требовать границу `<Suspense>`; навигация уже смонтирована внутри неё в
// `SiteHeader`, поэтому статическая оболочка header не зависит от пути.

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Пункт навигации, подготовленный сервером: адрес и подпись. */
export type SiteHeaderNavItem = Readonly<{
  href: string;
  label: string;
}>;

const LIST_CLASS = "flex flex-wrap items-center gap-x-1 gap-y-2";
const LINK_CLASS =
  "inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/[.08] dark:hover:text-zinc-50";
const ACTIVE_LINK_CLASS =
  "bg-black/[.06] text-zinc-950 dark:bg-white/[.1] dark:text-zinc-50";

/**
 * Текущий раздел: `/` и `/slots` относятся к «Расписанию», остальные пункты
 * подсвечиваются на своём маршруте и вложенных страницах (`/admin/*` и т. п.).
 */
function isActivePath(pathname: string, href: string): boolean {
  if (href === "/slots") {
    return (
      pathname === "/" || pathname === "/slots" || pathname.startsWith("/slots/")
    );
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * `aria-current="page"` ставится только на точное совпадение. Для раздела,
 * открытого на соседнем маршруте (`/` при пункте `/slots`), используется
 * значение `true`: пункт остаётся текущим, но не выдаёт себя за точную страницу.
 */
function currentPathAttribute(
  pathname: string,
  href: string,
): "page" | "true" | undefined {
  if (pathname === href) {
    return "page";
  }

  return isActivePath(pathname, href) ? "true" : undefined;
}

/** Ссылки навигации; видимость пунктов уже определена на сервере (FR-38). */
export function SiteHeaderNav({
  items,
}: Readonly<{ items: readonly SiteHeaderNavItem[] }>) {
  const pathname = usePathname();

  return (
    <ul className={LIST_CLASS}>
      {items.map((item) => {
        const current = currentPathAttribute(pathname, item.href);

        return (
          <li key={item.href}>
            <Link
              aria-current={current}
              className={
                current === undefined
                  ? LINK_CLASS
                  : `${LINK_CLASS} ${ACTIVE_LINK_CLASS}`
              }
              href={item.href}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
