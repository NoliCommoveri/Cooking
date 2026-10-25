// Phase 12b: a Level course (plan §12.4). Setting up a course starts with
// Which program?; a Level course runs one Level week a calendar week, its
// recipes in week order, and the schedule works as it does for any course.
// All behind the Levels' release (§8.6). The courses here are on Level 3
// Cook, whose first written recipes are week 4's Minestrone (the unit's
// mastery check), week 7's Thick beef burgers, and week 8's Baked fish.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';
import { weekOf, addDays } from '../src/worker/schedule.js';
import { LIBRARY } from '../src/worker/library-data.js';

const today = new Date().toISOString().slice(0, 10);
const sunday = weekOf(today);

async function setup({ preview = true } = {}) {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true });
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Ben', color: 'sky' }] });
  const fid = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  if (preview) await setPreview(env.DB, fid, true);
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, ben] = ['Ava', 'Ben'].map((n) => profiles.find((p) => p.name === n).id);
  return { env, a, ava, ben, fid };
}
// weeks: [] keeps every week's own recipe, so these tests don't move as
// recipes are written; best fit picks are tested on their own (12d).
const level = (a, pids, start = sunday, extra = {}) => a.post('/api/courses', { program: 'sp-3', start_date: start, per_week: 3, profile_ids: pids, weeks: [], ...extra });
const card = async (a) => (await a.get('/api/queue')).body.courses[0];
// Cooked early this Sunday, so the test passes on the Sabbath too (a cook
// finished on Saturday never counts, §6.18).
const finish = (a, id, lesson_id, profile_ids) => a.put(`/api/attempts/${id}`, {
  lesson_id, servings: 6, profile_ids, started_at: `${sunday}T00:10:00.000Z`, finished_at: `${sunday}T00:40:00.000Z`,
});

test("without the Levels' release there is only Cook Around the World", async () => {
  const { a, ava } = await setup({ preview: false });
  assert.deepEqual((await a.get('/api/courses')).body.levels, []);
  assert.equal((await level(a, [ava])).status, 400);
});

test('the Levels show to a preview family before launch, and to every family after', async () => {
  const { env, a, fid } = await setup({ preview: false });
  const ids = async () => (await a.get('/api/courses')).body.levels.map((V) => V.id);
  await setPreview(env.DB, fid, true);
  assert.deepEqual(await ids(), ['sp-2', 'sp-3', 'sp-4']);
  await setPreview(env.DB, fid, false);
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('releases', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(JSON.stringify({ live: 1, preview: [] })).run();
  assert.deepEqual(await ids(), ['sp-2', 'sp-3', 'sp-4'], 'launched for everyone');
});

test('a Level course: one Level week a calendar week, its written recipes in week order', async () => {
  const { a, ava } = await setup();
  const levels = (await a.get('/api/courses')).body.levels;
  assert.ok(levels.every((V) => V.weeks.length === 36));
  assert.equal(levels.find((V) => V.id === 'sp-3').weeks[0].title, 'Black bean and vegetable quesadillas');
  const made = await level(a, [ava]);
  assert.equal(made.status, 200);

  const c = (await a.get('/api/courses')).body.courses[0];
  assert.equal(c.program, 'sp-3');
  assert.equal(c.per_week, 1, 'one Level week a calendar week, whatever was sent');
  assert.equal(c.plan.length, 34, 'the practice run and the capstone have no recipe');
  assert.deepEqual(c.plan.slice(0, 3).map((x) => [x.week, x.id]), [[1, 'bean-quesadillas'], [2, 'aglio-e-olio'], [3, 'vegetable-lo-mein']]);

  // A week whose recipe isn't written yet waits; the course starts on the first that is.
  const q = await card(a);
  assert.deepEqual([q.level.id, q.level.name, q.level.weeks, q.level.week], ['sp-3', 'Level 3 Cook', 36, 4]);
  assert.deepEqual(q.this_week.lessons.map((x) => [x.lesson_id, x.label]), [['minestrone', 'Week 4']]);
  // Thick burgers (week 7) is a Level-only lesson, served with the Levels' release (§12.4).
  assert.deepEqual(q.next_week.lessons.map((x) => [x.lesson_id, x.label]), [['thick-burgers', 'Week 7']]);
  assert.equal(q.total + q.unwritten, 36, 'the written recipes are scheduled; the rest wait, the weeks with no recipe too');
  assert.ok(q.total >= 11);
  // Its week's recipe is queued for the course's profiles.
  const mine = (await a.get(`/api/profiles/${ava}/queue`)).body;
  assert.deepEqual(mine.items.map((x) => x.lesson_id), ['minestrone']);
  assert.deepEqual(mine.order.slice(0, 5), ['bean-quesadillas', 'aglio-e-olio', 'vegetable-lo-mein', 'minestrone', 'bean-tostadas'], 'the whole course, in week order');
});

test('a week is done when its recipe is cooked; an uncooked one rolls over', async () => {
  const { a, ava, ben } = await setup();
  await level(a, [ava, ben], addDays(sunday, -14));
  let q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => x.lesson_id), ['minestrone']);
  assert.equal(q.level.week, 4);
  assert.deepEqual([q.weeks_behind, q.lessons_behind], [2, 2], 'the first two written weeks were due');
  // Cooked with any of the course's profiles on it.
  assert.equal((await finish(a, '00000000000012b1', 'minestrone', [ben])).status, 200);
  q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => [x.lesson_id, x.done]), [['minestrone', true]]);
  assert.deepEqual(q.next_week.lessons.map((x) => x.lesson_id), ['thick-burgers']);
  assert.equal(q.done, 1);
});

