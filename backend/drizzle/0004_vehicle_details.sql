DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'use_type') THEN
    CREATE TYPE use_type AS ENUM ('private', 'commercial');
  END IF;
END $$;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS vehicle_registration_location TEXT,
  ADD COLUMN IF NOT EXISTS classification_number TEXT,
  ADD COLUMN IF NOT EXISTS license_plate_info TEXT,
  ADD COLUMN IF NOT EXISTS use_type use_type;
