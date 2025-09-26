-- Add a master flag to users allowing privileged booking actions
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT FALSE;

