-- Enable needed extension for our EXCLUDE constraint (prevents overlapping bookings).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Regions (e.g., "kashiwa 001", "kashiwa 002")
CREATE TABLE IF NOT EXISTS regions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,     -- e.g., "kashiwa 001"
  name        TEXT NOT NULL,            -- display name
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subareas (e.g., "001-1", "001-2"), each belongs to a region
CREATE TABLE IF NOT EXISTS subareas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,            -- e.g., "001-1"
  name        TEXT NOT NULL,
  highlight_image_url TEXT,             -- optional image for highlight
  UNIQUE(region_id, code),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parking spots under a subarea
CREATE TABLE IF NOT EXISTS spots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subarea_id  UUID NOT NULL REFERENCES subareas(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,            -- human-friendly code for the spot, e.g., "A-01"
  description TEXT,
  UNIQUE(subarea_id, code),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

Bookings: use tstzrange to represent [start, end)
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spot_id     UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  time_range  TSTZRANGE NOT NULL,       -- [start, end)
  comment     TEXT,
  status      TEXT NOT NULL DEFAULT 'active', -- 'active' | 'cancelled'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);



-- Prevent overlapping active bookings per spot:
-- two ranges overlap if && is true. We exclude overlap when status = 'active'.
CREATE INDEX IF NOT EXISTS bookings_spot_status_idx ON bookings (spot_id, status);
ALTER TABLE bookings
  ADD CONSTRAINT no_overlap_active_bookings
  EXCLUDE USING gist (
    spot_id WITH =,
    time_range WITH &&
  ) WHERE (status = 'active');


