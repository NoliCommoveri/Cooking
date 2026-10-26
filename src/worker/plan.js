// Phase 3a: the queue, course plans and the weekly schedule, kid requests,
// safety review, and test-cooked marks (plan §6.1, §6.2, §6.17, §6.18). Every
// query is scoped by the session's family_id, as in api.js.
//
// The queue is the one "up next" list in both modes. A parent adds lessons, a
// kid asks for one (a parent approves it), an adult profile taps Cook this, or
// a course's weekly schedule loads them. The schedule itself isn't stored
// (schedule.js): each read works it out and brings the queue's course rows in
// line with it.
import { fail, now } from './lib/http.js';
import { randomHex } from './lib/crypto.js';
import { requireSession, requireParent, ownProfile, checkPin } from './auth.js';
import { LIBRARY } from './library-data.js';
import { CONTENT } from './content-data.js';
import { liveLesson, livePatches } from './lessons.js';
import { dietView } from '../content/diet.js';
import { servingOptions } from '../content/scale.js';
import { courseEntries, numberCourse } from '../content/course.js';
import { schedule, weekOf, addDays, localDay, isDay, isSabbath, DUE_DAY } from './schedule.js';
import { isRecipeId, lessonFor, recipeNames, recipeVisible } from './recipes.js';
import { tasteContext, versionFor, bestPlan, hatedExtras, versionSummary, levelPlan, levelCandidates, cookedBy } from './picks.js';
import { variationChoices } from './variations.js';
import { releaseOn, familyRelease, LEVELS_RELEASE } from './release.js';
import { PARTS, PART_NAMES, coursePartsOf, weekParts, plannedMinutes, hoursOf } from '../content/levels.js';

const id = () => randomHex(8);
const ACTIVE = ['requested', 'assigned', 'shopped'];
const ASK_MAX = 5;       // requests one profile can have waiting at once
const QUEUE_MAX = 30;    // lessons one profile can have queued by hand at once
const PER_WEEK_MAX = 7;
const EXTRA_MAX = 7;

// course_lessons.removed: kept, taken out in the plan, or Skip this recipe.
const KEPT = 0, REMOVED = 1, SKIPPED = 2;
// Unit 1 is knife work (§4.0).
const unitOne = LIBRARY.course.filter((d) => d.unit === 1).map((d) => d.id);

const lessonById = Object.fromEntries(LIBRARY.lessons.map((L) => [L.id, L]));
const dishById = Object.fromEntries(LIBRARY.course.map((d) => [d.id, d]));
// The Levels (§12), by id: what a Level course can be, with their release.
const LEVELS = LIBRARY.levels ?? {};
const placeholders = (list) => list.map(() => '?').join(', ');
const toolNames = Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e.name]));
// A Level recipe's title: its lesson's, or its card's until it's written.
const titleOfLevel = (V, id) => lessonById[id]?.title ?? V.titles[id] ?? dishById[id]?.title ?? id;

// ---------- small helpers ----------

// The version a row plays (§6.21), for its Version button: the family's pick,
// or the best for the profiles on it, with every version's fit. null for a
// lesson with no other versions, and on a Level course (14e), which plays the
// Level's own version.
function versionOut(tc, choices, lid, pids, level = null) {
  if (level) return null;
  const v = versionFor(tc, choices, lid, pids);
  if (!v.options) return null;
  const on = tc.profiles.filter((p) => !pids?.length || pids.includes(p.id)).map((p) => p.name);
  return {
    id: v.variation, saved: v.saved, title: v.options.find((o) => o.id === v.variation)?.title ?? lessonById[lid].title, best_for: on,
    options: v.options.map(({ id, title, fit, label, why, notes, hidden }) => ({ id, title, fit, label, why, notes, hidden })),
  };
}
const versionPicker = async (env, fam, tc = undefined) => {
  tc = tc === undefined ? await tasteContext(env, fam) : tc;
  if (!tc) return () => null;
  const choices = await variationChoices(env, fam.id);
  return (lid, pids, level = null) => versionOut(tc, choices, lid, pids, level);
};
// The Level a queue row is cooked on (14e): its course's, for a Level course.
const rowLevels = async (env, fid) => {
  const of = Object.fromEntries((await activeCourses(env, fid)).filter((c) => c.program).map((c) => [c.id, c.program]));
  return (r) => (r.course_id && of[r.course_id]) || null;
};

// The family's row, with the newest release it sees (§8.6).
export const family = async (env, fid) => {
  const fam = await env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(fid).first();
  return fam && { ...fam, release: await familyRelease(env.DB, fid) };
};
export const weeksOn = (fam) => fam.mode === 'homeschool' || Boolean(fam.plan_weeks);
// A Level's own recipe (§12.4) shows with the Levels' release.
export const levelLessonOn = (L, release) => !L.level || release >= LEVELS_RELEASE;
// The Levels a family can set a course up on: all of them, with their release.
export const levelsOn = (release) => (release >= LEVELS_RELEASE ? Object.values(LEVELS) : []);
// The lessons a family can cook: its diet settings allow them, and a Level's
// own recipes (§12.4) only with their release.
const visible = (fam) => {
  const filters = JSON.parse(fam.diet_filters);
  return new Set(LIBRARY.lessons.filter((L) => levelLessonOn(L, fam.release) && dietView(L, LIBRARY.ingredients, filters).visible).map((L) => L.id));
};
const nearestSize = (L, n) => {
  const options = servingOptions(L);
  return options.includes(n) ? n : options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
};

// The family's calendar day, from the browser's offset (?tz=300). A missing or
// odd offset counts as UTC.
export const tzOf = (req) => {
  const tz = Number(new URL(req.url).searchParams.get('tz') ?? 0);
  return Number.isInteger(tz) && Math.abs(tz) <= 840 ? tz : 0;
};
export const today = (req) => localDay(new Date().toISOString(), tzOf(req));

async function familyProfiles(env, fid, ids) {
  const list = Array.isArray(ids) ? [...new Set(ids.map(String))] : [];
  if (list.length < 1 || list.length > 20) fail(400, 'invalid', 'Pick 1 to 20 profiles.');
  const { results } = await env.DB.prepare(`SELECT id, audience FROM profiles WHERE family_id = ? AND id IN (${placeholders(list)})`).bind(fid, ...list).all();
  if (results.length !== list.length) fail(400, 'invalid', 'A profile picked is not in your family.');
  return list;
}

const servingsFor = (L, v, fam) => {
  if (v == null) return nearestSize(L, fam.default_servings);
  const n = Number(v);
  if (!servingOptions(L).includes(n)) fail(400, 'invalid', `${L.title} can't be made for ${v}.`);
  return n;
};
const plannedDate = (v) => {
  if (v == null || v === '') return null;
  if (!isDay(v)) fail(400, 'invalid', 'The planned date must be a date.');
  return v;
};
// A library lesson, or one of the family's recipes ("recipe:<id>", §6.10).
const queueLesson = async (env, lid, fam) => {
  if (isRecipeId(lid)) {
    const found = await lessonFor(env, fam.id, lid) ?? fail(400, 'invalid', 'No such recipe.');
    if (!recipeVisible(found, JSON.parse(fam.diet_filters))) fail(400, 'invalid', `${found.lesson.title} is hidden by your family's diet settings.`);
    return found.lesson;
  }
  const L = lessonById[lid] ?? fail(400, 'invalid', 'No such lesson.');
  if (!levelLessonOn(L, fam.release)) fail(400, 'invalid', 'No such lesson.');
  if (!visible(fam).has(L.id)) fail(400, 'invalid', `${L.title} is hidden by your family's diet settings.`);
  return L;
};

async function queueRow(env, fid, qid) {
  return (await env.DB.prepare('SELECT * FROM queue WHERE id = ? AND family_id = ?').bind(qid, fid).first()) ?? fail(404, 'not_found', 'No such queued lesson.');
}

// The week a queued item is for: a course lesson's week, a planned date's
// week, or this week.
export const weekFor = (r, day) => r.week_start ?? (r.planned_date ? weekOf(r.planned_date) : weekOf(day));

// What happens to a queued lesson another one replaces (Swap for an Appointed
// Time meal, §6.19, and a request approved as "Replace an assigned meal"): a
// course lesson stays in the plan and goes first next week, and the planned
// finish moves back with it, so it's never behind; a lesson queued by hand
// comes off the queue. Returns the replacing row's swap_of and the statements.
export function replaceStatements(env, fid, r, week, t) {
  if (r.course_id) {
    return { swapOf: `c:${r.course_id}:${r.lesson_id}`, stmts: [env.DB.prepare(`INSERT INTO course_weeks (course_id, family_id, week_start, skipped, extra, swapped) VALUES (?, ?, ?, 0, 0, 1)
        ON CONFLICT(course_id, week_start) DO UPDATE SET swapped = swapped + 1`).bind(r.course_id, fid, week)] };
  }
  return { swapOf: `q:${r.id}`, stmts: [env.DB.prepare("UPDATE queue SET status = 'removed', closed_at = ? WHERE id = ? AND family_id = ?").bind(t, r.id, fid)] };
}

// The meal a request replaces: an assigned lesson on the asker's list that
// isn't already a swap.
async function replaceable(env, fid, qid, pid) {
  const r = await queueRow(env, fid, qid);
  if (!['assigned', 'shopped'].includes(r.status)) fail(409, 'closed', 'That lesson is no longer in the queue.');
  if (r.swap_of) fail(409, 'swapped', 'That one already replaced another meal. Pick a different one.');
  const on = await env.DB.prepare('SELECT 1 FROM queue_profiles WHERE queue_id = ? AND family_id = ? AND profile_id = ?').bind(r.id, fid, pid).first();
  if (!on) fail(400, 'invalid', "That meal isn't on their list.");
  return r;
}

// Approving a request (or a lesson a kid wants to cook now): either an extra
// assigned meal, or one that replaces an assigned meal (owner, 2026-10-23).
// Either way it never pushes the course's assigned lessons back (schedule.js).
// row: the request to approve, or null to make a new one for pid.
// day: the planned date for an extra meal (today, when a kid is cooking it now).
async function approveStatements(env, s, fam, { row, L, pid, replace, servings, req, day = null }) {
  const t = now();
  const stmts = [];
  let qid = row?.id ?? id(), who = [pid], week = null, swapOf = null, planned = replace ? null : day;
  if (replace) {
    const r = await replaceable(env, s.family_id, String(replace), pid);
    week = weekFor(r, today(req));
    who = (await queueProfiles(env, s.family_id, [r.id]))[r.id] ?? [pid];
    const out = replaceStatements(env, s.family_id, r, week, t);
    swapOf = out.swapOf;
    stmts.push(...out.stmts);
    if (!r.course_id) { week = r.week_start; planned = r.planned_date; }
    servings ??= r.servings;
  }
  const size = servingsFor(L, servings, fam);
  if (row) {
    stmts.unshift(env.DB.prepare("UPDATE queue SET status = 'assigned', servings = ?, planned_date = ?, week_start = ?, swap_of = ? WHERE id = ? AND family_id = ?")
      .bind(size, planned, week, swapOf, row.id, s.family_id));
  } else {
    stmts.unshift(env.DB.prepare(`INSERT INTO queue (id, family_id, lesson_id, servings, planned_date, status, source, requested_by_profile_id, week_start, swap_of, created_at)
        VALUES (?, ?, ?, ?, ?, 'assigned', 'request', ?, ?, ?, ?)`).bind(qid, s.family_id, L.id, size, planned, pid, week, swapOf, t));
  }
  stmts.push(env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(qid, s.family_id));
  for (const p of who) stmts.push(env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(qid, s.family_id, p));
  return { qid, stmts };
}

// ---------- course plans ----------

// A course's plan: every dish in the course outline in this course's order,
// each kept or removed. A dish added to the outline after the plan was saved
// goes where the suggested order puts it, kept unless it's a second choice in
// a pick-one group.
async function planOf(env, course) {
  if (course.program) return levelPlanOf(env, course);
  const { results } = await env.DB.prepare('SELECT lesson_id, position, removed FROM course_lessons WHERE course_id = ? AND family_id = ? ORDER BY position')
    .bind(course.id, course.family_id).all();
  const known = results.filter((r) => dishById[r.lesson_id]);
  const order = courseEntries(known.map((r) => dishById[r.lesson_id])).map((e) => e.key);
  const removed = known.filter((r) => r.removed).map((r) => r.lesson_id);
  const skipped = known.filter((r) => r.removed === SKIPPED).map((r) => r.lesson_id);
  const saved = new Set(known.map((r) => r.lesson_id));
  for (const e of courseEntries(LIBRARY.course)) e.ids.slice(1).forEach((x) => { if (!saved.has(x) && e.pickOne) removed.push(x); });
  return { order, removed, skipped };
}

// What a Level course's weeks start with (14c): each week's Familiar or its
// Explore dish. A course with no row starts with Familiar.
export const STARTS = ['familiar', 'explore'];
async function courseStartOf(env, course) {
  const r = await env.DB.prepare('SELECT starts FROM course_starts WHERE course_id = ? AND family_id = ?').bind(course.id, course.family_id).first();
  return r?.starts ?? 'familiar';
}
// A new Level course's start, preset from "how adventurous" (owner,
// 2026-10-25): Bring it on or A bit adventurous start with Explore; Stick to
// what we know, or not set, with Familiar.
export const startPreset = (adventurous) => (adventurous === 'adventurous' || adventurous === 'a-bit' ? 'explore' : 'familiar');
async function familyPreset(env, fid) {
  const r = await env.DB.prepare('SELECT adventurous FROM family_limits WHERE family_id = ?').bind(fid).first();
  return startPreset(r?.adventurous ?? null);
}
const startsInput = (x) => (STARTS.includes(x) ? x : fail(400, 'invalid', 'Each week starts with familiar or explore.'));

