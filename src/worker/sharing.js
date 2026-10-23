// Phase 4c: sharing family recipes (plan §6.10, §6.19). One routine for
// every recipe: the hard block and the leaven check run, and then
//   - every ingredient from the registry: it's shared at once;
//   - a typed-in ingredient: it waits for the owner's review;
//   - a feast-day recipe flagged for leaven: the owner's notice, with Send for
//     review and Share recipe (shared without the Unleavened badge), and both
//     can be pressed;
//   - a blocked word: saved but held, with Send for review only (recipes.js).
// The directory, "User-shared recipes", carries no identifier of the sharing
// family. Any parent can report a shared recipe; the owner hides or unhides
// any of them. A review only clears a false alarm; it never lets unclean food
// through (§2.1).
import { fail, now } from './lib/http.js';
import { randomHex } from './lib/crypto.js';
import { requireSession, requireParent, requireOwner } from './auth.js';
import { CONTENT } from './content-data.js';
import { sendEmail, recipeReportEmail } from './email.js';
import { recipeRow, stored, clearedOf, REGISTRY, recipeVisible } from './recipes.js';
import { recipeLesson, recipeCard, blockedWords, MEAL_TYPES } from '../content/recipe.js';
import { leavenIn } from '../content/leaven.js';

const KINDS = ['general', 'feast'];
export const REPORT_KINDS = { unclean: 'Unclean ingredient', safety: 'Food-safety problem', wrong: 'Wrong or unclear', inappropriate: 'Inappropriate', other: 'Something else' };
const URGENT = new Set(['unclean', 'safety']);
const REPORTS_MAX = 20; // open reports one family can have at once

const meal = (k) => MEAL_TYPES.find(([x]) => x === k)?.[1] ?? '';

// The latest review of a recipe for one reason, at its current version.
async function reviewOf(env, row, reason) {
  return env.DB.prepare(`SELECT * FROM recipe_reviews WHERE family_recipe_id = ? AND family_id = ? AND reason = ? AND version = ?
      ORDER BY sent_at DESC, id DESC LIMIT 1`).bind(row.id, row.family_id, reason, row.version).first();
}