test('Skip this recipe and Skip this week work on a Level course, with their undos', async () => {
  const { a, ava } = await setup();
  const { id } = (await level(a, [ava])).body;
  assert.equal((await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: 'beef-bulgogi' })).status, 400, 'not one of its weeks');
  await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: 'minestrone' });
  let q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => x.lesson_id), ['thick-burgers']);
  assert.equal(q.level.week, 7);
  assert.deepEqual(q.skipped_recipes, [{ lesson_id: 'minestrone', title: 'Minestrone', week: 4 }]);
  await a.post(`/api/courses/${id}/put-back-recipe`, { lesson_id: 'minestrone' });
  q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => x.lesson_id), ['minestrone']);

  await a.post(`/api/courses/${id}/week`, { week: sunday, skipped: true });
  q = await card(a);
  assert.equal(q.this_week.lessons.length, 0);
  assert.equal(q.level.week, 4, 'next week holds week 4 now');
  assert.deepEqual(q.next_week.lessons.map((x) => x.lesson_id), ['minestrone']);
});

test('editing a Level course keeps its program; a profile is on one course at a time', async () => {
  const { a, ava, ben } = await setup();
  const { id } = (await level(a, [ava])).body;
  assert.equal((await a.post('/api/courses', { start_date: sunday, per_week: 1, profile_ids: [ava] })).status, 409);
  assert.equal((await a.put(`/api/courses/${id}`, { name: 'Ava\'s Level 3', start_date: sunday, per_week: 4, profile_ids: [ava, ben], program: '' })).status, 200);
  const c = (await a.get('/api/courses')).body.courses[0];
  assert.deepEqual([c.program, c.per_week, c.name, c.profile_ids.length], ['sp-3', 1, 'Ava\'s Level 3', 2]);
});

test("a Level course waits out of sight while the Levels' release is off, and comes back", async () => {
  const { env, a, ava, fid } = await setup();
  await level(a, [ava]);
  assert.equal((await card(a)).program, 'sp-3');
  await setPreview(env.DB, fid, false);
  assert.equal((await a.get('/api/courses')).body.courses.length, 0);
  assert.equal((await a.get('/api/queue')).body.courses.length, 0);
  await setPreview(env.DB, fid, true);
  assert.equal((await card(a)).level.week, 4);
});

