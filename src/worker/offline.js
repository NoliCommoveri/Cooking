// Print and complete offline (plan §6.22, release 3). A learner or a parent
// prints the next weeks of a course (its recipes, and on a Level course its
// Knowledge, Drill, and Beyond the Recipe pages), and afterwards marks what was
// done away from the app: any of a week's four parts, the recipe included. A
// recipe marked done is a full cook on the day picked (owner, 2026-10-30), so
// it counts everywhere a cook does; a parent can take it back with Didn't make
// it, and a part with Take back, as today.
import { fail } from './lib/http.js';
import { randomHex } from './lib/crypto.js';
import { requireSession, ownProfile, kidRefused } from './auth.js';
import { LIBRARY } from './library-data.js';
import { CONTENT } from './content-data.js';
import { livePatches } from './lessons.js';
import { family, today, tzOf, syncQueue, markCooked, offlineWeeks, sizeFor } from './plan.js';
import { isDay, isSabbath } from './schedule.js';
import { lessonFor, REGISTRY } from './recipes.js';
import { tasteContext, versionFor } from './picks.js';
import { variationChoices, recordVariation } from './variations.js';
import { OFFLINE_RELEASE, UNLEAVENED_RELEASE } from './release.js';
import { datesFor, feastGuard } from './unleavened.js';
import { unleavenedOn } from '../content/calendars.js';
import { feastCook } from '../content/leaven.js';
import { lessonVersion } from '../content/variations.js';
import { weekParts, PARTS } from '../content/levels.js';

const LEVELS = LIBRARY.levels ?? {};
// The most weeks printed at once.
export const OFFLINE_WEEKS = 8;

// The profile's course, as the kitchen sees it, with the release.
async function context(env, req, pid) {
  const s = await requireSession(env, req);
  ownProfile(s, pid);
  const fam = await family(env, s.family_id);
  if (fam.release < OFFLINE_RELEASE) fail(404, 'not_found', 'No such route.');
  const st = (await syncQueue(env, fam, today(req), tzOf(req))).find((x) => x.profiles.includes(pid)) ?? fail(404, 'not_found', 'This profile is not on a course.');
  return { s, fam, st };
}

// The version a course recipe plays: a Level's own (14e), or the family's
// pick or best fit for the course's profiles (§6.21).
async function versions(env, fam, st) {
  const tc = await tasteContext(env, fam);
  const choices = await variationChoices(env, fam.id);
  return (id) => versionFor(tc, choices, id, st.profiles, st.course.program).variation;
}

