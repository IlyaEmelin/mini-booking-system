// Автотесты серверного слоя слотов (FR-22, CR-35).
//
// Прогон идёт по отдельной тестовой базе: `tests/test-env.ts` подключается
// первым и проверяет, что имя базы оканчивается на `_test`. Тестовые строки
// удаляются до и после прогона, поэтому повторный `npm test` не требует ручной
// очистки. Даты зафиксированы в 2099 году: слоты seed (2026) не попадают в
// проверяемое окно и не влияют на сортировку.

import "./test-env";

import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { db } from "@/app/lib/db";
import { getSlotAvailability, listUpcomingSlots } from "@/app/lib/slots";

import { testDatabaseName } from "./test-env";

/** Момент, относительно которого проверяется будущее слотов. */
const NOW = new Date("2099-01-01T00:00:00.000Z");

/** Прошедший слот: заканчивается ровно в `NOW`, поэтому в список не входит. */
const PAST_STARTS_AT = new Date("2098-12-31T23:00:00.000Z");

/** Первый будущий слот: две активные брони при вместимости 2. */
const FIRST_STARTS_AT = new Date("2099-01-01T01:00:00.000Z");

/** Второй будущий слот: единственная бронь отменена и не занимает место. */
const SECOND_STARTS_AT = new Date("2099-01-01T02:00:00.000Z");

const SLOT_DURATION_MS = 60 * 60 * 1000;

const OWNER_EMAIL = "slots.owner@example.com";
const OTHER_EMAIL = "slots.other@example.com";
const TEST_EMAILS = [OWNER_EMAIL, OTHER_EMAIL] as const;
const TEST_STARTS_AT = [
  PAST_STARTS_AT,
  FIRST_STARTS_AT,
  SECOND_STARTS_AT,
] as const;

type Fixture = Readonly<{
  pastSlotId: string;
  firstSlotId: string;
  secondSlotId: string;
}>;

let fixture: Fixture;

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

  const owner = await db.orm.public.User.select("id").create({
    email: OWNER_EMAIL,
    passwordHash: "slots-test-owner-password-hash",
  });
  const other = await db.orm.public.User.select("id").create({
    email: OTHER_EMAIL,
    passwordHash: "slots-test-other-password-hash",
  });

  // Создаём в обратном порядке, чтобы проверить сортировку по `startsAt`.
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
  };
});

after(async () => {
  await deleteFixtures();
  // Клиент Prisma 8 держит пул соединений: без close() процесс не завершится.
  await db.close();
});

describe("Список будущих слотов (FR-22, CR-35)", () => {
  test("возвращает только будущие слоты по возрастанию startsAt", async () => {
    const slots = await listUpcomingSlots(NOW);
    const fixtureIds = new Set([
      fixture.pastSlotId,
      fixture.firstSlotId,
      fixture.secondSlotId,
    ]);
    const fixtureSlots = slots.filter((slot) => fixtureIds.has(slot.id));

    assert.deepEqual(
      fixtureSlots.map((slot) => slot.id),
      [fixture.firstSlotId, fixture.secondSlotId],
    );
    assert.ok(
      !fixtureSlots.some((slot) => slot.id === fixture.pastSlotId),
      "прошедший слот не должен попадать в список",
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
