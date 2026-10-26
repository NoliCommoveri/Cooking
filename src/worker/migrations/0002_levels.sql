-- Release 1, the Levels (§12.9): the build's draft migration (§8.6), edited in
-- place until the release launches. New tables only.

-- A family's request for a replacement for a Level week neither of whose
-- dishes it can cook with its settings (14c). reasons: the name-free codes
-- the owner's Recipe gaps page counts ("diet:meat", "tool:microwave").
CREATE TABLE IF NOT EXISTS level_requests (
  family_id  TEXT NOT NULL REFERENCES families(id),
  level      TEXT NOT NULL,
  week       INTEGER NOT NULL,
  reasons    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (family_id, level, week)
);

-- Cook this instead (14d): a Level week moved to its other dish, by a learner
-- (profile_id) or a parent (NULL). Its Undo puts back what the week had:
-- from_id, and whether the week had a parent's pick (from_changed). Swaps
-- are for the whole course. shop_done_at: the parent said they have what the
-- new dish needs, so its shopping notice goes.
CREATE TABLE IF NOT EXISTS level_swaps (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL REFERENCES families(id),
  course_id    TEXT NOT NULL,
  week         INTEGER NOT NULL,
  from_id      TEXT NOT NULL,
  to_id        TEXT NOT NULL,
  from_changed INTEGER NOT NULL DEFAULT 0,
  profile_id   TEXT,
  created_at   TEXT NOT NULL,
  undone_at    TEXT,
  shop_done_at TEXT
);
CREATE INDEX IF NOT EXISTS level_swaps_course ON level_swaps(course_id, week);

-- Step pictures (14e): a parent's pick, for one learner on a Level course, of
-- how the player shows a step's picture. shown: 1 under each step, 0 behind
-- Show me. Only a change from the Level's way has a row (Level 2 shows them;
-- Level 3 and 4 put them behind Show me).
CREATE TABLE IF NOT EXISTS course_pictures (
  course_id  TEXT NOT NULL,
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL,
  shown      INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (course_id, profile_id)
);

-- The portfolio (14f): what a learner types into a part page's writing boxes
-- (the capstone's menu, budget, guest list, prep timeline, and reflection
-- essay at Level 4), one row per box. field: the box's id, unique in its Level.
CREATE TABLE IF NOT EXISTS level_writing (
  course_id  TEXT NOT NULL,
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL,
  week       INTEGER NOT NULL,
  field      TEXT NOT NULL,
  body       TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (course_id, profile_id, week, field)
);
