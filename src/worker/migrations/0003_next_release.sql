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

-- Phase 11c (plan §6.21): variations. Which version of a lesson the family
-- cooks ('' is the lesson itself), the version each cook was of, and the
-- version each lesson on a shopping list was bought for. A cook still counts
-- as its lesson; these only say which version. No REFERENCES on attempt_id or
-- list_id, so taking a cook or a list away never waits on these rows.
CREATE TABLE IF NOT EXISTS variation_choices (
  family_id  TEXT NOT NULL REFERENCES families(id),
  lesson_id  TEXT NOT NULL,
  variation  TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (family_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS attempt_variations (
  attempt_id TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id),
  variation  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS attempt_variations_family ON attempt_variations(family_id);

CREATE TABLE IF NOT EXISTS list_variations (
  list_id   TEXT NOT NULL,
  family_id TEXT NOT NULL REFERENCES families(id),
  position  INTEGER NOT NULL,
  variation TEXT NOT NULL,
  PRIMARY KEY (list_id, position)
);
CREATE INDEX IF NOT EXISTS list_variations_family ON list_variations(family_id);

-- Phase 11d3 (plan §6.21): what each profile's cooks have taught. Rebuilt for
-- a profile from all its finished cooks whenever a reflection on one is saved
-- (its own rating and half the eaters'), so a changed reflection is never
-- counted twice. kind: the cooked version's flavors, its protein, or the
-- lesson's cuisine. adjust: added to the score, -2 to 2. Cuisines are never
-- asked; they're only learned here.
CREATE TABLE IF NOT EXISTS taste_learned (
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('flavor', 'protein', 'cuisine')),
  item       TEXT NOT NULL,
  adjust     REAL NOT NULL,
  cooks      INTEGER NOT NULL,
  PRIMARY KEY (profile_id, kind, item)
);
CREATE INDEX IF NOT EXISTS taste_learned_family ON taste_learned(family_id);

-- Phase 12b (plan §12.4): which program a course is. No row is Cook Around
-- the World, so courses from before need nothing. program: a Level's id from
-- content/levels/ ('level-3'). No REFERENCES on course_id, like the tables
-- above, so nothing here waits on a course's own rows.
-- parts: a Level course's parts the parent kept on, as a JSON list of
-- 'drill', 'knowledge', 'sabbath'; NULL is all three.
CREATE TABLE IF NOT EXISTS course_programs (
  course_id  TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id),
  program    TEXT NOT NULL,
  parts      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS course_programs_family ON course_programs(family_id);

-- Phase 12c (plan §12.4): a Level week's drill, knowledge, and Sabbath task,
-- checked off per profile. week: the Level week (1 to 36); part: which page.
-- A parent's take back sets removed_at, and its Undo clears it; a row taken
-- back counts for nothing. Checking a part off again counts it again.
-- skipped: 1 when the part was skipped, not done: it's no longer open, and
-- counts for nothing. done_at is then when it was skipped.
CREATE TABLE IF NOT EXISTS level_tasks (
  family_id  TEXT NOT NULL REFERENCES families(id),
  course_id  TEXT NOT NULL,
  week       INTEGER NOT NULL,
  part       TEXT NOT NULL CHECK (part IN ('drill', 'knowledge', 'sabbath')),
  profile_id TEXT NOT NULL,
  done_at    TEXT NOT NULL,
  skipped    INTEGER NOT NULL DEFAULT 0,
  removed_at TEXT,
  PRIMARY KEY (course_id, week, part, profile_id)
);
CREATE INDEX IF NOT EXISTS level_tasks_family ON level_tasks(family_id, profile_id);

-- Phase 12c: a mastery week's "Why did it work?", one per profile on the
-- cook. Its own table, since the draft can't add a column to attempt_profiles.
CREATE TABLE IF NOT EXISTS mastery_notes (
  attempt_id TEXT NOT NULL,
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL,
  why        TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (attempt_id, profile_id)
);
CREATE INDEX IF NOT EXISTS mastery_notes_family ON mastery_notes(family_id);