// Puts a recipe in the directory, or updates its copy there. A copy the owner
// hid stays hidden.
async function publish(env, row, kind, unleavened) {
  const r = stored(row), t = now();
  const body = JSON.stringify({ ...r, cleared: clearedOf(row) });
  const had = await env.DB.prepare('SELECT id FROM community_recipes WHERE family_recipe_id = ?').bind(row.id).first();
  if (had) {
    await env.DB.prepare(`UPDATE community_recipes SET kind = ?, title = ?, meal_type = ?, body_json = ?, unleavened = ?, updated_at = ?, withdrawn_at = NULL WHERE id = ?`)
      .bind(kind, row.title, row.meal_type, body, unleavened ? 1 : 0, t, had.id).run();
    return had.id;
  }
  const id = randomHex(8);
  await env.DB.prepare(`INSERT INTO community_recipes (id, family_id, family_recipe_id, kind, title, meal_type, body_json, unleavened, shared_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, row.family_id, row.id, kind, row.title, row.meal_type, body, unleavened ? 1 : 0, t, t).run();
  return id;
}

// The sharing routine (§6.10). Returns what happened, for the notice.
async function share(env, row, kind, withoutBadge) {
  const r = stored(row);
  const lv = leavenIn(r, REGISTRY, CONTENT.rules.leaven);
  let unleavened = !lv.found.length && !lv.typedIn;
  if (lv.typedIn) {
    const rev = await reviewOf(env, row, 'typed_in');
    if (rev?.status !== 'cleared') return { status: 'needs_review', reason: 'typed_in', review: rev?.status ?? null, reply: rev?.owner_reply ?? null };
    unleavened = Boolean(rev.unleavened);
  }
  const lrev = await reviewOf(env, row, 'leaven');
  if (lrev?.status === 'cleared' && lrev.unleavened) unleavened = true;
  if (kind === 'feast' && !unleavened && !withoutBadge) {
    return { status: 'leaven_flag', found: lv.found, review: lrev?.status ?? null, reply: lrev?.owner_reply ?? null };
  }
  await publish(env, row, kind, unleavened);
  return { status: 'shared', unleavened };
}

// A directory recipe as anybody signed in reads it: no family, ever.
function sharedOut(c, filters, fid, added) {
  const r = JSON.parse(c.body_json);
  const { lesson, extra } = recipeLesson(`shared:${c.id}`, r);
  return {
    id: c.id, title: c.title, kind: c.kind, feast: c.kind === 'feast', unleavened: Boolean(c.unleavened),
    meal: meal(c.meal_type), image: `img/meals/${c.meal_type}.svg`, servings: r.servings, totalMinutes: r.totalMinutes,
    card: recipeCard(r, REGISTRY), visible: recipeVisible({ lesson, extra }, filters),
    mine: c.family_id === fid, added: added.has(c.id), shared_at: c.shared_at,
  };
}

const live = "withdrawn_at IS NULL AND hidden_at IS NULL";
const sharedRow = async (env, id) => (await env.DB.prepare(`SELECT * FROM community_recipes WHERE id = ? AND ${live}`).bind(id).first()) ?? fail(404, 'not_found', 'No such shared recipe.');

export function register(on) {
  // ---------- a family's side ----------

  // Share a recipe as General or Feast day. without_badge: the parent pressed
  // Share recipe on the leaven notice.
  on('POST', '/api/recipes/([0-9a-f]{16})/share', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    const row = await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    if (row.held) fail(409, 'held', 'This recipe is waiting on a review before it can be shared.');
    const kind = KINDS.includes(body.kind) ? body.kind : fail(400, 'invalid', 'Share it as General or Feast day.');
    return share(env, row, kind, Boolean(body.without_badge));
  });

  // Take a recipe out of the directory. Sharing it again puts it back.
  on('DELETE', '/api/recipes/([0-9a-f]{16})/share', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    await env.DB.prepare('UPDATE community_recipes SET withdrawn_at = ? WHERE family_recipe_id = ? AND family_id = ? AND withdrawn_at IS NULL').bind(now(), hex, s.family_id).run();
    return { ok: true };
  });

  // Send for review: a typed-in ingredient, or a feast-day recipe flagged for
  // leaven. (A blocked word is sent when the recipe is saved, in recipes.js.)
  on('POST', '/api/recipes/([0-9a-f]{16})/review', async (req, env, body, [hex]) => {
    const s = await requireParent(env, req);
    const row = await recipeRow(env, s.family_id, hex) ?? fail(404, 'not_found', 'No such recipe.');
    const reason = ['typed_in', 'leaven'].includes(body.reason) ? body.reason : fail(400, 'invalid', 'Send it for a typed-in ingredient or for leaven.');
    const kind = KINDS.includes(body.kind) ? body.kind : 'general';
    const had = await reviewOf(env, row, reason);
    if (had?.status === 'pending') return { ok: true, status: 'pending' };
    await env.DB.prepare(`INSERT INTO recipe_reviews (id, family_id, family_recipe_id, reason, kind, version, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(randomHex(8), s.family_id, hex, reason, kind, row.version, now()).run();
    return { ok: true, status: 'pending' };
  });

  // The directory: "User-shared recipes". ?feast=1 for Good for Feast Days.
  on('GET', '/api/shared', async (req, env) => {
    const s = await requireSession(env, req);
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const feast = url.searchParams.get('feast') === '1';
    const filters = JSON.parse((await env.DB.prepare('SELECT diet_filters FROM families WHERE id = ?').bind(s.family_id).first()).diet_filters);
    const { results } = await env.DB.prepare(`SELECT * FROM community_recipes WHERE ${live} ${feast ? "AND kind = 'feast'" : ''} ORDER BY title COLLATE NOCASE, id`).all();
    const added = new Set((await env.DB.prepare('SELECT source_community_id FROM family_recipes WHERE family_id = ? AND deleted_at IS NULL AND source_community_id IS NOT NULL').bind(s.family_id).all()).results.map((r) => r.source_community_id));
    const list = results.filter((c) => !q || c.title.toLowerCase().includes(q) || c.body_json.toLowerCase().includes(q));
    return { recipes: list.map((c) => sharedOut(c, filters, s.family_id, added)) };
  });

  // One directory recipe, to read before adding it.
  on('GET', '/api/shared/([0-9a-f]{16})', async (req, env, body, [id]) => {
    const s = await requireSession(env, req);
    const c = await sharedRow(env, id);
    const filters = JSON.parse((await env.DB.prepare('SELECT diet_filters FROM families WHERE id = ?').bind(s.family_id).first()).diet_filters);
    const { cleared, ...recipe } = JSON.parse(c.body_json);
    return { ...sharedOut(c, filters, s.family_id, new Set()), recipe };
  });

  // Add a directory recipe to this family's recipes, as its own copy.
  on('POST', '/api/shared/([0-9a-f]{16})/add', async (req, env, body, [id]) => {
    const s = await requireParent(env, req);
    const c = await sharedRow(env, id);
    const had = await env.DB.prepare('SELECT id FROM family_recipes WHERE family_id = ? AND source_community_id = ? AND deleted_at IS NULL').bind(s.family_id, id).first();
    if (had) return { ok: true, id: `recipe:${had.id}` };
    const { cleared = [], ...r } = JSON.parse(c.body_json);
    const hex = randomHex(8), t = now();
    await env.DB.prepare(`INSERT INTO family_recipes (id, family_id, title, servings, total_minutes, meal_type, body_json, version, cleared_words, source_community_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).bind(hex, s.family_id, c.title, r.servings, r.totalMinutes, c.meal_type, JSON.stringify(r), JSON.stringify(cleared), id, t, t).run();
    return { ok: true, id: `recipe:${hex}` };
  });

  // Report a directory recipe. Unclean and food-safety reports email the owner.
  on('POST', '/api/shared/([0-9a-f]{16})/report', async (req, env, body, [id]) => {
    const s = await requireParent(env, req);
    const c = await sharedRow(env, id);
    const kind = REPORT_KINDS[body.kind] ? body.kind : fail(400, 'invalid', 'Pick what kind of problem it is.');
    const note = String(body.note ?? '').trim().slice(0, 1000) || fail(400, 'invalid', 'Say what the problem is.');
    const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM recipe_reports WHERE family_id = ? AND status = 'open'").bind(s.family_id).first()).n;
    if (n >= REPORTS_MAX) fail(429, 'too_many', 'Your family has a lot of reports waiting. The owner will get to them.');
    await env.DB.prepare('INSERT INTO recipe_reports (id, family_id, community_recipe_id, kind, note, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(randomHex(8), s.family_id, id, kind, note, now()).run();
    if (URGENT.has(kind)) {
      const owners = (await env.DB.prepare('SELECT email FROM parents WHERE is_owner = 1').all()).results.map((r) => r.email);
      if (owners.length) await sendEmail(env, { to: owners, ...recipeReportEmail({ kind: REPORT_KINDS[kind], title: c.title, note }) });
    }
    return { ok: true };
  });

  // ---------- the owner's side (§6.2a) ----------

  // Recipes sent for review, with what was flagged.
  on('GET', '/api/owner/recipe-reviews', async (req, env) => {
    await requireOwner(env, req);
    const { results } = await env.DB.prepare(`SELECT v.*, f.body_json, f.title, f.version AS now_version, f.cleared_words FROM recipe_reviews v
        JOIN family_recipes f ON f.id = v.family_recipe_id AND f.family_id = v.family_id
        WHERE v.status = 'pending' AND f.deleted_at IS NULL ORDER BY v.sent_at, v.id`).all();
    return {
      reviews: results.map((v) => {
        const r = JSON.parse(v.body_json);
        const lv = leavenIn(r, REGISTRY, CONTENT.rules.leaven);
        const cleared = JSON.parse(v.cleared_words);
        return {
          id: v.id, reason: v.reason, kind: v.kind, sent_at: v.sent_at, stale: v.version !== v.now_version, title: v.title, recipe: r,
          blocked: blockedWords(r, CONTENT.rules).filter((w) => !cleared.includes(w)),
          typed_in: r.ingredients.filter((l) => !l.ingredient).map((l) => l.name),
          leaven: lv.found,
        };
      }),
    };
  });

  // Clear a review. unleavened: the owner's call on the badge, for a typed-in
  // ingredient or a leaven flag. A blocked word's review frees the recipe and
  // remembers the words as a false alarm in it; the other two share it.
  on('POST', '/api/owner/recipe-reviews/([0-9a-f]{16})/clear', async (req, env, body, [id]) => {
    await requireOwner(env, req);
    const v = await env.DB.prepare("SELECT * FROM recipe_reviews WHERE id = ? AND status = 'pending'").bind(id).first() ?? fail(404, 'not_found', 'No such review waiting.');
    const row = await env.DB.prepare('SELECT * FROM family_recipes WHERE id = ? AND family_id = ?').bind(v.family_recipe_id, v.family_id).first() ?? fail(404, 'not_found', 'That recipe is gone.');
    const unleavened = v.reason === 'hard_block' ? null : body.unleavened ? 1 : 0;
    const stmts = [env.DB.prepare("UPDATE recipe_reviews SET status = 'cleared', unleavened = ?, owner_reply = ?, decided_at = ? WHERE id = ?")
      .bind(unleavened, String(body.note ?? '').trim().slice(0, 500) || null, now(), id)];
    if (v.reason === 'hard_block') {
      const words = [...new Set([...clearedOf(row), ...blockedWords(stored(row), CONTENT.rules)])];
      stmts.push(env.DB.prepare('UPDATE family_recipes SET held = 0, cleared_words = ? WHERE id = ?').bind(JSON.stringify(words), row.id));
    }
    await env.DB.batch(stmts);
    // The parent asked to share it, so a cleared review shares it, with the
    // Unleavened badge if the owner gave it. An edit since means another check.
    if (v.reason !== 'hard_block' && v.version === row.version && !row.deleted_at && !row.held) await publish(env, row, v.kind, Boolean(unleavened));
    return { ok: true };
  });

  on('POST', '/api/owner/recipe-reviews/([0-9a-f]{16})/decline', async (req, env, body, [id]) => {
    await requireOwner(env, req);
    const note = String(body.note ?? '').trim().slice(0, 500) || fail(400, 'invalid', 'Add a short note for the family.');
    const r = await env.DB.prepare("UPDATE recipe_reviews SET status = 'declined', owner_reply = ?, decided_at = ? WHERE id = ? AND status = 'pending'").bind(note, now(), id).run();
    if (!r.meta?.changes) fail(404, 'not_found', 'No such review waiting.');
    return { ok: true };
  });

  // Open reports, and every hidden recipe (with Unhide).
  on('GET', '/api/owner/recipe-reports', async (req, env) => {
    await requireOwner(env, req);
    const { results: reports } = await env.DB.prepare(`SELECT r.*, c.title, c.hidden_at FROM recipe_reports r JOIN community_recipes c ON c.id = r.community_recipe_id
        WHERE r.status = 'open' ORDER BY r.created_at, r.id`).all();
    const { results: hidden } = await env.DB.prepare('SELECT id, title, hidden_at FROM community_recipes WHERE hidden_at IS NOT NULL ORDER BY hidden_at DESC').all();
    return {
      reports: reports.map((r) => ({ id: r.id, recipe_id: r.community_recipe_id, title: r.title, kind: REPORT_KINDS[r.kind] ?? r.kind, note: r.note, created_at: r.created_at, hidden: Boolean(r.hidden_at) })),
      hidden: hidden.map((c) => ({ id: c.id, title: c.title, hidden_at: c.hidden_at })),
      kinds: REPORT_KINDS,
    };
  });

  on('POST', '/api/owner/recipe-reports/([0-9a-f]{16})/dismiss', async (req, env, body, [id]) => {
    await requireOwner(env, req);
    await env.DB.prepare("UPDATE recipe_reports SET status = 'dismissed', decided_at = ? WHERE id = ? AND status = 'open'").bind(now(), id).run();
    return { ok: true };
  });

  // Hide any directory recipe, reported or not. Unhide puts it back (the
  // restore beside the destructive control, CLAUDE.md).
  on('POST', '/api/owner/shared/([0-9a-f]{16})/hide', async (req, env, body, [id]) => {
    await requireOwner(env, req);
    const t = now();
    await env.DB.batch([
      env.DB.prepare('UPDATE community_recipes SET hidden_at = ? WHERE id = ? AND hidden_at IS NULL').bind(t, id),
      env.DB.prepare("UPDATE recipe_reports SET status = 'hidden', decided_at = ? WHERE community_recipe_id = ? AND status = 'open'").bind(t, id),
    ]);
    return { ok: true };
  });

  on('POST', '/api/owner/shared/([0-9a-f]{16})/unhide', async (req, env, body, [id]) => {
    await requireOwner(env, req);
    await env.DB.prepare('UPDATE community_recipes SET hidden_at = NULL WHERE id = ?').bind(id).run();
    return { ok: true };
  });
}

// For the swap picker (§6.19): every live directory recipe.
export const liveShared = async (env) => (await env.DB.prepare(`SELECT * FROM community_recipes WHERE ${live}`).all()).results;
