// Автотесты серверного слоя данных 4.3.3 (FR-22 … FR-28, NFR-12 … NFR-16,
// CR-34 … CR-41).
//
// Прогон идёт по отдельной тестовой базе: `tests/test-env.ts` подключается
// первым и проверяет, что имя базы оканчивается на `_test`. Пользователи,
// слоты, брони и уведомления фикстур удаляются до и после прогона, поэтому
// повторный `npm test` не требует ручной очистки, а база разработки не
// затрагивается. Даты фикстур зафиксированы в 2099 году, чтобы не пересекаться
// с seed-слотами текущей недели и не зависеть от календаря.
//
// Seed проверяется отдельным процессом с окружением `.env.test`: скрипт
// `prisma/seed.ts` получает тестовую строку подключения явно, как и в
// `tests/auth.test.ts`, и не читает базу разработки.

import "./test-env";

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import {
  BookingError,
  cancelBooking,
  confirmBooking,
  createBooking,
  listMyBookings,
} from "@/app/lib/bookings";
import { db } from "@/app/lib/db";
import {
  NotificationError,
  listMyNotifications,
  markNotificationRead,
} from "@/app/lib/notifications";
import { getSlotAvailability, listUpcomingSlots } from "@/app/lib/slots";
import type { SessionRole, SessionUser } from "@/app/lib/session";

import { testChildEnv, testDatabaseName, testSeedEmail } from "./test-env";

/** Момент, относительно которого проверяется будущее слотов и броней. */
const NOW = new Date("2099-03-01T00:00:00.000Z");

/** Заведомо прошедший слот: заканчивается до `NOW`. */
const PAST_STARTS_AT = new Date("2099-02-28T23:00:00.000Z");

/** Начало будущих фикстур: все слоты тестов идут по часовым окнам. */
const FIXTURE_BASE = new Date("2099-03-02T00:00:00.000Z");

const SLOT_DURATION_MS = 60 * 60 * 1000;
const SEED_DAYS = 7;
const SEED_HOURS_UTC = [10, 15] as const;
const SEED_SLOT_COUNT = SEED_DAYS * SEED_HOURS_UTC.length;
const SEED_CAPACITY = 1;

const OWNER_EMAIL = "data.owner@example.com";
const OTHER_EMAIL = "data.other@example.com";
const ADMIN_EMAIL = "data.admin@example.com";
const SUPER_ADMIN_EMAIL = "data.super-admin@example.com";
const FIXTURE_EMAILS = [
  OWNER_EMAIL,
  OTHER_EMAIL,
  ADMIN_EMAIL,
  SUPER_ADMIN_EMAIL,
] as const;

type ScriptResult = Readonly<{
  code: number | null;
  stdout: string;
  stderr: string;
}>;

type SlotRow = Readonly<{
  id: string;
  startsAt: Date;
  endsAt: Date;
  capacity: number;
}>;

type SeedWindow = Readonly<{
  startsAt: Date;
  endsAt: Date;
}>;

let owner: SessionUser;
let other: SessionUser;
let admin: SessionUser;
let superAdmin: SessionUser;

const createdSlotIds: string[] = [];
let nextSlotOffset = 0;

/** Создаёт пользователя тестовой базы и возвращает узкий объект сессии. */
async function createTestUser(
  email: string,
  role: SessionRole,
): Promise<SessionUser> {
  const user = await db.orm.public.User.select("id").create({
    email,
    passwordHash: `data-layer-test-hash:${email}`,
    role,
  });

  return { id: user.id, email, displayName: null, role };
}

/** Создаёт воспроизводимый слот и запоминает его для очистки. */
async function createTestSlot(
  capacity = 2,
  startsAt?: Date,
): Promise<string> {
  const starts = startsAt ?? new Date(
    FIXTURE_BASE.getTime() + nextSlotOffset * SLOT_DURATION_MS,
  );
  nextSlotOffset += 1;

  const slot = await db.orm.public.Slot.select("id").create({
    startsAt: starts,
    endsAt: new Date(starts.getTime() + SLOT_DURATION_MS),
    capacity,
  });
  createdSlotIds.push(slot.id);
  return slot.id;
}

/** Создаёт уникальный прошедший слот, не пересекающийся с другими тестами. */
async function createTestPastSlot(): Promise<string> {
  const startsAt = new Date(
    PAST_STARTS_AT.getTime() - nextSlotOffset * SLOT_DURATION_MS,
  );
  return createTestSlot(1, startsAt);
}

