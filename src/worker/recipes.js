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
import { normalizeRecipe, recipeProblems, recipeLesson, recipeCard, blockedWords, MEAL_TYPES } from '../content/recipe.js';
import { leavenIn, unleavened } from '../content/leaven.js';
import { dietView } from '../content/diet.js';

const RECIPES_MAX = 200;
export const RECIPE_ID = /^recipe:([0-9a-f]{16})$/;
// A User-shared recipe, cooked straight from the directory (the Appointed
// Times shelf in the kitchen, §6.19).
export const SHARED_ID = /^shared:([0-9a-f]{16})$/;
export const isRecipeId = (id) => RECIPE_ID.test(id) || SHARED_ID.test(id);
// The full registry, for the checks, scaling, and the shopping list.
export const REGISTRY = Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i]));
const CTX = { ingredients: REGISTRY, equipment: Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e])), rules: CONTENT.rules };

export const stored = (row) => ({ ...JSON.parse(row.body_json), version: row.version });
export const clearedOf = (row) => JSON.parse(row.cleared_words ?? '[]');

// A recipe row as a lesson, with its typed-in ingredients beside the registry.
export const rowLesson = (row) => recipeLesson(`recipe:${row.id}`, stored(row));

export async function recipeRow(env, fid, hex, { deleted = false } = {}) {
  const row = await env.DB.prepare('SELECT * FROM family_recipes WHERE id = ? AND family_id = ?').bind(hex, fid).first();
  return row && (deleted || !row.deleted_at) ? row : null;
}

// A library lesson (with the owner's patches) or one of this family's
// recipes, by its lesson id. Returns { lesson, extra } or null.
export async function lessonFor(env, fid, lessonId, opts) {
  const sh = SHARED_ID.exec(lessonId);
  if (sh) {
    // Live in the directory; with { deleted: true }, also one since taken out,
    // so a cook or a shopping list of it still reads.
    const c = await env.DB.prepare(`SELECT * FROM community_recipes WHERE id = ?${opts?.deleted ? '' : ' AND withdrawn_at IS NULL AND hidden_at IS NULL'}`).bind(sh[1]).first();
    if (!c) return null;
    const { cleared, ...r } = JSON.parse(c.body_json);
    return recipeLesson(lessonId, r, 'User-shared recipe');
  }
  const m = RECIPE_ID.exec(lessonId);
  if (!m) {
    const L = await liveLesson(env.DB, lessonId);
    return L ? { lesson: L, extra: {} } : null;
  }
  const row = await recipeRow(env, fid, m[1], opts);
  // A recipe waiting on the owner's review of a blocked word can't be cooked yet.
  return row && !row.held ? rowLesson(row) : null;
}

// Title and picture for each of the family's recipes, deleted ones too, so a
// cook or a queued item of one still has a name.
export async function recipeNames(env, fid) {
  const { results } = await env.DB.prepare('SELECT id, title, meal_type, deleted_at FROM family_recipes WHERE family_id = ?').bind(fid).all();
  const { results: shared } = await env.DB.prepare('SELECT id, title, meal_type, hidden_at, withdrawn_at FROM community_recipes').all();
  return Object.fromEntries([
    ...results.map((r) => [`recipe:${r.id}`, { title: r.title, image: `img/meals/${r.meal_type}.svg`, deleted: Boolean(r.deleted_at) }]),
    ...shared.map((c) => [`shared:${c.id}`, { title: c.title, image: `img/meals/${c.meal_type}.svg`, deleted: Boolean(c.hidden_at || c.withdrawn_at) }]),
  ]);
}

// Whether a family's diet filters hide a recipe (§2.1). A typed-in ingredient
// has no diet tags, so it never hides one.
export const recipeVisible = ({ lesson, extra }, filters) => dietView(lesson, { ...LIBRARY.ingredients, ...REGISTRY, ...extra }, filters).visible;

// A recipe's words for the kitchen's search: its name and every ingredient.
export const searchText = (r) => [r.title, ...r.ingredients.map((l) => (l.ingredient ? REGISTRY[l.ingredient]?.name : l.name))].join(' ').toLowerCase();

