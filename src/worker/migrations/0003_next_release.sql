-- The next release (plan §8.6): a draft, edited in place for the whole build.
-- It may only create new tables and indexes on them. Nothing it makes is used
-- until the Next release switch is on for a family. Press Apply pending on
-- /ops after the first deploy, and Re-apply draft after each edit to it.

-- Phase 11b (plan §6.21): each profile's star ratings, and the family's limits.
-- No REFERENCES on profile_id: a profile deleted before this draft is applied
-- would otherwise block the delete. A profile's ratings go when it does.
CREATE TABLE IF NOT EXISTS profile_ratings (
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('protein', 'flavor', 'ingredient')),
  item       TEXT NOT NULL,
  -- 5 absolute favorite, 4 love, 3 like, 2 okay, 1 hate; NULL is Haven't tried.
  stars      INTEGER CHECK (stars BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, kind, item)
);
CREATE INDEX IF NOT EXISTS profile_ratings_family ON profile_ratings(family_id);

CREATE TABLE IF NOT EXISTS family_limits (
  family_id     TEXT PRIMARY KEY REFERENCES families(id),
  max_minutes   INTEGER,
  budget        TEXT CHECK (budget IN ('$', '$$', '$$$')),
  missing_tools TEXT NOT NULL DEFAULT '[]',
  adventurous   TEXT CHECK (adventurous IN ('familiar', 'a-bit', 'adventurous')),
  updated_at    TEXT NOT NULL
);