/** Создаёт `pending`-бронь через проверяемый серверный модуль. */
async function createPendingBooking(
  actor: SessionUser,
  capacity = 2,
): Promise<Readonly<{ bookingId: string; slotId: string }>> {
  const slotId = await createTestSlot(capacity);
  const booking = await createBooking(actor, slotId, NOW);
  return { bookingId: booking.id, slotId };
}

/** Уведомления конкретной брони без ограничения владельцем: проверка записи. */
async function notificationRowsFor(bookingId: string): Promise<
  readonly Readonly<{
    id: string;
    userId: string;
    bookingId: string | null;
    type: "booking_created" | "booking_confirmed" | "booking_cancelled";
    message: string;
    readAt: Date | null;
    createdAt: Date;
  }>[]
> {
  return db.orm.public.Notification
    .select("id", "userId", "bookingId", "type", "message", "readAt", "createdAt")
    .where({ bookingId })
    .all();
}

/** Типы уведомлений брони в порядке создания. */
async function notificationTypesAsc(bookingId: string): Promise<string[]> {
  const rows = await notificationRowsFor(bookingId);
  return rows
    .slice()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((row) => row.type);
}

/** Текущее число активных броней слота. */
async function activeBookingsCount(slotId: string): Promise<number> {
  const result = await db.orm.public.Booking
    .where({ slotId })
    .where((booking) => booking.status.in(["pending", "confirmed"] as const))
    .aggregate((aggregate) => ({ count: aggregate.count() }));
  return result.count;
}

