-- Phase 4c: family recipes (plan §6.10). A parent's own recipe, for their
-- family only. body_json is the recipe (src/content/recipe.js); title,
-- servings, total_minutes, and meal_type are copied out of it for lists.
-- version goes up with each edit, so a cook records what was cooked. A
-- deleted recipe keeps its row (deleted_at) so Undo can bring it back.
-- In the queue and on cooks, a family recipe's lesson_id is "recipe:<id>".
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
  deleted_at          TEXT
);
CREATE INDEX IF NOT EXISTS family_recipes_family ON family_recipes(family_id);
