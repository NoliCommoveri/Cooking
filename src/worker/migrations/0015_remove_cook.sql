-- A parent can take back a cook a kid marked done but didn't make (a test run
-- on the couch). removed_at is when; a removed cook counts for nothing, and
-- Undo clears it.
ALTER TABLE attempts ADD COLUMN removed_at TEXT;
