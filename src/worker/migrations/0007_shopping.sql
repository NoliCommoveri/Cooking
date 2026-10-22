-- Phase 3b: shopping trips and the pantry (plan §6.3, §8.4).

-- A trip holds the lessons picked for it and its own check-offs, so changing
-- the queue mid-shop doesn't scramble the list. End trip marks its lessons
-- shopped; Cancel sets cancelled_at. Either can be undone (Reopen).
-- perish_days: perishables show only for lessons planned within this many days.
CREATE TABLE IF NOT EXISTS shopping_trips (
  id           TEXT PRIMARY KEY,
  family_id    TEXT NOT NULL REFERENCES families(id),
  created_at   TEXT NOT NULL,
  ended_at     TEXT,
  cancelled_at TEXT,
  perish_days  INTEGER NOT NULL DEFAULT 7
);
CREATE INDEX IF NOT EXISTS shopping_trips_family ON shopping_trips(family_id, created_at);

-- The queued lessons on a trip, with the serving count shopped for, so the
-- lesson card can say "You shopped for 6" if it changes later (§6.6).
CREATE TABLE IF NOT EXISTS trip_lessons (
  trip_id   TEXT NOT NULL REFERENCES shopping_trips(id),
  family_id TEXT NOT NULL REFERENCES families(id),
  queue_id  TEXT NOT NULL REFERENCES queue(id),
  servings  INTEGER NOT NULL,
  PRIMARY KEY (trip_id, queue_id)
);

CREATE TABLE IF NOT EXISTS shopping_checks (
  trip_id       TEXT NOT NULL REFERENCES shopping_trips(id),
  family_id     TEXT NOT NULL REFERENCES families(id),
  ingredient_id TEXT NOT NULL,
  checked       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (trip_id, ingredient_id)
);

-- Ingredients this family always has; they drop to "You should have".
CREATE TABLE IF NOT EXISTS pantry (
  family_id     TEXT NOT NULL REFERENCES families(id),
  ingredient_id TEXT NOT NULL,
  PRIMARY KEY (family_id, ingredient_id)
);