// Each recipe week's dish on a Level course (14c), worked out when the plan
// is read, not saved per week:
//   - a week with a row in course_lessons (the parent changed or skipped it)
//     keeps its row's dish;
//   - a week whose Familiar or Explore dish is on the course's queue, a
//     shopping list, or cooked keeps that one;
//   - otherwise the start slot's dish, or the other slot's when the diet
//     settings hide it or it needs a tool the family doesn't have; a start
//     dish not written yet cooks the other while only that one is written
//     (owner, 2026-10-25), and moves to its own once it's written.
// Best fit never picks a Level week's dish (owner, 2026-10-25). A week whose
// dishes are both written and both ruled out is blocked: it holds the course,
// with why, for the parent to check the settings, request a replacement,
// change it, or go on to the next week. A week with a dish still being
// written waits quietly for it, as before. A recipe is in one week at
// most. rows: { week: course_lessons row }; held: the course's queued or
// cooked dishes. Returns { ids: { week: id }, blocked: { week: reasons } },
// and why, what rules a dish out (ruledOut), for Cook this instead (14d).
async function levelWeekDishes(env, fam, V, starts, rows, held) {
  const why = await ruledOut(env, fam);
  const used = new Set(Object.values(rows).map((r) => r.lesson_id));
  const recipeWeeks = V.weeks.filter((w) => w.recipe && !rows[w.week]);
  const ids = {}, blocked = {};
  for (const w of recipeWeeks) {
    const kept = [w.familiar, w.explore].find((id) => held.has(id) && !used.has(id));
    if (kept) { ids[w.week] = kept; used.add(kept); }
  }
  for (const w of recipeWeeks.filter((x) => !ids[x.week])) {
    const pair = (starts === 'explore' ? [w.explore, w.familiar] : [w.familiar, w.explore]).filter((id) => !used.has(id));
    const can = pair.find((id) => lessonById[id] && !why(id));
    const out = pair.filter((id) => lessonById[id] && why(id));
    const id = can ?? pair.find((x) => !lessonById[x]) ?? out[0] ?? w.recipe;
    if (!can && out.length && out.length === pair.length) blocked[w.week] = pair.map((x) => ({ id: x, title: titleOfLevel(V, x), written: true, why: why(x) }));
    ids[w.week] = id;
    used.add(id);
  }
  return { ids, blocked, why };
}

// What rules a written dish out for a family, in words, or null: each
// ingredient its diet settings leave out (with no substitution), and each
// tool it needs that the family marked they don't have.
async function ruledOut(env, fam) {
  const filters = JSON.parse(fam.diet_filters ?? '[]');
  const limits = await env.DB.prepare('SELECT missing_tools FROM family_limits WHERE family_id = ?').bind(fam.id).first();
  const missing = JSON.parse(limits?.missing_tools ?? '[]');
  return (id) => {
    const L = lessonById[id];
    if (!L) return null;
    const out = [
      ...dietView(L, LIBRARY.ingredients, filters).blockedBy.map((i) => {
        const tags = (LIBRARY.ingredients[i]?.contains ?? []).filter((t) => filters.includes(t));
        return { kind: 'diet', item: LIBRARY.ingredients[i]?.name ?? i, tags };
      }),
      ...(L.tools ?? []).filter((t) => missing.includes(t)).map((t) => ({ kind: 'tool', item: toolNames[t] ?? t, tags: [t] })),
    ];
    return out.length ? out : null;
  };
}

// The weeks of a Level this family has requested a replacement for (14c).
// Empty before the draft's table exists.
async function requestedWeeks(env, fid, level) {
  try {
    const { results } = await env.DB.prepare('SELECT week FROM level_requests WHERE family_id = ? AND level = ?').bind(fid, level).all();
    return new Set(results.map((r) => r.week));
  } catch { return new Set(); }
}

// A Level course's plan (§12.4): each week's recipe in week order, one Level
// week a calendar week, so the schedule works as it does for any course. A
// row's position is its week. The weeks with no recipe (the practice run and
// the capstone) aren't in it. changed: the week has a row. starts: the start
// to work it out with, when it's being changed.
async function levelPlanOf(env, course, starts = null) {
  const V = LEVELS[course.program];
  const fam = await family(env, course.family_id);
  starts ??= await courseStartOf(env, course);
  const { results } = await env.DB.prepare('SELECT lesson_id, position, removed FROM course_lessons WHERE course_id = ? AND family_id = ?')
    .bind(course.id, course.family_id).all();
  const byWeek = Object.fromEntries(results.filter((r) => V.weeks.some((w) => w.week === r.position && w.recipe)).map((r) => [r.position, r]));
  const { results: queued } = await env.DB.prepare("SELECT DISTINCT lesson_id FROM queue WHERE family_id = ? AND course_id = ? AND status IN ('assigned', 'shopped', 'cooked')")
    .bind(course.family_id, course.id).all();
  const { ids, blocked, why } = await levelWeekDishes(env, fam, V, starts, byWeek, new Set(queued.map((r) => r.lesson_id)));
  const weeks = V.weeks.filter((w) => w.recipe).map((w) => (byWeek[w.week]
    ? { week: w.week, id: byWeek[w.week].lesson_id, removed: byWeek[w.week].removed, changed: true }
    : { week: w.week, id: ids[w.week], removed: KEPT, changed: false, ...(blocked[w.week] ? { blocked: blocked[w.week] } : {}) }));
  return {
    order: weeks.map((x) => x.id), removed: weeks.filter((x) => x.removed).map((x) => x.id),
    skipped: weeks.filter((x) => x.removed === SKIPPED).map((x) => x.id), weeks, starts, why,
  };
}

// A Level's weeks as a new course for this family would plan them, for each
// start: { familiar: { ids, blocked }, explore: { ids, blocked } }, for setup.
async function levelDefaults(env, fam, V) {
  return Object.fromEntries(await Promise.all(STARTS.map(async (x) => [x, await levelWeekDishes(env, fam, V, x, {}, new Set())])));
}

// The parent's picks for some of a Level's weeks (12d), checked: each is one
// of the week's recipes (its dishes and swap-ins, or another with its skill),
// and none is in two weeks of the plan it changes (so a mastery week doesn't
// repeat weeks 1-3 of its unit, owner, 2026-10-24). Returns { week: id }.
function levelPicksInput(V, plan, list) {
  if (!Array.isArray(list)) fail(400, 'invalid', "A Level course's weeks list each week's recipe.");
  const picks = {};
  for (const x of list) {
    const w = V.weeks.find((y) => y.week === Number(x?.week) && y.recipe) ?? fail(400, 'invalid', 'No such week.');
    const id = String(x.id ?? '');
    const { options, more } = levelCandidates(V, w);
    if (![...options, ...more].includes(id)) fail(400, 'invalid', `That recipe isn't one of week ${w.week}'s.`);
    picks[w.week] = id;
  }
  const seen = {};
  for (const x of plan.weeks) {
    const id = picks[x.week] ?? x.id;
    if (seen[id]) fail(400, 'invalid', `A recipe can be in one week only: ${V.titles[id] ?? lessonById[id]?.title ?? id} is in weeks ${seen[id]} and ${x.week}.`);
    seen[id] = x.week;
  }
  return picks;
}

// A row for each week the parent picked a recipe for: the week keeps it
// whatever the course starts with. A skipped week stays skipped.
const levelPickStatements = (env, course, plan, picks) => Object.entries(picks).flatMap(([week, lid]) => [
  env.DB.prepare('DELETE FROM course_lessons WHERE course_id = ? AND family_id = ? AND (position = ? OR lesson_id = ?)').bind(course.id, course.family_id, Number(week), lid),
  env.DB.prepare('INSERT INTO course_lessons (course_id, family_id, lesson_id, position, removed) VALUES (?, ?, ?, ?, ?)')
    .bind(course.id, course.family_id, lid, Number(week), plan.weeks.find((x) => x.week === Number(week))?.removed ?? KEPT),
]);
const startStatement = (env, course, starts) => env.DB.prepare(`INSERT INTO course_starts (course_id, family_id, starts, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(course_id) DO UPDATE SET starts = excluded.starts, updated_at = excluded.updated_at`).bind(course.id, course.family_id, starts, now());

// Which program each of a family's courses is: a Level's id, or null for
// Cook Around the World (no row). Empty before its table exists. A Level
// course waits, out of sight, while the Levels' release is off for the family
// (§8.6): Undo launch puts the app back as it was, and nothing is lost.
async function withPrograms(env, fid, rows) {
  let progs = {};
  try {
    const { results } = await env.DB.prepare('SELECT course_id, program, parts FROM course_programs WHERE family_id = ?').bind(fid).all();
    progs = Object.fromEntries(results.filter((r) => LEVELS[r.program]).map((r) => [r.course_id, r]));
  } catch { /* the table isn't there yet */ }
  const pics = Object.keys(progs).length ? await picturesPicked(env, fid) : {};
  // A Level course's parts kept on (a parent can turn any off), and how each
  // learner's step pictures show.
  const out = rows.map((c) => ({ ...c, program: progs[c.id]?.program ?? null, ...(progs[c.id] ? { parts: coursePartsOf(progs[c.id].parts), pictures: pics[c.id] ?? {} } : {}) }));
  if (!out.some((c) => c.program)) return out;
  if (await releaseOn(env.DB, fid, LEVELS_RELEASE)) return out;
  return out.filter((c) => !c.program);
}

// Step pictures (14e): 'shown' under each step, or 'button', behind Show me.
// A Level 2 course shows them; Level 3 and 4 put them behind Show me
// (owner, 2026-10-26). A parent can change it for each learner on the course
// (course_pictures, in the draft migration); only a change from the Level's
// way is kept.
export const PICTURES = ['shown', 'button'];
export const picturesDefault = (program) => (program === 'sp-2' ? 'shown' : 'button');
export const picturesFor = (course, pid) => course.pictures?.[pid] ?? picturesDefault(course.program);
// { course_id: { profile_id: 'shown' | 'button' } }. Empty before the table exists.
async function picturesPicked(env, fid) {
  const out = {};
  try {
    const { results } = await env.DB.prepare('SELECT course_id, profile_id, shown FROM course_pictures WHERE family_id = ?').bind(fid).all();
    for (const r of results) (out[r.course_id] ??= {})[r.profile_id] = r.shown ? 'shown' : 'button';
  } catch (err) { if (!/no such table/i.test(String(err?.message))) throw err; }
  return out;
}
const picturesInput = (x, pids) => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) fail(400, 'invalid', 'Step pictures must be a setting for each learner.');
  for (const [pid, v] of Object.entries(x)) if (!pids.includes(pid) || !PICTURES.includes(v)) fail(400, 'invalid', 'Step pictures are shown or behind Show me, for a learner on the course.');
  return x;
};
// Saved apart from the course, so a course still saves before /ops applies
// the draft. Returns false when the table isn't there yet.
async function savePictures(env, course, program, pictures) {
  const keep = Object.entries(pictures).filter(([, v]) => v !== picturesDefault(program));
  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM course_pictures WHERE course_id = ? AND family_id = ?').bind(course.id, course.family_id),
      ...keep.map(([pid, v]) => env.DB.prepare('INSERT INTO course_pictures (course_id, family_id, profile_id, shown, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(course.id, course.family_id, pid, v === 'shown' ? 1 : 0, now())),
    ]);
    return true;
  } catch (err) {
    if (/no such table/i.test(String(err?.message))) return false;
    throw err;
  }
}

// A new course with no plan sent (Chef Ruth's): the best dish of each
// pick-one group for its profiles (§6.21).
async function defaultFor(env, fid, pids) {
  const tc = await tasteContext(env, await family(env, fid));
  return tc ? bestPlan(tc, pids) : defaultPlan();
}

// The suggested order with the first dish of each pick-one group kept.
function defaultPlan() {
  return LIBRARY.course.map((d, i, all) => ({ id: d.id, removed: Boolean(d.pickOne && all[i - 1]?.pickOne === d.pickOne) }));
}

function planInput(list) {
  if (!Array.isArray(list) || !list.length) fail(400, 'invalid', 'A course plan lists its dishes.');
  const seen = new Set();
  return list.map((x) => {
    const lid = String(x?.id ?? '');
    if (!dishById[lid]) fail(400, 'invalid', `"${lid}" is not in the course.`);
    if (seen.has(lid)) fail(400, 'invalid', `"${lid}" is in the plan twice.`);
    seen.add(lid);
    return { id: lid, removed: Boolean(x.removed) };
  });
}

const planStatements = (env, course, plan) => [
  env.DB.prepare('DELETE FROM course_lessons WHERE course_id = ? AND family_id = ?').bind(course.id, course.family_id),
  ...plan.map((x, i) => env.DB.prepare('INSERT INTO course_lessons (course_id, family_id, lesson_id, position, removed) VALUES (?, ?, ?, ?, ?)')
    .bind(course.id, course.family_id, x.id, i, x.removed ? REMOVED : KEPT)),
];

async function courseProfiles(env, course) {
  const { results } = await env.DB.prepare('SELECT profile_id FROM course_profiles WHERE course_id = ? AND family_id = ?').bind(course.id, course.family_id).all();
  return results.map((r) => r.profile_id);
}

