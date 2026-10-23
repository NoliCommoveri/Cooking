-- The kitchen intro (plan §6.9): when this profile finished or skipped it, so
-- it opens on its own only once. How it works in the kitchen replays it.
ALTER TABLE profiles ADD COLUMN intro_seen_at TEXT;
