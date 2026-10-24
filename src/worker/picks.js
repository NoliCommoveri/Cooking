// Phase 11d1: scoring and default picks (plan §6.21). From the star ratings of
// the profiles on a cook and the family's limits (tastes.js), the best version
// of a lesson plays when the family hasn't picked one, and a new course keeps
// the best dish in each pick-one group. Nothing is ruled out on the main
// track: dishes are only ranked (src/content/score.js). Part of the next
// release (§8.6): a family without it gets the lesson itself and the first
// dish of each group, as before.
import { fail } from './lib/http.js';
import { requireParent } from './auth.js';
import { CONTENT } from './content-data.js';
import { LIBRARY } from './library-data.js';
import { nextReleaseOn } from './release.js';
import { ratingsOf, limitsOf } from './tastes.js';
import { dietView } from '../content/diet.js';
import { courseEntries } from '../content/course.js';
import { ratingItems } from '../content/tastes.js';
import { scoreDish, rankVersions, better } from '../content/score.js';

const lessonById = Object.fromEntries(LIBRARY.lessons.map((L) => [L.id, L]));
const dishById = Object.fromEntries(LIBRARY.course.map((d) => [d.id, d]));
const skillName = Object.fromEntries(CONTENT.skills.map((x) => [x.id, x.name]));
const ITEMS = ratingItems(CONTENT.tastes);
const NAMES = {
  ...Object.fromEntries(Object.entries(ITEMS).map(([k, list]) => [k, Object.fromEntries(list.map((x) => [x.id, x.name]))])),
  tool: Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e.name])),
};
const missingTable = (err) => /no such table/i.test(String(err?.message));

// Everything scoring needs for one family, read once a request: its
// profiles' names and ratings, its limits, and its diet filters. null for a
// family without the next release, or before its draft tables exist.
export async function tasteContext(env, fam) {
  if (!(await nextReleaseOn(env.DB, fam.id))) return null;
  try {
    const { results } = await env.DB.prepare('SELECT id, name FROM profiles WHERE family_id = ? ORDER BY created_at, id').bind(fam.id).all();
    const ratings = await ratingsOf(env, fam.id, results.map((p) => p.id));
    return {
      profiles: results.map((p) => ({ ...p, ratings: ratings[p.id] })),
      limits: await limitsOf(env, fam.id),
      filters: JSON.parse(fam.diet_filters ?? '[]'),
    };
  } catch (err) {
    if (missingTable(err)) return null;
    throw err;
  }
}

// The scoring input for the profiles on one cook. With no one named (a lesson
// not queued for anyone yet), everyone in the family.
function cookCtx(tc, pids) {
  const on = pids?.length ? tc.profiles.filter((p) => pids.includes(p.id)) : tc.profiles;
  return { profiles: on, limits: tc.limits, names: NAMES };
}
const dietOk = (tc, x) => dietView(x, LIBRARY.ingredients, tc.filters).visible;

// A lesson's versions for the profiles on a cook, best first, each with its
// fit and why. A version the family's diet settings hide is listed last,
// marked, and never picked.
export function versionOptions(tc, lid, pids) {
  const L = lessonById[lid];
  if (!tc || !L?.variations?.length) return null;
  const hidden = new Set([L, ...L.variations].filter((v) => !dietOk(tc, v)).map((v) => (v === L ? '' : v.id)));
  const ranked = rankVersions(L, cookCtx(tc, pids)).map((v) => ({ ...v, hidden: hidden.has(v.id) }));
  return [...ranked.filter((v) => !v.hidden), ...ranked.filter((v) => v.hidden)];
}

// The version a cook plays: the family's pick when it made one, or the best
// for the profiles on it. { variation, saved, options } ('' is the lesson).
export function versionFor(tc, choices, lid, pids) {
  const options = versionOptions(tc, lid, pids);
  if (!options) return { variation: choices?.[lid] ?? '', saved: lid in (choices ?? {}), options: null };
  if (choices && lid in choices) return { variation: choices[lid], saved: true, options };
  return { variation: options[0].hidden ? '' : options[0].id, saved: false, options };
}

// How well a dish in the course outline fits the profiles on a course: a
// written one by its best version, a planned one by its tags and minutes.
function dishFit(tc, ctx, id) {
  const L = lessonById[id];
  if (!L) return { ...scoreDish(dishById[id], ctx), written: false };
  const versions = [L, ...(L.variations ?? []).map((v) => ({ ...v, tags: v.tags ?? L.tags }))].filter((v) => dietOk(tc, v));
  if (!versions.length) return { ...scoreDish(L, ctx), written: true, hidden: true };
  const scored = versions.map((v) => ({ ...scoreDish(v, ctx), version: v === L ? '' : v.id, version_title: v.title }));
  return { ...scored.sort(better)[0], written: true };
}

// Every dish's fit for a course's profiles, and the dish each pick-one group
// keeps: the best-scoring one that can be cooked now, or the first when none
// can. A group where nothing fits keeps its closest, with a note: a skill is
// never skipped.
export function courseFits(tc, pids) {
  const ctx = cookCtx(tc, pids);
  const dishes = {}, picks = {}, notes = {};
  for (const d of LIBRARY.course) {
    const f = dishFit(tc, ctx, d.id);
    dishes[d.id] = { fit: f.fit, label: f.label, fits: f.fits, why: f.why, notes: f.notes, score: f.score, ...(f.version ? { version: f.version, version_title: f.version_title } : {}) };
  }
  for (const e of courseEntries(LIBRARY.course)) {
    if (!e.pickOne) continue;
    const ready = e.ids.filter((id) => lessonById[id] && dietOk(tc, lessonById[id]));
    const scored = ready.map((id) => ({ id, ...dishFit(tc, ctx, id) })).map((x, i) => ({ ...x, i }))
      .sort((a, b) => better(a, b) || a.i - b.i);
    picks[e.key] = scored[0]?.id ?? e.ids[0];
    if (scored.length && !scored[0].fits) notes[e.key] = `Nothing for ${lower(skillName[e.pickOne] ?? e.pickOne)} fits everyone yet; this one is closest.`;
  }
  return { dishes, picks, notes };
}
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// The suggested order with the best dish of each pick-one group kept.
export function bestPlan(tc, pids) {
  const { picks } = courseFits(tc, pids);
  const keyOf = Object.fromEntries(courseEntries(LIBRARY.course).flatMap((e) => e.ids.map((id) => [id, e])));
  return LIBRARY.course.map((d) => ({ id: d.id, removed: Boolean(d.pickOne && keyOf[d.id].pickOne && picks[keyOf[d.id].key] !== d.id) }));
}

export function register(on) {
  // Each dish's fit for the profiles a course is for, and the pick for each
  // pick-one group, for the course editor (?profiles=id,id).
  on('GET', '/api/picks/course', async (req, env) => {
    const s = await requireParent(env, req);
    const fam = await env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(s.family_id).first();
    const tc = await tasteContext(env, fam) ?? fail(404, 'not_available', 'Not available yet.');
    const pids = (new URL(req.url).searchParams.get('profiles') ?? '').split(',').filter((p) => tc.profiles.some((x) => x.id === p));
    return courseFits(tc, pids);
  });
}