export function register(on) {
  // The weeks to print, or to mark done: this week and the next, up to n.
  on('GET', '/api/profiles/([0-9a-f]{16})/offline', async (req, env, body, [pid]) => {
    const { fam, st } = await context(env, req, pid);
    const n = Math.max(1, Math.min(OFFLINE_WEEKS, Number(new URL(req.url).searchParams.get('weeks')) || 1));
    const dates = fam.release >= UNLEAVENED_RELEASE ? await datesFor(env, fam.id) : null;
    const { results: names } = await env.DB.prepare(`SELECT id, name FROM profiles WHERE family_id = ? AND id IN (${st.profiles.map(() => '?').join(', ')}) ORDER BY created_at, id`)
      .bind(fam.id, ...st.profiles).all();
    const V = LEVELS[st.course.program] ?? null;
    return {
      course: { id: st.course.id, name: V?.name ?? st.course.name ?? null, program: st.course.program ?? null },
      profiles: names.map((x) => ({ id: x.id, name: x.name })),
      servings: fam.default_servings,
      weeks: offlineWeeks(st, pid, n, await versions(env, fam, st), dates),
    };
  }, { kid: true });

  // Completed offline: on the day picked, the recipes cooked (each a full
  // cook) and the Level parts done, for each profile who did them. Nothing
  // done on the Sabbath counts (§6.18), so that day can't be picked; and a
  // leavened recipe can't be marked on the family's unleavened days (§6.20),
  // though one with an unleavened version is marked as that version.
  on('POST', '/api/profiles/([0-9a-f]{16})/offline', async (req, env, body, [pid]) => {
    const { s, fam, st } = await context(env, req, pid);
    const day = String(body.date ?? '');
    if (!isDay(day)) fail(400, 'invalid', 'Pick the day it was done.');
    if (day > today(req)) fail(400, 'invalid', "That day hasn't come yet. Pick the day it was done.");
    if (isSabbath(day)) fail(409, 'sabbath', "Nothing done on the Sabbath counts, so that day can't be picked. Pick the day it was done, or another day.");
    const who = Array.isArray(body.profile_ids) && body.profile_ids.length ? [...new Set(body.profile_ids.map(String))] : [pid];
    if (who.some((x) => !st.profiles.includes(x))) fail(400, 'invalid', "Everyone marked has to be on this course.");
    // A kid's device marks what the kid did (§8.3a).
    if (s.kid && !who.includes(s.profile_id)) kidRefused();
    const recipes = [...new Set((Array.isArray(body.recipes) ? body.recipes : []).map(String))];
    const parts = Array.isArray(body.parts) ? body.parts.map((x) => ({ week: Number(x?.week), part: String(x?.part ?? '') })) : [];
    if (!recipes.length && !parts.length) fail(400, 'invalid', 'Tick at least one thing that was done.');
    for (const id of recipes) if (!st.lessons.usable.includes(id)) fail(400, 'invalid', "That recipe isn't on this course.");
    const V = LEVELS[st.course.program] ?? null;
    for (const x of parts) {
      const w = V?.weeks.find((y) => y.week === x.week);
      if (!w || !PARTS.includes(x.part) || !weekParts(w, st.course.parts ?? PARTS).includes(x.part)) fail(400, 'invalid', 'That part is turned off for this course, or there is no such page.');
    }
    // Noon on the day picked, in the family's time zone.
    const at = new Date(Date.parse(`${day}T12:00:00Z`) + tzOf(req) * 60 * 1000).toISOString();
    const feastDay = fam.release >= UNLEAVENED_RELEASE && unleavenedOn(day, await datesFor(env, fam.id));
    const version = await versions(env, fam, st);
    const cooked = [], stmts = [];
    for (const id of recipes) {
      if (st.done[id]) continue;
      const found = await lessonFor(env, fam.id, id, { deleted: true }) ?? fail(400, 'invalid', 'No such recipe.');
      await feastGuard(env, fam, id, null, { date: day });
      let vid = found.lesson.recipe ? '' : version(id);
      if (feastDay && !found.lesson.recipe) vid = feastCook(found.lesson, lessonVersion(found.lesson, vid || null), REGISTRY, JSON.parse(fam.diet_filters), CONTENT.rules.leaven).variation ?? vid;
      const aid = randomHex(8);
      const L = vid ? lessonVersion(found.lesson, vid) : found.lesson;
      const version_ = L.recipe ? L.version : (await livePatches(env.DB, L.id))[L.id]?.version ?? L.version;
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO attempts (id, family_id, lesson_id, lesson_version, servings, started_at, finished_at, checklist_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(aid, fam.id, id, version_, sizeFor(id, fam.default_servings), at, at, JSON.stringify({ stage: 'done', offline: true })),
        ...(vid ? [recordVariation(env, fam.id, aid, vid)] : []),
        ...who.map((x) => env.DB.prepare('INSERT INTO attempt_profiles (attempt_id, family_id, profile_id) VALUES (?, ?, ?)').bind(aid, fam.id, x)),
      ]);
      await markCooked(env, fam.id, id, who, aid);
      cooked.push(id);
    }
    let marked = 0;
    for (const x of parts) for (const p of who) {
      // A part already checked off keeps its day.
      const t = st.tasks[`${x.week}:${x.part}:${p}`];
      if (t && !t.skipped) continue;
      marked++;
      stmts.push(env.DB.prepare(`INSERT INTO level_tasks (family_id, course_id, week, part, profile_id, done_at, skipped) VALUES (?, ?, ?, ?, ?, ?, 0)
          ON CONFLICT(course_id, week, part, profile_id) DO UPDATE SET done_at = excluded.done_at, skipped = 0, removed_at = NULL`)
        .bind(fam.id, st.course.id, x.week, x.part, p, at));
    }
    if (stmts.length) await env.DB.batch(stmts);
    return { ok: true, cooked, parts: marked, at };
  }, { kid: true });
}
