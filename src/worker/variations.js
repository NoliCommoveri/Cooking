// Phase 11c: variations (plan §6.21). A lesson can have versions with a
// preference built in (Chimichurri chicken for Chimichurri steak); a parent
// picks which one the family cooks, and the lesson player and shopping lists
// use it. A cook of any version counts as its lesson. Part of the next release
// (§8.6): a family without it always gets the lesson itself, and none of these
// tables is read for it.
import { fail, now } from './lib/http.js';
import { requireParent } from './auth.js';
import { LIBRARY } from './library-data.js';
import { releaseOn } from './release.js';

const missingTable = (err) => /no such table/i.test(String(err?.message));
const libraryLesson = (lid) => LIBRARY.lessons.find((L) => L.id === lid) ?? null;
export const hasVariation = (lid, vid) => Boolean(libraryLesson(lid)?.variations?.some((v) => v.id === vid));

// The family's chosen version of each lesson that has variations, as
// { lesson id: variation id }; '' is the lesson itself. Empty for a family
// without the next release, and for a variation since taken out of its lesson.
export async function variationChoices(env, fid) {
  if (!(await releaseOn(env.DB, fid, 1))) return {};
  try {
    const { results } = await env.DB.prepare('SELECT lesson_id, variation FROM variation_choices WHERE family_id = ?').bind(fid).all();
    return Object.fromEntries(results.filter((r) => r.variation === '' || hasVariation(r.lesson_id, r.variation)).map((r) => [r.lesson_id, r.variation]));
  } catch (err) {
    if (missingTable(err)) return {};
    throw err;
  }
}

// The version a cook was of, or of each cook in a list: { attempt id: variation id }.
export async function attemptVariations(env, fid, ids) {
  if (!ids.length) return {};
  try {
    const { results } = await env.DB.prepare(`SELECT attempt_id, variation FROM attempt_variations WHERE family_id = ? AND attempt_id IN (${ids.map(() => '?').join(', ')})`)
      .bind(fid, ...ids).all();
    return Object.fromEntries(results.map((r) => [r.attempt_id, r.variation]));
  } catch (err) {
    if (missingTable(err)) return {};
    throw err;
  }
}

// Saves which version a new cook is of. Called once, when the cook is first saved.
export function recordVariation(env, fid, aid, vid) {
  return env.DB.prepare('INSERT OR IGNORE INTO attempt_variations (attempt_id, family_id, variation) VALUES (?, ?, ?)').bind(aid, fid, vid);
}

// The versions each lesson on a shopping list was bought for: { position: variation id }.
export async function listVariations(env, fid, listId) {
  try {
    const { results } = await env.DB.prepare('SELECT position, variation FROM list_variations WHERE list_id = ? AND family_id = ?').bind(listId, fid).all();
    return Object.fromEntries(results.map((r) => [r.position, r.variation]));
  } catch (err) {
    if (missingTable(err)) return {};
    throw err;
  }
}

export const listVariationRow = (env, fid, listId, position, vid) => env.DB
  .prepare('INSERT INTO list_variations (list_id, family_id, position, variation) VALUES (?, ?, ?, ?)').bind(listId, fid, position, vid);

// A lesson's title as the family cooks it: the chosen variation's, or its own.
export function versionTitle(lid, vid) {
  const L = libraryLesson(lid);
  return (vid ? L?.variations?.find((v) => v.id === vid)?.title : null) ?? L?.title ?? null;
}

// Cooks taken away with a profile leave their version rows behind; this tidies them.
export async function forgetCooks(env, fid) {
  try {
    await env.DB.prepare('DELETE FROM attempt_variations WHERE family_id = ? AND attempt_id NOT IN (SELECT id FROM attempts WHERE family_id = ?)').bind(fid, fid).run();
  } catch (err) {
    if (!missingTable(err)) throw err;
  }
}

export function register(on) {
  // Which version of a lesson the family cooks: a variation's id, '' for the
  // lesson itself, or null for no pick. Parents only, behind the PIN.
  on('PUT', '/api/variations/([a-z0-9-]+)', async (req, env, body, [lid]) => {
    const s = await requireParent(env, req);
    if (!(await releaseOn(env.DB, s.family_id, 1))) fail(404, 'not_available', 'Not available yet.');
    const L = libraryLesson(lid);
    if (!L?.variations?.length) fail(404, 'not_found', 'That lesson has no other versions.');
    // null: no pick, so the best fit for whoever is cooking plays (§6.21, 11d1).
    if (body.variation === null) {
      await env.DB.prepare('DELETE FROM variation_choices WHERE family_id = ? AND lesson_id = ?').bind(s.family_id, lid).run();
      return { ok: true, lesson_id: lid, variation: null, title: null };
    }
    const vid = String(body.variation ?? '');
    if (vid !== '' && !hasVariation(lid, vid)) fail(400, 'invalid', `${L.title} has no version called "${vid}".`);
    await env.DB.prepare(`INSERT INTO variation_choices (family_id, lesson_id, variation, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (family_id, lesson_id) DO UPDATE SET variation = excluded.variation, updated_at = excluded.updated_at`)
      .bind(s.family_id, lid, vid, now()).run();
    return { ok: true, lesson_id: lid, variation: vid, title: versionTitle(lid, vid) };
  });
}
