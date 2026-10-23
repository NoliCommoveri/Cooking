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
import { liveLesson, livePatches } from './lessons.js';
import { dietView } from '../content/diet.js';
import { servingOptions } from '../content/scale.js';
import { courseEntries, numberCourse } from '../content/course.js';
import { schedule, weekOf, addDays, localDay, isDay, isSabbath, DUE_DAY } from './schedule.js';
import { isRecipeId, lessonFor, recipeNames, recipeVisible } from './recipes.js';

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
const placeholders = (list) => list.map(() => '?').join(', ');

// ---------- small helpers ----------

export const family = (env, fid) => env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(fid).first();
export const weeksOn = (fam) => fam.mode === 'homeschool' || Boolean(fam.plan_weeks);
const visible = (fam) => {
  const filters = JSON.parse(fam.diet_filters);
  return new Set(LIBRARY.lessons.filter((L) => dietView(L, LIBRARY.ingredients, filters).visible).map((L) => L.id));
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
  return { course, profiles, lessons, done, taken, sched: schedule({ course, lessons: lessons.usable, done, free, taken, weeks, today: day }) };
}

const activeCourses = async (env, fid) => (await env.DB.prepare('SELECT * FROM courses WHERE family_id = ? AND archived_at IS NULL ORDER BY created_at, id').bind(fid).all()).results;

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
    for (const x of st.sched.this_week.lessons) if (!x.done) due.set(x.id, st.sched.this_week.week);
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
const suggestedLabels = { ...numberCourse(LIBRARY.course).labels, ...LIBRARY.seasonalLabels };

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