test("a Level's own recipes are in the library with the Levels' release only, in their own unit", async () => {
  const { env, a, ava, fid } = await setup();
  let lib = (await a.get('/api/library')).body;
  const burgers = lib.lessons.find((L) => L.id === 'thick-burgers');
  assert.deepEqual([burgers?.unit, burgers?.label, lib.units[103], lib.level_units], [103, 'K11', 'Level 3 Cook recipes', [102, 103, 104]]);
  assert.ok((await a.get('/api/queue')).body.library.some((L) => L.id === 'thick-burgers'), 'a parent can queue it');
  assert.equal((await a.post('/api/queue', { lesson_id: 'thick-burgers', profile_ids: [ava] })).status, 200);

  await setPreview(env.DB, fid, false);
  lib = (await a.get('/api/library')).body;
  assert.ok(!lib.lessons.some((L) => L.id === 'thick-burgers'));
  assert.deepEqual([lib.units[103], lib.level_units, lib.labels['thick-burgers']], [undefined, [], undefined]);
  assert.ok(!(await a.get('/api/queue')).body.library.some((L) => L.id === 'thick-burgers'));
  assert.equal((await a.post('/api/queue', { lesson_id: 'thick-burgers', profile_ids: [ava] })).status, 400);
});

// ---------- 12c: the kitchen's Level week ----------