// The dishes in a course plan with numbers, and the ones the schedule can use:
// written, kept, and not hidden by the family's diet settings.
async function courseLessons(env, course, fam) {
  if (course.program) return levelLessons(env, course, fam);
  const plan = await planOf(env, course);
  const numbered = numberCourse(LIBRARY.course, plan);
  const kept = numbered.entries.flatMap((e) => e.ids);
  const shown = visible(fam);
  return {
    plan, labels: { ...numbered.labels, ...LIBRARY.seasonalLabels }, total: numbered.total, kept,
    usable: kept.filter((x) => shown.has(x)),
    unwritten: kept.filter((x) => !lessonById[x]).length,
    hidden: kept.filter((x) => lessonById[x] && !shown.has(x)).length,
  };
}

// A Level course's recipes (§12.4). They keep the kitchen's usual lesson
// numbers; the parent sees each one's Level week. unwritten counts the weeks
// with no recipe yet too.
async function levelLessons(env, course, fam) {
  const V = LEVELS[course.program];
  const plan = await levelPlanOf(env, course);
  const kept = plan.weeks.filter((x) => !x.removed).map((x) => x.id);
  const shown = visible(fam);
  // A blocked week (14c) holds the schedule, unqueued, until the parent acts on it.
  const blocked = Object.fromEntries(plan.weeks.filter((x) => x.blocked && !x.removed).map((x) => [x.id, x.blocked]));
  return {
    plan, labels: suggestedLabels, total: numberCourse(LIBRARY.course).total, kept,
    usable: kept.filter((x) => shown.has(x) || blocked[x]),
    unwritten: kept.filter((x) => !lessonById[x]).length + V.weeks.filter((w) => !w.recipe).length,
    hidden: kept.filter((x) => lessonById[x] && !shown.has(x) && !blocked[x]).length,
    blocked, requested: await requestedWeeks(env, course.family_id, V.id),
    level: V, weekOf: Object.fromEntries(plan.weeks.map((x) => [x.id, x.week])), idOf: Object.fromEntries(plan.weeks.map((x) => [x.week, x.id])),
    // For Cook this instead (14d): what rules a dish out, each week's swap
    // still standing, and the dishes on the course's shopping lists.
    why: plan.why, swaps: await levelSwaps(env, course), listed: await listedFor(env, course),
  };
}

// ---------- Cook this instead (14d) ----------

// Each week's latest swap still standing: { week: level_swaps row }. Empty
// before the draft's table exists.
async function levelSwaps(env, course) {
  try {
    const { results } = await env.DB.prepare('SELECT * FROM level_swaps WHERE course_id = ? AND family_id = ? AND undone_at IS NULL ORDER BY created_at, id')
      .bind(course.id, course.family_id).all();
    return Object.fromEntries(results.map((r) => [r.week, r]));
  } catch { return {}; }
}

// The course's dishes on a shopping list not deleted.
async function listedFor(env, course) {
  const { results } = await env.DB.prepare(`SELECT DISTINCT ll.lesson_id FROM list_lessons ll JOIN shopping_lists l ON l.id = ll.list_id
      WHERE ll.family_id = ? AND ll.course_id = ? AND l.deleted_at IS NULL`).bind(course.family_id, course.id).all();
  return new Set(results.map((r) => r.lesson_id));
}

// A Level week's Familiar and Explore dishes, the one it cooks now marked,
// and whether each can be cooked instead: written, not ruled out by the
// family's settings, and not in another week.
function levelChoices(lessons, w, current) {
  return [['familiar', w.familiar], ['explore', w.explore]].map(([slot, id]) => {
    const written = Boolean(lessonById[id]), out = written && Boolean(lessons.why(id));
    const elsewhere = id !== current && lessons.weekOf[id] !== undefined && lessons.weekOf[id] !== w.week;
    return { id, slot, title: titleOfLevel(lessons.level, id), current: id === current, written, out, elsewhere, can: id !== current && written && !out && !elsewhere };
  });
}

// A week's swap while it stands (its dish not cooked): who made it (a
// profile, or null for the parent), the dish it replaced, and whether to
// check the shopping: the old dish is on a list and the new one isn't, and
// the parent hasn't said they have what it needs (owner, 2026-10-25).
function swapOut(lessons, week, current, done) {
  const x = lessons.swaps[week];
  if (!x || x.to_id !== current || done[current]) return null;
  return {
    by: x.profile_id, from: x.from_id, from_title: titleOfLevel(lessons.level, x.from_id),
    shopping: !x.shop_done_at && lessons.listed.has(x.from_id) && !lessons.listed.has(current),
  };
}

// What a week shows for Cook this instead: its two dishes and its swap, or
// nothing once it's cooked, skipped, or blocked (both dishes ruled out, 14c).
function weekSwapOut(st, week) {
  const { lessons } = st;
  const w = lessons.level.weeks.find((x) => x.week === week);
  const id = lessons.idOf[week];
  if (!w?.familiar || !id || st.done[id] || lessons.blocked[id] || lessons.plan.removed.includes(id)) return {};
  return { choices: levelChoices(lessons, w, id), swap: swapOut(lessons, week, id, st.done) };
}

const NO_SABBATH = "Dishes aren't swapped on the Sabbath. Swap it on another day.";

// The statements that move a week from one dish to another: the week's row
// (a pick that survives a change of start, so Put back wipes it, 14c), and
// the course's queued lesson, so the queue holds the dish the week cooks.
async function moveStatements(env, fam, course, plan, week, from, to, keepRow) {
  const stmts = keepRow ? levelPickStatements(env, course, plan, { [week]: to })
    : [env.DB.prepare('DELETE FROM course_lessons WHERE course_id = ? AND family_id = ? AND position = ?').bind(course.id, course.family_id, week)];
  const q = await env.DB.prepare("SELECT id, servings FROM queue WHERE family_id = ? AND course_id = ? AND lesson_id = ? AND status IN ('assigned', 'shopped')")
    .bind(course.family_id, course.id, from).first();
  if (q && lessonById[to]) stmts.push(env.DB.prepare('UPDATE queue SET lesson_id = ?, servings = ? WHERE id = ? AND family_id = ?').bind(to, nearestSize(lessonById[to], q.servings), q.id, course.family_id));
  return stmts;
}

