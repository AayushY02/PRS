// backend/src/schema.ts
import { pgTable, text, timestamp, uuid, index, uniqueIndex, pgEnum, varchar, integer, unique, customType, jsonb } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
type GJ = any;
export const directionEnum = pgEnum('direction', ['north', 'south']);

// We keep tstzrange as a raw SQL data type. We'll use raw SQL in queries when needed.
const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tstzrange';
  },
});
export const vehicleTypeEnum = pgEnum('vehicle_type', ['normal', 'large', 'other']);


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
  centerline: jsonb('centerline').$type<GJ | null>().default(null),
  geom: jsonb('geom').$type<GJ | null>().default(null),
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
    geom: jsonb('geom').$type<GJ | null>().default(null),
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
    geom: jsonb('geom').$type<GJ | null>().default(null),
  },
  (t) => ({
    // ✅ use uniqueIndex instead of index(...).unique()
    subareaCodeUnique: uniqueIndex('spots_subarea_code_unique').on(t.subareaId, t.code),
  }),
);


export const subSpots = pgTable('sub_spots', {
  id: uuid('id').defaultRandom().primaryKey(),
  spotId: uuid('spot_id').notNull().references(() => spots.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 64 }).notNull(),         // e.g., S-12-A / “01-3”
  idx: integer('idx').notNull(),                           // 1..N (order inside spot)
  geom: jsonb('geom').$type<GJ | null>().default(null),
}, (t) => ({
  uniqPerSpot: unique().on(t.spotId, t.idx),
  uniqCode: unique().on(t.code),
}));


// Keep status as text ('active' | 'cancelled'); the EXCLUDE overlap constraint
// is added via SQL migration (0002_constraints.sql).
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  // CHANGED: link to sub-spot instead of “spot”
  subSpotId: uuid('sub_spot_id').notNull().references(() => subSpots.id, { onDelete: 'cascade' }),
  direction: directionEnum('direction'),
  // time range: [start, end) — end open while active; you already use tstzrange in UI
  // timeRange: ("time_range").notNull(),
  timeRange: tstzrange('time_range').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  comment: text('comment'),

  // NEW:
  vehicleType: vehicleTypeEnum('vehicle_type').notNull().default('normal'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});


export const subSpotsRelations = relations(subSpots, ({ one, many }) => ({
  spot: one(spots, { fields: [subSpots.spotId], references: [spots.id] }),
  bookings: many(bookings),
}));
