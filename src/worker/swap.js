// Phase 4c: Swap for an Appointed Time meal instead (plan §6.19). In the "⋯"
// menu of every queued lesson, all year, parents only. The meal picked takes
// that lesson's place this week:
//   - a course lesson stays in the plan and goes first next week, and the rest
//     move back a week; the planned finish moves with them, so a swap never
//     counts as behind (schedule.js, course_weeks.swapped);
//   - a lesson queued by hand is taken off the queue.
// Either way the swap has an Undo.
//
// February 1 through May 15, by the week being swapped, the picker offers only
// Unleavened recipes: the Appointed Times lessons, then other library lessons
// that pass the leaven check, then parent recipes that pass it (the family's
// own, and the whole directory). The rest of the year it offers the
// Appointed Times lessons, then the other lessons the owner marked Good for
// Feast Days, then every Good for Feast Days recipe. Diet settings apply to
// all of them.
import { fail, now } from './lib/http.js';
import { randomHex } from './lib/crypto.js';
import { requireParent } from './auth.js';
import { CONTENT } from './content-data.js';
import { LIBRARY } from './library-data.js';
import { dietView } from '../content/diet.js';
import { servingOptions } from '../content/scale.js';
import { unleavened } from '../content/leaven.js';
import { family, queueProfiles, today, weekFor, replaceStatements, levelLessonOn } from './plan.js';
import { addDays } from './schedule.js';
import { REGISTRY, stored, rowLesson, recipeVisible, lessonFor } from './recipes.js';
import { recipeLesson } from '../content/recipe.js';
import { tasteContext, cookCtx, dishFit } from './picks.js';
import { better } from '../content/score.js';

const ACTIVE = ['assigned', 'shopped'];
const seasonal = new Set(LIBRARY.lessons.filter((L) => LIBRARY.seasonal.includes(L.unit)).map((L) => L.id));
const LABELS = LIBRARY.seasonalLabels;

// February 1 through May 15, fixed every year (owner, 2026-10-22): any day of
// the week being swapped, Sunday to Friday, in that window.
export function springWeek(sunday) {
  for (let i = 0; i < 6; i++) {
    const md = addDays(sunday, i).slice(5);
    if (md >= '02-01' && md <= '05-15') return true;
  }
  return false;
}

// What the picker offers for a week, in order (§6.19). With the next release,
// each library lesson has its fit for the profiles on the cook (pids), and
// within each part the best fit comes first; ones that don't fit go last
// (§6.21, 11d2). The parts keep their order, and parent recipes, which have
// no tags, keep theirs.
export async function swapOptions(env, fam, week, pids = []) {
  const filters = JSON.parse(fam.diet_filters);
  const spring = springWeek(week);
  // A Level's own recipes (§12.4) only with the next release.
  const libOk = (L) => levelLessonOn(L, fam.release) && dietView(L, LIBRARY.ingredients, filters).visible;
  const out = [];
  const lesson = (L, group) => ({ id: L.id, title: L.title, label: LABELS[L.id] ?? null, group, image: L.image, unleavened: Boolean(L.unleavened), feast: Boolean(L.feast) });
  for (const L of LIBRARY.lessons) if (seasonal.has(L.id) && libOk(L) && (!spring || L.unleavened)) out.push(lesson(L, 'Appointed Times lessons'));
  for (const L of LIBRARY.lessons) if (!seasonal.has(L.id) && libOk(L) && (spring ? L.unleavened : L.feast)) out.push(lesson(L, 'Other lessons'));

  // Parent recipes: the family's own, then the directory. One the family
  // already added from the directory is offered as its own copy.
  const own = (await env.DB.prepare('SELECT * FROM family_recipes WHERE family_id = ? AND deleted_at IS NULL AND held = 0 ORDER BY title COLLATE NOCASE, id').bind(fam.id).all()).results;
  const shares = (await env.DB.prepare('SELECT * FROM community_recipes WHERE withdrawn_at IS NULL AND hidden_at IS NULL ORDER BY title COLLATE NOCASE, id').all()).results;
  const copied = new Set(own.map((r) => r.source_community_id).filter(Boolean));
  for (const row of own) {
    const share = shares.find((c) => c.family_recipe_id === row.id);
    const source = shares.find((c) => c.id === row.source_community_id);
    const unlv = unleavened(stored(row), REGISTRY, CONTENT.rules.leaven) || Boolean(share?.unleavened || source?.unleavened);
    const feast = share?.kind === 'feast' || source?.kind === 'feast';
    if (spring ? !unlv : !feast) continue;
    if (!recipeVisible(rowLesson(row), filters)) continue;
    out.push({ id: `recipe:${row.id}`, title: row.title, label: null, group: 'Our recipes', image: `img/meals/${row.meal_type}.svg`, unleavened: unlv, feast });
  }
  for (const c of shares) {
    if (c.family_id === fam.id || copied.has(c.id)) continue;
    if (spring ? !c.unleavened : c.kind !== 'feast') continue;
    const { cleared, ...r } = JSON.parse(c.body_json);
    if (!recipeVisible(recipeLesson(`shared:${c.id}`, r), filters)) continue;
    out.push({ id: `shared:${c.id}`, title: c.title, label: null, group: 'User-shared recipes', image: `img/meals/${c.meal_type}.svg`, unleavened: Boolean(c.unleavened), feast: c.kind === 'feast' });
  }
  const tc = await tasteContext(env, fam);
  if (tc) {
    const ctx = cookCtx(tc, pids);
    const groups = [...new Set(out.map((o) => o.group))];
    const scored = out.map((o, i) => {
      if (o.id.includes(':')) return { o, i };
      const f = dishFit(tc, ctx, o.id);
      return { o: { ...o, fit: f.fit, fit_label: f.label, why: f.why, notes: f.notes }, f, i };
    });
    scored.sort((a, b) => (groups.indexOf(a.o.group) - groups.indexOf(b.o.group)) || (a.f && b.f ? better(a.f, b.f) : 0) || a.i - b.i);
    return { spring, week, options: scored.map((x) => x.o) };
  }
  return { spring, week, options: out };
}

