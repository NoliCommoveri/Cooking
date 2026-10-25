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
import { releaseOn, LEVELS_RELEASE } from './release.js';
import { ratingsOf, limitsOf } from './tastes.js';
import { dietView } from '../content/diet.js';
import { courseEntries } from '../content/course.js';
import { ratingItems } from '../content/tastes.js';
import { scoreDish, rankVersions, better, learnedFrom } from '../content/score.js';

const lessonById = Object.fromEntries(LIBRARY.lessons.map((L) => [L.id, L]));
const dishById = Object.fromEntries(LIBRARY.course.map((d) => [d.id, d]));
const skillName = Object.fromEntries(CONTENT.skills.map((x) => [x.id, x.name]));
const ITEMS = ratingItems(CONTENT.tastes);
const NAMES = {
  ...Object.fromEntries(Object.entries(ITEMS).map(([k, list]) => [k, Object.fromEntries(list.map((x) => [x.id, x.name]))])),
  tool: Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e.name])),
  cuisine: LIBRARY.cuisines,
};
const missingTable = (err) => /no such table/i.test(String(err?.message));

// Everything scoring needs for one family, read once a request: its
// profiles' names and ratings, its limits, and its diet filters. null before
// its tables exist.
export async function tasteContext(env, fam) {
  try {
    const { results } = await env.DB.prepare('SELECT id, name FROM profiles WHERE family_id = ? ORDER BY created_at, id').bind(fam.id).all();
    const ratings = await ratingsOf(env, fam.id, results.map((p) => p.id));
    const learned = await learnedOf(env, fam.id);
    return {
      profiles: results.map((p) => ({ ...p, ratings: ratings[p.id], learned: learned[p.id] ?? null })),
      limits: await limitsOf(env, fam.id),
      filters: JSON.parse(fam.diet_filters ?? '[]'),
    };
  } catch (err) {
    if (missingTable(err)) return null;
    throw err;
  }
}

// What each profile's cooks have taught (11d3), as { profile: { kind: { item:
// adjust } } }. Empty before the draft's taste_learned table exists.
async function learnedOf(env, fid) {
  try {
    const { results } = await env.DB.prepare('SELECT profile_id, kind, item, adjust FROM taste_learned WHERE family_id = ?').bind(fid).all();
    const out = {};
    for (const r of results) ((out[r.profile_id] ??= { protein: {}, flavor: {}, cuisine: {} })[r.kind] ??= {})[r.item] = r.adjust;
    return out;
  } catch (err) {
    if (missingTable(err)) return {};
    throw err;
  }
}

// Rebuilds what the profiles' cooks have taught (11d3) from every finished
// cook each was on: its own Reflect rating and half the eaters', on the
// cooked version's protein and flavors and the lesson's cuisine. Rebuilt, not
// added to, so a reflection changed later never counts twice. With no pids,
// the whole family. Nothing before its tables exist.
export async function relearn(env, fid, pids = null) {
  try {
    if (!pids) pids = (await env.DB.prepare('SELECT id FROM profiles WHERE family_id = ?').bind(fid).all()).results.map((r) => r.id);
    if (!pids.length) return;
    const marks = pids.map(() => '?').join(', ');
    const { results } = await env.DB.prepare(`SELECT ap.profile_id, ap.rating, a.eater_rating, a.lesson_id, av.variation
        FROM attempts a JOIN attempt_profiles ap ON ap.attempt_id = a.id LEFT JOIN attempt_variations av ON av.attempt_id = a.id
        WHERE a.family_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL AND ap.profile_id IN (${marks})`).bind(fid, ...pids).all();
    const stmts = [env.DB.prepare(`DELETE FROM taste_learned WHERE family_id = ? AND profile_id IN (${marks})`).bind(fid, ...pids)];
    for (const pid of pids) {
      // A family recipe has no tags, and teaches nothing here.
      const cooks = results.filter((r) => r.profile_id === pid && lessonById[r.lesson_id]).map((r) => {
        const L = lessonById[r.lesson_id];
        const v = versionSummary(r.lesson_id, r.variation ?? '');
        return { rating: r.rating, eater: r.eater_rating, tags: v.tags ?? L.tags, cuisine: v.cuisine ?? L.cuisine };
      });
      const learned = learnedFrom(cooks);
      for (const [kind, items] of Object.entries(learned)) {
        for (const [item, x] of Object.entries(items)) {
          if (!x.adjust) continue;
          stmts.push(env.DB.prepare('INSERT INTO taste_learned (family_id, profile_id, kind, item, adjust, cooks) VALUES (?, ?, ?, ?, ?, ?)').bind(fid, pid, kind, item, x.adjust, x.cooks));
        }
      }
    }
    await env.DB.batch(stmts);
  } catch (err) {
    if (!missingTable(err)) throw err;
  }
}