const saturday = new Date().getUTCDay() === 6;
const kitchen = async (a, pid) => (await a.get(`/api/profiles/${pid}/queue`)).body.level;
// Checks a part off; on the Sabbath the API refuses, so the row goes in directly.
async function checkOff(env, a, pid, week, part) {
  const res = await a.put(`/api/profiles/${pid}/level-tasks`, { week, part });
  if (!saturday) return assert.equal(res.status, 200);
  assert.equal(res.status, 409, 'nothing is checked off on the Sabbath');
  const c = await env.DB.prepare('SELECT course_id, family_id FROM course_profiles WHERE profile_id = ?').bind(pid).first();
  await env.DB.prepare('INSERT INTO level_tasks (family_id, course_id, week, part, profile_id, done_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(c.family_id, c.course_id, week, part, pid, `${sunday}T12:00:00.000Z`).run();
}

test("the kitchen shows this week's recipe and three parts, and the mastery recipes", async () => {
  const { a, ava } = await setup();
  await level(a, [ava]);
  const lv = await kitchen(a, ava);
  const w4 = LIBRARY.levels['sp-3'].weeks[3];
  assert.equal(lv.week.week, 4);
  assert.deepEqual([lv.week.unit_name, lv.week.mastery, lv.week.recipe, lv.week.recipe_written, lv.week.recipe_done], ['Kitchen basics', true, 'minestrone', true, false]);
  assert.deepEqual(lv.week.parts.map((x) => [x.part, x.title, x.minutes, x.done_at]), ['knowledge', 'drill', 'sabbath'].map((k) => [k, w4[k].title, w4[k].minutes, null]));
  assert.ok(lv.mastery.includes('minestrone') && lv.mastery.includes('challah') && !lv.mastery.includes('thick-burgers'));
  assert.equal(lv.sabbath, saturday);
  assert.deepEqual(lv.open, []);
});

test('a part is checked off per profile; the parent takes it back, with Undo', async () => {
  const { env, a, ava, ben } = await setup();
  const { id } = (await level(a, [ava, ben])).body;
  assert.equal((await a.put(`/api/profiles/${ava}/level-tasks`, { week: 4, part: 'lunch' })).status, saturday ? 409 : 400);
  await checkOff(env, a, ava, 4, 'drill');
  assert.ok((await kitchen(a, ava)).week.parts.find((x) => x.part === 'drill').done_at);
  assert.equal((await kitchen(a, ben)).week.parts.find((x) => x.part === 'drill').done_at, null, 'each profile checks off its own');
  let parts = (await card(a)).level.parts;
  assert.deepEqual(parts.map((x) => [x.part, x.done]), [['knowledge', []], ['drill', [ava]], ['sabbath', []]]);

  const body = { week: 4, part: 'drill', profile_id: ava };
  assert.equal((await a.post(`/api/courses/${id}/level-tasks/take-back`, body)).status, 200);
  assert.deepEqual((await card(a)).level.parts.find((x) => x.part === 'drill').done, []);
  assert.equal((await kitchen(a, ava)).week.parts.find((x) => x.part === 'drill').done_at, null);
  assert.equal((await a.post(`/api/courses/${id}/level-tasks/put-back`, body)).status, 200);
  assert.deepEqual((await card(a)).level.parts.find((x) => x.part === 'drill').done, [ava]);
  assert.equal((await a.post(`/api/courses/${id}/level-tasks/take-back`, { ...body, part: 'sabbath' })).status, 404, 'nothing to take back');
});

test("a part not checked off doesn't hold the schedule; it stays open", async () => {
  const { a, ava } = await setup();
  await level(a, [ava], addDays(sunday, -7));
  // Week 4's recipe cooked last Monday; its parts weren't checked off.
  await a.put('/api/attempts/00000000000012c1', {
    lesson_id: 'minestrone', servings: 6, profile_ids: [ava], started_at: `${addDays(sunday, -6)}T00:10:00.000Z`, finished_at: `${addDays(sunday, -6)}T00:40:00.000Z`,
  });
  const lv = await kitchen(a, ava);
  assert.equal(lv.week.week, 7, 'the course moved on');
  assert.deepEqual(lv.open.map((x) => [x.week, x.part]), [[4, 'knowledge'], [4, 'drill'], [4, 'sabbath']]);
});

test('a profile not on a Level course, or in another family, checks off nothing', async () => {
  const { env, a, ava, ben } = await setup();
  await level(a, [ava]);
  const b = await family(env, 'Smiths', 'pat@example.com');
  assert.ok([403, 404].includes((await b.put(`/api/profiles/${ava}/level-tasks`, { week: 4, part: 'drill' })).status));
  if (!saturday) assert.equal((await a.put(`/api/profiles/${ben}/level-tasks`, { week: 4, part: 'drill' })).status, 404);
});

test("a mastery week's Why did it work? is kept per profile", async () => {
  const { env, a, ava } = await setup();
  await a.put('/api/attempts/00000000000012c2', {
    lesson_id: 'minestrone', servings: 6, profile_ids: [ava], started_at: `${sunday}T00:10:00.000Z`, finished_at: `${sunday}T00:40:00.000Z`,
  });
  const why = (v) => a.put('/api/attempts/00000000000012c2/reflection', { profile_id: ava, rating: 5, why: v });
  assert.equal((await why('The stock simmered, not boiled, so it stayed clear.')).status, 200);
  const row = () => env.DB.prepare('SELECT why FROM mastery_notes WHERE attempt_id = ? AND profile_id = ?').bind('00000000000012c2', ava).first();
  assert.equal((await row()).why, 'The stock simmered, not boiled, so it stayed clear.');
  await why('');
  assert.equal(await row(), null, 'emptied, it goes');
});

// ---------- 12d: best-fit recipes and Swap recipe ----------

const rate = (a, pid, kind, item, stars) => a.put(`/api/profiles/${pid}/ratings`, { kind, item, stars });
const weekIds = async (a) => Object.fromEntries((await a.get('/api/courses')).body.courses[0].plan.map((x) => [x.week, x.id]));
const bestFit = (a, pid) => a.post('/api/courses', { program: 'sp-3', start_date: sunday, per_week: 1, profile_ids: [pid] });

test("a new Level course keeps each week's best fit, one recipe a week", async () => {
  const { a, ava } = await setup();
  assert.equal((await bestFit(a, ava)).status, 200);
  const w = await weekIds(a);
  assert.deepEqual([w[4], w[7], w[8]], ['minestrone', 'thick-burgers', 'baked-salmon'], "each week's own, written");
  assert.equal(new Set(Object.values(w)).size, Object.keys(w).length, 'a recipe is in one week at most');
});

test("a week where nothing fits keeps its own; a recipe they've cooked comes last", async () => {
  const { a, ava } = await setup();
  await rate(a, ava, 'protein', 'beef', 1);
  const p = (await a.get(`/api/picks/level?level=sp-3&profiles=${ava}`)).body;
  assert.equal(p.picks[33], 'beef-ragu');
  assert.match(p.notes[33], /keeps its own recipe/);
  await a.put('/api/attempts/00000000000012d1', {
    lesson_id: 'steamed-fish', servings: 6, profile_ids: [ava], started_at: `${addDays(sunday, -6)}T00:10:00.000Z`, finished_at: `${addDays(sunday, -6)}T00:40:00.000Z`,
  });
  const w8 = (await a.get(`/api/picks/level?level=sp-3&profiles=${ava}`)).body.weeks.find((x) => x.week === 8);
  assert.equal(w8.more.at(-1).id, 'steamed-fish');
  assert.ok(w8.more.at(-1).cooked);
});

test('the parent changes a week; a recipe is in one week only; Swap recipe with Undo', async () => {
  const { a, ava } = await setup();
  const { id } = (await level(a, [ava])).body;
  const put = (weeks) => a.put(`/api/courses/${id}`, { start_date: sunday, per_week: 1, profile_ids: [ava], weeks });
  assert.equal((await put([{ week: 4, id: 'ratatouille' }])).status, 200);
  assert.equal((await weekIds(a))[4], 'ratatouille');
  assert.equal((await put([{ week: 4, id: 'beef-bulgogi' }])).status, 400, "not one of week 4's recipes");
  assert.equal((await put([{ week: 4, id: 'fish-tacos' }])).status, 400, 'fish tacos are week 29');

  // Swap recipe on this week's recipe.
  const opts = (await a.get(`/api/courses/${id}/level-week?week=4`)).body;
  assert.equal(opts.current, 'ratatouille');
  assert.deepEqual(opts.options.map((x) => x.id), ['minestrone']);
  assert.ok(opts.more.find((x) => x.id === 'ratatouille').current);
  assert.ok(opts.more.find((x) => x.id === 'fish-tacos').taken);
  const res = await a.post(`/api/courses/${id}/level-week`, { week: 4, id: 'chicken-fried-rice' });
  assert.equal(res.body.before, 'ratatouille');
  let q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => [x.lesson_id, x.label]), [['chicken-fried-rice', 'Week 4']]);
  await a.post(`/api/courses/${id}/level-week`, { week: 4, id: res.body.before });
  q = await card(a);
  assert.equal(q.this_week.lessons[0].lesson_id, 'ratatouille');
  // A week's skipped mark stays with the week when its recipe changes.
  await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: 'ratatouille' });
  await a.post(`/api/courses/${id}/level-week`, { week: 4, id: 'minestrone' });
  assert.deepEqual((await card(a)).skipped_recipes.map((x) => x.lesson_id), ['minestrone']);
});

