import type { Metadata } from "next";
import { Suspense } from "react";

import { ScheduleContent } from "@/app/ui/schedule-content";

export const metadata: Metadata = {
  title: "Mini Booking System",
  description:
    "Публичное расписание слотов на 7 дней вперёд: свободные и занятые окна записи",
};

// `/` — публичная точка входа с расписанием (FR-34, CR-48).
//
// Страница не вызывает `requireUser`: расписание доступно гостю, а сессия
// читается внутри `ScheduleContent` только для выбора ролевого DTO (FR-35,
// FR-36, NFR-21). Чтение cookie остаётся за границей `<Suspense>`, поэтому
// статическая оболочка не содержит данных пользователя (NFR-7).
//
// Разметка таблицы здесь не дублируется: `/slots` использует тот же серверный
// компонент расписания (FR-34).

const PAGE_CLASS =
  "flex flex-1 flex-col items-center bg-zinc-50 px-6 py-10 dark:bg-black";
const TEXT_CLASS = "text-sm text-zinc-600 dark:text-zinc-400";

/** Статическая оболочка `/`: данных слотов и сессии в ней нет. */
export default function HomePage() {
  return (
    <main className={PAGE_CLASS}>
      <Suspense fallback={<p className={TEXT_CLASS}>Загрузка расписания…</p>}>
        <ScheduleContent />
      </Suspense>
    </main>
  );
}
