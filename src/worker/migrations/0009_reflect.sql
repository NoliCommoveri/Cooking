-- Phase 4 (first part): the Reflect stage and the photos switch (plan §2.6, §3).

-- Photos are off unless the owner turns them on for a family, on /ops (§2.6).
ALTER TABLE families ADD COLUMN photos_enabled INTEGER NOT NULL DEFAULT 0;

-- Each profile's reflection on a cook: rating (1 to 5) and notes ("what would
-- you change next time?") are already on attempt_profiles; transfer is the
-- optional "what other dish could use this move?" (§3), and reflected_at when
-- it was saved. The eater rating is attempts.eater_rating.
ALTER TABLE attempt_profiles ADD COLUMN transfer TEXT;
ALTER TABLE attempt_profiles ADD COLUMN reflected_at TEXT;
