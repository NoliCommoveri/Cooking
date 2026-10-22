-- Phase 2e: fix requests and lesson patches (plan §6.11, §8.4).

-- What a family reports is wrong in a lesson, with what it should say instead.
-- field is a patch field path (src/content/patch.js), or empty for "something
-- else". current_value and suggested_value are JSON, so a number stays a number.
-- patch_id has no foreign key: patches belong to the whole app and outlive a
-- removed family, and a family restored later still points at its patch.
CREATE TABLE IF NOT EXISTS fix_requests (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES families(id),
  reporter_parent_id  TEXT NOT NULL,
  reporter_profile_id TEXT,
  lesson_id           TEXT NOT NULL,
  lesson_version      INTEGER NOT NULL,
  step                TEXT,
  servings            INTEGER,
  kind                TEXT NOT NULL CHECK (kind IN ('amount', 'unclear', 'safety', 'unclean', 'other')),
  field               TEXT,
  current_value       TEXT,
  suggested_value     TEXT,
  note                TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'declined', 'duplicate', 'needs_content_change')),
  owner_reply         TEXT,
  patch_id            TEXT,
  closed_at           TEXT
);
CREATE INDEX IF NOT EXISTS fix_requests_family ON fix_requests(family_id, lesson_id);
CREATE INDEX IF NOT EXISTS fix_requests_status ON fix_requests(status, created_at);

-- A fix applied to the shared library, on top of the lesson files. No
-- family_id: it applies to every family. old_value and new_value are JSON.
-- Live patches are the ones not reverted, applied in applied_at order. A
-- lesson's version is its file's version plus one for each apply and each
-- revert, so a cook records exactly what was cooked.
CREATE TABLE IF NOT EXISTS lesson_patches (
  id             TEXT PRIMARY KEY,
  lesson_id      TEXT NOT NULL,
  base_version   INTEGER NOT NULL,
  field_path     TEXT NOT NULL,
  old_value      TEXT,
  new_value      TEXT,
  fix_request_id TEXT,
  applied_by     TEXT NOT NULL,
  applied_at     TEXT NOT NULL,
  reverted_at    TEXT
);
CREATE INDEX IF NOT EXISTS lesson_patches_lesson ON lesson_patches(lesson_id, applied_at);
