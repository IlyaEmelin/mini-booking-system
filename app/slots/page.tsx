import type { Metadata } from "next";
import { Suspense } from "react";

import { ScheduleContent } from "@/app/ui/schedule-content";

export const metadata: Metadata = {
  title: "Расписание",
  description:
    "Все будущие слоты на 7 дней вперёд, свободные и занятые; время указано в UTC",
};

// `/slots` — публичное расписание (FR-34, CR-48).
//
// Страница больше не вызывает `requireUser`: действующая сессия нужна только
// для выбора ролевого DTO внутри `ScheduleContent` (FR-35, FR-36, NFR-21).
// Гость видит то же расписание и не уходит на `/access-denied`.
//
// Чтение cookie остаётся за границей `<Suspense>`, поэтому статическая
// оболочка не содержит данных пользователя (NFR-7). Разметка и серверная
// подготовка данных общие с `/`: отдельного списка карточек и ссылок на
// «Мои записи», «Аккаунт» и «На главную» здесь нет — их заменяет header.

const PAGE_CLASS =
  "flex flex-1 flex-col items-center bg-zinc-50 px-6 py-10 dark:bg-black";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";

/** Статическая оболочка `/slots`: данных слотов и сессии в ней нет. */
export default function SlotsPage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Загрузка расписания…</p>}>
        <ScheduleContent />
      </Suspense>
    </main>
  );
}
