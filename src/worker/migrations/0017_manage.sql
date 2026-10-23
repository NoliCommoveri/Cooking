-- The manager section (plan §7.5). Its own sign-in, separate from the family
-- app's: only the owner's login opens it. family_id is the owner's family, so
-- removing that family removes these too.
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
