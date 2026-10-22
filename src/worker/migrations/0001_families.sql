-- Phase 1b: families, parents, sessions, profiles, and sign-up (plan §8.3, §8.4).
-- Ids are random text, not counters, so one family's rows can be put back
-- (Restore a family on /ops) without colliding with rows made since.
-- Every table holding a family's data carries family_id.

CREATE TABLE IF NOT EXISTS families (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  default_servings INTEGER NOT NULL DEFAULT 6,
  diet_filters     TEXT NOT NULL DEFAULT '[]',   -- JSON list of diet tags (§2.1)
  parent_pin_hash  TEXT,                         -- null until the first run sets it
  created_at       TEXT NOT NULL,
  last_active_at   TEXT
);

CREATE TABLE IF NOT EXISTS parents (
  id            TEXT PRIMARY KEY,
  family_id     TEXT NOT NULL REFERENCES families(id),
  email         TEXT NOT NULL UNIQUE,            -- stored lower-case
  password_hash TEXT NOT NULL,
  is_owner      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
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

-- Owner-level: sign-up codes, requests to join, and app settings.
CREATE TABLE IF NOT EXISTS invites (
  code              TEXT PRIMARY KEY,
  created_by        TEXT NOT NULL,               -- 'ops', or the owner parent's id
  email             TEXT,                        -- set when made for a request
  used_by_family_id TEXT,
  created_at        TEXT NOT NULL,
  revoked           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS signup_requests (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  invite_code TEXT
);
-- One pending request per email address (§8.3).
CREATE UNIQUE INDEX IF NOT EXISTS signup_requests_one_pending ON signup_requests(email) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- A profile is one person or several sharing it (§1). people is a JSON list of
-- { name, color } so a shared locker can show everyone on it.
CREATE TABLE IF NOT EXISTS profiles (
  id         TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL REFERENCES families(id),
  name       TEXT NOT NULL,
  avatar     TEXT NOT NULL,
  people     TEXT NOT NULL DEFAULT '[]',
  theme      TEXT NOT NULL DEFAULT 'quest' CHECK (theme IN ('quest', 'passport')),
  audience   TEXT NOT NULL DEFAULT 'kid' CHECK (audience IN ('kid', 'adult')),
  track      TEXT NOT NULL DEFAULT 'core' CHECK (track IN ('core', 'beginner')),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS profiles_family ON profiles(family_id);
