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
