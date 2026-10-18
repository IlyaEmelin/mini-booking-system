// Автотесты административных серверных операций 4.3.4 (FR-29, FR-33,
// NFR-12 … NFR-19, CR-44 … CR-45).
//
// Прогон идёт по отдельной тестовой базе: `tests/test-env.ts` подключается
// первым. Пользователи, слоты, брони и уведомления фикстур удаляются до и после
// прогона, поэтому повторный `npm test` не требует ручной очистки. Даты
// зафиксированы в 2099 году, чтобы не пересекаться с seed текущей недели.

import "./test-env";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import {
  BookingError,
  createBooking,
  getAdminBooking,
  listAllBookings,
} from "@/app/lib/bookings";
import { db } from "@/app/lib/db";
import type { SessionRole, SessionUser } from "@/app/lib/session";
import {
  SlotError,
  createSlot,
  listUpcomingSlots,
  updateSlot,
} from "@/app/lib/slots";

import { testDatabaseName } from "./test-env";

const NOW = new Date("2099-05-01T00:00:00.000Z");
const FIXTURE_BASE = new Date("2099-05-02T00:00:00.000Z");
const PAST_STARTS_AT = new Date("2099-04-30T23:00:00.000Z");
const HORIZON_END = new Date(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
const SLOT_DURATION_MS = 60 * 60 * 1000;

const OWNER_EMAIL = "admin.owner@example.com";
const OTHER_EMAIL = "admin.other@example.com";
const ADMIN_EMAIL = "admin.slot-admin@example.com";
const SUPER_ADMIN_EMAIL = "admin.slot-super-admin@example.com";
const OWNER_DISPLAY_NAME = "Booking Owner";
const TEST_EMAILS = [
  OWNER_EMAIL,
  OTHER_EMAIL,
  ADMIN_EMAIL,
  SUPER_ADMIN_EMAIL,
] as const;

let owner: SessionUser;
let other: SessionUser;
let admin: SessionUser;
let superAdmin: SessionUser;
let nextHour = 0;

const createdSlotIds: string[] = [];

/** Создаёт пользователя тестовой базы и возвращает узкий объект сессии. */
async function createTestUser(
  email: string,
  role: SessionRole,
  displayName: string | null = null,
): Promise<SessionUser> {
  const user = await db.orm.public.User.select("id").create({
    email,
    passwordHash: `admin-test-hash:${email}`,
    displayName,
    role,
  });

  return { id: user.id, email, displayName, role };
}

/** Уникальное будущее окно фикстуры: не пересекается с другими тестами. */
function nextWindow(): Readonly<{ startsAt: Date; endsAt: Date }> {
  const startsAt = new Date(
    FIXTURE_BASE.getTime() + nextHour * SLOT_DURATION_MS,
  );
  nextHour += 1;
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + SLOT_DURATION_MS),
  };
}

/** Создаёт слот через проверяемую функцию и запоминает его для очистки. */
async function createManagedSlot(
  capacity = 1,
  startsAt?: Date,
): Promise<string> {
  const window = startsAt === undefined
    ? nextWindow()
    : {
        startsAt,
        endsAt: new Date(startsAt.getTime() + SLOT_DURATION_MS),
      };
  const slot = await createSlot(admin, { ...window, capacity }, NOW);
  createdSlotIds.push(slot.id);
  return slot.id;
}

/** Удаляет пользователей (каскадом — их данные) и созданные слоты. */
async function deleteFixtures(): Promise<void> {
  for (const email of TEST_EMAILS) {
    await db.orm.public.User.where({ email }).deleteAndCount();
  }
  for (const slotId of createdSlotIds) {
    await db.orm.public.Slot.where({ id: slotId }).deleteAndCount();
  }
  createdSlotIds.length = 0;
  nextHour = 0;
}