// ---------- 12e: the Level view, Progress, and the transcript ----------

const minutesOf = (id) => LIBRARY.lessons.find((L) => L.id === id).totalMinutes;
const monday = addDays(sunday, -6);
const cookOn = (a, id, lesson_id, pids, day = monday) => a.put(`/api/attempts/${id}`, {
  lesson_id, servings: 6, profile_ids: pids, started_at: `${day}T00:10:00.000Z`, finished_at: `${day}T00:40:00.000Z`,
});
// Rows straight into the draft's table, so the Sabbath doesn't refuse them.
const partDone = (env, fid, courseId, pid, week, part) => env.DB.prepare('INSERT INTO level_tasks (family_id, course_id, week, part, profile_id, done_at) VALUES (?, ?, ?, ?, ?, ?)')
  .bind(fid, courseId, week, part, pid, `${monday}T12:00:00.000Z`).run();

const W = LIBRARY.levels['sp-3'].weeks;
const HOURS = LIBRARY.levels['sp-3'].hours;

test("a learner's Level progress: each week ticked, hours, and a unit mastered with why it worked", async () => {
  const { env, a, ava, ben, fid } = await setup();
  const { id } = (await level(a, [ava], addDays(sunday, -7))).body;
  const total = (await card(a)).level.hours;
  await partDone(env, fid, id, ava, 4, 'drill');
  let pr = (await kitchen(a, ava)).progress;
  assert.deepEqual([pr.name, pr.hours, pr.weeks, pr.units.length, pr.complete], ['Level 3 Cook', total, 36, 9, null]);
  assert.equal(pr.hours_done, Math.round(W[3].drill.minutes / 6) / 10, "the drill's planned time");

  // Week 4's Minestrone is Unit 1's mastery check: cooked, and mastered once there's a "why it worked".
  await cookOn(a, '00000000000012e1', 'minestrone', [ava, ben]);
  pr = (await kitchen(a, ava)).progress;
  const w4 = pr.units[0].weeks[3];
  assert.deepEqual([w4.recipe, w4.cooked, w4.parts.drill, w4.parts.knowledge], ['minestrone', monday, monday, null]);
  assert.equal(pr.hours_done, Math.round((minutesOf('minestrone') + W[3].drill.minutes) / 6) / 10, "the recipe's and the drill's planned time");
  assert.equal(pr.units[0].mastered, null, 'cooked without a why');
  await a.put('/api/attempts/00000000000012e1/reflection', { profile_id: ava, rating: 5, why: 'The soup simmered gently, so the dice held their shape.' });
  pr = (await kitchen(a, ava)).progress;
  assert.equal(pr.units[0].mastered, monday);
  assert.equal(pr.units[1].mastered, null);
  assert.equal(pr.rows.length, 1);

  // Ben cooked the minestrone too, but he isn't on a Level course.
  const benQ = (await a.get(`/api/profiles/${ben}/queue`)).body;
  assert.equal(benQ.level, null);
});

