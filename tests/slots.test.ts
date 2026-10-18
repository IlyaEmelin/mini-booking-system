// Автотесты серверного слоя слотов (FR-22, FR-29, NFR-17, CR-35).
//
// Прогон идёт по отдельной тестовой базе: `tests/test-env.ts` подключается
// первым и проверяет, что имя базы оканчивается на `_test`. Тестовые строки
// удаляются до и после прогона, поэтому повторный `npm test` не требует ручной
// очистки. Даты зафиксированы в 2099 году: слоты seed (2026) не попадают в
// проверяемое окно и не влияют на сортировку. Граница горизонта проверяется
// отдельными слотами: последний день входит в список, начало следующего — нет.

import "./test-env";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { db } from "@/app/lib/db";
import type { SessionRole, SessionUser } from "@/app/lib/session";
import {
  getSlotAvailability,
  listUpcomingSchedule,
  listUpcomingSlots,
} from "@/app/lib/slots";

import { testDatabaseName } from "./test-env";

/** Момент, относительно которого проверяется будущее слотов. */
const NOW = new Date("2099-01-01T00:00:00.000Z");

/** Прошедший слот: заканчивается ровно в `NOW`, поэтому в список не входит. */
const PAST_STARTS_AT = new Date("2098-12-31T23:00:00.000Z");

/** Первый будущий слот: две активные брони при вместимости 2. */
const FIRST_STARTS_AT = new Date("2099-01-01T01:00:00.000Z");

/** Второй будущий слот: единственная бронь отменена и не занимает место. */
const SECOND_STARTS_AT = new Date("2099-01-01T02:00:00.000Z");

/** За секунду до границы горизонта: 8 января, 00:00 UTC минус 1 с — входит. */
const LAST_DAY_STARTS_AT = new Date("2099-01-07T23:59:59.000Z");

/** Ровно граница горизонта: 8 января, 00:00 UTC — слот уже не входит. */
const AFTER_HORIZON_STARTS_AT = new Date("2099-01-08T00:00:00.000Z");

const SLOT_DURATION_MS = 60 * 60 * 1000;

const OWNER_EMAIL = "slots.owner@example.com";
const OTHER_EMAIL = "slots.other@example.com";
const ADMIN_EMAIL = "slots.admin@example.com";
const SUPER_ADMIN_EMAIL = "slots.super-admin@example.com";
const TEST_EMAILS = [
  OWNER_EMAIL,
  OTHER_EMAIL,
  ADMIN_EMAIL,
  SUPER_ADMIN_EMAIL,
] as const;
const TEST_STARTS_AT = [
  PAST_STARTS_AT,
  FIRST_STARTS_AT,
  SECOND_STARTS_AT,
  LAST_DAY_STARTS_AT,
  AFTER_HORIZON_STARTS_AT,
] as const;

type Fixture = Readonly<{
  pastSlotId: string;
  firstSlotId: string;
  secondSlotId: string;
  lastDaySlotId: string;
  afterHorizonSlotId: string;
}>;

let fixture: Fixture;
let owner: SessionUser;
let other: SessionUser;
let admin: SessionUser;
let superAdmin: SessionUser;

/** Создаёт пользователя тестовой базы и возвращает узкий объект сессии. */
async function createTestUser(
  email: string,
  role: SessionRole,
): Promise<SessionUser> {
  const user = await db.orm.public.User.select("id").create({
    email,
    passwordHash: `slots-test-hash:${email}`,
    role,
  });

  return { id: user.id, email, displayName: null, role };
}

/** Удаляет пользователей (каскадом — их брони) и слоты тестового окна. */
async function deleteFixtures(): Promise<void> {
  for (const email of TEST_EMAILS) {
    await db.orm.public.User.where({ email }).deleteAndCount();
  }

  for (const startsAt of TEST_STARTS_AT) {
    await db.orm.public.Slot.where({ startsAt }).deleteAndCount();
  }
}

/** Создаёт слот на час, начиная с указанного момента. */
async function createSlot(
  startsAt: Date,
  capacity: number,
): Promise<string> {
  const slot = await db.orm.public.Slot.select("id").create({
    startsAt,
    endsAt: new Date(startsAt.getTime() + SLOT_DURATION_MS),
    capacity,
  });
  return slot.id;
}

/** Создаёт бронь указанного статуса напрямую: проверяется чтение, не запись. */
async function createBooking(
  userId: string,
  slotId: string,
  status: "pending" | "confirmed" | "cancelled",
): Promise<void> {
  await db.orm.public.Booking.select("id").create({ userId, slotId, status });
}

