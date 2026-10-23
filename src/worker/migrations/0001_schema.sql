-- The whole app schema in one file (plan §8.4). The seventeen migrations it
-- replaces were squashed on 2026-10-23, when the database was cleared and
-- started fresh (docs/build-log.md). Lessons, ingredients, and the other
-- lists are content files in the repo (plan §7), not tables here.
--
-- Ids are random text, not counters, so one family's rows can be put back
-- (Restore a family on /ops) without colliding with rows made since.
-- Every table holding a family's data carries family_id.

-- ---------- families, parents, sign-in ----------

-- mode: casual or homeschool (§6.17). plan_weeks is Plan our weeks in casual
-- mode; homeschool mode always plans weeks. voice_enabled (§6.12) is off until
-- a parent turns it on, because the browser usually sends what the mic hears
-- to Google. photos_enabled is set only from /ops (§2.6). setup_step is the
-- last part of Chef Ruth's Getting started a family finished (§6.9), and
-- setup_done_at when it was all done.
CREATE TABLE IF NOT EXISTS families (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL DEFAULT '',      -- set in the first run
  default_servings INTEGER NOT NULL DEFAULT 6,
  diet_filters     TEXT NOT NULL DEFAULT '[]',   -- JSON list of diet tags (§2.1)
  parent_pin_hash  TEXT,                         -- null until the first run sets it
  created_at       TEXT NOT NULL,
  last_active_at   TEXT,
  voice_enabled    INTEGER NOT NULL DEFAULT 0,
  mode             TEXT NOT NULL DEFAULT 'casual' CHECK (mode IN ('casual', 'homeschool')),
  plan_weeks       INTEGER NOT NULL DEFAULT 0,
  photos_enabled   INTEGER NOT NULL DEFAULT 0,
  setup_step       TEXT,
  setup_done_at    TEXT
);