test('the capstone completes the Level; the practice run and capstone come after the last recipe', async () => {
  const { env, a, ava, fid } = await setup();
  const { id } = (await level(a, [ava], addDays(sunday, -7))).body;
  for (const part of ['drill', 'knowledge', 'sabbath']) await partDone(env, fid, id, ava, 36, part);
  const pr = (await kitchen(a, ava)).progress;
  assert.equal(pr.complete, monday);
  assert.equal(pr.units[8].mastered, monday, 'the last unit is mastered by its capstone');
  const cap = W[35];
  assert.equal(pr.hours_done, Math.round((cap.drill.minutes + cap.knowledge.minutes + cap.sabbath.minutes + cap.minutes) / 6) / 10, "the capstone's parts and its own time once it's served");

  // Every recipe week skipped: the practice run is this week's card, with its note.
  const plan = (await a.get('/api/courses')).body.courses[0].plan;
  for (const x of plan) await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: x.id });
  const lv = await kitchen(a, ava);
  assert.deepEqual([lv.week.week, lv.week.kind, lv.week.recipe], [35, 'practice', null]);
  assert.match(lv.week.note, /Practice run/);
});

test('Print our progress and the transcript gain the Level part rows, its hours, and its units', async () => {
  const { env, a, ava, fid } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true, mode: 'homeschool' });
  const { id } = (await level(a, [ava], addDays(sunday, -7))).body;
  const total = (await card(a)).level.hours;
  await cookOn(a, '00000000000012e3', 'minestrone', [ava]);
  await partDone(env, fid, id, ava, 4, 'knowledge');

  const p = (await a.get('/api/progress')).body.profiles.find((x) => x.id === ava);
  assert.deepEqual(p.rows.map((r) => [r.dish, r.skill, Boolean(r.part)]), [
    ['Minestrone', LIBRARY.lessons.find((L) => L.id === 'minestrone').skill, false],
    [W[3].knowledge.title, 'Level 3 Cook · Week 4 Knowledge', true],
  ]);
  assert.equal(p.level.weeks.length, 36);
  assert.equal(p.level.units[0].mastered, null);

  const t = (await a.get(`/api/transcript/${ava}`)).body;
  assert.deepEqual([t.totals.cooks, t.totals.parts], [1, 1]);
  assert.equal(t.totals.hours, Math.round((minutesOf('minestrone') + W[3].knowledge.minutes) / 6) / 10);
  assert.deepEqual([t.level.name, t.level.hours, t.level.hours_done], ['Level 3 Cook', total, t.totals.hours]);
  assert.ok(t.rows.find((r) => r.part === 'knowledge' && r.minutes === W[3].knowledge.minutes && r.grade === null));

  // Without the Levels' release, none of it shows.
  await setPreview(env.DB, fid, false);
  const off = (await a.get('/api/progress')).body.profiles.find((x) => x.id === ava);
  assert.deepEqual([off.level, off.rows.length], [null, 1]);
});