// The scoring input for the profiles on one cook. With no one named (a lesson
// not queued for anyone yet), everyone in the family.
export function cookCtx(tc, pids) {
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
export function dishFit(tc, ctx, id) {
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

// ---------- Level weeks (12d) ----------

// A Level week's recipes: its Familiar and Explore dishes and swap-ins
// (§12.2), then any other recipe that teaches its skill, from the course and
// the Level's cards.
export function levelCandidates(V, w) {
  const options = [...new Set([w.familiar ?? w.recipe, w.explore, ...(w.options ?? [])].filter(Boolean))];
  const skilled = w.skill ? [...LIBRARY.course, ...V.cards].filter((d) => d.skills?.includes(w.skill)).map((d) => d.id) : [];
  return { options, more: [...new Set(skilled)].filter((id) => !options.includes(id)) };
}

// How a Level recipe fits: a course dish or lesson as in the course editor, a
// Level-only card by its tags until it's written.
function levelFit(tc, ctx, V, id) {
  if (lessonById[id] || dishById[id]) return dishFit(tc, ctx, id);
  return { ...scoreDish(V.cards.find((c) => c.id === id) ?? {}, ctx), written: false };
}
const titleOf = (V, id) => lessonById[id]?.title ?? V.titles[id] ?? dishById[id]?.title ?? V.cards.find((c) => c.id === id)?.title ?? id;

// Best first within a week: one that fits, then one written (so the week has
// something to cook now), then by score; one a profile on the course has
// already cooked comes last (owner, 2026-10-24); then the order given.
const levelOrder = (a, b) => (Number(a.cooked) - Number(b.cooked)) || (Number(b.fits) - Number(a.fits)) || (Number(b.written) - Number(a.written)) || better(a, b) || a.i - b.i;

// Every week's recipes with their fit for the profiles on a Level course, for
// the course editor's Change and Swap recipe (12d). Best fit no longer picks a
// week's recipe: a course cooks its start slot's dish, and best fit only fills
// in (14c). cooked: recipes a profile on the course has cooked.
export function levelPlan(tc, V, pids, cooked = new Set()) {
  const ctx = cookCtx(tc, pids);
  const out = (x) => ({ id: x.id, title: titleOf(V, x.id), fit: x.fit, label: x.label, fits: x.fits, why: x.why, notes: x.notes, written: x.written, cooked: x.cooked, hidden: Boolean(x.hidden) });
  const score = (ids) => ids.map((id, i) => ({ id, i, cooked: cooked.has(id), ...levelFit(tc, ctx, V, id) }));
  // The week's own dishes in their order (Familiar, Explore, swap-ins); the others best fit first.
  return {
    weeks: V.weeks.filter((w) => w.recipe).map((w) => {
      const { options, more } = levelCandidates(V, w);
      return { week: w.week, options: score(options).map(out), more: score(more).sort(levelOrder).map(out) };
    }),
  };
}

// Every lesson in the library the family's diet settings allow, outside the
// Appointed Times (Swap has those), best first for the profiles on a cook,
// each with whether any of them has cooked it or has it queued. For Add a lesson and Chef
// Ruth's "What should we cook?" (11d2).
export async function rankLessons(env, fam, tc, pids) {
  const ctx = cookCtx(tc, pids);
  const seasonal = new Set(LIBRARY.seasonal);
  const cooked = new Set(), queued = new Set();
  if (pids.length) {
    const { results } = await env.DB.prepare(`SELECT DISTINCT a.lesson_id FROM attempts a JOIN attempt_profiles ap ON ap.attempt_id = a.id
        WHERE a.family_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL AND ap.profile_id IN (${pids.map(() => '?').join(', ')})`).bind(fam.id, ...pids).all();
    results.forEach((r) => cooked.add(r.lesson_id));
    const { results: q } = await env.DB.prepare(`SELECT DISTINCT q.lesson_id FROM queue q JOIN queue_profiles qp ON qp.queue_id = q.id
        WHERE q.family_id = ? AND q.status IN ('requested', 'assigned', 'shopped') AND qp.profile_id IN (${pids.map(() => '?').join(', ')})`).bind(fam.id, ...pids).all();
    q.forEach((r) => queued.add(r.lesson_id));
  }
  return LIBRARY.lessons.filter((L) => !seasonal.has(L.unit) && dietOk(tc, L))
    .map((L, i) => ({ L, f: dishFit(tc, ctx, L.id), i }))
    .sort((a, b) => better(a.f, b.f) || a.i - b.i)
    .map(({ L, f }) => ({
      id: L.id, title: L.title, image: L.image, fit: f.fit, label: f.label, fits: f.fits, why: f.why, notes: f.notes, score: f.score,
      ...(f.version ? { version: f.version, version_title: f.version_title } : {}), cooked: cooked.has(L.id), queued: queued.has(L.id),
    }));
}

// Optional ingredients someone on the cook rated 1 star (11d2): left out of
// the lesson and the shopping list, as diet filters leave things out (§2.1).
// version: a lesson summary, or one of its variations. Returns
// [{ ingredient, name, who: [names] }].
const ITEM_LINES = [...CONTENT.tastes.proteins.map((x) => ['protein', x]), ...CONTENT.tastes.ingredients.map((x) => ['ingredient', x])];
export function hatedExtras(tc, version, pids) {
  if (!tc || !version) return [];
  const on = cookCtx(tc, pids).profiles;
  const out = [];
  for (const line of version.ingredients ?? []) {
    if (!line.optional || out.some((x) => x.ingredient === line.ingredient)) continue;
    const who = on.filter((p) => ITEM_LINES.some(([kind, item]) => item.ingredients.includes(line.ingredient) && p.ratings?.[kind]?.[item.id] === 1)).map((p) => p.name);
    if (who.length) out.push({ ingredient: line.ingredient, name: LIBRARY.ingredients[line.ingredient]?.name ?? line.ingredient, who });
  }
  return out;
}
// The lesson summary a version id names ('' is the lesson itself).
export const versionSummary = (lid, vid) => {
  const L = lessonById[lid];
  return (vid && L?.variations?.find((v) => v.id === vid)) || L || null;
};

// The lessons any of these profiles has cooked (not on the Sabbath, not
// taken back), for a Level week's pick: those come last (owner, 2026-10-24).
export async function cookedBy(env, fid, pids) {
  if (!pids.length) return new Set();
  const { results } = await env.DB.prepare(`SELECT DISTINCT a.lesson_id, a.finished_at FROM attempts a JOIN attempt_profiles ap ON ap.attempt_id = a.id AND ap.family_id = a.family_id
      WHERE a.family_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL AND ap.profile_id IN (${pids.map(() => '?').join(', ')})`).bind(fid, ...pids).all();
  // By the UTC day: a cook's own Sabbath check needs the family's offset, and
  // here it only orders the list.
  return new Set(results.filter((r) => new Date(r.finished_at).getUTCDay() !== 6).map((r) => r.lesson_id));
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

  // A Level's weeks with each recipe's fit for the profiles a course is for,
  // for the course editor (?level=sp-3&profiles=id,id).
  on('GET', '/api/picks/level', async (req, env) => {
    const s = await requireParent(env, req);
    const fam = await env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(s.family_id).first();
    const tc = await tasteContext(env, fam) ?? fail(404, 'not_available', 'Not available yet.');
    const q = new URL(req.url).searchParams;
    // A Level shows with the Levels' release (§8.6).
    const V = LIBRARY.levels?.[q.get('level')];
    if (!V || !(await releaseOn(env.DB, s.family_id, LEVELS_RELEASE))) fail(404, 'not_found', 'No such Level.');
    const pids = (q.get('profiles') ?? '').split(',').filter((p) => tc.profiles.some((x) => x.id === p));
    return levelPlan(tc, V, pids, await cookedBy(env, s.family_id, pids));
  });

  // The library, best first for the profiles on a cook (?profiles=id,id).
  on('GET', '/api/picks/lessons', async (req, env) => {
    const s = await requireParent(env, req);
    const fam = await env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(s.family_id).first();
    const tc = await tasteContext(env, fam) ?? fail(404, 'not_available', 'Not available yet.');
    const pids = (new URL(req.url).searchParams.get('profiles') ?? '').split(',').filter((p) => tc.profiles.some((x) => x.id === p));
    return { lessons: await rankLessons(env, fam, tc, pids) };
  });
}