-- notice_seen_at: when this parent closed the "recipes may not be
-- test-cooked" notice. Empty means they haven't yet, so it shows.
CREATE TABLE IF NOT EXISTS parents (
  id             TEXT PRIMARY KEY,
  family_id      TEXT NOT NULL REFERENCES families(id),
  email          TEXT NOT NULL UNIQUE,           -- stored lower-case
  password_hash  TEXT NOT NULL,
  is_owner       INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  notice_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS parents_family ON parents(family_id);

-- id is the SHA-256 of the cookie's token, so a copy of this table can't log
-- anyone in. pin_until is when the parent PIN has to be entered again.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT NOT NULL REFERENCES parents(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  pin_until  TEXT
);
CREATE INDEX IF NOT EXISTS sessions_family ON sessions(family_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id),
  parent_id  TEXT NOT NULL REFERENCES parents(id),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- Open sign-up (§8.3): an email and password wait here until the code emailed
-- to that address is entered. Owner-level, not a family's: no family exists yet.
CREATE TABLE IF NOT EXISTS signup_verifications (
  email         TEXT PRIMARY KEY,                -- stored lower-case
  password_hash TEXT NOT NULL,
  code_hash     TEXT NOT NULL,
  attempts      INTEGER NOT NULL DEFAULT 0,
  sent_at       TEXT NOT NULL,                   -- a new code can be asked for 10 minutes after this
  expires_at    TEXT NOT NULL
);

-- App settings, e.g. the beta word.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ---------- profiles and kid logins ----------

-- A profile is one person or several sharing it (§1). people is a JSON list of
-- { name, color } so a shared locker can show everyone on it. intro_seen_at:
-- when this profile finished or skipped the kitchen intro (§6.9), so it opens
-- on its own only once.
CREATE TABLE IF NOT EXISTS profiles (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id),
  name          TEXT NOT NULL,
  avatar        TEXT NOT NULL,
  people        TEXT NOT NULL DEFAULT '[]',
  theme         TEXT NOT NULL DEFAULT 'quest' CHECK (theme IN ('quest', 'passport')),
  audience      TEXT NOT NULL DEFAULT 'kid' CHECK (audience IN ('kid', 'adult')),
  track         TEXT NOT NULL DEFAULT 'core' CHECK (track IN ('core', 'beginner')),
  created_at    TEXT NOT NULL,
  intro_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS profiles_family ON profiles(family_id);

-- Kid logins (§8.3a): a first name and last initial, a cooking picture, and a
-- password, set by a parent. The name and picture together are unique across
-- the app.
CREATE TABLE IF NOT EXISTS kid_logins (
  profile_id    TEXT PRIMARY KEY REFERENCES profiles(id),
  family_id     TEXT NOT NULL REFERENCES families(id),
  login_name    TEXT NOT NULL,                   -- as shown: "Ava C"
  login_key     TEXT NOT NULL,                   -- lower-case, no spaces or periods: "avac"
  picture       TEXT NOT NULL,                   -- a login picture id (src/content/login-pictures.js)
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS kid_logins_name_picture ON kid_logins(login_key, picture);
CREATE INDEX IF NOT EXISTS kid_logins_family ON kid_logins(family_id);

-- Like sessions: id is the SHA-256 of the cookie's token. Never exported.
CREATE TABLE IF NOT EXISTS kid_sessions (
  id         TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS kid_sessions_profile ON kid_sessions(profile_id);

-- ---------- cooks ----------

-- One cook of one lesson. The id is made on the device that starts the cook, so
-- sending the same cook again (a retry after a dropped connection) updates it
-- instead of saving it twice. checklist_state is where the cook is up to:
-- stage, step, and what's checked. removed_at: a parent took back a cook a kid
-- marked done but didn't make; it counts for nothing, and Undo clears it.
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
  eater_rating    INTEGER,
  removed_at      TEXT
);
CREATE INDEX IF NOT EXISTS attempts_family ON attempts(family_id, lesson_id);

-- Every profile on the cook, each with its own reflection from the Reflect
-- stage (§3): rating (1 to 5), notes ("what would you change next time?"),
-- transfer (the optional "what other dish could use this move?"), and
-- reflected_at when it was saved. The eater rating is attempts.eater_rating.
CREATE TABLE IF NOT EXISTS attempt_profiles (
  attempt_id   TEXT NOT NULL REFERENCES attempts(id),
  family_id    TEXT NOT NULL REFERENCES families(id),
  profile_id   TEXT NOT NULL REFERENCES profiles(id),
  rating       INTEGER,
  notes        TEXT,
  transfer     TEXT,
  reflected_at TEXT,
  PRIMARY KEY (attempt_id, profile_id)
);
CREATE INDEX IF NOT EXISTS attempt_profiles_profile ON attempt_profiles(family_id, profile_id);

-- A parent cooked this lesson themselves (§6.2, §7).
CREATE TABLE IF NOT EXISTS test_cooks (
  family_id      TEXT NOT NULL REFERENCES families(id),
  lesson_id      TEXT NOT NULL,
  lesson_version INTEGER NOT NULL,
  parent_id      TEXT NOT NULL,
  cooked_on      TEXT NOT NULL,
  PRIMARY KEY (family_id, lesson_id)
);

-- ---------- fix requests and lesson patches ----------

-- What a family reports is wrong in a lesson, with what it should say instead
-- (§6.11). field is a patch field path (src/content/patch.js), or empty for
-- "something else". current_value and suggested_value are JSON, so a number
-- stays a number. patch_id has no foreign key: patches belong to the whole app
-- and outlive a removed family, and a family restored later still points at
-- its patch.
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

-- ---------- the queue, courses, and the weekly schedule ----------

-- A course for one or more profiles (§6.18). start_date is a Sunday (weeks run
-- Sunday to Friday); per_week is the pace. name, code, and school_year feed
-- the transcript. An ended course has archived_at set and can be put back.
CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES families(id),
  name        TEXT NOT NULL DEFAULT '',
  code        TEXT,
  school_year TEXT,
  start_date  TEXT NOT NULL,
  per_week    INTEGER NOT NULL CHECK (per_week BETWEEN 1 AND 7),
  created_at  TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS courses_family ON courses(family_id);

-- Who a course is for. A profile is on one active course at most (checked by the API).
CREATE TABLE IF NOT EXISTS course_profiles (
  course_id  TEXT NOT NULL REFERENCES courses(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  PRIMARY KEY (course_id, profile_id)
);
CREATE INDEX IF NOT EXISTS course_profiles_family ON course_profiles(family_id, profile_id);

-- The course plan: every dish in the course outline, in this course's order.
-- removed: 0 kept, 1 taken out of the plan (like the other dishes of a
-- pick-one group), 2 taken out with Skip this recipe. A dish added to the
-- outline later goes in where the suggested order puts it (src/content/course.js).
CREATE TABLE IF NOT EXISTS course_lessons (
  course_id TEXT NOT NULL REFERENCES courses(id),
  family_id TEXT NOT NULL REFERENCES families(id),
  lesson_id TEXT NOT NULL,
  position  INTEGER NOT NULL,
  removed   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, lesson_id)
);

-- A week the parent skipped, or added extra lessons to (Cook another recipe).
-- week_start is the week's Sunday. swapped: how many of the week's course
-- lessons were swapped for an Appointed Time meal (§6.19); each takes a place
-- at the pace, so the planned finish moves back and nothing counts as behind.
CREATE TABLE IF NOT EXISTS course_weeks (
  course_id  TEXT NOT NULL REFERENCES courses(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  week_start TEXT NOT NULL,
  skipped    INTEGER NOT NULL DEFAULT 0,
  extra      INTEGER NOT NULL DEFAULT 0,
  swapped    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, week_start)
);

-- The one "up next" list (§6.2). source: manual (a parent added it), request
-- (a kid asked, or an adult tapped Cook this), or course (the weekly schedule
-- loaded it; week_start is its week). A declined request or a removed lesson
-- keeps its row, so it can be put back. swap_of marks an item a swap put in
-- (§6.19): "q:<queue id>" for a lesson queued by hand (taken off the queue,
-- and put back by Undo) or "c:<course id>:<lesson id>" for a course lesson
-- (which goes first next week). A family recipe's lesson_id is "recipe:<id>".
CREATE TABLE IF NOT EXISTS queue (
  id                      TEXT PRIMARY KEY,
  family_id               TEXT NOT NULL REFERENCES families(id),
  lesson_id               TEXT NOT NULL,
  servings                INTEGER NOT NULL,
  planned_date            TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('requested', 'assigned', 'shopped', 'cooked', 'declined', 'removed')),
  source                  TEXT NOT NULL CHECK (source IN ('manual', 'request', 'course')),
  requested_by_profile_id TEXT,
  course_id               TEXT,
  week_start              TEXT,
  created_at              TEXT NOT NULL,
  closed_at               TEXT,
  swap_of                 TEXT
);
CREATE INDEX IF NOT EXISTS queue_family ON queue(family_id, status);

CREATE TABLE IF NOT EXISTS queue_profiles (
  queue_id   TEXT NOT NULL REFERENCES queue(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  PRIMARY KEY (queue_id, profile_id)
);
CREATE INDEX IF NOT EXISTS queue_profiles_profile ON queue_profiles(family_id, profile_id);

-- ---------- shopping (§6.3) ----------

-- Ingredients this family always has; they drop to "You should have".
CREATE TABLE IF NOT EXISTS pantry (
  family_id     TEXT NOT NULL REFERENCES families(id),
  ingredient_id TEXT NOT NULL,
  PRIMARY KEY (family_id, ingredient_id)
);

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

-- ---------- family recipes and sharing (§6.10, §6.19) ----------

-- A parent's own recipe, for their family only. body_json is the recipe
-- (src/content/recipe.js); title, servings, total_minutes, and meal_type are
-- copied out of it for lists. version goes up with each edit, so a cook
-- records what was cooked. A deleted recipe keeps its row (deleted_at) so Undo
-- can bring it back. held: saved but waiting on the owner's review of a
-- blocked word, so it can't be cooked or shared yet. cleared_words: the words
-- a review found to be a false alarm in this recipe ("crab apple"); the hard
-- block skips only those.
CREATE TABLE IF NOT EXISTS family_recipes (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES families(id),
  title               TEXT NOT NULL,
  servings            INTEGER NOT NULL,
  total_minutes       INTEGER NOT NULL,
  meal_type           TEXT NOT NULL,
  body_json           TEXT NOT NULL,
  version             INTEGER NOT NULL DEFAULT 1,
  photo_key           TEXT,
  source_community_id TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  deleted_at          TEXT,
  held                INTEGER NOT NULL DEFAULT 0,
  cleared_words       TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS family_recipes_family ON family_recipes(family_id);

-- A recipe a parent sent to the owner. reason: typed_in (a typed-in
-- ingredient), leaven (a feast-day recipe flagged for leaven), or hard_block
-- (a blocked word). kind: how it's to be shared. version: the recipe's
-- version when sent, so an edit after a review needs another.
CREATE TABLE IF NOT EXISTS recipe_reviews (
  id               TEXT PRIMARY KEY,
  family_id        TEXT NOT NULL REFERENCES families(id),
  family_recipe_id TEXT NOT NULL REFERENCES family_recipes(id),
  reason           TEXT NOT NULL CHECK (reason IN ('typed_in', 'leaven', 'hard_block')),
  kind             TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'feast')),
  version          INTEGER NOT NULL,
  sent_at          TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'declined')),
  unleavened       INTEGER,
  owner_reply      TEXT,
  decided_at       TEXT
);
CREATE INDEX IF NOT EXISTS recipe_reviews_family ON recipe_reviews(family_id, family_recipe_id);
CREATE INDEX IF NOT EXISTS recipe_reviews_status ON recipe_reviews(status);

