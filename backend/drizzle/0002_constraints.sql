-- Prevent overlapping ACTIVE bookings per spot
ALTER TABLE bookings
  ADD CONSTRAINT no_overlap_active_bookings
  EXCLUDE USING gist (
    spot_id WITH =,
    time_range WITH &&
  ) WHERE (status = 'active');
