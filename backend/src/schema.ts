// backend/src/schema.ts
import { pgTable, text, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// We keep tstzrange as a raw SQL data type. We'll use raw SQL in queries when needed.
const tstzrange = {
  dataType: () => 'tstzrange' as const,
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const regions = pgTable('regions', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(), // "kashiwa 001"
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subareas = pgTable(
  'subareas',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    regionId: uuid('region_id')
      .notNull()
      .references(() => regions.id, { onDelete: 'cascade' }),
    code: text('code').notNull(), // "001-1"
    name: text('name').notNull(),
    highlightImageUrl: text('highlight_image_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // ✅ use uniqueIndex instead of index(...).unique()
    regionCodeUnique: uniqueIndex('subareas_region_code_unique').on(t.regionId, t.code),
  }),
);

export const spots = pgTable(
  'spots',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    subareaId: uuid('subarea_id')
      .notNull()
      .references(() => subareas.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // ✅ use uniqueIndex instead of index(...).unique()
    subareaCodeUnique: uniqueIndex('spots_subarea_code_unique').on(t.subareaId, t.code),
  }),
);

// Keep status as text ('active' | 'cancelled'); the EXCLUDE overlap constraint
// is added via SQL migration (0002_constraints.sql).
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    spotId: uuid('spot_id')
      .notNull()
      .references(() => spots.id, { onDelete: 'cascade' }),
    // Stored as tstzrange; we write/read via raw SQL in routes.
    timeRange: text('time_range').notNull(),
    comment: text('comment'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // regular (non-unique) index is fine here
    spotStatusIdx: index('bookings_spot_status_idx').on(t.spotId, t.status),
  }),
);