function courseOut(st, fam, rowsByLesson) {
  const { course, profiles, lessons, sched } = st;
  const lessonOut = (x) => {
    const L = lessonById[x.id];
    const q = rowsByLesson[`${course.id}:${x.id}`];
    return {
      lesson_id: x.id, title: L?.title ?? x.id, label: lessons.labels[x.id] ?? null, image: L?.image ?? null, unit: L?.unit ?? null,
      foundation: Boolean(dishById[x.id]?.pickOne), done: x.done, overdue: fam.mode === 'homeschool' ? x.overdue : false, extra: Boolean(x.extra),
      queue_id: q?.id ?? null, servings: q?.servings ?? null, servings_options: L ? servingOptions(L) : [], status: q?.status ?? null,
    };
  };
  const week = (w) => ({ week: w.week, skipped: w.skipped, extra: w.extra, lessons: w.lessons.map(lessonOut) });
  return {
    id: course.id, name: course.name, start_date: course.start_date, per_week: course.per_week, profile_ids: profiles,
    this_week: week(sched.this_week), next_week: week(sched.next_week), due_day: DUE_DAY,
    started: sched.started, planned_finish: sched.planned_finish, projected_finish: sched.projected_finish,
    weeks_behind: sched.weeks_behind, lessons_behind: sched.lessons_behind,
    total: sched.total, done: sched.done, unwritten: lessons.unwritten, hidden: lessons.hidden,
    // Recipes skipped with Skip this recipe, each with Put back.
    skipped_recipes: lessons.plan.skipped.map((x) => ({ lesson_id: x, title: lessonById[x]?.title ?? dishById[x]?.title ?? x })),
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
    const out = (r) => itemOut(r, who, suggestedLabels, names);
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
      courses: states.map((st) => courseOut(st, fam, byLesson)),
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
    return {
      mode: fam.mode,
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
    for (const c of results) {
      const plan = await planOf(env, c);
      const removed = new Set(plan.removed);
      const order = numberCourse(LIBRARY.course, plan).entries.flatMap((e) => [...e.ids, ...e.removed]);
      const lessons = await courseLessons(env, c, fam);
      out.push({
        id: c.id, name: c.name, start_date: c.start_date, per_week: c.per_week, archived_at: c.archived_at,
        profile_ids: await courseProfiles(env, c), plan: order.map((x) => ({ id: x, removed: removed.has(x) })),
        usable: lessons.usable.length, unwritten: lessons.unwritten, hidden: lessons.hidden,
      });
    }
    const shown = visible(fam);
    return {
      courses: out, mode: fam.mode, weeks_on: weeksOn(fam), default_plan: defaultPlan(),
      written: LIBRARY.lessons.map((L) => L.id), hidden: LIBRARY.lessons.filter((L) => !shown.has(L.id)).map((L) => L.id),
      per_week_max: PER_WEEK_MAX,
    };
  });

  const courseInput = async (env, s, body, courseId = null) => {
    const per = Number(body.per_week);
    if (!Number.isInteger(per) || per < 1 || per > PER_WEEK_MAX) fail(400, 'invalid', `Lessons per week must be 1 to ${PER_WEEK_MAX}.`);
    if (!isDay(body.start_date)) fail(400, 'invalid', 'Pick a start date.');
    const pids = await familyProfiles(env, s.family_id, body.profile_ids);
    // A profile is on one course at a time.
    const { results: taken } = await env.DB.prepare(`SELECT cp.profile_id FROM course_profiles cp JOIN courses c ON c.id = cp.course_id
        WHERE cp.family_id = ? AND c.archived_at IS NULL AND c.id != ? AND cp.profile_id IN (${placeholders(pids)})`).bind(s.family_id, courseId ?? '', ...pids).all();
    if (taken.length) fail(409, 'on_a_course', 'A profile picked is already on another course. End that course or take them off it first.');
    const name = String(body.name ?? '').trim().slice(0, 60);
    return { per, start: weekOf(body.start_date), pids, name, plan: body.plan === undefined ? null : planInput(body.plan) };
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
      ...planStatements(env, course, v.plan ?? defaultPlan()),
    ]);
    return { ok: true, id: course.id };
  });

  // The course's lessons already queued follow the change: new profiles are
  // put on them, and the next read reschedules them.
  on('PUT', '/api/courses/([0-9a-f]{16})', async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await env.DB.prepare('SELECT * FROM courses WHERE id = ? AND family_id = ?').bind(cid, s.family_id).first() ?? fail(404, 'not_found', 'No such course.');
    const v = await courseInput(env, s, body, course.id);
    const { results: rows } = await env.DB.prepare("SELECT id FROM queue WHERE family_id = ? AND course_id = ? AND status IN ('assigned', 'shopped')").bind(s.family_id, course.id).all();
    await env.DB.batch([
      env.DB.prepare('UPDATE courses SET name = ?, start_date = ?, per_week = ? WHERE id = ? AND family_id = ?').bind(v.name, v.start, v.per, course.id, s.family_id),
      ...profileStatements(env, course, v.pids),
      ...(v.plan ? planStatements(env, course, v.plan) : []),
      ...rows.flatMap((r) => [
        env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(r.id, s.family_id),
        ...v.pids.map((pid) => env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(r.id, s.family_id, pid)),
      ]),
    ]);
    return { ok: true };
  });

  const ownCourse = async (env, s, cid) => (await env.DB.prepare('SELECT * FROM courses WHERE id = ? AND family_id = ?').bind(cid, s.family_id).first()) ?? fail(404, 'not_found', 'No such course.');

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

  // Skip this recipe: out of the plan, and the next lesson takes its place.
  // Put back undoes it (§6.18).
  const setRemoved = (removed) => async (req, env, body, [cid]) => {
    const s = await requireParent(env, req);
    const course = await ownCourse(env, s, cid);
    const lid = String(body.lesson_id ?? '');
    if (!dishById[lid]) fail(400, 'invalid', 'No such lesson.');
    const res = await env.DB.prepare('UPDATE course_lessons SET removed = ? WHERE course_id = ? AND family_id = ? AND lesson_id = ?').bind(removed, course.id, s.family_id, lid).run();
    if (!res.meta.changes) {
      const at = LIBRARY.course.findIndex((d) => d.id === lid);
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
