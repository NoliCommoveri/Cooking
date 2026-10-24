// Phase 12b: a Level course (plan §12.4). Setting up a course starts with
// Which program?; a Level course runs one Level week a calendar week, its
// recipes in week order, and the schedule works as it does for any course.
// All behind the next release (§8.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';
import { weekOf, addDays } from '../src/worker/schedule.js';

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
const level = (a, pids, start = sunday, extra = {}) => a.post('/api/courses', { program: 'level-3', start_date: start, per_week: 3, profile_ids: pids, weeks: [], ...extra });
const card = async (a) => (await a.get('/api/queue')).body.courses[0];
// Cooked early this Sunday, so the test passes on the Sabbath too (a cook
// finished on Saturday never counts, §6.18).
const finish = (a, id, lesson_id, profile_ids) => a.put(`/api/attempts/${id}`, {
  lesson_id, servings: 6, profile_ids, started_at: `${sunday}T00:10:00.000Z`, finished_at: `${sunday}T00:40:00.000Z`,
});

test('without the next release there is only Cook Around the World', async () => {
  const { a, ava } = await setup({ preview: false });
  assert.deepEqual((await a.get('/api/courses')).body.levels, []);
  assert.equal((await level(a, [ava])).status, 400);
});

test('a Level course: one week a week, its recipes in week order, "Week 1 of 36"', async () => {
  const { a, ava } = await setup();
  const { levels } = (await a.get('/api/courses')).body;
  assert.deepEqual(levels.map((V) => [V.id, V.weeks.length]), [['level-3', 36]]);
  assert.equal(levels[0].weeks[0].title, 'Shakshuka');
  const made = await level(a, [ava]);
  assert.equal(made.status, 200);

  const c = (await a.get('/api/courses')).body.courses[0];
  assert.equal(c.program, 'level-3');
  assert.equal(c.per_week, 1, 'one Level week a calendar week, whatever was sent');
  assert.equal(c.plan.length, 34, 'the practice run and the capstone have no recipe yet');
  assert.deepEqual(c.plan.slice(0, 3).map((x) => [x.week, x.id]), [[1, 'shakshuka'], [2, 'thick-burgers'], [3, 'chicken-fried-rice']]);

  const q = await card(a);
  assert.deepEqual([q.level.id, q.level.name, q.level.weeks, q.level.week], ['level-3', 'Level 3 Cook', 36, 1]);
  assert.deepEqual(q.this_week.lessons.map((x) => [x.lesson_id, x.label]), [['shakshuka', 'Week 1']]);
  // Thick burgers (week 2) is a Level-only lesson, not served to the app yet, so week 3's recipe is next, like a planned dish (§6.18).
  assert.deepEqual(q.next_week.lessons.map((x) => [x.lesson_id, x.label]), [['chicken-fried-rice', 'Week 3']]);
  assert.equal(q.total, 4, 'the written recipes are scheduled');
  assert.equal(q.unwritten, 32, 'the rest wait, the weeks with no recipe too');
  // Its week's recipe is queued for the course's profiles.
  const mine = (await a.get(`/api/profiles/${ava}/queue`)).body;
  assert.deepEqual(mine.items.map((x) => x.lesson_id), ['shakshuka']);
  assert.deepEqual(mine.order.slice(0, 2), ['shakshuka', 'thick-burgers']);
});

test('a week is done when its recipe is cooked; an uncooked one rolls over', async () => {
  const { a, ava, ben } = await setup();
  await level(a, [ava, ben], addDays(sunday, -14));
  let q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
  assert.equal(q.level.week, 1);
  assert.deepEqual([q.weeks_behind, q.lessons_behind], [2, 2], 'weeks 1 and 3 were due');
  // Cooked with any of the course's profiles on it.
  assert.equal((await finish(a, '00000000000012b1', 'shakshuka', [ben])).status, 200);
  q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => [x.lesson_id, x.done]), [['shakshuka', true]]);
  assert.deepEqual(q.next_week.lessons.map((x) => x.lesson_id), ['chicken-fried-rice']);
  assert.equal(q.done, 1);
});