// share: its directory copy, review: the latest review of it, source: the
// directory recipe it was added from (§6.10).
const summary = (row, filters, { share = null, review = null, source = null } = {}) => {
  const r = stored(row);
  const L = rowLesson(row);
  return {
    held: Boolean(row.held),
    shared: share && !share.withdrawn_at ? { kind: share.kind, unleavened: Boolean(share.unleavened), hidden: Boolean(share.hidden_at) } : null,
    review: review ? { reason: review.reason, status: review.status, owner_reply: review.owner_reply, current: review.version === row.version } : null,
    source_hidden: Boolean(source && (source.hidden_at || source.withdrawn_at)),
    id: `recipe:${row.id}`, title: row.title, servings: row.servings, totalMinutes: row.total_minutes, mealType: row.meal_type,
    meal: MEAL_TYPES.find(([k]) => k === row.meal_type)?.[1] ?? '', image: `img/meals/${row.meal_type}.svg`,
    visible: recipeVisible(L, filters), unleavened: unleavened(r, REGISTRY, CONTENT.rules.leaven),
    // Good for Feast Days: shared as a feast-day recipe, or added from one (§6.19).
    feast: Boolean(share && !share.withdrawn_at && share.kind === 'feast') || Boolean(source && !source.withdrawn_at && !source.hidden_at && source.kind === 'feast'),
    typed_in: r.ingredients.filter((l) => !l.ingredient).length, version: row.version, updated_at: row.updated_at,
    card: recipeCard(r, REGISTRY),
    search: searchText(r),
  };
};

// The checks, in one place: the recipe as it will be stored, what's wrong
// with it, and what looks like leaven (§6.19). reviewable: the only problems
// are blocked words, which a parent can send to the owner as a false alarm.
function checked(body, cleared = []) {
  const recipe = normalizeRecipe(body);
  const problems = recipeProblems(recipe, CTX, { cleared });
  const blocked = blockedWords(recipe, CTX.rules).filter((w) => !cleared.includes(w));
  const reviewable = problems.length > 0 && blocked.length > 0 && !recipeProblems(recipe, CTX, { cleared: [...cleared, ...blocked] }).length;
  return { recipe, problems, blocked, reviewable, leaven: leavenIn(recipe, REGISTRY, CONTENT.rules.leaven) };
}
// Saved as it is, or held for the owner's review when the parent sent its
// blocked words as a false alarm; anything else is refused.
const mustPass = (c, body) => {
  if (!c.problems.length) return { recipe: c.recipe, held: false };
  if (c.reviewable && body?.send_for_review) return { recipe: c.recipe, held: true };
  return fail(400, 'problems', c.problems.join(' '));
};
const holdReview = (env, fid, hex, version) => env.DB.prepare(`INSERT INTO recipe_reviews (id, family_id, family_recipe_id, reason, kind, version, sent_at)
    VALUES (?, ?, ?, 'hard_block', 'general', ?, ?)`).bind(randomHex(8), fid, hex, version, now());

// For each recipe: its directory copy, its latest review, and the directory
// recipe it came from.
async function summaryExtras(env, fid) {
  const shares = (await env.DB.prepare('SELECT * FROM community_recipes WHERE family_id = ?').bind(fid).all()).results;
  const reviews = (await env.DB.prepare('SELECT * FROM recipe_reviews WHERE family_id = ? ORDER BY sent_at, id').bind(fid).all()).results;
  const sources = (await env.DB.prepare(`SELECT c.id, c.kind, c.hidden_at, c.withdrawn_at FROM community_recipes c
      JOIN family_recipes f ON f.source_community_id = c.id WHERE f.family_id = ?`).bind(fid).all()).results;
  return (row) => ({
    share: shares.find((x) => x.family_recipe_id === row.id) ?? null,
    review: reviews.filter((x) => x.family_recipe_id === row.id).at(-1) ?? null,
    source: sources.find((x) => x.id === row.source_community_id) ?? null,
  });
}