/** Проверяет доменный код ошибки слоя броней. */
async function expectBookingError(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(
      error instanceof BookingError,
      `ожидался BookingError, получено: ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

/** Проверяет доменный код ошибки слоя уведомлений. */
async function expectNotificationError(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(
      error instanceof NotificationError,
      `ожидался NotificationError, получено: ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

/** Запускает скрипт проекта отдельным процессом с окружением тестовой базы. */
function runProjectScript(relativePath: string): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", join(process.cwd(), relativePath)],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...testChildEnv },
        windowsHide: true,
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

/** Окна seed: завтра и ещё 6 дней, 10:00 и 15:00 UTC, по часу. */
function buildSeedWindows(now: Date): readonly SeedWindow[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const windows: SeedWindow[] = [];

  for (let dayOffset = 0; dayOffset < SEED_DAYS; dayOffset += 1) {
    for (const hour of SEED_HOURS_UTC) {
      const startsAt = new Date(
        Date.UTC(year, month, day + 1 + dayOffset, hour, 0, 0, 0),
      );
      windows.push({
        startsAt,
        endsAt: new Date(startsAt.getTime() + SLOT_DURATION_MS),
      });
    }
  }

  return windows;
}

/** Ключ уникальной пары `startsAt` + `endsAt` слота. */
function slotKey(slot: Readonly<{ startsAt: Date; endsAt: Date }>): string {
  return `${slot.startsAt.toISOString()}|${slot.endsAt.toISOString()}`;
}

/** Удаляет пользователей (каскадом — их данные) и слоты фикстур. */
async function deleteFixtures(): Promise<void> {
  for (const email of FIXTURE_EMAILS) {
    await db.orm.public.User.where({ email }).deleteAndCount();
  }

  for (const slotId of createdSlotIds) {
    await db.orm.public.Slot.where({ id: slotId }).deleteAndCount();
  }

  createdSlotIds.length = 0;
  nextSlotOffset = 0;
}

before(async () => {
  assert.ok(testDatabaseName.endsWith("_test"));
  await deleteFixtures();

  owner = await createTestUser(OWNER_EMAIL, "user");
  other = await createTestUser(OTHER_EMAIL, "user");
  admin = await createTestUser(ADMIN_EMAIL, "admin");
  superAdmin = await createTestUser(SUPER_ADMIN_EMAIL, "super_admin");
});

after(async () => {
  await deleteFixtures();
  // Клиент Prisma 8 держит пул соединений: без close() процесс не завершится.
  await db.close();
});

describe("Seed слотов (FR-21, CR-34, NFR-16)", () => {
  test("создаёт 14 будущих окон UTC и не дублирует их при повторе", async () => {
    const seedAdminBefore = await db.orm.public.User
      .select("id")
      .where({ email: testSeedEmail })
      .first();
    const slotsBefore: readonly SlotRow[] = await db.orm.public.Slot
      .select("id", "startsAt", "endsAt", "capacity")
      .all();
    const idsBefore = new Set(slotsBefore.map((slot) => slot.id));
    const createdIds: string[] = [];

    try {
      const first = await runProjectScript("prisma/seed.ts");
      assert.equal(first.code, 0, first.stderr);

      const slotsAfterFirst: readonly SlotRow[] = await db.orm.public.Slot
        .select("id", "startsAt", "endsAt", "capacity")
        .all();
      for (const slot of slotsAfterFirst) {
        if (!idsBefore.has(slot.id)) {
          createdIds.push(slot.id);
        }
      }

      const expectedWindows = buildSeedWindows(new Date());
      assert.equal(expectedWindows.length, SEED_SLOT_COUNT);

      const grouped = new Map<string, SlotRow[]>();
      for (const slot of slotsAfterFirst) {
        const key = slotKey(slot);
        const rows = grouped.get(key) ?? [];
        rows.push(slot);
        grouped.set(key, rows);
      }

      for (const window of expectedWindows) {
        const rows = grouped.get(slotKey(window)) ?? [];
        assert.equal(
          rows.length,
          1,
          `seed должен создать ровно одно окно ${window.startsAt.toISOString()}`,
        );

        const row = rows[0];
        assert.ok(row !== undefined);
        if (row === undefined) {
          return;
        }

        assert.equal(row.capacity, SEED_CAPACITY);
        assert.equal(
          row.endsAt.getTime() - row.startsAt.getTime(),
          SLOT_DURATION_MS,
        );
        assert.ok(
          row.startsAt.getTime() > Date.now(),
          "окно seed должно быть в будущем",
        );
        assert.ok(
          SEED_HOURS_UTC.includes(
            row.startsAt.getUTCHours() as (typeof SEED_HOURS_UTC)[number],
          ),
          "окно seed должно начинаться в 10:00 или 15:00 UTC",
        );
      }

      const idsAfterFirst = slotsAfterFirst
        .map((slot) => slot.id)
        .sort((left, right) => left.localeCompare(right));

      const second = await runProjectScript("prisma/seed.ts");
      assert.equal(second.code, 0, second.stderr);
      assert.ok(
        second.stdout.includes("уже было"),
        "повторный seed должен сообщить о существующих слотах",
      );

      const slotsAfterSecond: readonly SlotRow[] = await db.orm.public.Slot
        .select("id", "startsAt", "endsAt", "capacity")
        .all();
      for (const slot of slotsAfterSecond) {
        if (!idsBefore.has(slot.id) && !createdIds.includes(slot.id)) {
          createdIds.push(slot.id);
        }
      }

      const idsAfterSecond = slotsAfterSecond
        .map((slot) => slot.id)
        .sort((left, right) => left.localeCompare(right));
      assert.deepEqual(idsAfterSecond, idsAfterFirst);

      const expectedKeys = new Set(expectedWindows.map(slotKey));
      const seedRows = slotsAfterSecond.filter((slot) =>
        expectedKeys.has(slotKey(slot)),
      );
      assert.equal(seedRows.length, SEED_SLOT_COUNT);

      const seedAdmins = await db.orm.public.User
        .select("id", "email", "role")
        .where({ email: testSeedEmail })
        .all();
      assert.equal(seedAdmins.length, 1);
      assert.equal(seedAdmins[0]?.role, "super_admin");
    } finally {
      for (const slotId of createdIds) {
        await db.orm.public.Slot.where({ id: slotId }).deleteAndCount();
      }
      if (seedAdminBefore === null) {
        await db.orm.public.User.where({ email: testSeedEmail }).deleteAndCount();
      }
    }
  });
});

describe("Слоты (FR-22, CR-35)", () => {
  test("показывает только будущие слоты и считает остаток вместимости", async () => {
    const pastSlotId = await createTestPastSlot();
    const futureSlotId = await createTestSlot(3);

    const slots = await listUpcomingSlots(NOW);
    const fixtureIds = slots
      .filter((slot) => slot.id === pastSlotId || slot.id === futureSlotId)
      .map((slot) => slot.id);
    assert.deepEqual(fixtureIds, [futureSlotId]);

    const future = slots.find((slot) => slot.id === futureSlotId);
    assert.ok(future !== undefined);
    if (future === undefined) {
      return;
    }
    assert.equal(future.activeBookings, 0);
    assert.equal(future.availableCapacity, 3);
    assert.equal(future.isUpcoming, true);

    const unknown = await getSlotAvailability("slot-that-does-not-exist", NOW);
    assert.equal(unknown, null);

    const past = await getSlotAvailability(pastSlotId, NOW);
    assert.ok(past !== null);
    if (past === null) {
      return;
    }
    assert.equal(past.isUpcoming, false);
  });
});

describe("Создание брони (FR-23, CR-36, CR-37, NFR-14)", () => {
  test("создаёт pending только для actor и уведомление booking_created", async () => {
    const slotId = await createTestSlot(2);
    const booking = await createBooking(owner, slotId, NOW);

    assert.equal(booking.status, "pending");
    assert.equal(booking.slot.id, slotId);
    assert.equal(booking.confirmedAt, null);
    assert.equal(booking.cancelledAt, null);
    assert.deepEqual(Object.keys(booking).sort(), [
      "cancelledAt",
      "confirmedAt",
      "createdAt",
      "id",
      "slot",
      "status",
    ]);

    const stored = await db.orm.public.Booking
      .select("id", "userId", "slotId", "status")
      .where({ id: booking.id })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.userId, owner.id);
    assert.equal(stored.slotId, slotId);
    assert.equal(stored.status, "pending");

    const notifications = await notificationRowsFor(booking.id);
    assert.equal(notifications.length, 1);
    const notification = notifications[0];
    assert.ok(notification !== undefined);
    if (notification === undefined) {
      return;
    }
    assert.equal(notification.userId, owner.id);
    assert.equal(notification.bookingId, booking.id);
    assert.equal(notification.type, "booking_created");
    assert.equal(notification.readAt, null);
  });

  test("возвращает SLOT_NOT_FOUND для неизвестного слота", async () => {
    await expectBookingError(
      createBooking(owner, "slot-that-does-not-exist", NOW),
      "SLOT_NOT_FOUND",
    );
  });

  test("возвращает SLOT_IN_PAST для начавшегося слота", async () => {
    const slotId = await createTestPastSlot();
    await expectBookingError(
      createBooking(owner, slotId, NOW),
      "SLOT_IN_PAST",
    );
    assert.equal(await activeBookingsCount(slotId), 0);
  });

  test("отклоняет повторную активную бронь при capacity = 1", async () => {
    const slotId = await createTestSlot(1);
    await createBooking(owner, slotId, NOW);

    await expectBookingError(
      createBooking(owner, slotId, NOW),
      "DUPLICATE_ACTIVE_BOOKING",
    );
    assert.equal(await activeBookingsCount(slotId), 1);
  });

  test("возвращает SLOT_FULL другому пользователю при заполненной вместимости", async () => {
    const slotId = await createTestSlot(1);
    await createBooking(owner, slotId, NOW);

    await expectBookingError(
      createBooking(other, slotId, NOW),
      "SLOT_FULL",
    );
    assert.equal(await activeBookingsCount(slotId), 1);
  });
});

describe("Подтверждение брони (FR-24, FR-25, CR-38)", () => {
  test("admin переводит pending в confirmed и фиксирует confirmedAt", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    const confirmedAt = new Date(NOW.getTime() + 30 * 60 * 1000);

    const confirmed = await confirmBooking(admin, bookingId, confirmedAt);
    assert.equal(confirmed.status, "confirmed");
    assert.equal(confirmed.confirmedAt?.getTime(), confirmedAt.getTime());
    assert.equal(confirmed.cancelledAt, null);

    const stored = await db.orm.public.Booking
      .select("status", "confirmedAt")
      .where({ id: bookingId })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.status, "confirmed");
    assert.equal(stored.confirmedAt?.getTime(), confirmedAt.getTime());

    assert.deepEqual(await notificationTypesAsc(bookingId), [
      "booking_created",
      "booking_confirmed",
    ]);
  });

  test("super_admin тоже может подтверждать бронь", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    const confirmed = await confirmBooking(superAdmin, bookingId, NOW);
    assert.equal(confirmed.status, "confirmed");
  });

  test("запрещает подтверждение роли user и не меняет бронь", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    await expectBookingError(
      confirmBooking(owner, bookingId, NOW),
      "FORBIDDEN",
    );

    const stored = await db.orm.public.Booking
      .select("status")
      .where({ id: bookingId })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.status, "pending");
  });

  test("возвращает BOOKING_NOT_FOUND для неизвестной брони", async () => {
    await expectBookingError(
      confirmBooking(admin, "booking-that-does-not-exist", NOW),
      "BOOKING_NOT_FOUND",
    );
  });
});

