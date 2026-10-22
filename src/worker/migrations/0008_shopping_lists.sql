-- Shopping is optional (owner, 2026-10-22): a parent makes a list for the
-- next few uncooked lessons when they want one, and nothing waits on it. The
-- trips from 0007 tied a list to queued lessons and a week; no family had used
-- them, so their tables are replaced. The pantry (kitchen staples) stays.
DROP TABLE IF EXISTS shopping_checks;
DROP TABLE IF EXISTS trip_lessons;
DROP TABLE IF EXISTS shopping_trips;

-- A list a parent made. done_at: Done shopping (optional). deleted_at: Delete,
-- which Undo reverses.
CREATE TABLE IF NOT EXISTS shopping_lists (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id),
  created_at TEXT NOT NULL,
  done_at    TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS shopping_lists_family ON shopping_lists(family_id, created_at);

-- The lessons the list is for, as they were when it was made: each at its
-- serving count, with its queued lesson or its course, so the lesson card can
-- say "You shopped for 6" if the count changes later (§6.6).
CREATE TABLE IF NOT EXISTS list_lessons (
  list_id   TEXT NOT NULL REFERENCES shopping_lists(id),
  family_id TEXT NOT NULL REFERENCES families(id),
  position  INTEGER NOT NULL,
  lesson_id TEXT NOT NULL,
  servings  INTEGER NOT NULL,
  queue_id  TEXT,
  course_id TEXT,
  PRIMARY KEY (list_id, position)
);

-- What the parent said they have on hand: left off this list only.
CREATE TABLE IF NOT EXISTS list_on_hand (
  list_id       TEXT NOT NULL REFERENCES shopping_lists(id),
  family_id     TEXT NOT NULL REFERENCES families(id),
  ingredient_id TEXT NOT NULL,
  PRIMARY KEY (list_id, ingredient_id)
);

-- Check-offs in the store.
CREATE TABLE IF NOT EXISTS list_checks (
  list_id       TEXT NOT NULL REFERENCES shopping_lists(id),
  family_id     TEXT NOT NULL REFERENCES families(id),
  ingredient_id TEXT NOT NULL,
  PRIMARY KEY (list_id, ingredient_id)
);
