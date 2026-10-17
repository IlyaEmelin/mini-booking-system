#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/2c4bfddba6e6cf4f8fd2fece4f6a4b1371219e6161dc2efd554bf40b48ef27ad/contract';
import endContract from '../../snapshots/2c4bfddba6e6cf4f8fd2fece4f6a4b1371219e6161dc2efd554bf40b48ef27ad/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e4cd2105195ac3c1d6c623657ca70f1f90d4b923f955e9d22ab9aa2284b9bd2b/contract';
import startContract from '../../snapshots/e4cd2105195ac3c1d6c623657ca70f1f90d4b923f955e9d22ab9aa2284b9bd2b/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Booking',
        columns: [
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slotId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Booking_status_check_2ea04269',
            sql`"status" IN ('pending', 'confirmed', 'cancelled')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Notification',
        columns: [
          col('bookingId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('message', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('readAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-date@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Notification_type_check_fb86c23a',
            sql`"type" IN ('booking_created', 'booking_confirmed', 'booking_cancelled')`,
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Slot',
        columns: [
          col('capacity', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('endsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('startsAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-date@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Slot_capacity_positive_a3711091', sql`"capacity" > 0`),
          checkExpression('Slot_endsAt_after_startsAt_20c1ac54', sql`"endsAt" > "startsAt"`),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Slot',
        constraint: 'Slot_startsAt_endsAt_key',
        columns: ['startsAt', 'endsAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_active_user_slot_key_b8a2666e',
        columns: ['userId', 'slotId'],
        extras: { where: sql`status IN ('pending', 'confirmed')`, unique: true },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_slotId_idx_4d7c6bc9',
        columns: ['slotId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_slotId_status_idx_f2571da7',
        columns: ['slotId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Notification',
        index: 'Notification_userId_readAt_idx_8bd92969',
        columns: ['userId', 'readAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Slot',
        index: 'Slot_startsAt_idx_5ff0df68',
        columns: ['startsAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_slotId_fkey',
          columns: ['slotId'],
          references: { schema: 'public', table: 'Slot', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Notification',
        foreignKey: {
          name: 'Notification_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'public', table: 'Booking', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