describe("Отмена и конечность статусов (FR-24, FR-25, CR-38)", () => {
  test("владелец отменяет pending и получает booking_cancelled", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    const cancelledAt = new Date(NOW.getTime() + 60 * 60 * 1000);

    const cancelled = await cancelBooking(owner, bookingId, cancelledAt);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.cancelledAt?.getTime(), cancelledAt.getTime());
    assert.equal(cancelled.confirmedAt, null);

    const stored = await db.orm.public.Booking
      .select("status", "cancelledAt")
      .where({ id: bookingId })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.status, "cancelled");
    assert.equal(stored.cancelledAt?.getTime(), cancelledAt.getTime());

    assert.deepEqual(await notificationTypesAsc(bookingId), [
      "booking_created",
      "booking_cancelled",
    ]);
  });

  test("отменяет confirmed, сохраняя confirmedAt", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    const confirmedAt = new Date(NOW.getTime() + 30 * 60 * 1000);
    await confirmBooking(admin, bookingId, confirmedAt);

    const cancelledAt = new Date(confirmedAt.getTime() + 30 * 60 * 1000);
    const cancelled = await cancelBooking(owner, bookingId, cancelledAt);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.confirmedAt?.getTime(), confirmedAt.getTime());
    assert.equal(cancelled.cancelledAt?.getTime(), cancelledAt.getTime());
  });

  test("отклоняет повторную отмену и подтверждение cancelled", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    await cancelBooking(owner, bookingId, NOW);

    await expectBookingError(
      cancelBooking(owner, bookingId, new Date(NOW.getTime() + 1)),
      "INVALID_TRANSITION",
    );
    await expectBookingError(
      confirmBooking(admin, bookingId, new Date(NOW.getTime() + 2)),
      "INVALID_TRANSITION",
    );

    const stored = await db.orm.public.Booking
      .select("status")
      .where({ id: bookingId })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.status, "cancelled");
    assert.equal((await notificationTypesAsc(bookingId)).length, 2);
  });

  test("запрещает user отменять чужую бронь", async () => {
    const { bookingId } = await createPendingBooking(other, 2);

    await expectBookingError(
      cancelBooking(owner, bookingId, NOW),
      "FORBIDDEN",
    );

    const stored = await db.orm.public.Booking
      .select("status")
      .where({ id: bookingId })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.status, "pending");
    assert.deepEqual(await notificationTypesAsc(bookingId), ["booking_created"]);
  });
});

