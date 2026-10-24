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
const level = (a, pids, start = sunday, extra = {}) => a.post('/api/courses', { program: 'level-3', start_date: start, per_week: 3, profile_ids: pids, ...extra });
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
  assert.deepEqual(q.level, { id: 'level-3', name: 'Level 3 Cook', weeks: 36, week: 1 });
  assert.deepEqual(q.this_week.lessons.map((x) => [x.lesson_id, x.label]), [['shakshuka', 'Week 1']]);
  // Thick burgers (week 2) isn't written, so week 3's recipe is next, like a planned dish (§6.18).
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