/** Проверяет доменный код ошибки слотов. */
async function expectSlotError(
  operation: Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(
      error instanceof SlotError,
      `ожидался SlotError, получено: ${String(error)}`,
    );
    assert.equal(error.code, code);
    return true;
  });
}

/** Проверяет доменный код ошибки броней. */
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

before(async () => {
  assert.ok(testDatabaseName.endsWith("_test"));
  await deleteFixtures();

  owner = await createTestUser(OWNER_EMAIL, "user", OWNER_DISPLAY_NAME);
  other = await createTestUser(OTHER_EMAIL, "user");
  admin = await createTestUser(ADMIN_EMAIL, "admin");
  superAdmin = await createTestUser(SUPER_ADMIN_EMAIL, "super_admin");
});

after(async () => {
  await deleteFixtures();
  // Клиент Prisma 8 держит пул соединений: без close() процесс не завершится.
  await db.close();
});

describe("Создание слота администратором (FR-29, CR-45)", () => {
  test("проверяет роль по базе, а не по объекту сессии", async () => {
    const staleActor: SessionUser = { ...owner, role: "admin" };

    await expectSlotError(
      createSlot(staleActor, { ...nextWindow(), capacity: 1 }, NOW),
      "FORBIDDEN",
    );
    await expectSlotError(
      createSlot(
        { ...admin, id: "user-that-does-not-exist" },
        { ...nextWindow(), capacity: 1 },
        NOW,
      ),
      "FORBIDDEN",
    );
  });

  test("admin и super_admin создают слот в горизонте", async () => {
    const window = nextWindow();
    const createdByAdmin = await createSlot(
      admin,
      { ...window, capacity: 2 },
      NOW,
    );
    createdSlotIds.push(createdByAdmin.id);

    assert.equal(createdByAdmin.capacity, 2);
    assert.equal(createdByAdmin.activeBookings, 0);
    assert.equal(createdByAdmin.availableCapacity, 2);
    assert.equal(createdByAdmin.startsAt.getTime(), window.startsAt.getTime());

    const secondWindow = nextWindow();
    const createdBySuperAdmin = await createSlot(
      superAdmin,
      { ...secondWindow, capacity: 1 },
      NOW,
    );
    createdSlotIds.push(createdBySuperAdmin.id);

    const slots = await listUpcomingSlots(NOW);
    const ids = new Set(slots.map((slot) => slot.id));
    assert.ok(ids.has(createdByAdmin.id));
    assert.ok(ids.has(createdBySuperAdmin.id));
  });

  test("отклоняет неверный интервал, вместимость, прошлое и горизонт", async () => {
    const window = nextWindow();

    await expectSlotError(
      createSlot(
        admin,
        {
          startsAt: window.startsAt,
          endsAt: window.startsAt,
          capacity: 1,
        },
        NOW,
      ),
      "INVALID_SLOT_INTERVAL",
    );

    await expectSlotError(
      createSlot(admin, { ...window, capacity: 0 }, NOW),
      "INVALID_SLOT_CAPACITY",
    );

    await expectSlotError(
      createSlot(
        admin,
        {
          startsAt: PAST_STARTS_AT,
          endsAt: new Date(PAST_STARTS_AT.getTime() + SLOT_DURATION_MS),
          capacity: 1,
        },
        NOW,
      ),
      "SLOT_IN_PAST",
    );

    await expectSlotError(
      createSlot(
        admin,
        {
          startsAt: HORIZON_END,
          endsAt: new Date(HORIZON_END.getTime() + SLOT_DURATION_MS),
          capacity: 1,
        },
        NOW,
      ),
      "SLOT_OUT_OF_HORIZON",
    );
  });

  test("не создаёт дубль пары startsAt + endsAt", async () => {
    const window = nextWindow();
    const slot = await createSlot(admin, { ...window, capacity: 1 }, NOW);
    createdSlotIds.push(slot.id);

    await expectSlotError(
      createSlot(admin, { ...window, capacity: 2 }, NOW),
      "SLOT_ALREADY_EXISTS",
    );
  });
});