const familyFilters = async (env, fid) => JSON.parse((await env.DB.prepare('SELECT diet_filters FROM families WHERE id = ?').bind(fid).first()).diet_filters);

export function register(on) {
  // The family's recipes, for the kitchen shelf and the parent screen.
  on('GET', '/api/recipes', async (req, env) => {
    const s = await requireSession(env, req);
    const filters = await familyFilters(env, s.family_id);
    const { results } = await env.DB.prepare('SELECT * FROM family_recipes WHERE family_id = ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE, id').bind(s.family_id).all();
    const extras = await summaryExtras(env, s.family_id);
    return { recipes: results.map((r) => summary(r, filters, extras(r))), meal_types: MEAL_TYPES };
  }, { kid: true });

  // One recipe: as stored (for editing) and as a lesson (for the player).
  on('GET', '/api/recipes/([0-9a-f]{16})', async (req, env, body, [hex]) => {
    const s = await requireSession(env, req);
    const row = await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    const filters = await familyFilters(env, s.family_id);
    return { ...summary(row, filters, (await summaryExtras(env, s.family_id))(row)), recipe: stored(row), cleared: clearedOf(row), ...rowLesson(row) };
  }, { kid: true });

  // The entry flow's Review step: what would be saved, and what's wrong with it.
  on('POST', '/api/recipes/check', async (req, env, body) => {
    const s = await requireParent(env, req);
    const row = /^[0-9a-f]{16}$/.test(String(body.id ?? '')) ? await recipeRow(env, s.family_id, body.id) : null;
    return checked(body, row ? clearedOf(row) : []);
  });

  on('POST', '/api/recipes', async (req, env, body) => {
    const s = await requireParent(env, req);
    const { recipe: r, held } = mustPass(checked(body), body);
    const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM family_recipes WHERE family_id = ? AND deleted_at IS NULL').bind(s.family_id).first()).n;
    if (n >= RECIPES_MAX) fail(429, 'too_many', `A family can keep ${RECIPES_MAX} recipes.`);
    const hex = randomHex(8), t = now();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO family_recipes (id, family_id, title, servings, total_minutes, meal_type, body_json, version, held, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(hex, s.family_id, r.title, r.servings, r.totalMinutes, r.mealType, JSON.stringify(r), held ? 1 : 0, t, t),
      ...(held ? [holdReview(env, s.family_id, hex, 1)] : []),
    ]);
    return { ok: true, id: `recipe:${hex}`, held };
  });

  // An edit raises the version, so a cook records what was cooked.
  on('PUT', '/api/recipes/([0-9a-f]{16})', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    const row = await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    const { recipe: r, held } = mustPass(checked(body, clearedOf(row)), body);
    const v = row.version + 1;
    await env.DB.batch([
      env.DB.prepare(`UPDATE family_recipes SET title = ?, servings = ?, total_minutes = ?, meal_type = ?, body_json = ?, version = ?, held = ?, updated_at = ?
          WHERE id = ? AND family_id = ?`).bind(r.title, r.servings, r.totalMinutes, r.mealType, JSON.stringify(r), v, held ? 1 : 0, now(), hex, s.family_id),
      ...(held ? [holdReview(env, s.family_id, hex, v)] : []),
    ]);
    return { ok: true, id: `recipe:${hex}`, version: v, held };
  });

  // Delete has an Undo (restore). Cooks of it keep their record; it comes off
  // the queue until it's put back.
  on('DELETE', '/api/recipes/([0-9a-f]{16})', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    const t = now();
    await env.DB.batch([
      env.DB.prepare('UPDATE family_recipes SET deleted_at = ? WHERE id = ? AND family_id = ?').bind(t, hex, s.family_id),
      // Its shared copy leaves the directory too; putting the recipe back doesn't re-share it.
      env.DB.prepare('UPDATE community_recipes SET withdrawn_at = ? WHERE family_recipe_id = ? AND family_id = ? AND withdrawn_at IS NULL').bind(t, hex, s.family_id),
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