describe("Отмена администратором (FR-25, CR-39)", () => {
  test("admin отменяет чужую бронь и уведомляет её владельца", async () => {
    const { bookingId } = await createPendingBooking(other, 2);
    const cancelled = await cancelBooking(admin, bookingId, NOW);
    assert.equal(cancelled.status, "cancelled");

    const notifications = await notificationRowsFor(bookingId);
    const cancellation = notifications.find(
      (notification) => notification.type === "booking_cancelled",
    );
    assert.ok(cancellation !== undefined);
    if (cancellation === undefined) {
      return;
    }
    assert.equal(cancellation.userId, other.id);
  });

  test("возвращает BOOKING_NOT_FOUND для неизвестной брони", async () => {
    await expectBookingError(
      cancelBooking(admin, "booking-that-does-not-exist", NOW),
      "BOOKING_NOT_FOUND",
    );
  });
});

describe("Изоляция владельца (FR-23, FR-27, NFR-14)", () => {
  test("listMyBookings возвращает только брони actor", async () => {
    const ownerSlotId = await createTestSlot(2);
    const otherSlotId = await createTestSlot(2);
    const ownerBooking = await createBooking(owner, ownerSlotId, NOW);
    const otherBooking = await createBooking(other, otherSlotId, NOW);

    const ownerBookings = await listMyBookings(owner);
    const ownerIds = new Set(ownerBookings.map((booking) => booking.id));
    assert.ok(ownerIds.has(ownerBooking.id));
    assert.ok(!ownerIds.has(otherBooking.id));
    assert.ok(
      ownerBookings.every((booking) => !("userId" in booking)),
      "сводка брони не должна раскрывать userId",
    );

    const otherBookings = await listMyBookings(other);
    const otherIds = new Set(otherBookings.map((booking) => booking.id));
    assert.ok(otherIds.has(otherBooking.id));
    assert.ok(!otherIds.has(ownerBooking.id));
  });
});