describe("Изменение слота администратором (FR-29, CR-45)", () => {
  test("user не изменяет слот, неизвестный слот даёт SLOT_NOT_FOUND", async () => {
    const slotId = await createManagedSlot(1);
    const window = nextWindow();

    await expectSlotError(
      updateSlot(owner, slotId, { ...window, capacity: 2 }, NOW),
      "FORBIDDEN",
    );
    await expectSlotError(
      updateSlot(
        admin,
        "slot-that-does-not-exist",
        { ...window, capacity: 2 },
        NOW,
      ),
      "SLOT_NOT_FOUND",
    );
  });

  test("admin изменяет свободный слот", async () => {
    const slotId = await createManagedSlot(1);
    const window = nextWindow();

    const updated = await updateSlot(
      admin,
      slotId,
      { ...window, capacity: 3 },
      NOW,
    );

    assert.equal(updated.id, slotId);
    assert.equal(updated.capacity, 3);
    assert.equal(updated.startsAt.getTime(), window.startsAt.getTime());
    assert.equal(updated.endsAt.getTime(), window.endsAt.getTime());
    assert.equal(updated.availableCapacity, 3);
  });

  test("слот с активной бронью не изменяется, отменённая бронь не блокирует", async () => {
    const slotId = await createManagedSlot(2);
    const booking = await createBooking(owner, slotId, NOW);
    const window = nextWindow();

    await expectSlotError(
      updateSlot(admin, slotId, { ...window, capacity: 2 }, NOW),
      "SLOT_HAS_ACTIVE_BOOKINGS",
    );

    await db.orm.public.Booking
      .where({ id: booking.id })
      .select("id")
      .update({ status: "cancelled" });

    const updated = await updateSlot(
      admin,
      slotId,
      { ...window, capacity: 2 },
      NOW,
    );
    assert.equal(updated.startsAt.getTime(), window.startsAt.getTime());
  });
});

describe("Список всех броней (FR-33, CR-44, NFR-14)", () => {
  test("роль user не получает чужие брони", async () => {
    await expectBookingError(listAllBookings(owner, NOW), "FORBIDDEN");
  });

  test("admin видит все брони с email владельца и без служебных полей", async () => {
    const ownerSlotId = await createManagedSlot(2);
    const otherSlotId = await createManagedSlot(2);
    const ownerBooking = await createBooking(owner, ownerSlotId, NOW);
    const otherBooking = await createBooking(other, otherSlotId, NOW);

    const bookings = await listAllBookings(admin, NOW);
    const fixtures = bookings.filter(
      (booking) =>
        booking.id === ownerBooking.id || booking.id === otherBooking.id,
    );

    assert.equal(fixtures.length, 2);
    const emails = new Set(fixtures.map((booking) => booking.ownerEmail));
    assert.ok(emails.has(OWNER_EMAIL));
    assert.ok(emails.has(OTHER_EMAIL));

    for (const booking of fixtures) {
      assert.ok(!("passwordHash" in booking));
      assert.equal(booking.status, "pending");
      assert.equal(booking.isSlotUpcoming, true);
    }

    const byId = new Map(fixtures.map((booking) => [booking.id, booking]));
    const ownerFixture = byId.get(ownerBooking.id);
    const otherFixture = byId.get(otherBooking.id);
    assert.ok(ownerFixture !== undefined);
    assert.ok(otherFixture !== undefined);
    if (ownerFixture === undefined || otherFixture === undefined) {
      return;
    }

    assert.equal(ownerFixture.ownerId, owner.id);
    assert.equal(ownerFixture.ownerDisplayName, OWNER_DISPLAY_NAME);
    assert.equal(otherFixture.ownerId, other.id);
    assert.equal(otherFixture.ownerDisplayName, null);

    const asSuperAdmin = await listAllBookings(superAdmin, NOW);
    const superAdminIds = new Set(asSuperAdmin.map((booking) => booking.id));
    assert.ok(superAdminIds.has(ownerBooking.id));
    assert.ok(superAdminIds.has(otherBooking.id));
  });

  test("помечает начавшийся слот как isSlotUpcoming = false", async () => {
    const slotId = await createManagedSlot(
      1,
      new Date(NOW.getTime() + SLOT_DURATION_MS),
    );
    const booking = await createBooking(owner, slotId, NOW);
    const later = new Date(NOW.getTime() + 2 * SLOT_DURATION_MS);

    const bookings = await listAllBookings(admin, later);
    const found = bookings.find((item) => item.id === booking.id);

    assert.ok(found !== undefined);
    if (found === undefined) {
      return;
    }
    assert.equal(found.isSlotUpcoming, false);
  });
});