before(async () => {
  assert.ok(testDatabaseName.endsWith("_test"));
  await deleteFixtures();

  owner = await createTestUser(OWNER_EMAIL, "user");
  other = await createTestUser(OTHER_EMAIL, "user");
  admin = await createTestUser(ADMIN_EMAIL, "admin");
  superAdmin = await createTestUser(SUPER_ADMIN_EMAIL, "super_admin");

  // Создаём в обратном порядке, чтобы проверить сортировку по `startsAt`.
  const afterHorizonSlotId = await createSlot(AFTER_HORIZON_STARTS_AT, 1);
  const lastDaySlotId = await createSlot(LAST_DAY_STARTS_AT, 1);
  const secondSlotId = await createSlot(SECOND_STARTS_AT, 1);
  const firstSlotId = await createSlot(FIRST_STARTS_AT, 2);
  const pastSlotId = await createSlot(PAST_STARTS_AT, 1);

  await createBooking(owner.id, firstSlotId, "pending");
  await createBooking(other.id, firstSlotId, "confirmed");
  await createBooking(owner.id, secondSlotId, "cancelled");
  await createBooking(owner.id, pastSlotId, "pending");

  fixture = {
    pastSlotId,
    firstSlotId,
    secondSlotId,
    lastDaySlotId,
    afterHorizonSlotId,
  };
});

after(async () => {
  await deleteFixtures();
  // Клиент Prisma 8 держит пул соединений: без close() процесс не завершится.
  await db.close();
});

describe("Список будущих слотов (FR-22, FR-29, NFR-17, CR-35)", () => {
  test("возвращает только будущие слоты по возрастанию startsAt", async () => {
    const slots = await listUpcomingSlots(NOW);
    const fixtureIds = new Set([
      fixture.pastSlotId,
      fixture.firstSlotId,
      fixture.secondSlotId,
      fixture.lastDaySlotId,
      fixture.afterHorizonSlotId,
    ]);
    const fixtureSlots = slots.filter((slot) => fixtureIds.has(slot.id));

    assert.deepEqual(
      fixtureSlots.map((slot) => slot.id),
      [fixture.firstSlotId, fixture.secondSlotId, fixture.lastDaySlotId],
    );
    assert.ok(
      !fixtureSlots.some((slot) => slot.id === fixture.pastSlotId),
      "прошедший слот не должен попадать в список",
    );
    assert.ok(
      !fixtureSlots.some((slot) => slot.id === fixture.afterHorizonSlotId),
      "слот за границей горизонта не должен попадать в список",
    );

    const startsAtValues = slots.map((slot) => slot.startsAt.getTime());
    assert.deepEqual(
      startsAtValues,
      [...startsAtValues].sort((left, right) => left - right),
    );
    assert.ok(
      slots.every((slot) => slot.isUpcoming),
      "все слоты списка должны начинаться после now",
    );
  });

  test("включает слот перед границей горизонта и исключает слот на границе", async () => {
    const slots = await listUpcomingSlots(NOW);
    const ids = new Set(slots.map((slot) => slot.id));

    assert.equal(
      ids.has(fixture.lastDaySlotId),
      true,
      "слот последнего дня горизонта должен остаться в списке",
    );
    assert.equal(
      ids.has(fixture.afterHorizonSlotId),
      false,
      "слот, начинающийся после горизонта, не должен попадать в список",
    );
  });

  test("считает активные брони и остаток вместимости", async () => {
    const slots = await listUpcomingSlots(NOW);
    const first = slots.find((slot) => slot.id === fixture.firstSlotId);
    const second = slots.find((slot) => slot.id === fixture.secondSlotId);

    assert.ok(first !== undefined);
    assert.ok(second !== undefined);
    if (first === undefined || second === undefined) {
      return;
    }

    // `pending` + `confirmed` занимают оба места.
    assert.equal(first.activeBookings, 2);
    assert.equal(first.availableCapacity, 0);
    // Отменённая бронь не занимает вместимость.
    assert.equal(second.activeBookings, 0);
    assert.equal(second.availableCapacity, 1);
  });
});