describe("Уведомления (FR-26, FR-27, NFR-15)", () => {
  test("создаёт три типа и отдаёт их от новых к старым", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    await confirmBooking(admin, bookingId, new Date(NOW.getTime() + 30 * 60 * 1000));
    await cancelBooking(owner, bookingId, new Date(NOW.getTime() + 60 * 60 * 1000));

    const mine = (await listMyNotifications(owner)).filter(
      (notification) => notification.bookingId === bookingId,
    );
    assert.deepEqual(
      mine.map((notification) => notification.type),
      ["booking_cancelled", "booking_confirmed", "booking_created"],
    );
    assert.deepEqual(
      mine.map((notification) => notification.message),
      [
        "Бронь отменена.",
        "Бронь подтверждена.",
        "Бронь создана и ожидает подтверждения.",
      ],
    );
    assert.ok(
      mine.every((notification) => !("userId" in notification)),
      "сводка уведомления не должна раскрывать userId",
    );
    assert.deepEqual(Object.keys(mine[0] ?? {}).sort(), [
      "bookingId",
      "createdAt",
      "id",
      "message",
      "readAt",
      "type",
    ]);
  });

  test("listMyNotifications не показывает чужие уведомления", async () => {
    const ownerPending = await createPendingBooking(owner, 2);
    const otherPending = await createPendingBooking(other, 2);

    const ownerNotifications = await listMyNotifications(owner);
    const otherNotificationIds = new Set(
      (await notificationRowsFor(otherPending.bookingId)).map(
        (notification) => notification.id,
      ),
    );
    assert.ok(
      ownerNotifications.some(
        (notification) => notification.bookingId === ownerPending.bookingId,
      ),
    );
    assert.ok(
      ownerNotifications.every(
        (notification) => !otherNotificationIds.has(notification.id),
      ),
    );

    const otherNotifications = await listMyNotifications(other);
    assert.ok(
      otherNotifications.some(
        (notification) => notification.bookingId === otherPending.bookingId,
      ),
    );
  });

  test("markNotificationRead выставляет readAt один раз и идемпотентен", async () => {
    const { bookingId } = await createPendingBooking(owner, 2);
    const notifications = await notificationRowsFor(bookingId);
    const notification = notifications[0];
    assert.ok(notification !== undefined);
    if (notification === undefined) {
      return;
    }

    const firstReadAt = new Date(NOW.getTime() + 60 * 60 * 1000);
    const first = await markNotificationRead(owner, notification.id, firstReadAt);
    assert.equal(first.readAt?.getTime(), firstReadAt.getTime());

    const later = new Date(firstReadAt.getTime() + 60 * 60 * 1000);
    const second = await markNotificationRead(owner, notification.id, later);
    assert.equal(second.readAt?.getTime(), firstReadAt.getTime());

    const stored = await db.orm.public.Notification
      .select("readAt")
      .where({ id: notification.id })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.readAt?.getTime(), firstReadAt.getTime());
  });

  test("чужие уведомления нельзя отметить, неизвестное даёт NOTIFICATION_NOT_FOUND", async () => {
    const { bookingId } = await createPendingBooking(other, 2);
    const notifications = await notificationRowsFor(bookingId);
    const notification = notifications[0];
    assert.ok(notification !== undefined);
    if (notification === undefined) {
      return;
    }

    await expectNotificationError(
      markNotificationRead(owner, notification.id, NOW),
      "FORBIDDEN",
    );
    await expectNotificationError(
      markNotificationRead(owner, "notification-that-does-not-exist", NOW),
      "NOTIFICATION_NOT_FOUND",
    );

    const stored = await db.orm.public.Notification
      .select("readAt")
      .where({ id: notification.id })
      .first();
    assert.ok(stored !== null);
    if (stored === null) {
      return;
    }
    assert.equal(stored.readAt, null);
  });
});

describe("Конкурентное бронирование (FR-23, NFR-13)", () => {
  test("на capacity = 1 успешна ровно одна из двух одновременных броней", async () => {
    const slotId = await createTestSlot(1);

    const results = await Promise.allSettled([
      createBooking(owner, slotId, NOW),
      createBooking(other, slotId, NOW),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const success = fulfilled[0];
    assert.ok(success?.status === "fulfilled");
    if (success?.status === "fulfilled") {
      assert.equal(success.value.status, "pending");
      assert.equal(success.value.slot.id, slotId);
    }

    const failure = rejected[0];
    assert.ok(failure?.status === "rejected");
    if (failure?.status === "rejected") {
      assert.ok(
        failure.reason instanceof BookingError,
        `ожидался BookingError, получено: ${String(failure.reason)}`,
      );
      assert.equal(failure.reason.code, "SLOT_FULL");
    }

    assert.equal(await activeBookingsCount(slotId), 1);
  });
});









