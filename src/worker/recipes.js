// Phase 4c: family recipes (plan §6.10). A parent adds the family's own
// recipes through the guided entry flow; they run in the lesson player like
// any lesson and can be queued, shopped for, and cooked. Only that family sees
// them. Every query is scoped by the session's family_id, as in api.js.
//
// In the queue and on cooks, a family recipe's lesson id is "recipe:<id>", so
// everything built for lessons works for recipes too. lessonFor() finds either.
import { fail, now } from './lib/http.js';
import { randomHex } from './lib/crypto.js';
import { requireSession, requireParent } from './auth.js';
import { CONTENT } from './content-data.js';
import { LIBRARY } from './library-data.js';
import { liveLesson } from './lessons.js';
import { normalizeRecipe, recipeProblems, recipeLesson, recipeCard, MEAL_TYPES } from '../content/recipe.js';
import { leavenIn, unleavened } from '../content/leaven.js';
import { dietView } from '../content/diet.js';

const RECIPES_MAX = 200;
export const RECIPE_ID = /^recipe:([0-9a-f]{16})$/;
// The full registry, for the checks, scaling, and the shopping list.
export const REGISTRY = Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i]));
const CTX = { ingredients: REGISTRY, equipment: Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e])), rules: CONTENT.rules };

const stored = (row) => ({ ...JSON.parse(row.body_json), version: row.version });

// A recipe row as a lesson, with its typed-in ingredients beside the registry.
export const rowLesson = (row) => recipeLesson(`recipe:${row.id}`, stored(row));

export async function recipeRow(env, fid, hex, { deleted = false } = {}) {
  const row = await env.DB.prepare('SELECT * FROM family_recipes WHERE id = ? AND family_id = ?').bind(hex, fid).first();
  return row && (deleted || !row.deleted_at) ? row : null;
}

// A library lesson (with the owner's patches) or one of this family's
// recipes, by its lesson id. Returns { lesson, extra } or null.
export async function lessonFor(env, fid, lessonId, opts) {
  const m = RECIPE_ID.exec(lessonId);
  if (!m) {
    const L = await liveLesson(env.DB, lessonId);
    return L ? { lesson: L, extra: {} } : null;
  }
  const row = await recipeRow(env, fid, m[1], opts);
  return row ? rowLesson(row) : null;
}

// Title and picture for each of the family's recipes, deleted ones too, so a
// cook or a queued item of one still has a name.
export async function recipeNames(env, fid) {
  const { results } = await env.DB.prepare('SELECT id, title, meal_type, deleted_at FROM family_recipes WHERE family_id = ?').bind(fid).all();
  return Object.fromEntries(results.map((r) => [`recipe:${r.id}`, { title: r.title, image: `img/meals/${r.meal_type}.svg`, deleted: Boolean(r.deleted_at) }]));
}

// Whether a family's diet filters hide a recipe (§2.1). A typed-in ingredient
// has no diet tags, so it never hides one.
export const recipeVisible = ({ lesson, extra }, filters) => dietView(lesson, { ...LIBRARY.ingredients, ...REGISTRY, ...extra }, filters).visible;

const summary = (row, filters) => {
  const r = stored(row);
  const L = rowLesson(row);
  return {
    id: `recipe:${row.id}`, title: row.title, servings: row.servings, totalMinutes: row.total_minutes, mealType: row.meal_type,
    meal: MEAL_TYPES.find(([k]) => k === row.meal_type)?.[1] ?? '', image: `img/meals/${row.meal_type}.svg`,
    visible: recipeVisible(L, filters), unleavened: unleavened(r, REGISTRY, CONTENT.rules.leaven),
    typed_in: r.ingredients.filter((l) => !l.ingredient).length, version: row.version, updated_at: row.updated_at,
    card: recipeCard(r, REGISTRY),
  };
};