// Cook this instead (14d): the week cooks `to` for everyone on the course
// (owner, 2026-10-25), by a learner (pid) or the parent (null). Cook this
// instead offers the week's other dish, never on the Sabbath; the parent's
// Swap recipe (12d, any) any recipe the week can hold. A learner swaps the
// week their kitchen is on. Returns the dish it replaced, and whether the
// shopping needs a look: the old dish is on a list and the new one isn't.
async function swapWeek(env, fam, course, req, { week, to, pid = null, any = false }) {
  if (!any && isSabbath(today(req))) fail(409, 'sabbath', NO_SABBATH);
  const st = await courseState(env, course, fam, today(req), tzOf(req));
  const { lessons } = st, V = lessons.level, plan = lessons.plan;
  const w = V.weeks.find((x) => x.week === week && x.recipe) ?? fail(400, 'invalid', 'No such week.');
  const cur = plan.weeks.find((x) => x.week === week);
  if (pid && levelWeekNow(st) !== week) fail(409, 'not_this_week', 'Only this week\'s dish can be swapped.');
  // Swap recipe may change a skipped week, which stays skipped (12d).
  if (cur.removed && !any) fail(409, 'skipped', 'That week is skipped. Put it back first.');
  if (st.done[cur.id]) fail(409, 'cooked', "That week's recipe is cooked already.");
  if (cur.id === to) fail(409, 'already', `That week already cooks ${titleOfLevel(V, to)}.`);
  if (any) levelPicksInput(V, plan, [{ week, id: to }]);
  else {
    const c = levelChoices(lessons, w, cur.id).find((x) => x.id === to) ?? fail(400, 'invalid', "That isn't one of this week's dishes.");
    if (!c.can) fail(409, 'not_available', c.out ? "That dish can't be cooked with your family's settings." : c.written ? "That dish is in another week." : "That dish isn't written yet.");
  }
  await env.DB.batch(await moveStatements(env, fam, course, plan, week, cur.id, to, true));
  // Kept for the Undo, who swapped, and the shopping notice; the swap
  // itself works before the draft's table exists.
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE level_swaps SET undone_at = ? WHERE course_id = ? AND family_id = ? AND week = ? AND undone_at IS NULL').bind(now(), course.id, fam.id, week),
      env.DB.prepare(`INSERT INTO level_swaps (id, family_id, course_id, week, from_id, to_id, from_changed, profile_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id(), fam.id, course.id, week, cur.id, to, cur.changed ? 1 : 0, pid, now()),
    ]);
  } catch { /* the table isn't there yet */ }
  return { ok: true, week, from: cur.id, from_title: titleOfLevel(V, cur.id), title: titleOfLevel(V, to), shopping: lessons.listed.has(cur.id) && !lessons.listed.has(to) };
}

// Undo a week's swap: the dish it had, as it had it (a parent's pick keeps
// its row; otherwise the week follows the start again). Before the draft's
// table exists, Undo swaps back to `from`.
async function undoSwap(env, fam, course, req, { week, from, pid = null }) {
  if (isSabbath(today(req))) fail(409, 'sabbath', NO_SABBATH);
  const st = await courseState(env, course, fam, today(req), tzOf(req));
  const plan = st.lessons.plan;
  const cur = plan.weeks.find((x) => x.week === week) ?? fail(400, 'invalid', 'No such week.');
  const x = st.lessons.swaps[week];
  if (!x) return swapWeek(env, fam, course, req, { week, to: from, pid });
  if (x.to_id !== cur.id) fail(409, 'changed', 'That week has changed since. There is nothing to undo.');
  if (st.done[cur.id]) fail(409, 'cooked', "That week's recipe is cooked already.");
  await env.DB.batch([
    ...(await moveStatements(env, fam, course, plan, week, cur.id, x.from_id, Boolean(x.from_changed))),
    env.DB.prepare('UPDATE level_swaps SET undone_at = ? WHERE id = ? AND family_id = ?').bind(now(), x.id, fam.id),
  ]);
  return { ok: true, week, title: titleOfLevel(st.lessons.level, x.from_id) };
}

export { PART_NAMES };

// A profile's Level progress as Print our progress and the transcript show
// it (12e): the Level, its hours, and each unit mastered, and each part
// checked off as a row beside the cooks.
export function levelSummary(lv) {
  return lv && { name: lv.name, hours: lv.hours, on: lv.on, hours_done: lv.hours_done, complete: lv.complete, units: lv.units.map(({ number, name, mastered }) => ({ number, name, mastered })) };
}
export const partRows = (lv) => (lv?.rows ?? []).map((r) => ({
  part: r.part, week: r.week, date: r.date, dish: r.title, cuisine: '', skill: `${lv.name} · Week ${r.week} ${PART_NAMES[r.part]}`, minutes: r.minutes,
}));

// The parts the course's profiles have checked off or skipped (12c), not
// taken back: { "week:part:profile": { at, skipped } }. Empty before the
// draft's table exists.
async function levelTasks(env, course, profiles) {
  if (!course.program || !profiles.length) return {};
  try {
    const { results } = await env.DB.prepare(`SELECT week, part, profile_id, done_at, skipped FROM level_tasks
        WHERE course_id = ? AND family_id = ? AND removed_at IS NULL AND profile_id IN (${placeholders(profiles)})`).bind(course.id, course.family_id, ...profiles).all();
    return Object.fromEntries(results.map((r) => [`${r.week}:${r.part}:${r.profile_id}`, { at: r.done_at, skipped: Boolean(r.skipped) }]));
  } catch { return {}; }
}
const doneAt = (t) => (t && !t.skipped ? t.at : null);

// The minutes a recipe plans for: its lesson's, or a planned dish's or a
// Level card's estimate until it's written.
const plannedRecipeMinutes = (V, id) => lessonById[id]?.totalMinutes ?? dishById[id]?.minutes ?? V.cards.find((c) => c.id === id)?.minutes ?? 0;
// The hours a Level course plans for, with its recipes and the parts it keeps on.
const courseHours = (V, idOf, on) => hoursOf(plannedMinutes(V.weeks.map((w) => ({ ...w, id: idOf[w.week] ?? null })), (id) => plannedRecipeMinutes(V, id), on));

// The Level week a course is on: this week's first recipe's, or next week's
// when this one is skipped or empty.
const levelWeekNow = (st) => {
  const at = [...st.sched.this_week.lessons, ...st.sched.next_week.lessons][0];
  return at ? st.lessons.weekOf[at.id] ?? null : null;
};

// What a profile's kitchen shows of its Level course (12c): this week with
// its recipe and three parts, and the parts still open from weeks already
// reached (their recipe cooked). A part not checked off never holds the
// schedule; it stays open until it is.
function levelFor(st, pid, day) {
  const V = st.lessons.level, now = levelWeekNow(st);
  const unitName = Object.fromEntries(V.units.map((u) => [u.number, u.name]));
  const on = st.course.parts ?? PARTS;
  const partOut = (w, part) => {
    const t = st.tasks[`${w.week}:${part}:${pid}`];
    return { week: w.week, part, ...w[part], done_at: doneAt(t), skipped: Boolean(t?.skipped) };
  };
  const weekOut = (w) => {
    const id = st.lessons.idOf[w.week] ?? null;
    return {
      week: w.week, unit: w.unit, unit_name: unitName[w.unit], mastery: Boolean(w.mastery), kind: w.kind ?? null, note: w.kind ? w.note ?? null : null,
      recipe: id, recipe_title: id ? lessonById[id]?.title ?? V.titles[id] ?? id : null, recipe_written: Boolean(id && lessonById[id]), recipe_done: Boolean(id && st.done[id]),
      // Neither dish can be cooked with the family's settings (14c): the kitchen sends the learner to a parent.
      blocked: Boolean(id && st.lessons.blocked[id]),
      // This week's two dishes, for Cook this instead, and its swap (14d).
      ...(w.week === now ? weekSwapOut(st, w.week) : {}),
      // The parts the course keeps on (a parent can turn any off).
      parts: weekParts(w, on).map((part) => partOut(w, part)),
    };
  };
  // Once every recipe week is cooked or skipped, the practice run and the
  // capstone come next, each until this profile has checked its parts off.
  const recipesDone = V.weeks.filter((w) => w.recipe).every((w) => {
    const id = st.lessons.idOf[w.week];
    return !id || st.done[id] || st.lessons.plan.skipped.includes(id);
  });
  const after = !now && recipesDone ? V.weeks.find((w) => w.kind && PARTS.some((part) => !st.tasks[`${w.week}:${part}:${pid}`])) : null;
  const reached = V.weeks.filter((w) => w.week !== now && st.lessons.idOf[w.week] && st.done[st.lessons.idOf[w.week]]);
  return {
    course_id: st.course.id, id: V.id, name: V.name, weeks: V.weeks.length, sabbath: isSabbath(day),
    // How this learner's step pictures show in the player (14e).
    pictures: picturesFor(st.course, pid),
    week: now ? weekOut(V.weeks.find((w) => w.week === now)) : after ? weekOut(after) : null,
    open: reached.flatMap((w) => weekParts(w, on).map((part) => partOut(w, part))).filter((x) => !x.done_at && !x.skipped),
    // The recipes of mastery weeks: the player says "cook it on your own" (§12.4).
    mastery: V.weeks.filter((w) => w.mastery && st.lessons.idOf[w.week]).map((w) => st.lessons.idOf[w.week]),
    // The week each recipe is on the course, for its card: "Week 5", never
    // Cook Around the World's lesson numbers (owner, 2026-10-26).
    week_of: Object.fromEntries(V.weeks.filter((w) => st.lessons.idOf[w.week]).map((w) => [st.lessons.idOf[w.week], w.week])),
  };
}

// ---------- a learner's Level progress (12e) ----------

// The minutes a Level week's recipe counts for: its lesson's planned time.
const recipeMinutes = (id) => lessonById[id]?.totalMinutes ?? 0;

// The Level course a profile is on: its active one, or else its latest
// archived one, so a finished Level still prints. null without the next
// release (withPrograms hides it then).
async function levelCourseOf(env, fid, pid) {
  const { results } = await env.DB.prepare(`SELECT c.* FROM courses c JOIN course_profiles cp ON cp.course_id = c.id AND cp.family_id = c.family_id
      WHERE c.family_id = ? AND cp.profile_id = ? ORDER BY c.archived_at IS NOT NULL, c.created_at DESC, c.id`).bind(fid, pid).all();
  return (await withPrograms(env, fid, results)).find((c) => c.program) ?? null;
}

// How far one profile is on its Level (12e), by its own work: each week's
// recipe is ticked when the profile cooked it on the course (a cook that
// counts: finished, not taken back, not on the Sabbath), and each part when
// the profile checked it off. A unit is mastered when its mastery week's
// recipe is cooked with a "why it worked" (§12.4); the last unit, whose last
// week is the capstone, when the capstone's three parts are checked off, and
// that completes the Level. A practice or capstone week, which has no
// recipe, counts its own minutes once its last part (serving the meal) is
// checked off. Hours are the planned time of what's done, toward the
// Level's hours. rows: each part checked off, for Progress and the
// transcript. Returns null when the profile isn't on a Level course.
export async function levelProgress(env, fid, pid, tz) {
  const course = await levelCourseOf(env, fid, pid);
  if (!course) return null;
  const V = LEVELS[course.program];
  const plan = await levelPlanOf(env, course);
  const idOf = Object.fromEntries(plan.weeks.map((x) => [x.week, x.id]));
  const tasks = await levelTasks(env, course, [pid]);
  const from = [course.created_at, course.start_date].sort()[0];
  const { results: cooks } = await env.DB.prepare(`SELECT a.id, a.lesson_id, a.finished_at FROM attempts a
      JOIN attempt_profiles ap ON ap.attempt_id = a.id AND ap.family_id = a.family_id
      WHERE a.family_id = ? AND ap.profile_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL AND a.finished_at >= ?
      ORDER BY a.finished_at, a.id`).bind(fid, pid, from).all();
  let noted = new Set();
  try {
    const { results } = await env.DB.prepare('SELECT attempt_id FROM mastery_notes WHERE family_id = ? AND profile_id = ?').bind(fid, pid).all();
    noted = new Set(results.map((r) => r.attempt_id));
  } catch { /* the table isn't there yet */ }
  // Each lesson's first counted cook, and its first with a "why it worked".
  const cooked = {}, why = {};
  for (const r of cooks) {
    const day = localDay(r.finished_at, tz);
    if (isSabbath(day)) continue;
    cooked[r.lesson_id] ??= day;
    if (noted.has(r.id)) why[r.lesson_id] ??= day;
  }
  const on = course.parts ?? PARTS;
  const doneOn = (w, part) => {
    const at = doneAt(tasks[`${w.week}:${part}:${pid}`]);
    return at ? localDay(at, tz) : null;
  };
  let minutes = 0;
  const rows = [];
  const weeks = V.weeks.map((w) => {
    const id = idOf[w.week] ?? null;
    // Only the parts the course keeps on: done (the day), or skipped.
    const kept = weekParts(w, on);
    const parts = Object.fromEntries(kept.map((part) => [part, doneOn(w, part)]));
    const skipped = kept.filter((part) => tasks[`${w.week}:${part}:${pid}`]?.skipped);
    for (const part of kept) {
      if (!parts[part]) continue;
      minutes += w[part].minutes;
      rows.push({ date: parts[part], week: w.week, part, title: w[part].title, minutes: w[part].minutes });
    }
    const recipeOn = id ? cooked[id] ?? null : null;
    if (recipeOn) minutes += recipeMinutes(id);
    if (w.kind && parts.sabbath) minutes += w.minutes ?? 0;
    return {
      week: w.week, unit: w.unit, mastery: Boolean(w.mastery), kind: w.kind ?? null, minutes: w.kind ? w.minutes ?? 0 : recipeMinutes(id),
      recipe: id, title: id ? lessonById[id]?.title ?? V.titles[id] ?? id : null, cooked: recipeOn, parts, skipped,
      titles: Object.fromEntries(kept.map((part) => [part, w[part].title])),
    };
  });
  const units = V.units.map((u) => {
    const mine = weeks.filter((w) => w.unit === u.number);
    const last = mine.at(-1);
    let mastered = null;
    // The capstone is finished when each of its parts is done or skipped, and at least one is done.
    if (last?.kind === 'capstone') {
      const days = PARTS.map((part) => last.parts[part]).filter(Boolean);
      mastered = days.length && PARTS.every((part) => last.parts[part] || last.skipped.includes(part)) ? days.sort().at(-1) : null;
    }
    else if (last?.mastery && last.recipe) mastered = why[last.recipe] ?? null;
    return { number: u.number, name: u.name, goal: u.goal ?? null, mastered, weeks: mine };
  });
  const capstone = units.at(-1);
  return {
    // hours: what this course plans for, with its recipes and the parts it keeps on.
    course_id: course.id, id: V.id, name: V.name, hours: courseHours(V, idOf, on), on, weeks: V.weeks.length,
    hours_done: Math.round(minutes / 6) / 10,
    complete: capstone?.weeks.at(-1)?.kind === 'capstone' ? capstone.mastered : null,
    units, rows: rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.week - b.week)),
  };
}

// The day each lesson was first cooked on this course, by any of its profiles.
// Cooks from before the course was set up (or before it starts) don't count.
// free: the lessons whose first cook was through a lesson queued outside the
// course (schedule.js).
async function courseDone(env, course, profiles, tz) {
  if (!profiles.length) return { done: {}, free: new Set() };
  const from = [course.created_at, course.start_date].sort()[0];
  const { results } = await env.DB.prepare(
    `SELECT a.lesson_id, a.finished_at, q.id AS qid, q.course_id FROM attempts a
       LEFT JOIN queue q ON q.id = a.queue_id AND q.family_id = a.family_id
       WHERE a.family_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL AND a.finished_at >= ?
         AND EXISTS (SELECT 1 FROM attempt_profiles ap WHERE ap.attempt_id = a.id AND ap.family_id = a.family_id
           AND ap.profile_id IN (${placeholders(profiles)}))
       ORDER BY a.finished_at`,
  ).bind(course.family_id, from, ...profiles).all();
  // The first cook of each lesson that wasn't on the Sabbath.
  const done = {}, free = new Set();
  for (const r of results) {
    const day = localDay(r.finished_at, tz);
    if (isSabbath(day) || done[r.lesson_id]) continue;
    done[r.lesson_id] = day;
    if (r.qid && !r.course_id) free.add(r.lesson_id);
  }
  return { done, free };
}

// Each week's skips, extras, and swaps. bumped: the course lessons a swap
// took out that week, from the swap rows (swap_of "c:<course>:<lesson>").
async function courseWeeks(env, course) {
  const { results } = await env.DB.prepare('SELECT week_start, skipped, extra, swapped FROM course_weeks WHERE course_id = ? AND family_id = ?').bind(course.id, course.family_id).all();
  const weeks = Object.fromEntries(results.map((r) => [r.week_start, { skipped: Boolean(r.skipped), extra: r.extra, swapped: r.swapped ?? 0, bumped: [] }]));
  const tag = `c:${course.id}:`;
  const { results: swaps } = await env.DB.prepare('SELECT week_start, swap_of FROM queue WHERE family_id = ? AND substr(swap_of, 1, ?) = ? ORDER BY created_at, id')
    .bind(course.family_id, tag.length, tag).all();
  for (const r of swaps) weeks[r.week_start]?.bumped.push(r.swap_of.slice(tag.length));
  return weeks;
}

// The course's lessons queued for its profiles outside the course (a kid's
// request approved early), not cooked yet: the schedule takes them out of
// their later place so the same dish isn't queued twice (owner, 2026-10-23).
async function courseTaken(env, course, profiles, usable) {
  if (!profiles.length || !usable.length) return new Set();
  const { results } = await env.DB.prepare(`SELECT DISTINCT q.lesson_id FROM queue q JOIN queue_profiles qp ON qp.queue_id = q.id AND qp.family_id = q.family_id
      WHERE q.family_id = ? AND q.course_id IS NULL AND q.status IN ('assigned', 'shopped') AND qp.profile_id IN (${placeholders(profiles)})`)
    .bind(course.family_id, ...profiles).all();
  const ids = new Set(usable);
  return new Set(results.map((r) => r.lesson_id).filter((x) => ids.has(x)));
}

async function courseState(env, course, fam, day, tz) {
  const profiles = await courseProfiles(env, course);
  const lessons = await courseLessons(env, course, fam);
  const { done, free } = await courseDone(env, course, profiles, tz);
  const weeks = await courseWeeks(env, course);
  const taken = await courseTaken(env, course, profiles, lessons.usable);
  const tasks = await levelTasks(env, course, profiles);
  return { course, profiles, lessons, done, taken, tasks, sched: schedule({ course, lessons: lessons.usable, done, free, taken, weeks, today: day }) };
}

const activeCourses = async (env, fid) => withPrograms(env, fid, (await env.DB.prepare('SELECT * FROM courses WHERE family_id = ? AND archived_at IS NULL ORDER BY created_at, id').bind(fid).all()).results);

// Brings the queue's course rows in line with each schedule: this week's
// unfinished lessons are queued for the course's profiles (§6.18); a course row that's no longer due goes, unless it was shopped for;
// a cooked one is marked cooked. Nothing happens while weeks aren't planned.
export async function syncQueue(env, fam, day, tz) {
  const states = [];
  if (!weeksOn(fam)) return states;
  for (const course of await activeCourses(env, fam.id)) {
    const st = await courseState(env, course, fam, day, tz);
    states.push(st);
    const due = new Map();
    // A blocked Level week (14c) isn't queued: no one can cook it as things stand.
    for (const x of st.sched.this_week.lessons) if (!x.done && !st.lessons.blocked?.[x.id]) due.set(x.id, st.sched.this_week.week);
    const { results: rows } = await env.DB.prepare("SELECT * FROM queue WHERE family_id = ? AND course_id = ? AND status IN ('assigned', 'shopped')").bind(fam.id, course.id).all();
    const stmts = [];
    const have = new Set();
    for (const r of rows) {
      have.add(r.lesson_id);
      if (st.done[r.lesson_id]) {
        stmts.push(env.DB.prepare("UPDATE queue SET status = 'cooked', closed_at = ? WHERE id = ?").bind(now(), r.id));
      } else if (due.has(r.lesson_id)) {
        if (r.week_start !== due.get(r.lesson_id)) stmts.push(env.DB.prepare('UPDATE queue SET week_start = ? WHERE id = ?').bind(due.get(r.lesson_id), r.id));
      } else if (r.status === 'assigned') {
        stmts.push(env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(r.id, fam.id));
        stmts.push(env.DB.prepare('DELETE FROM queue WHERE id = ? AND family_id = ?').bind(r.id, fam.id));
      }
    }
    for (const [lid, week] of due) {
      if (have.has(lid) || !st.profiles.length) continue;
      const qid = id();
      stmts.push(env.DB.prepare(`INSERT INTO queue (id, family_id, lesson_id, servings, status, source, course_id, week_start, created_at)
          VALUES (?, ?, ?, ?, 'assigned', 'course', ?, ?, ?)`).bind(qid, fam.id, lid, nearestSize(lessonById[lid], fam.default_servings), course.id, week, now()));
      for (const pid of st.profiles) stmts.push(env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(qid, fam.id, pid));
    }
    if (stmts.length) await env.DB.batch(stmts);
  }
  return states;
}
// A finished cook closes the queued lesson it was for: the oldest open one of
// that lesson with any of the cook's profiles on it (§6.2). Called by the cooks
// route in api.js.
export async function markCooked(env, fid, lessonId, profileIds, attemptId) {
  const { results } = await env.DB.prepare(
    `SELECT q.id FROM queue q WHERE q.family_id = ? AND q.lesson_id = ? AND q.status IN ('assigned', 'shopped')
       AND EXISTS (SELECT 1 FROM queue_profiles qp WHERE qp.queue_id = q.id AND qp.profile_id IN (${placeholders(profileIds)}))
     ORDER BY q.week_start IS NULL, q.week_start, q.created_at LIMIT 1`,
  ).bind(fid, lessonId, ...profileIds).all();
  const q = results[0];
  if (!q) return null;
  await env.DB.batch([
    env.DB.prepare("UPDATE queue SET status = 'cooked', closed_at = ? WHERE id = ? AND family_id = ?").bind(now(), q.id, fid),
    env.DB.prepare('UPDATE attempts SET queue_id = ? WHERE id = ? AND family_id = ?').bind(q.id, attemptId, fid),
  ]);
  return q.id;
}

// How many servings a queued lesson was shopped for, for the "You shopped for
// N" note on the lesson card (§6.6). From the latest ended trip it was on.
// How many servings a queued lesson's latest shopping list was for, for the
// "You shopped for N" note on the lesson card (§6.6). A list made before a
// course lesson was queued finds it by course and lesson.
export async function shoppedFor(env, fid, rows) {
  if (!rows.length) return {};
  const lids = [...new Set(rows.map((r) => r.lesson_id))];
  const { results } = await env.DB.prepare(`SELECT ll.lesson_id, ll.servings, ll.queue_id, ll.course_id FROM list_lessons ll
      JOIN shopping_lists l ON l.id = ll.list_id
      WHERE ll.family_id = ? AND l.deleted_at IS NULL AND ll.lesson_id IN (${placeholders(lids)}) ORDER BY l.created_at`).bind(fid, ...lids).all();
  const out = {};
  for (const r of rows) {
    const hit = results.filter((x) => x.lesson_id === r.lesson_id && (x.queue_id === r.id || (r.course_id && x.course_id === r.course_id))).at(-1);
    if (hit) out[r.id] = hit.servings;
  }
  return out;
}


// ---------- what the screens get ----------

export async function queueProfiles(env, fid, ids) {
  if (!ids.length) return {};
  const out = {};
  // D1 binds 100 values at most.
  for (let i = 0; i < ids.length; i += 90) {
    const slice = ids.slice(i, i + 90);
    const { results } = await env.DB.prepare(`SELECT queue_id, profile_id FROM queue_profiles WHERE family_id = ? AND queue_id IN (${placeholders(slice)})`).bind(fid, ...slice).all();
    for (const r of results) (out[r.queue_id] ??= []).push(r.profile_id);
  }
  return out;
}

// Appointed Times lessons are A1, A2… whatever the plan (§6.19).
const suggestedLabels = { ...numberCourse(LIBRARY.course).labels, ...LIBRARY.seasonalLabels, ...LIBRARY.levelLabels };

// names: the family's recipes (recipeNames), for queued family recipes.
const RECIPE_SIZES = servingOptions({ scaling: { mode: 'free', min: 1, max: 12 } });
export function itemOut(r, who, labels = suggestedLabels, names = {}) {
  const L = lessonById[r.lesson_id], n = names[r.lesson_id];
  return {
    id: r.id, lesson_id: r.lesson_id, title: L?.title ?? n?.title ?? dishById[r.lesson_id]?.title ?? r.lesson_id, label: labels[r.lesson_id] ?? null,
    unit: L?.unit ?? dishById[r.lesson_id]?.unit ?? null, image: L?.image ?? n?.image ?? null, foundation: Boolean(dishById[r.lesson_id]?.pickOne),
    recipe: Boolean(n), swap: Boolean(r.swap_of), servings: r.servings, servings_options: L ? servingOptions(L) : n ? RECIPE_SIZES : [], planned_date: r.planned_date, status: r.status, source: r.source,
    profile_ids: who[r.id] ?? [], requested_by: r.requested_by_profile_id, course_id: r.course_id, week_start: r.week_start,
    created_at: r.created_at, closed_at: r.closed_at,
  };
}

function courseOut(st, fam, rowsByLesson, version = () => null) {
  const { course, profiles, lessons, sched } = st;
  const V = lessons.level;
  const lessonOut = (x) => {
    const L = lessonById[x.id];
    const q = rowsByLesson[`${course.id}:${x.id}`];
    // A Level week's recipe shows its week, not its lesson number.
    const week = V ? lessons.weekOf[x.id] ?? null : null;
    return {
      lesson_id: x.id, title: L?.title ?? x.id, label: V ? (week ? `Week ${week}` : null) : lessons.labels[x.id] ?? null, week, image: L?.image ?? null, unit: L?.unit ?? null,
      foundation: Boolean(dishById[x.id]?.pickOne), done: x.done, overdue: fam.mode === 'homeschool' ? x.overdue : false, extra: Boolean(x.extra),
      queue_id: q?.id ?? null, servings: q?.servings ?? null, servings_options: L ? servingOptions(L) : [], status: q?.status ?? null,
      // A Level course plays the Level's own version (14e): no Version button.
      version: version(x.id, profiles, V ? course.program : null),
      // A Level week neither of whose dishes the family can cook (14c): each dish and why, and whether it's been requested.
      ...(V && lessons.blocked[x.id] ? { blocked: lessons.blocked[x.id], requested: lessons.requested.has(week) } : {}),
      // Its two dishes, for Cook this instead, and its swap (14d).
      ...(V && week ? weekSwapOut(st, week) : {}),
    };
  };
  const week = (w) => ({ week: w.week, skipped: w.skipped, extra: w.extra, lessons: w.lessons.map(lessonOut) });
  // The Level week the course is on, for "Week 5 of 36", and who has
  // checked off each of its parts, for the parent's Take back (12c).
  const now = V ? levelWeekNow(st) : null;
  const lw = now ? V.weeks.find((w) => w.week === now) : null;
  return {
    id: course.id, name: course.name, start_date: course.start_date, per_week: course.per_week, profile_ids: profiles,
    program: course.program,
    level: V ? {
      id: V.id, name: V.name, weeks: V.weeks.length, week: now, starts: lessons.plan.starts,
      parts: lw ? weekParts(lw, course.parts ?? PARTS).map((part) => ({
        part, title: lw[part].title, minutes: lw[part].minutes,
        done: profiles.filter((pid) => doneAt(st.tasks[`${now}:${part}:${pid}`])), skipped: profiles.filter((pid) => st.tasks[`${now}:${part}:${pid}`]?.skipped),
      })) : [],
      // The parts it keeps on, and the hours that plans for (§12.4).
      on: course.parts ?? PARTS, hours: courseHours(V, lessons.idOf, course.parts ?? PARTS),
    } : null,
    this_week: week(sched.this_week), next_week: week(sched.next_week), due_day: DUE_DAY,
    started: sched.started, planned_finish: sched.planned_finish, projected_finish: sched.projected_finish,
    weeks_behind: sched.weeks_behind, lessons_behind: sched.lessons_behind,
    total: sched.total, done: sched.done, unwritten: lessons.unwritten, hidden: lessons.hidden,
    // Recipes skipped with Skip this recipe, each with Put back.
    skipped_recipes: lessons.plan.skipped.map((x) => ({ lesson_id: x, title: lessonById[x]?.title ?? dishById[x]?.title ?? V?.titles[x] ?? x, week: V ? lessons.weekOf[x] : null })),
  };
}

export function register(on) {
  // ---------- the parent's queue ----------

  on('GET', '/api/queue', async (req, env) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const day = today(req);
    const states = await syncQueue(env, fam, day, tzOf(req));
    const { results: rows } = await env.DB.prepare(
      `SELECT * FROM queue WHERE family_id = ? AND (status IN ('requested', 'assigned', 'shopped') OR (status IN ('declined', 'removed') AND closed_at >= ?))
       ORDER BY created_at, id`,
    ).bind(s.family_id, addDays(day, -14)).all();
    const who = await queueProfiles(env, s.family_id, rows.map((r) => r.id));
    const byLesson = Object.fromEntries(rows.filter((r) => r.course_id && ['assigned', 'shopped'].includes(r.status)).map((r) => [`${r.course_id}:${r.lesson_id}`, r]));
    const active = rows.filter((r) => ACTIVE.includes(r.status));
    // Profiles that have cooked or queued a Unit 1 knife lesson (§4.0).
    const { results: knife } = await env.DB.prepare(
      `SELECT DISTINCT ap.profile_id FROM attempt_profiles ap JOIN attempts a ON a.id = ap.attempt_id
        WHERE ap.family_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL AND a.lesson_id IN (${placeholders(unitOne)})`,
    ).bind(s.family_id, ...unitOne).all();
    const knifeOk = new Set(knife.map((r) => r.profile_id));
    for (const r of active) if (unitOne.includes(r.lesson_id)) (who[r.id] ?? []).forEach((p) => knifeOk.add(p));
    const tests = (await env.DB.prepare('SELECT lesson_id, cooked_on, parent_id FROM test_cooks WHERE family_id = ?').bind(s.family_id).all()).results;
    const names = await recipeNames(env, s.family_id);
    const version = await versionPicker(env, fam);
    const levelOfRow = await rowLevels(env, s.family_id);
    const out = (r) => ({ ...itemOut(r, who, suggestedLabels, names), version: version(r.lesson_id, who[r.id], levelOfRow(r)) });
    const filters = JSON.parse(fam.diet_filters);
    const { results: mine } = await env.DB.prepare('SELECT * FROM family_recipes WHERE family_id = ? AND deleted_at IS NULL ORDER BY title COLLATE NOCASE, id').bind(s.family_id).all();
    return {
      today: day, mode: fam.mode, plan_weeks: Boolean(fam.plan_weeks), weeks_on: weeksOn(fam),
      // A request for a lesson already on the asker's list (say the course
      // loaded it since) says so.
      requests: active.filter((r) => r.status === 'requested').map((r) => ({
        ...out(r),
        already_queued: active.some((x) => x.status !== 'requested' && x.lesson_id === r.lesson_id && (who[x.id] ?? []).includes(r.requested_by_profile_id)),
      })),
      queued: active.filter((r) => r.status !== 'requested' && !r.course_id).map(out),
      // A lesson a swap took off is put back by the swap's Undo, not here.
      put_back: rows.filter((r) => !ACTIVE.includes(r.status) && !names[r.lesson_id]?.deleted && !active.some((x) => x.swap_of === `q:${r.id}`)).map(out),
      courses: states.map((st) => courseOut(st, fam, byLesson, version)),
      knife_ok: [...knifeOk],
      test_cooks: Object.fromEntries(tests.map((t) => [t.lesson_id, { cooked_on: t.cooked_on, by_me: t.parent_id === s.parent_id }])),
      library: LIBRARY.lessons.filter((L) => visible(fam).has(L.id)).map((L) => ({
        id: L.id, title: L.title, label: suggestedLabels[L.id] ?? null, unit: L.unit, servings_options: servingOptions(L), foundation: Boolean(dishById[L.id]?.pickOne),
      })),
      // The family's own recipes can be queued like lessons (§6.10).
      recipes: (await Promise.all(mine.map(async (row) => ({ row, f: await lessonFor(env, s.family_id, `recipe:${row.id}`) }))))
        .filter(({ f }) => f && recipeVisible(f, filters)).map(({ row }) => ({ id: `recipe:${row.id}`, title: row.title, servings_options: RECIPE_SIZES })),
      default_servings: fam.default_servings,
    };
  });

  // A parent queues a lesson for one or more profiles (§6.2).
  on('POST', '/api/queue', async (req, env, body) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const L = await queueLesson(env, String(body.lesson_id ?? ''), fam);
    const pids = await familyProfiles(env, s.family_id, body.profile_ids);
    for (const pid of pids) {
      const n = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM queue q JOIN queue_profiles qp ON qp.queue_id = q.id
          WHERE q.family_id = ? AND qp.profile_id = ? AND q.status IN ('assigned', 'shopped') AND q.course_id IS NULL`).bind(s.family_id, pid).first()).n;
      if (n >= QUEUE_MAX) fail(429, 'too_many', `A profile can have ${QUEUE_MAX} lessons queued at once.`);
    }
    const qid = id();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO queue (id, family_id, lesson_id, servings, planned_date, status, source, created_at)
          VALUES (?, ?, ?, ?, ?, 'assigned', 'manual', ?)`).bind(qid, s.family_id, L.id, servingsFor(L, body.servings, fam), plannedDate(body.planned_date), now()),
      ...pids.map((pid) => env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(qid, s.family_id, pid)),
    ]);
    return { ok: true, id: qid };
  });

  // Servings, the planned date, and who it's for. A course's lessons are for
  // the course's profiles, so only their servings change here.
  on('PUT', '/api/queue/([0-9a-f]{16})', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const r = await queueRow(env, s.family_id, qid);
    if (!ACTIVE.includes(r.status)) fail(409, 'closed', 'That lesson is no longer in the queue.');
    const L = lessonById[r.lesson_id] ?? (await lessonFor(env, s.family_id, r.lesson_id))?.lesson ?? fail(409, 'gone', 'That lesson is no longer in the library.');
    const stmts = [env.DB.prepare('UPDATE queue SET servings = ?, planned_date = ? WHERE id = ? AND family_id = ?')
      .bind(servingsFor(L, body.servings ?? r.servings, fam), r.course_id ? null : plannedDate(body.planned_date === undefined ? r.planned_date : body.planned_date), r.id, s.family_id)];
    if (body.profile_ids !== undefined && !r.course_id) {
      const pids = await familyProfiles(env, s.family_id, body.profile_ids);
      stmts.push(env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(r.id, s.family_id));
      for (const pid of pids) stmts.push(env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(r.id, s.family_id, pid));
    }
    await env.DB.batch(stmts);
    return { ok: true };
  });

  // Remove; Put back undoes it. A course's lessons come out with Skip this recipe instead.
  on('DELETE', '/api/queue/([0-9a-f]{16})', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const r = await queueRow(env, s.family_id, qid);
    if (r.course_id) fail(409, 'course', 'This one is from a course. Use Skip this recipe.');
    if (!['assigned', 'shopped'].includes(r.status)) fail(409, 'closed', 'That lesson is no longer in the queue.');
    await env.DB.prepare("UPDATE queue SET status = 'removed', closed_at = ? WHERE id = ? AND family_id = ?").bind(now(), r.id, s.family_id).run();
    return { ok: true };
  });

  on('POST', '/api/queue/([0-9a-f]{16})/approve', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const r = await queueRow(env, s.family_id, qid);
    if (r.status !== 'requested') fail(409, 'not_requested', 'That request is already answered.');
    const L = await queueLesson(env, r.lesson_id, fam);
    // "Replace an assigned meal": it takes that meal's place (owner, 2026-10-23).
    if (body.replace) {
      const { stmts } = await approveStatements(env, s, fam, { row: r, L, pid: r.requested_by_profile_id, replace: body.replace, servings: body.servings, req });
      await env.DB.batch(stmts);
      return { ok: true };
    }
    const stmts = [env.DB.prepare("UPDATE queue SET status = 'assigned', servings = ?, planned_date = ? WHERE id = ? AND family_id = ?")
      .bind(servingsFor(L, body.servings ?? r.servings, fam), plannedDate(body.planned_date), r.id, s.family_id)];
    if (body.profile_ids !== undefined) {
      const pids = await familyProfiles(env, s.family_id, body.profile_ids);
      stmts.push(env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(r.id, s.family_id));
      for (const pid of pids) stmts.push(env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(r.id, s.family_id, pid));
    }
    await env.DB.batch(stmts);
    return { ok: true };
  });

  on('POST', '/api/queue/([0-9a-f]{16})/decline', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const r = await queueRow(env, s.family_id, qid);
    if (r.status !== 'requested') fail(409, 'not_requested', 'That request is already answered.');
    await env.DB.prepare("UPDATE queue SET status = 'declined', closed_at = ? WHERE id = ? AND family_id = ?").bind(now(), r.id, s.family_id).run();
    return { ok: true };
  });

  // The restore for Not now and Remove.
  on('POST', '/api/queue/([0-9a-f]{16})/put-back', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const r = await queueRow(env, s.family_id, qid);
    const to = { declined: 'requested', removed: 'assigned' }[r.status] ?? fail(409, 'not_closed', 'That lesson is already in the queue.');
    await env.DB.prepare('UPDATE queue SET status = ?, closed_at = NULL WHERE id = ? AND family_id = ?').bind(to, r.id, s.family_id).run();
    return { ok: true };
  });

  // ---------- a profile's own list, and asking for a lesson (§6.1) ----------

  // What a profile has coming up, for its kitchen. Kids see "due Friday" in
  // homeschool mode and never anything about being late (§6.17).
  on('GET', '/api/profiles/([0-9a-f]{16})/queue', async (req, env, body, [pid]) => {
    const s = await requireSession(env, req);
    ownProfile(s, pid);
    if (!(await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first())) fail(404, 'not_found', 'No such profile.');
    const fam = await family(env, s.family_id);
    const day = today(req);
    const states = await syncQueue(env, fam, day, tzOf(req));
    const { results: rows } = await env.DB.prepare(
      `SELECT q.* FROM queue q JOIN queue_profiles qp ON qp.queue_id = q.id
        WHERE q.family_id = ? AND qp.profile_id = ? AND q.status IN ('requested', 'assigned', 'shopped') ORDER BY q.week_start IS NULL, q.week_start, q.created_at`,
    ).bind(s.family_id, pid).all();
    const who = await queueProfiles(env, s.family_id, rows.map((r) => r.id));
    const shopped = await shoppedFor(env, s.family_id, rows.filter((r) => r.status !== 'requested'));
    const mine = states.find((st) => st.profiles.includes(pid));
    // A profile on a course takes its lesson numbers from the course's plan (§4.1).
    const labels = mine ? mine.lessons.labels : suggestedLabels;
    const thisWeek = weekOf(day);
    // An extra lesson (Cook another recipe) is this week only, never due.
    const extras = new Set(mine ? mine.sched.this_week.lessons.filter((x) => x.extra).map((x) => x.id) : []);
    // A request for a lesson that's on the list anyway shows once, as queued.
    const listed = new Set(rows.filter((r) => r.status !== 'requested').map((r) => r.lesson_id));
    const names = await recipeNames(env, s.family_id);
    // The course's lessons first, in the course plan's order, then the rest in
    // the order they were added (§6.18).
    const at = new Map((mine?.lessons.kept ?? []).map((x, i) => [x, i]));
    const rank = (r) => (r.course_id && at.has(r.lesson_id) ? at.get(r.lesson_id) : 1e6);
    rows.sort((a, b) => rank(a) - rank(b));
    // The version each lesson with variations plays in this kitchen (§6.21):
    // a queued one's for everyone it's queued for, any other's for this
    // profile alone. The family's own pick wins either way.
    // An optional ingredient someone on it rated 1 star is left out (11d2).
    const tc = await tasteContext(env, fam);
    const version = await versionPicker(env, fam, tc);
    const versions = {}, leaveOut = {};
    for (const L of tc ? LIBRARY.lessons : []) {
      const r = rows.find((x) => x.lesson_id === L.id && x.status !== 'requested');
      const pids = r ? who[r.id] : [pid];
      const v = L.variations?.length ? version(L.id, pids) : null;
      if (v) versions[L.id] = v.id;
      const out = hatedExtras(tc, versionSummary(L.id, v?.id), pids);
      if (out.length) leaveOut[L.id] = out;
    }
    // A Level learner's course recipes play the Level's own version (14e),
    // whatever the tastes say, or the lesson itself when it has none.
    const program = mine?.lessons.level ? mine.course.program : null;
    for (const lid of program ? Object.values(mine.lessons.idOf) : []) {
      if (!lessonById[lid]?.variations?.length) continue;
      const v = versionFor(tc, null, lid, [pid], program).variation;
      versions[lid] = v;
      const out = hatedExtras(tc, versionSummary(lid, v), mine.profiles);
      if (out.length) leaveOut[lid] = out; else delete leaveOut[lid];
    }
    return {
      mode: fam.mode,
      versions,
      leave_out: leaveOut,
      // A profile on a Level course: its week, parts, and mastery recipes (12c).
      // Its progress view (12e) comes with it.
      level: mine?.lessons.level ? { ...levelFor(mine, pid, day), progress: await levelProgress(env, s.family_id, pid, tzOf(req)) } : null,
      // The profile's path, in its course plan's order (or the suggested one),
      // for its kitchen's "Coming up" and the early flag (owner, 2026-10-23).
      order: mine ? mine.lessons.kept : null,
      items: rows.filter((r) => r.status !== 'requested' || !listed.has(r.lesson_id)).map((r) => ({
        id: r.id, lesson_id: r.lesson_id, title: lessonById[r.lesson_id]?.title ?? names[r.lesson_id]?.title ?? r.lesson_id, label: labels[r.lesson_id] ?? null,
        image: lessonById[r.lesson_id]?.image ?? names[r.lesson_id]?.image ?? null, recipe: Boolean(names[r.lesson_id]), status: r.status, servings: r.servings, planned_date: r.planned_date, profile_ids: who[r.id] ?? [],
        shopped_for: shopped[r.id] ?? null,
        swap: Boolean(r.swap_of),
        when: r.week_start ? 'this-week' : null,
        due: r.week_start && r.week_start <= thisWeek && fam.mode === 'homeschool' && !(r.course_id && extras.has(r.lesson_id)) ? addDays(thisWeek, DUE_DAY) : null,
      })),
      labels: mine ? mine.lessons.labels : null,
      total: mine ? mine.lessons.total : null,
      // The week each lesson still to cook on the course falls in, so the
      // kitchen shows this week and next open and the rest under See more
      // (owner, 2026-10-23).
      week: thisWeek,
      weeks: mine ? Object.fromEntries([mine.sched.this_week, mine.sched.next_week].flatMap((w) => w.lessons.filter((x) => !x.done).map((x) => [x.id, w.week]))
        .concat(mine.sched.ahead.flatMap((w) => w.lessons.map((x) => [x, w.week])))) : null,
    };
  }, { kid: true });

  // "I want to make this" on a kid profile: a request for a parent to approve.
  // "Cook this" on an adult profile: queued straight away, no PIN (§6.1).
  on('POST', '/api/profiles/([0-9a-f]{16})/ask', async (req, env, body, [pid]) => {
    const s = await requireSession(env, req);
    ownProfile(s, pid);
    const p = await env.DB.prepare('SELECT id, audience FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first() ?? fail(404, 'not_found', 'No such profile.');
    const fam = await family(env, s.family_id);
    const L = await queueLesson(env, String(body.lesson_id ?? ''), fam);
    const had = await env.DB.prepare(`SELECT q.id, q.status FROM queue q JOIN queue_profiles qp ON qp.queue_id = q.id
        WHERE q.family_id = ? AND qp.profile_id = ? AND q.lesson_id = ? AND q.status IN ('requested', 'assigned', 'shopped') LIMIT 1`).bind(s.family_id, pid, L.id).first();
    if (had) return { ok: true, id: had.id, status: had.status };
    const adult = p.audience === 'adult';
    if (!adult) {
      const n = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM queue q JOIN queue_profiles qp ON qp.queue_id = q.id
          WHERE q.family_id = ? AND qp.profile_id = ? AND q.status = 'requested'`).bind(s.family_id, pid).first()).n;
      if (n >= ASK_MAX) fail(429, 'too_many', `You've asked for ${n} already. An adult needs to answer those first.`);
    }
    const qid = id(), status = adult ? 'assigned' : 'requested';
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO queue (id, family_id, lesson_id, servings, status, source, requested_by_profile_id, created_at)
          VALUES (?, ?, ?, ?, ?, 'request', ?, ?)`).bind(qid, s.family_id, L.id, nearestSize(L, fam.default_servings), status, pid, now()),
      env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(qid, s.family_id, pid),
    ]);
    return { ok: true, id: qid, status };
  }, { kid: true });

  // A kid wants to cook something that isn't on their list now: a parent, with
  // the PIN, approves it on the spot as an extra assigned meal, or as one that
  // replaces an assigned meal (owner, 2026-10-23). A request already waiting
  // for it is the one approved. An extra one is planned for today. A course
  // lesson approved early comes out of its later place in the course, so it
  // isn't queued twice (courseTaken). On a kid's own login the adult types
  // the PIN with this request: it approves this one thing and unlocks nothing
  // (§8.3a).
  on('POST', '/api/profiles/([0-9a-f]{16})/approve', async (req, env, body, [pid]) => {
    const s = await requireSession(env, req);
    if (s.kid) {
      ownProfile(s, pid);
      await checkPin(env, s.family_id, body.pin);
    } else await requireParent(env, req);
    if (!(await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first())) fail(404, 'not_found', 'No such profile.');
    const fam = await family(env, s.family_id);
    const L = await queueLesson(env, String(body.lesson_id ?? ''), fam);
    const rows = (await env.DB.prepare(`SELECT q.* FROM queue q JOIN queue_profiles qp ON qp.queue_id = q.id
        WHERE q.family_id = ? AND qp.profile_id = ? AND q.lesson_id = ? AND q.status IN ('requested', 'assigned', 'shopped')`).bind(s.family_id, pid, L.id).all()).results;
    const listed = rows.find((r) => r.status !== 'requested');
    if (listed) return { ok: true, id: listed.id, status: listed.status };
    const { qid, stmts } = await approveStatements(env, s, fam, { row: rows[0] ?? null, L, pid, replace: body.replace || null, servings: body.servings, req, day: today(req) });
    await env.DB.batch(stmts);
    return { ok: true, id: qid, status: 'assigned' };
  }, { kid: true });

  // ---------- safety review and test-cooked (§6.2) ----------

  // Every step an adult needs to be in the kitchen for, before approving.
  on('GET', '/api/lessons/([a-z0-9-]+|(?:recipe|shared):[0-9a-f]{16})/safety', async (req, env, body, [lid]) => {
    const s = await requireSession(env, req);
    const L = (await lessonFor(env, s.family_id, lid))?.lesson ?? fail(404, 'not_found', 'No such lesson.');
    const steps = L.steps.map((x, i) => ({ n: i + 1, text: x.text, safety: x.safety, hazard: x.hazard ?? null })).filter((x) => x.safety !== 'solo');
    const level = steps.some((x) => x.safety === 'adult-hands-on') ? 'adult-hands-on' : steps.length ? 'adult-nearby' : 'solo';
    return { lesson_id: L.id, title: L.title, level, steps };
  }, { kid: true });

  on('POST', '/api/test-cooks', async (req, env, body) => {
    const s = await requireParent(env, req);
    const L = lessonById[String(body.lesson_id ?? '')] ?? fail(400, 'invalid', 'No such lesson.');
    const version = (await livePatches(env.DB, L.id))[L.id]?.version ?? L.version;
    const day = isDay(body.cooked_on) ? body.cooked_on : now().slice(0, 10);
    await env.DB.prepare(`INSERT INTO test_cooks (family_id, lesson_id, lesson_version, parent_id, cooked_on) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(family_id, lesson_id) DO UPDATE SET lesson_version = excluded.lesson_version, parent_id = excluded.parent_id, cooked_on = excluded.cooked_on`)
      .bind(s.family_id, L.id, version, s.parent_id, day).run();
    return { ok: true };
  });

  on('DELETE', '/api/test-cooks/([a-z0-9-]+)', async (req, env, body, [lid]) => {
    const s = await requireParent(env, req);
    await env.DB.prepare('DELETE FROM test_cooks WHERE family_id = ? AND lesson_id = ?').bind(s.family_id, lid).run();
    return { ok: true };
  });

  // ---------- courses (§6.18) ----------

  on('GET', '/api/courses', async (req, env) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const { results } = await env.DB.prepare('SELECT * FROM courses WHERE family_id = ? ORDER BY archived_at IS NOT NULL, created_at, id').bind(s.family_id).all();
    const out = [];
    for (const c of await withPrograms(env, s.family_id, results)) {
      const plan = await planOf(env, c);
      if (c.program) {
        const lessons = await courseLessons(env, c, fam);
        out.push({
          id: c.id, name: c.name, start_date: c.start_date, per_week: c.per_week, archived_at: c.archived_at, program: c.program, parts: c.parts, starts: plan.starts,
          // Each learner's step pictures (14e): their pick, else the Level's way.
          pictures: Object.fromEntries((await courseProfiles(env, c)).map((pid) => [pid, picturesFor(c, pid)])), pictures_default: picturesDefault(c.program),
          // changed: a week the parent picked or skipped, which keeps its recipe whatever the course starts with (14c).
          profile_ids: await courseProfiles(env, c), plan: plan.weeks.map((x) => ({ id: x.id, week: x.week, removed: Boolean(x.removed), changed: x.changed, ...(x.blocked ? { blocked: x.blocked } : {}) })),
          usable: lessons.usable.length, unwritten: lessons.unwritten, hidden: lessons.hidden,
        });
        continue;
      }
      const removed = new Set(plan.removed);
      const order = numberCourse(LIBRARY.course, plan).entries.flatMap((e) => [...e.ids, ...e.removed]);
      const lessons = await courseLessons(env, c, fam);
      out.push({
        id: c.id, name: c.name, start_date: c.start_date, per_week: c.per_week, archived_at: c.archived_at, program: null,
        profile_ids: await courseProfiles(env, c), plan: order.map((x) => ({ id: x, removed: removed.has(x) })),
        usable: lessons.usable.length, unwritten: lessons.unwritten, hidden: lessons.hidden,
      });
    }
    const shown = visible(fam);
    return {
      courses: out, mode: fam.mode, weeks_on: weeksOn(fam), default_plan: defaultPlan(),
      written: LIBRARY.lessons.map((L) => L.id), hidden: LIBRARY.lessons.filter((L) => !shown.has(L.id)).map((L) => L.id),
      per_week_max: PER_WEEK_MAX,
      // The programs a course can be, past Cook Around the World (§12.4):
      // the Levels, with their release. Each week with its Familiar and
      // Explore dishes, and the dish each week cooks for this family when a
      // course starts with either (14c).
      levels: await Promise.all(levelsOn(fam.release).map(async (V) => ({
        id: V.id, name: V.name, hours: V.hours, units: V.units,
        weeks: V.weeks.map((w) => ({ ...w, ...(w.recipe ? { title: titleOfLevel(V, w.familiar), explore_title: titleOfLevel(V, w.explore) } : { title: null }) })),
        defaults: await levelDefaults(env, fam, V),
        // The weeks the family has asked for a replacement for (14c).
        requested: [...await requestedWeeks(env, s.family_id, V.id)],
        // Each recipe's planned minutes, for the hours the parent's setup plans for (§12.4).
        minutes: Object.fromEntries([...new Set([...Object.keys(V.titles), ...LIBRARY.course.map((d) => d.id), ...V.cards.map((c) => c.id)])]
          .map((rid) => [rid, plannedRecipeMinutes(V, rid)])),
      }))),
      // What a new Level course starts with, from "how adventurous" (14c).
      starts_preset: await familyPreset(env, s.family_id),
    };
  });

  // course: the one being changed. Its program stays what it was set up as;
  // a new one is Cook Around the World unless body.program names a Level.
  const courseInput = async (env, s, body, course = null) => {
    const courseId = course?.id ?? null;
    let program = course ? course.program : null;
    if (!course && body.program) {
      program = String(body.program);
      if (!levelsOn(await familyRelease(env.DB, s.family_id)).some((V) => V.id === program)) fail(400, 'invalid', 'No such program.');
    }
    // A Level course runs one Level week a calendar week (§12.4).
    const per = program ? 1 : Number(body.per_week);
    if (!Number.isInteger(per) || per < 1 || per > PER_WEEK_MAX) fail(400, 'invalid', `Lessons per week must be 1 to ${PER_WEEK_MAX}.`);
    if (!isDay(body.start_date)) fail(400, 'invalid', 'Pick a start date.');
    const pids = await familyProfiles(env, s.family_id, body.profile_ids);
    // A profile is on one course at a time.
    const { results: taken } = await env.DB.prepare(`SELECT DISTINCT c.id FROM course_profiles cp JOIN courses c ON c.id = cp.course_id
        WHERE cp.family_id = ? AND c.archived_at IS NULL AND c.id != ? AND cp.profile_id IN (${placeholders(pids)})`).bind(s.family_id, courseId ?? '', ...pids).all();
    if ((await withPrograms(env, s.family_id, taken)).length) fail(409, 'on_a_course', 'A profile picked is already on another course. End that course or take them off it first.');
    const name = String(body.name ?? '').trim().slice(0, 60);
    // A Level's plan is its weeks, each with its recipe (12d).
    // A Level course's parts kept on (§12.4): all three unless the parent turned some off.
    let parts = null;
    if (program && body.parts !== undefined) {
      if (!Array.isArray(body.parts) || body.parts.some((x) => !PARTS.includes(x))) fail(400, 'invalid', 'Parts must be drill, knowledge, or sabbath.');
      parts = PARTS.filter((x) => body.parts.includes(x));
    }
    // What each week starts with (14c): the parent's, or for a new course the preset from "how adventurous".
    const starts = !program ? null : body.starts !== undefined ? startsInput(body.starts) : course ? null : await familyPreset(env, s.family_id);
    const pictures = program && body.pictures !== undefined ? picturesInput(body.pictures, pids) : null;
    return {
      per, start: weekOf(body.start_date), pids, name, program, parts, starts, pictures,
      plan: program || body.plan === undefined ? null : planInput(body.plan),
      weeks: program && body.weeks !== undefined ? body.weeks : null,
    };
  };

  const ownCourse = async (env, s, cid) => {
    const row = await env.DB.prepare('SELECT * FROM courses WHERE id = ? AND family_id = ?').bind(cid, s.family_id).first();
    return (row && (await withPrograms(env, s.family_id, [row]))[0]) ?? fail(404, 'not_found', 'No such course.');
  };

  const profileStatements = (env, course, pids) => [
    env.DB.prepare('DELETE FROM course_profiles WHERE course_id = ? AND family_id = ?').bind(course.id, course.family_id),
    ...pids.map((pid) => env.DB.prepare('INSERT INTO course_profiles (course_id, family_id, profile_id) VALUES (?, ?, ?)').bind(course.id, course.family_id, pid)),
  ];

  on('POST', '/api/courses', async (req, env, body) => {
    const s = await requireParent(env, req);
    const v = await courseInput(env, s, body);
    const course = { id: id(), family_id: s.family_id };
    await env.DB.batch([
      env.DB.prepare('INSERT INTO courses (id, family_id, name, start_date, per_week, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(course.id, s.family_id, v.name, v.start, v.per, now()),
      ...profileStatements(env, course, v.pids),
      ...(v.program
        ? [env.DB.prepare('INSERT INTO course_programs (course_id, family_id, program, parts, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(course.id, s.family_id, v.program, v.parts ? JSON.stringify(v.parts) : null, now()),
          startStatement(env, course, v.starts),
          ...(await levelPicksFor(env, s.family_id, course, v))]
        : planStatements(env, course, v.plan ?? (await defaultFor(env, s.family_id, v.pids)))),
    ]);
    const saved = v.pictures ? await savePictures(env, course, v.program, v.pictures) : true;
    return { ok: true, id: course.id, ...(saved ? {} : { pictures_saved: false }) };
  });

  // A new Level course's rows (14c): only the weeks the parent picked a
  // recipe for; every other week cooks the dish its start slot gives it.
  async function levelPicksFor(env, fid, course, v) {
    if (!v.weeks?.length) return [];
    const V = LEVELS[v.program];
    const { ids } = await levelWeekDishes(env, await family(env, fid), V, v.starts, {}, new Set());
    const plan = { weeks: V.weeks.filter((w) => w.recipe).map((w) => ({ week: w.week, id: ids[w.week], removed: KEPT })) };
    return levelPickStatements(env, course, plan, levelPicksInput(V, plan, v.weeks));
  }

  // The course's lessons already queued follow the change: new profiles are
  // put on them, and the next read reschedules them.
  on('PUT', '/api/courses/([0-9a-f]{16})', async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const v = await courseInput(env, s, body, course);
    const { results: rows } = await env.DB.prepare("SELECT id FROM queue WHERE family_id = ? AND course_id = ? AND status IN ('assigned', 'shopped')").bind(s.family_id, course.id).all();
    await env.DB.batch([
      env.DB.prepare('UPDATE courses SET name = ?, start_date = ?, per_week = ? WHERE id = ? AND family_id = ?').bind(v.name, v.start, v.per, course.id, s.family_id),
      ...(v.parts ? [env.DB.prepare('UPDATE course_programs SET parts = ? WHERE course_id = ? AND family_id = ?').bind(JSON.stringify(v.parts), course.id, s.family_id)] : []),
      ...profileStatements(env, course, v.pids),
      ...(v.plan ? planStatements(env, course, v.plan) : []),
      // A new start re-points only the weeks no one changed; a week on the
      // queue or a shopping list keeps its dish (14c).
      ...(v.starts ? [startStatement(env, course, v.starts)] : []),
      ...(v.weeks ? await (async () => {
        const plan = await levelPlanOf(env, course, v.starts);
        return levelPickStatements(env, course, plan, levelPicksInput(LEVELS[course.program], plan, v.weeks));
      })() : []),
      ...rows.flatMap((r) => [
        env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(r.id, s.family_id),
        ...v.pids.map((pid) => env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(r.id, s.family_id, pid)),
      ]),
    ]);
    const saved = v.pictures ? await savePictures(env, course, course.program, v.pictures) : true;
    return { ok: true, ...(saved ? {} : { pictures_saved: false }) };
  });


  // End a course; Put back restores it. Its lessons not yet shopped for leave the queue.
  on('POST', '/api/courses/([0-9a-f]{16})/end', async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const { results: rows } = await env.DB.prepare("SELECT id FROM queue WHERE family_id = ? AND course_id = ? AND status = 'assigned'").bind(s.family_id, course.id).all();
    await env.DB.batch([
      env.DB.prepare('UPDATE courses SET archived_at = ? WHERE id = ? AND family_id = ?').bind(now(), course.id, s.family_id),
      ...rows.flatMap((r) => [
        env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(r.id, s.family_id),
        env.DB.prepare('DELETE FROM queue WHERE id = ? AND family_id = ?').bind(r.id, s.family_id),
      ]),
    ]);
    return { ok: true };
  });

  on('POST', '/api/courses/([0-9a-f]{16})/put-back', async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const pids = await courseProfiles(env, course);
    if (pids.length) {
      const { results: taken } = await env.DB.prepare(`SELECT 1 FROM course_profiles cp JOIN courses c ON c.id = cp.course_id
          WHERE cp.family_id = ? AND c.archived_at IS NULL AND c.id != ? AND cp.profile_id IN (${placeholders(pids)})`).bind(s.family_id, course.id, ...pids).all();
      if (taken.length) fail(409, 'on_a_course', 'Someone on this course is on another course now. End that one first.');
    }
    await env.DB.prepare('UPDATE courses SET archived_at = NULL WHERE id = ? AND family_id = ?').bind(course.id, s.family_id).run();
    return { ok: true };
  });

  // ---------- a Level week's recipe (12d) ----------

  // Swap recipe on a Level week: every recipe it can hold, its options first,
  // each best first for the course's profiles, with the one it holds now.
  on('GET', '/api/courses/([0-9a-f]{16})/level-week', async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const V = LEVELS[course.program] ?? fail(400, 'invalid', 'That course has no Level weeks.');
    const week = Number(new URL(req.url).searchParams.get('week'));
    const plan = await levelPlanOf(env, course);
    const now = plan.weeks.find((x) => x.week === week) ?? fail(404, 'not_found', 'No such week.');
    const pids = await courseProfiles(env, course);
    const tc = await tasteContext(env, await family(env, s.family_id)) ?? fail(404, 'not_available', 'Not available yet.');
    const fits = levelPlan(tc, V, pids, await cookedBy(env, s.family_id, pids)).weeks.find((x) => x.week === week);
    // A recipe in another week can't be picked here.
    const elsewhere = new Set(plan.weeks.filter((x) => x.week !== week).map((x) => x.id));
    const mark = (x) => ({ ...x, current: x.id === now.id, taken: elsewhere.has(x.id) });
    return { week, current: now.id, options: fits.options.map(mark), more: fits.more.map(mark) };
  });

  // Puts a recipe in a Level week; Undo sends the one it held back.
  on('POST', '/api/courses/([0-9a-f]{16})/level-week', async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    if (!LEVELS[course.program]) fail(400, 'invalid', 'That course has no Level weeks.');
    const res = await swapWeek(env, await family(env, s.family_id), course, req, { week: Number(body.week), to: String(body.id ?? ''), any: true });
    return { ...res, before: res.from };
  });

  // ---------- Cook this instead (14d) ----------

  // The learner's: this week's other dish, for everyone on the course, and its Undo.
  const learnerCourse = async (env, s, pid) => {
    ownProfile(s, pid);
    const { results } = await env.DB.prepare(`SELECT c.* FROM courses c JOIN course_profiles cp ON cp.course_id = c.id
        WHERE c.family_id = ? AND c.archived_at IS NULL AND cp.profile_id = ?`).bind(s.family_id, pid).all();
    return (await withPrograms(env, s.family_id, results)).find((c) => c.program) ?? fail(404, 'not_found', 'This profile is not on a Level course.');
  };
  on('POST', '/api/profiles/([0-9a-f]{16})/level-swap', async (req, env, body, [pid]) => {
    const s = await requireSession(env, req);
    const course = await learnerCourse(env, s, pid);
    return swapWeek(env, await family(env, s.family_id), course, req, { week: Number(body.week), to: String(body.id ?? ''), pid });
  }, { kid: true });
  on('POST', '/api/profiles/([0-9a-f]{16})/level-swap/undo', async (req, env, body, [pid]) => {
    const s = await requireSession(env, req);
    const course = await learnerCourse(env, s, pid);
    return undoSwap(env, await family(env, s.family_id), course, req, { week: Number(body.week), from: String(body.from ?? ''), pid });
  }, { kid: true });

  // The parent's, on the course card: the same, and the Undo for anyone's swap.
  const levelCourse = async (env, req, cid) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    if (!LEVELS[course.program]) fail(400, 'invalid', 'That course has no Level weeks.');
    return { course, fam: await family(env, s.family_id) };
  };
  on('POST', '/api/courses/([0-9a-f]{16})/level-swap', async (req, env, body, [cid]) => {
    const { course, fam } = await levelCourse(env, req, cid);
    return swapWeek(env, fam, course, req, { week: Number(body.week), to: String(body.id ?? '') });
  });
  on('POST', '/api/courses/([0-9a-f]{16})/level-swap/undo', async (req, env, body, [cid]) => {
    const { course, fam } = await levelCourse(env, req, cid);
    return undoSwap(env, fam, course, req, { week: Number(body.week), from: String(body.from ?? '') });
  });

  // "We have what it needs": the swap's shopping notice goes; done: false is its Undo.
  on('POST', '/api/courses/([0-9a-f]{16})/level-swap/shopped', async (req, env, body, [cid]) => {
    const { course, fam } = await levelCourse(env, req, cid);
    let res;
    try {
      res = await env.DB.prepare('UPDATE level_swaps SET shop_done_at = ? WHERE course_id = ? AND family_id = ? AND week = ? AND undone_at IS NULL')
        .bind(body.done === false ? null : now(), course.id, fam.id, Number(body.week)).run();
    } catch { fail(409, 'not_ready', 'This opens once the update is applied.'); }
    if (!res.meta.changes) fail(404, 'not_found', 'That week has no swap.');
    return { ok: true };
  });

  // ---------- a Level week neither of whose dishes the family can cook (14c) ----------

  // Request a replacement: tells the owner, on Recipe gaps, so a variation or
  // another dish can be written (owner, 2026-10-25). Only for a week the
  // family's settings block now; asked again, it stays one request. Undo
  // takes it back.
  on('POST', '/api/level-requests', async (req, env, body) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const V = levelsOn(fam.release).find((x) => x.id === body.level) ?? fail(400, 'invalid', 'No such Level.');
    const w = V.weeks.find((x) => x.week === Number(body.week) && x.recipe) ?? fail(400, 'invalid', 'No such week.');
    const why = await ruledOut(env, fam);
    const pair = [w.familiar, w.explore];
    if (!pair.every((id) => why(id))) fail(409, 'not_blocked', "This week isn't blocked: a dish can be cooked now, or one is still being written.");
    // Name-free reasons, for the owner's counts: "diet:meat", "tool:microwave".
    const codes = [...new Set(pair.flatMap((id) => why(id) ?? []).flatMap((r) => r.tags.map((t) => `${r.kind}:${t}`)))];
    try {
      await env.DB.prepare(`INSERT INTO level_requests (family_id, level, week, reasons, created_at) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(family_id, level, week) DO UPDATE SET reasons = excluded.reasons`).bind(s.family_id, V.id, w.week, JSON.stringify(codes), now()).run();
    } catch (err) {
      if (/no such table/i.test(String(err?.message))) fail(503, 'not_ready', 'Requests open once the owner presses Apply pending on /ops.');
      throw err;
    }
    return { ok: true };
  });
  on('POST', '/api/level-requests/undo', async (req, env, body) => {
    const s = await requireParent(env, req);
    await env.DB.prepare('DELETE FROM level_requests WHERE family_id = ? AND level = ? AND week = ?').bind(s.family_id, String(body.level ?? ''), Number(body.week)).run();
    return { ok: true };
  });

  // ---------- a Level week's parts (12c) ----------

  // The week and part asked for, on a Level course; a page that doesn't exist is refused.
  const levelPart = (course, body) => {
    const V = LEVELS[course.program] ?? fail(400, 'invalid', 'That course has no Level weeks.');
    const week = Number(body.week), part = String(body.part ?? '');
    if (!V.weeks.some((w) => w.week === week) || !PARTS.includes(part)) fail(400, 'invalid', 'No such page.');
    return { week, part };
  };

  // Done on a drill, knowledge, or Beyond the Recipe page, by the profile or its
  // parent. Nothing checked off on the Sabbath counts, so it isn't taken then
  // (§12.4, as with grading, §6.18). { skip: true } skips the part instead:
  // it's no longer open and counts for nothing, so that's fine any day.
  on('PUT', '/api/profiles/([0-9a-f]{16})/level-tasks', async (req, env, body, [pid]) => {
    const s = await requireSession(env, req);
    ownProfile(s, pid);
    const skip = body.skip === true;
    if (!skip && isSabbath(today(req))) fail(409, 'sabbath', 'Nothing is checked off on the Sabbath. Check it off on another day.');
    const { results } = await env.DB.prepare(`SELECT c.* FROM courses c JOIN course_profiles cp ON cp.course_id = c.id
        WHERE c.family_id = ? AND c.archived_at IS NULL AND cp.profile_id = ?`).bind(s.family_id, pid).all();
    const course = (await withPrograms(env, s.family_id, results)).find((c) => c.program) ?? fail(404, 'not_found', 'This profile is not on a Level course.');
    const { week, part } = levelPart(course, body);
    if (!weekParts(LEVELS[course.program].weeks.find((w) => w.week === week), course.parts ?? PARTS).includes(part)) fail(400, 'invalid', 'That part is turned off for this course.');
    await env.DB.prepare(`INSERT INTO level_tasks (family_id, course_id, week, part, profile_id, done_at, skipped) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(course_id, week, part, profile_id) DO UPDATE SET done_at = excluded.done_at, skipped = excluded.skipped, removed_at = NULL`)
      .bind(s.family_id, course.id, week, part, pid, now(), skip ? 1 : 0).run();
    return { ok: true };
  }, { kid: true });

  // A parent takes a checked-off part back (it counts for nothing), and its Undo.
  const takeBack = (removed) => async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const { week, part } = levelPart(course, body);
    const res = await env.DB.prepare(`UPDATE level_tasks SET removed_at = ? WHERE course_id = ? AND family_id = ? AND week = ? AND part = ? AND profile_id = ?`)
      .bind(removed ? now() : null, course.id, s.family_id, week, part, String(body.profile_id ?? '')).run();
    if (!res.meta.changes) fail(404, 'not_found', "That part isn't checked off.");
    return { ok: true };
  };
  on('POST', '/api/courses/([0-9a-f]{16})/level-tasks/take-back', takeBack(true));
  on('POST', '/api/courses/([0-9a-f]{16})/level-tasks/put-back', takeBack(false));

  // Skip this recipe: out of the plan, and the next lesson takes its place.
  // Put back undoes it (§6.18).
  const setRemoved = (removed) => async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const lid = String(body.lesson_id ?? '');
    // A Level course's recipe is one of its weeks'; its row's position is the week.
    const week = course.program ? (await levelPlanOf(env, course)).weeks.find((x) => x.id === lid)?.week : null;
    if (course.program ? !week : !dishById[lid]) fail(400, 'invalid', 'No such lesson.');
    // Put back on a Level week that cooks its own Familiar or Explore dish
    // drops its row, so it follows the start and the settings again (14c);
    // a recipe the parent picked keeps its row.
    const w = week && LEVELS[course.program].weeks.find((x) => x.week === week);
    if (removed === KEPT && w && [w.familiar, w.explore].includes(lid)) {
      await env.DB.prepare('DELETE FROM course_lessons WHERE course_id = ? AND family_id = ? AND lesson_id = ?').bind(course.id, s.family_id, lid).run();
      // A swap goes with it (owner, 2026-10-25), and its dish off the queue,
      // so the week's own dish is queued in its place.
      try {
        const res = await env.DB.prepare('UPDATE level_swaps SET undone_at = ? WHERE course_id = ? AND family_id = ? AND week = ? AND undone_at IS NULL').bind(now(), course.id, s.family_id, week).run();
        if (res.meta.changes) {
          const q = await env.DB.prepare("SELECT id FROM queue WHERE family_id = ? AND course_id = ? AND lesson_id = ? AND status = 'assigned'").bind(s.family_id, course.id, lid).first();
          if (q) {
            await env.DB.batch([
              env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(q.id, s.family_id),
              env.DB.prepare('DELETE FROM queue WHERE id = ? AND family_id = ?').bind(q.id, s.family_id),
            ]);
          }
        }
      } catch { /* the table isn't there yet */ }
      return { ok: true };
    }
    const res = await env.DB.prepare('UPDATE course_lessons SET removed = ? WHERE course_id = ? AND family_id = ? AND lesson_id = ?').bind(removed, course.id, s.family_id, lid).run();
    if (!res.meta.changes) {
      const at = week ?? LIBRARY.course.findIndex((d) => d.id === lid);
      await env.DB.prepare('INSERT INTO course_lessons (course_id, family_id, lesson_id, position, removed) VALUES (?, ?, ?, ?, ?)').bind(course.id, s.family_id, lid, at, removed).run();
    }
    return { ok: true };
  };
  on('POST', '/api/courses/([0-9a-f]{16})/skip-recipe', setRemoved(SKIPPED));
  on('POST', '/api/courses/([0-9a-f]{16})/put-back-recipe', setRemoved(KEPT));

  // Skip this week (or a later one), and put it back. Cook another recipe adds
  // one to this week only; its Undo takes one away.
  on('POST', '/api/courses/([0-9a-f]{16})/week', async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const thisWeek = weekOf(today(req));
    const week = isDay(body.week) ? weekOf(body.week) : thisWeek;
    if (week < thisWeek) fail(400, 'invalid', 'That week is over.');
    const row = await env.DB.prepare('SELECT skipped, extra FROM course_weeks WHERE course_id = ? AND family_id = ? AND week_start = ?').bind(course.id, s.family_id, week).first();
    let skipped = row?.skipped ?? 0, extra = row?.extra ?? 0;
    if (body.skipped !== undefined) skipped = body.skipped ? 1 : 0;
    if (body.extra !== undefined) {
      if (week !== thisWeek) fail(400, 'invalid', 'Extra lessons are for this week only.');
      extra = Math.max(0, Math.min(EXTRA_MAX, extra + (Number(body.extra) > 0 ? 1 : -1)));
    }
    await env.DB.prepare(`INSERT INTO course_weeks (course_id, family_id, week_start, skipped, extra) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(course_id, week_start) DO UPDATE SET skipped = excluded.skipped, extra = excluded.extra`).bind(course.id, s.family_id, week, skipped, extra).run();
    return { ok: true, week, skipped: Boolean(skipped), extra };
  });
}