test('Skip this recipe and Skip this week work on a Level course, with their undos', async () => {
  const { a, ava } = await setup();
  const { id } = (await level(a, [ava])).body;
  assert.equal((await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: 'beef-bulgogi' })).status, 400, 'not one of its weeks');
  await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: 'shakshuka' });
  let q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => x.lesson_id), ['chicken-fried-rice']);
  assert.equal(q.level.week, 3);
  assert.deepEqual(q.skipped_recipes, [{ lesson_id: 'shakshuka', title: 'Shakshuka', week: 1 }]);
  await a.post(`/api/courses/${id}/put-back-recipe`, { lesson_id: 'shakshuka' });
  q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => x.lesson_id), ['shakshuka']);

  await a.post(`/api/courses/${id}/week`, { week: sunday, skipped: true });
  q = await card(a);
  assert.equal(q.this_week.lessons.length, 0);
  assert.equal(q.level.week, 1, 'next week holds week 1 now');
  assert.deepEqual(q.next_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
});

test('editing a Level course keeps its program; a profile is on one course at a time', async () => {
  const { a, ava, ben } = await setup();
  const { id } = (await level(a, [ava])).body;
  assert.equal((await a.post('/api/courses', { start_date: sunday, per_week: 1, profile_ids: [ava] })).status, 409);
  assert.equal((await a.put(`/api/courses/${id}`, { name: 'Ava\'s Level 3', start_date: sunday, per_week: 4, profile_ids: [ava, ben], program: '' })).status, 200);
  const c = (await a.get('/api/courses')).body.courses[0];
  assert.deepEqual([c.program, c.per_week, c.name, c.profile_ids.length], ['level-3', 1, 'Ava\'s Level 3', 2]);
});

test('a Level course waits out of sight while the next release is off, and comes back', async () => {
  const { env, a, ava, fid } = await setup();
  await level(a, [ava]);
  assert.equal((await card(a)).program, 'level-3');
  await setPreview(env.DB, fid, false);
  assert.equal((await a.get('/api/courses')).body.courses.length, 0);
  assert.equal((await a.get('/api/queue')).body.courses.length, 0);
  await setPreview(env.DB, fid, true);
  assert.equal((await card(a)).level.week, 1);
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
  assert.equal(lv.week.week, 1);
  assert.deepEqual([lv.week.unit_name, lv.week.recipe, lv.week.recipe_written, lv.week.recipe_done], ['Food safety science', 'shakshuka', true, false]);
  assert.deepEqual(lv.week.parts.map((x) => [x.part, x.title, x.minutes, x.done_at]), [
    ['drill', 'Calibrate a thermometer in ice water', 40, null], ['knowledge', 'Danger zone and how bacteria grow', 35, null], ['sabbath', 'Label and date containers', 45, null]]);
  assert.ok(lv.mastery.includes('minestrone') && lv.mastery.includes('meatloaf') && !lv.mastery.includes('shakshuka'));
  assert.equal(lv.sabbath, saturday);
  assert.deepEqual(lv.open, []);
});

test('a part is checked off per profile; the parent takes it back, with Undo', async () => {
  const { env, a, ava, ben } = await setup();
  const { id } = (await level(a, [ava, ben])).body;
  assert.equal((await a.put(`/api/profiles/${ava}/level-tasks`, { week: 1, part: 'lunch' })).status, saturday ? 409 : 400);
  await checkOff(env, a, ava, 1, 'drill');
  assert.ok((await kitchen(a, ava)).week.parts[0].done_at);
  assert.equal((await kitchen(a, ben)).week.parts[0].done_at, null, 'each profile checks off its own');
  let parts = (await card(a)).level.parts;
  assert.deepEqual(parts.map((x) => x.done), [[ava], [], []]);

  const body = { week: 1, part: 'drill', profile_id: ava };
  assert.equal((await a.post(`/api/courses/${id}/level-tasks/take-back`, body)).status, 200);
  assert.deepEqual((await card(a)).level.parts[0].done, []);
  assert.equal((await kitchen(a, ava)).week.parts[0].done_at, null);
  assert.equal((await a.post(`/api/courses/${id}/level-tasks/put-back`, body)).status, 200);
  assert.deepEqual((await card(a)).level.parts[0].done, [ava]);
  assert.equal((await a.post(`/api/courses/${id}/level-tasks/take-back`, { ...body, part: 'sabbath' })).status, 404, 'nothing to take back');
});

test("a part not checked off doesn't hold the schedule; it stays open", async () => {
  const { a, ava } = await setup();
  await level(a, [ava], addDays(sunday, -7));
  // Week 1's recipe cooked last Monday; its parts weren't checked off.
  await a.put('/api/attempts/00000000000012c1', {
    lesson_id: 'shakshuka', servings: 6, profile_ids: [ava], started_at: `${addDays(sunday, -6)}T00:10:00.000Z`, finished_at: `${addDays(sunday, -6)}T00:40:00.000Z`,
  });
  const lv = await kitchen(a, ava);
  assert.equal(lv.week.week, 3, 'the course moved on');
  assert.deepEqual(lv.open.map((x) => [x.week, x.part]), [[1, 'drill'], [1, 'knowledge'], [1, 'sabbath']]);
});