async function activeRow(env, fid, qid) {
  const r = await env.DB.prepare('SELECT * FROM queue WHERE id = ? AND family_id = ?').bind(qid, fid).first() ?? fail(404, 'not_found', 'No such queued lesson.');
  if (!ACTIVE.includes(r.status)) fail(409, 'closed', 'That lesson is no longer in the queue.');
  return r;
}

const nearest = (L, n) => {
  const options = servingOptions(L);
  return options.includes(n) ? n : options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
};

export function register(on) {
  on('GET', '/api/queue/([0-9a-f]{16})/swap', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const r = await activeRow(env, s.family_id, qid);
    if (r.swap_of) fail(409, 'swapped', 'This is already a swap. Undo it to pick again.');
    return swapOptions(env, fam, weekFor(r, today(req)), (await queueProfiles(env, s.family_id, [r.id]))[r.id] ?? []);
  });

  on('POST', '/api/queue/([0-9a-f]{16})/swap', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const r = await activeRow(env, s.family_id, qid);
    if (r.swap_of) fail(409, 'swapped', 'This is already a swap. Undo it to pick again.');
    const week = weekFor(r, today(req));
    const { options } = await swapOptions(env, fam, week);
    const pick = options.find((o) => o.id === String(body.lesson_id ?? '')) ?? fail(400, 'invalid', 'Pick one of the meals offered.');
    let lessonId = pick.id;
    // A directory recipe picked here is added to the family's recipes (§6.19).
    if (lessonId.startsWith('shared:')) {
      const c = await env.DB.prepare('SELECT * FROM community_recipes WHERE id = ?').bind(lessonId.slice(7)).first();
      const { cleared = [], ...rec } = JSON.parse(c.body_json);
      const hex = randomHex(8), t = now();
      await env.DB.prepare(`INSERT INTO family_recipes (id, family_id, title, servings, total_minutes, meal_type, body_json, version, cleared_words, source_community_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).bind(hex, s.family_id, c.title, rec.servings, rec.totalMinutes, c.meal_type, JSON.stringify(rec), JSON.stringify(cleared), c.id, t, t).run();
      lessonId = `recipe:${hex}`;
    }
    const L = (await lessonFor(env, s.family_id, lessonId)).lesson;
    const who = (await queueProfiles(env, s.family_id, [r.id]))[r.id] ?? [];
    const nid = randomHex(8), t = now();
    // The course lesson goes first next week, or a hand-queued one comes off.
    const { swapOf, stmts: replaced } = replaceStatements(env, s.family_id, r, week, t);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO queue (id, family_id, lesson_id, servings, planned_date, status, source, course_id, week_start, swap_of, created_at)
          VALUES (?, ?, ?, ?, ?, 'assigned', 'manual', NULL, ?, ?, ?)`)
        .bind(nid, s.family_id, lessonId, nearest(L, r.servings), r.course_id ? null : r.planned_date, r.course_id ? week : r.week_start, swapOf, t),
      ...who.map((pid) => env.DB.prepare('INSERT INTO queue_profiles (queue_id, family_id, profile_id) VALUES (?, ?, ?)').bind(nid, s.family_id, pid)),
      ...replaced,
    ]);
    return { ok: true, id: nid, title: pick.title };
  });

  // Undo a swap: the meal comes off, and the lesson it replaced goes back.
  on('POST', '/api/queue/([0-9a-f]{16})/unswap', async (req, env, body, [qid]) => {
    const s = await requireParent(env, req);
    const r = await activeRow(env, s.family_id, qid);
    const m = /^(q):([0-9a-f]{16})$|^(c):([0-9a-f]{16}):(.+)$/.exec(r.swap_of ?? '') ?? fail(409, 'not_swap', "That isn't a swap.");
    const stmts = [
      env.DB.prepare('DELETE FROM queue_profiles WHERE queue_id = ? AND family_id = ?').bind(r.id, s.family_id),
      env.DB.prepare('DELETE FROM queue WHERE id = ? AND family_id = ?').bind(r.id, s.family_id),
    ];
    if (m[1]) {
      stmts.push(env.DB.prepare("UPDATE queue SET status = 'assigned', closed_at = NULL WHERE id = ? AND family_id = ? AND status = 'removed'").bind(m[2], s.family_id));
    } else {
      stmts.push(env.DB.prepare('UPDATE course_weeks SET swapped = MAX(0, swapped - 1) WHERE course_id = ? AND family_id = ? AND week_start = ?').bind(m[4], s.family_id, r.week_start));
    }
    await env.DB.batch(stmts);
    return { ok: true };
  });
}
