-- Phase 5b: kid logins (plan §8.3a). A kid profile can have its own login: a
-- first name and last initial, a cooking picture, and a password, set by a
-- parent. The name and picture together are unique across the app.

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