test('a profile not on a Level course, or in another family, checks off nothing', async () => {
  const { env, a, ava, ben } = await setup();
  await level(a, [ava]);
  const b = await family(env, 'Smiths', 'pat@example.com');
  assert.ok([403, 404].includes((await b.put(`/api/profiles/${ava}/level-tasks`, { week: 1, part: 'drill' })).status));
  if (!saturday) assert.equal((await a.put(`/api/profiles/${ben}/level-tasks`, { week: 1, part: 'drill' })).status, 404);
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
const bestFit = (a, pid) => a.post('/api/courses', { program: 'level-3', start_date: sunday, per_week: 1, profile_ids: [pid] });

test("a new Level course keeps each week's best fit, written recipes first", async () => {
  const { a, ava } = await setup();
  await rate(a, ava, 'protein', 'eggs', 1);
  assert.equal((await bestFit(a, ava)).status, 200);
  const w = await weekIds(a);
  assert.equal(w[1], 'oyakodon', 'eggs rated 1 star: the chicken option');
  assert.equal(w[2], 'smash-burgers', 'a written option before an unwritten default');
  assert.equal(w[9], 'fish-tacos');
  assert.equal(new Set(Object.values(w)).size, Object.keys(w).length, 'a recipe is in one week at most');
});

test("a recipe they've cooked comes last; a week where nothing fits keeps its own", async () => {
  const { a, ava } = await setup();
  await a.put('/api/attempts/00000000000012d1', {
    lesson_id: 'smash-burgers', servings: 6, profile_ids: [ava], started_at: `${addDays(sunday, -6)}T00:10:00.000Z`, finished_at: `${addDays(sunday, -6)}T00:40:00.000Z`,
  });
  await rate(a, ava, 'protein', 'chicken', 1);
  const p = (await a.get(`/api/picks/level?level=level-3&profiles=${ava}`)).body;
  assert.equal(p.picks[2], 'thick-burgers', 'smash burgers were cooked, so they come last');
  assert.equal(p.picks[3], 'chicken-fried-rice', 'both options are chicken: the week keeps its own');
  assert.match(p.notes[3], /keeps its own recipe/);
  const w2 = p.weeks.find((x) => x.week === 2);
  assert.equal(w2.options.at(-1).id, 'smash-burgers');
  assert.ok(w2.options.at(-1).cooked);
});

test('the parent changes a week; a recipe is in one week only; Swap recipe with Undo', async () => {
  const { a, ava } = await setup();
  const { id } = (await level(a, [ava])).body;
  const put = (weeks) => a.put(`/api/courses/${id}`, { start_date: sunday, per_week: 1, profile_ids: [ava], weeks });
  assert.equal((await put([{ week: 1, id: 'huevos-rancheros' }])).status, 200);
  assert.equal((await weekIds(a))[1], 'huevos-rancheros');
  assert.equal((await put([{ week: 1, id: 'beef-bulgogi' }])).status, 400, "not one of week 1's recipes");
  assert.equal((await put([{ week: 9, id: 'minestrone' }])).status, 400, 'minestrone is week 32');

  // Swap recipe on this week's recipe.
  const opts = (await a.get(`/api/courses/${id}/level-week?week=1`)).body;
  assert.equal(opts.current, 'huevos-rancheros');
  assert.deepEqual(opts.options.map((x) => x.id).sort(), ['huevos-rancheros', 'oyakodon', 'shakshuka']);
  assert.ok(opts.options.find((x) => x.id === 'huevos-rancheros').current);
  const res = await a.post(`/api/courses/${id}/level-week`, { week: 1, id: 'oyakodon' });
  assert.equal(res.body.before, 'huevos-rancheros');
  let q = await card(a);
  assert.deepEqual(q.this_week.lessons.map((x) => [x.lesson_id, x.label]), [['oyakodon', 'Week 1']]);
  await a.post(`/api/courses/${id}/level-week`, { week: 1, id: res.body.before });
  q = await card(a);
  assert.equal(q.this_week.lessons[0].lesson_id, 'huevos-rancheros');
  // A week's skipped mark stays with the week when its recipe changes.
  await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: 'huevos-rancheros' });
  await a.post(`/api/courses/${id}/level-week`, { week: 1, id: 'shakshuka' });
  assert.deepEqual((await card(a)).skipped_recipes.map((x) => x.lesson_id), ['shakshuka']);
});
