-- Phase 4c: sharing family recipes (plan §6.10, §6.19).

-- held: saved but waiting on the owner's review of a blocked word, so it
-- can't be cooked or shared yet. cleared_words: the words a review found to
-- be a false alarm in this recipe ("crab apple"); the hard block skips only those.
ALTER TABLE family_recipes ADD COLUMN held INTEGER NOT NULL DEFAULT 0;
ALTER TABLE family_recipes ADD COLUMN cleared_words TEXT NOT NULL DEFAULT '[]';

-- A recipe a parent sent to the owner. reason: typed_in (a typed-in
-- ingredient), leaven (a feast-day recipe flagged for leaven), or hard_block
-- (a blocked word). kind: how it's to be shared. version: the recipe's
-- version when sent, so an edit after a review needs another.
CREATE TABLE IF NOT EXISTS recipe_reviews (
  id             TEXT PRIMARY KEY,
  family_id      TEXT NOT NULL REFERENCES families(id),
  family_recipe_id TEXT NOT NULL REFERENCES family_recipes(id),
  reason         TEXT NOT NULL CHECK (reason IN ('typed_in', 'leaven', 'hard_block')),
  kind           TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general', 'feast')),
  version        INTEGER NOT NULL,
  sent_at        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cleared', 'declined')),
  unleavened     INTEGER,
  owner_reply    TEXT,
  decided_at     TEXT
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