// The checks, in one place: the recipe as it will be stored, what's wrong
// with it, and what looks like leaven (§6.19).
function checked(body) {
  const recipe = normalizeRecipe(body);
  return { recipe, problems: recipeProblems(recipe, CTX), leaven: leavenIn(recipe, REGISTRY, CONTENT.rules.leaven) };
}
const mustPass = (c) => (c.problems.length ? fail(400, 'problems', c.problems.join(' ')) : c.recipe);

const familyFilters = async (env, fid) => JSON.parse((await env.DB.prepare('SELECT diet_filters FROM families WHERE id = ?').bind(fid).first()).diet_filters);

export function register(on) {
  // The family's recipes, for the kitchen shelf and the parent screen.
  on('GET', '/api/recipes', async (req, env) => {
    const s = await requireSession(env, req);
    const filters = await familyFilters(env, s.family_id);
    const { results } = await env.DB.prepare('SELECT * FROM family_recipes WHERE family_id = ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE, id').bind(s.family_id).all();
    return { recipes: results.map((r) => summary(r, filters)), meal_types: MEAL_TYPES };
  });

  // One recipe: as stored (for editing) and as a lesson (for the player).
  on('GET', '/api/recipes/([0-9a-f]{16})', async (req, env, body, [hex]) => {
    const s = await requireSession(env, req);
    const row = await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    const filters = await familyFilters(env, s.family_id);
    return { ...summary(row, filters), recipe: stored(row), ...rowLesson(row) };
  });

  // The entry flow's Review step: what would be saved, and what's wrong with it.
  on('POST', '/api/recipes/check', async (req, env, body) => {
    await requireParent(env, req);
    return checked(body);
  });

  on('POST', '/api/recipes', async (req, env, body) => {
    const s = await requireParent(env, req);
    const r = mustPass(checked(body));
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM family_recipes WHERE family_id = ? AND deleted_at IS NULL').bind(s.family_id).first()).n;
    if (n >= RECIPES_MAX) fail(429, 'too_many', `A family can keep ${RECIPES_MAX} recipes.`);
    const hex = randomHex(8), t = now();
    await env.DB.prepare(`INSERT INTO family_recipes (id, family_id, title, servings, total_minutes, meal_type, body_json, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`).bind(hex, s.family_id, r.title, r.servings, r.totalMinutes, r.mealType, JSON.stringify(r), t, t).run();
    return { ok: true, id: `recipe:${hex}` };
  });

  // An edit raises the version, so a cook records what was cooked.
  on('PUT', '/api/recipes/([0-9a-f]{16})', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    const row = await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    const r = mustPass(checked(body));
    await env.DB.prepare(`UPDATE family_recipes SET title = ?, servings = ?, total_minutes = ?, meal_type = ?, body_json = ?, version = ?, updated_at = ?
        WHERE id = ? AND family_id = ?`).bind(r.title, r.servings, r.totalMinutes, r.mealType, JSON.stringify(r), row.version + 1, now(), hex, s.family_id).run();
    return { ok: true, id: `recipe:${hex}`, version: row.version + 1 };
  });

  // Delete has an Undo (restore). Cooks of it keep their record; it comes off
  // the queue until it's put back.
  on('DELETE', '/api/recipes/([0-9a-f]{16})', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    const t = now();
    await env.DB.batch([
      env.DB.prepare('UPDATE family_recipes SET deleted_at = ? WHERE id = ? AND family_id = ?').bind(t, hex, s.family_id),
      env.DB.prepare(`UPDATE queue SET status = 'removed', closed_at = ? WHERE family_id = ? AND lesson_id = ? AND status IN ('requested', 'assigned', 'shopped')`)
        .bind(t, s.family_id, `recipe:${hex}`),
    ]);
    return { ok: true };
  });

  on('POST', '/api/recipes/([0-9a-f]{16})/restore', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    const row = await recipeRow(env, s.family_id, hex, { deleted: true }) ?? fail(404, 'not_found', 'No such recipe.');
    if (!row.deleted_at) return { ok: true };
    await env.DB.prepare('UPDATE family_recipes SET deleted_at = NULL WHERE id = ? AND family_id = ?').bind(hex, s.family_id).run();
    return { ok: true };
  });
}