describe("Детализация брони администратором (FR-33, FR-37, NFR-20, NFR-22)", () => {
  test("user получает FORBIDDEN, неизвестный id — null", async () => {
    await expectBookingError(
      getAdminBooking(owner, "booking-that-does-not-exist"),
      "FORBIDDEN",
    );
    assert.equal(
      await getAdminBooking(admin, "booking-that-does-not-exist"),
      null,
    );
  });

  test("admin и super_admin получают владельца, слот, даты и статус", async () => {
    const slotId = await createManagedSlot(2);
    const booking = await createBooking(owner, slotId, NOW);
    const slot = (await listUpcomingSlots(NOW)).find(
      (item) => item.id === slotId,
    );
    assert.ok(slot !== undefined);
    if (slot === undefined) {
      return;
    }

    for (const actor of [admin, superAdmin]) {
      const detail = await getAdminBooking(actor, booking.id);
      assert.ok(detail !== null);
      if (detail === null) {
        return;
      }

      assert.equal(detail.id, booking.id);
      assert.equal(detail.ownerId, owner.id);
      assert.equal(detail.ownerEmail, OWNER_EMAIL);
      assert.equal(detail.ownerDisplayName, OWNER_DISPLAY_NAME);
      assert.equal(detail.status, "pending");
      assert.equal(detail.createdAt.getTime(), booking.createdAt.getTime());
      assert.equal(detail.confirmedAt, null);
      assert.equal(detail.cancelledAt, null);

      assert.equal(detail.slot.id, slotId);
      assert.equal(detail.slot.capacity, 2);
      assert.equal(detail.slot.startsAt.getTime(), slot.startsAt.getTime());
      assert.equal(detail.slot.endsAt.getTime(), slot.endsAt.getTime());
      assert.equal(detail.isSlotUpcoming, true);

      assert.ok(!("userId" in detail));
      assert.ok(!("passwordHash" in detail));
      assert.ok(!("tokenHash" in detail));
      assert.ok(!JSON.stringify(detail).includes("admin-test-hash"));
    }
  });

  test("cancelled возвращается с датой отмены", async () => {
    const slotId = await createManagedSlot(1);
    const booking = await createBooking(owner, slotId, NOW);
    const cancelledAt = new Date(NOW.getTime() + SLOT_DURATION_MS);

    await db.orm.public.Booking
      .where({ id: booking.id })
      .select("id")
      .update({ status: "cancelled", cancelledAt });

    const detail = await getAdminBooking(admin, booking.id);
    assert.ok(detail !== null);
    if (detail === null) {
      return;
    }

    assert.equal(detail.status, "cancelled");
    assert.equal(detail.confirmedAt, null);
    assert.ok(detail.cancelledAt !== null);
    if (detail.cancelledAt === null) {
      return;
    }
    assert.equal(detail.cancelledAt.getTime(), cancelledAt.getTime());
    assert.equal(detail.ownerId, owner.id);
    assert.equal(detail.ownerDisplayName, OWNER_DISPLAY_NAME);
  });
});