describe("Ролевой DTO расписания (FR-34…FR-36, NFR-20)", () => {
  test("guest и user получают публичный DTO без данных владельцев", async () => {
    const guestSchedule = await listUpcomingSchedule(null, NOW);
    const userSchedule = await listUpcomingSchedule(owner, NOW);
    const staleAdminSchedule = await listUpcomingSchedule(
      { ...owner, role: "admin" },
      NOW,
    );

    for (const schedule of [
      guestSchedule,
      userSchedule,
      staleAdminSchedule,
    ]) {
      assert.equal(schedule.visibility, "public");
      const serialized = JSON.stringify(schedule);
      assert.ok(!serialized.includes(OWNER_EMAIL));
      assert.ok(!serialized.includes(OTHER_EMAIL));
      assert.ok(!serialized.includes(owner.id));
      assert.ok(!serialized.includes(other.id));
      assert.ok(!serialized.includes("activeBookingDetails"));
      assert.ok(!serialized.includes("ownerId"));
      assert.ok(!serialized.includes("ownerEmail"));
      assert.ok(!serialized.includes("ownerDisplayName"));
    }

    const secondSlot = guestSchedule.slots.find(
      (slot) => slot.id === fixture.secondSlotId,
    );
    assert.ok(secondSlot !== undefined);
    if (secondSlot === undefined) {
      return;
    }

    // Отменённая бронь не занимает место и не раскрывает владельца.
    assert.equal(secondSlot.activeBookings, 0);
    assert.equal(secondSlot.availableCapacity, 1);
  });

  test("admin и super_admin получают активные брони с владельцем", async () => {
    for (const viewer of [admin, superAdmin]) {
      const schedule = await listUpcomingSchedule(viewer, NOW);
      assert.equal(schedule.visibility, "admin");
      if (schedule.visibility !== "admin") {
        return;
      }

      const firstSlot = schedule.slots.find(
        (slot) => slot.id === fixture.firstSlotId,
      );
      const secondSlot = schedule.slots.find(
        (slot) => slot.id === fixture.secondSlotId,
      );
      assert.ok(firstSlot !== undefined);
      assert.ok(secondSlot !== undefined);
      if (firstSlot === undefined || secondSlot === undefined) {
        return;
      }

      assert.equal(firstSlot.activeBookings, 2);
      assert.equal(firstSlot.availableCapacity, 0);
      assert.equal(firstSlot.activeBookingDetails.length, 2);

      const ownerDetails = firstSlot.activeBookingDetails.find(
        (booking) => booking.ownerEmail === OWNER_EMAIL,
      );
      const otherDetails = firstSlot.activeBookingDetails.find(
        (booking) => booking.ownerEmail === OTHER_EMAIL,
      );
      assert.ok(ownerDetails !== undefined);
      assert.ok(otherDetails !== undefined);
      if (ownerDetails === undefined || otherDetails === undefined) {
        return;
      }

      assert.equal(ownerDetails.ownerId, owner.id);
      assert.equal(ownerDetails.ownerDisplayName, null);
      assert.equal(ownerDetails.status, "pending");
      assert.equal(otherDetails.status, "confirmed");
      assert.ok(ownerDetails.bookingId.length > 0);
      assert.ok(!("userId" in ownerDetails));
      assert.ok(!("passwordHash" in ownerDetails));
      assert.ok(!("tokenHash" in ownerDetails));

      // `cancelled` не попадает в административный DTO расписания.
      assert.equal(secondSlot.activeBookings, 0);
      assert.equal(secondSlot.activeBookingDetails.length, 0);
    }
  });

  test("сохраняет горизонт, сортировку и неотрицательный остаток", async () => {
    const publicSchedule = await listUpcomingSchedule(null, NOW);
    const adminSchedule = await listUpcomingSchedule(admin, NOW);

    for (const slots of [publicSchedule.slots, adminSchedule.slots]) {
      const fixtureIds = new Set([
        fixture.pastSlotId,
        fixture.firstSlotId,
        fixture.secondSlotId,
        fixture.lastDaySlotId,
        fixture.afterHorizonSlotId,
      ]);
      const fixtureSlots = slots.filter((slot) => fixtureIds.has(slot.id));

      assert.deepEqual(
        fixtureSlots.map((slot) => slot.id),
        [fixture.firstSlotId, fixture.secondSlotId, fixture.lastDaySlotId],
      );
      assert.ok(
        slots.every((slot) => slot.availableCapacity >= 0),
        "свободная вместимость не должна быть отрицательной",
      );

      const startsAtValues = slots.map((slot) => slot.startsAt.getTime());
      assert.deepEqual(
        startsAtValues,
        [...startsAtValues].sort((left, right) => left - right),
      );
    }
  });
});

describe("Доступность одного слота (FR-22, CR-35)", () => {
  test("возвращает слот, активные брони и остаток вместимости", async () => {
    const availability = await getSlotAvailability(fixture.firstSlotId, NOW);

    assert.ok(availability !== null);
    if (availability === null) {
      return;
    }

    assert.equal(availability.id, fixture.firstSlotId);
    assert.equal(availability.capacity, 2);
    assert.equal(availability.activeBookings, 2);
    assert.equal(availability.availableCapacity, 0);
    assert.equal(availability.isUpcoming, true);
    assert.equal(availability.startsAt.getTime(), FIRST_STARTS_AT.getTime());
    assert.equal(
      availability.endsAt.getTime(),
      FIRST_STARTS_AT.getTime() + SLOT_DURATION_MS,
    );
  });

  test("помечает существующий прошедший слот как isUpcoming = false", async () => {
    const availability = await getSlotAvailability(fixture.pastSlotId, NOW);

    assert.ok(availability !== null);
    if (availability === null) {
      return;
    }

    assert.equal(availability.isUpcoming, false);
  });

  test("возвращает null для неизвестного слота", async () => {
    const availability = await getSlotAvailability(
      "slot-that-does-not-exist",
      NOW,
    );

    assert.equal(availability, null);
  });
});
