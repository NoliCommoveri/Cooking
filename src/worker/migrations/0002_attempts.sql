-- Phase 2b: cooks saved for every profile on them (plan §1, §8.4), and the
-- parents' one-time test-cook notice (§6.9).

-- One cook of one lesson. The id is made on the device that starts the cook, so
-- sending the same cook again (a retry after a dropped connection) updates it
-- instead of saving it twice. queue_id stays empty until the queue (Phase 3).
-- checklist_state is where the cook is up to: stage, step, and what's checked.
CREATE TABLE IF NOT EXISTS attempts (
  id              TEXT PRIMARY KEY,
  family_id       TEXT NOT NULL REFERENCES families(id),
  queue_id        TEXT,
  lesson_id       TEXT NOT NULL,
  lesson_version  INTEGER NOT NULL,
  servings        INTEGER NOT NULL,
  started_at      TEXT NOT NULL,
  finished_at     TEXT,
  checklist_state TEXT NOT NULL DEFAULT '{}',
  eater_rating    INTEGER
);
CREATE INDEX IF NOT EXISTS attempts_family ON attempts(family_id, lesson_id);

-- Every profile on the cook. rating and notes are each profile's own
-- reflection, written in the Reflect stage (Phase 4).
CREATE TABLE IF NOT EXISTS attempt_profiles (
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  rating     INTEGER,
  notes      TEXT,
  PRIMARY KEY (attempt_id, profile_id)
);
CREATE INDEX IF NOT EXISTS attempt_profiles_profile ON attempt_profiles(family_id, profile_id);

-- When this parent closed the "recipes may not be test-cooked" notice. Empty
-- means they haven't yet, so it shows.
ALTER TABLE parents ADD COLUMN notice_seen_at TEXT;