test('a parent turns parts off at setup or later, and sees the hours that plans for', async () => {
  const { a, ava } = await setup();
  assert.equal((await level(a, [ava], sunday, { parts: ['lunch'] })).status, 400);
  const { id } = (await level(a, [ava], sunday, { parts: ['drill'] })).body;
  let c = (await a.get('/api/courses')).body.courses[0];
  assert.deepEqual(c.parts, ['drill']);
  const lv = await kitchen(a, ava);
  assert.deepEqual(lv.week.parts.map((x) => x.part), ['drill'], 'only the parts kept on');
  const card1 = await card(a);
  assert.deepEqual(card1.level.on, ['drill']);
  assert.equal(lv.progress.hours, card1.level.hours);
  assert.equal((await a.put(`/api/profiles/${ava}/level-tasks`, { week: 4, part: 'knowledge', skip: true })).status, 400, "it's off");

  // The editor's numbers: every recipe's minutes, so it adds up the same.
  const V = (await a.get('/api/courses')).body.levels.find((x) => x.id === 'sp-3');
  assert.equal(V.minutes.minestrone, minutesOf('minestrone'));

  // Turned back on later.
  await a.put(`/api/courses/${id}`, { start_date: sunday, per_week: 1, profile_ids: [ava], parts: ['drill', 'knowledge', 'sabbath'] });
  c = (await a.get('/api/courses')).body.courses[0];
  assert.deepEqual(c.parts, ['knowledge', 'drill', 'sabbath'], "in the owner's order");
  const all = (await card(a)).level.hours;
  assert.ok(card1.level.hours < all && card1.level.hours > all / 2, `${card1.level.hours} of ${all} hours`);
  assert.ok(Math.abs(all - HOURS) / HOURS < 0.1, `${all} hours, about the Level's ${HOURS}`);
});

test('a part kept on can be skipped, any day: no longer open, counts for nothing, and taken back', async () => {
  const { a, ava } = await setup();
  const { id } = (await level(a, [ava])).body;
  assert.equal((await a.put(`/api/profiles/${ava}/level-tasks`, { week: 4, part: 'knowledge', skip: true })).status, 200);
  let lv = await kitchen(a, ava);
  const k = lv.week.parts.find((x) => x.part === 'knowledge');
  assert.deepEqual([k.skipped, k.done_at], [true, null]);
  assert.equal(lv.progress.hours_done, 0);
  assert.deepEqual(lv.progress.units[0].weeks[3].skipped, ['knowledge']);
  assert.deepEqual((await card(a)).level.parts.find((x) => x.part === 'knowledge').skipped, [ava]);
  await a.post(`/api/courses/${id}/level-tasks/take-back`, { week: 4, part: 'knowledge', profile_id: ava });
  lv = await kitchen(a, ava);
  assert.equal(lv.week.parts.find((x) => x.part === 'knowledge').skipped, false);
});

test('the Levels 2, 3, and 4 are in the library, with a Familiar and an Explore dish each recipe week', () => {
  const sp = ['sp-2', 'sp-3', 'sp-4'].map((id) => LIBRARY.levels[id]);
  assert.deepEqual(sp.map((V) => [V.id, V.name, V.side.number, V.weeks.length]),
    [['sp-2', 'Level 2 Apprentice', 102, 36], ['sp-3', 'Level 3 Cook', 103, 36], ['sp-4', 'Level 4 Chef', 104, 36]]);
  for (const V of sp) {
    for (const w of V.weeks.filter((x) => !x.kind)) assert.ok(w.familiar && w.explore && w.familiar !== w.explore && w.recipe === w.familiar, `${V.id} week ${w.week}`);
    assert.deepEqual(V.weeks.filter((w) => w.mastery).map((w) => w.week), [4, 6, 10, 15, 20, 26, 30, 33]);
  }
  // Level 4 names a cuisine every recipe week (§12.0).
  assert.ok(sp[2].weeks.filter((w) => !w.kind).every((w) => w.cuisine));
});

test('the public demo and syllabus get the Levels only once their release is launched', async () => {
  const { default: worker } = await import('../src/worker/index.js');
  const env = await makeEnv();
  env.ASSETS = { fetch: async () => new Response(JSON.stringify({ levels: [{ id: 'sp-3' }] })) };
  const get = async () => (await (await worker.fetch(new Request('http://x/content/levels.json'), env)).json()).levels.length;
  assert.equal(await get(), 0, 'not launched: none, even for a preview family');
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('releases', ?)").bind(JSON.stringify({ live: 1, preview: [] })).run();
  assert.equal(await get(), 1, 'launched: the built file');
});