-- The community directory, "User-shared recipes": a copy of a shared recipe.
-- family_id is kept so the sharing family can update or withdraw theirs, and
-- so it goes with the family; it is never shown to anyone (§6.10).
CREATE TABLE IF NOT EXISTS community_recipes (
  id               TEXT PRIMARY KEY,
  family_id        TEXT NOT NULL REFERENCES families(id),
  family_recipe_id TEXT NOT NULL REFERENCES family_recipes(id),
  kind             TEXT NOT NULL CHECK (kind IN ('general', 'feast')),
  title            TEXT NOT NULL,
  meal_type        TEXT NOT NULL,
  body_json        TEXT NOT NULL,
  unleavened       INTEGER NOT NULL DEFAULT 0,
  shared_at        TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  withdrawn_at     TEXT,
  hidden_at        TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS community_recipes_source ON community_recipes(family_recipe_id);

-- A parent's report on a directory recipe; the owner hides it or dismisses the report.
CREATE TABLE IF NOT EXISTS recipe_reports (
  id                  TEXT PRIMARY KEY,
  family_id           TEXT NOT NULL REFERENCES families(id),
  community_recipe_id TEXT NOT NULL REFERENCES community_recipes(id),
  kind                TEXT NOT NULL,
  note                TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'hidden', 'dismissed')),
  decided_at          TEXT
);
CREATE INDEX IF NOT EXISTS recipe_reports_status ON recipe_reports(status);

-- ---------- the manager section (§7.5) ----------

-- Its own sign-in, separate from the family app's: only the owner's login
-- opens it. family_id is the owner's family, so removing that family removes
-- these too.
CREATE TABLE IF NOT EXISTS manage_sessions (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT NOT NULL REFERENCES parents(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL
);

-- Each save the content editor made: the commit it wrote to the content-edits
-- branch on GitHub, the files it changed, and each file's git id after it
-- (null for a file it removed). The commit is the record; this row is what the
-- editor lists, checks the status of, and undoes. undo_of names the save an
-- Undo reversed; fix_request_id the fix request a save answered (§6.11).
CREATE TABLE IF NOT EXISTS content_saves (
  id             TEXT PRIMARY KEY,
  commit_sha     TEXT NOT NULL,
  parent_sha     TEXT NOT NULL,
  summary        TEXT NOT NULL,
  paths          TEXT NOT NULL,
  blobs          TEXT NOT NULL,
  undo_of        TEXT,
  fix_request_id TEXT,
  created_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS content_saves_created ON content_saves(created_at);
