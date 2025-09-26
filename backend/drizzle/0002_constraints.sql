-- Prevent overlapping ACTIVE bookings per spot/sub-spot (idempotent across schemas)
DO $$
BEGIN
  -- Newer schema using sub_spot_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'sub_spot_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'no_overlap_active_bookings_subspot'
    ) THEN
      ALTER TABLE bookings
        ADD CONSTRAINT no_overlap_active_bookings_subspot
        EXCLUDE USING gist (
          sub_spot_id WITH =,
          time_range WITH &&
        ) WHERE (status = 'active');
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'spot_id'
  ) THEN
    -- Legacy schema using spot_id
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'no_overlap_active_bookings'
    ) THEN
      ALTER TABLE bookings
        ADD CONSTRAINT no_overlap_active_bookings
        EXCLUDE USING gist (
          spot_id WITH =,
          time_range WITH &&
        ) WHERE (status = 'active');
    END IF;
  END IF;
END $$;
