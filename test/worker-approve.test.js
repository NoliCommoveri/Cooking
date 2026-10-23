// A kid cooking off their path (owner, 2026-10-23): a parent approves it with
// the PIN, as an extra assigned meal or one replacing an assigned meal, and
// neither pushes the course's assigned lessons back. Also: a kid's list
// follows the course plan's order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, samplePlan } from './helpers/worker.js';
import { weekOf } from '../src/worker/schedule.js';

async function setup(per_week = 1) {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true });
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  const sunday = weekOf(new Date().toISOString().slice(0, 10));
  const plan = await samplePlan(a);
  const { id: cid } = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week, plan })).body;
  const course = async () => (await a.get('/api/queue')).body.courses.find((x) => x.id === cid);
  return { env, a, ava, cid, plan, sunday, course };
}

// A finished cook this week, never on the Sabbath (nothing then counts).
const thisWeekDay = () => {
  const d = new Date();
  if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString();
};
let n = 0;
const cook = (a, lesson_id, ids) => {
  const t = thisWeekDay();
  return a.put(`/api/attempts/${(++n).toString(16).padStart(16, 'a')}`, { lesson_id, servings: 6, profile_ids: ids, started_at: t, finished_at: t });
};

test('approving needs the PIN', async () => {
  const { a, ava } = await setup();
  await a.post('/api/pin/lock');
  assert.equal((await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies' })).status, 403);
});

test('an extra assigned meal, cooked early, doesn\'t push this week\'s lesson back', async () => {
  const { a, ava, course } = await setup();
  const before = await course();
  assert.deepEqual(before.this_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
  const ok = (await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies' })).body;
  assert.equal(ok.status, 'assigned');
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body.items.map((x) => x.lesson_id);
  assert.deepEqual(kid, ['shakshuka', 'brown-butter-cookies'], 'the assigned lesson stays first');
  assert.equal((await cook(a, 'brown-butter-cookies', [ava])).status, 200);
  const after = await course();
  assert.deepEqual(after.this_week.lessons.map((x) => [x.lesson_id, x.done]), [['shakshuka', false]], 'shakshuka is still this week');
  assert.equal(after.done, 1, 'the cookies count as done');
  assert.equal(after.weeks_behind, 0);
});

test('a meal that replaces an assigned one takes its place; the replaced lesson goes first next week; Undo', async () => {
  const { a, ava, course } = await setup();
  const before = await course();
  const [first] = before.this_week.lessons;
  const ok = (await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies', replace: first.queue_id })).body;
  const after = await course();
  assert.deepEqual(after.this_week.lessons, []);
  assert.equal(after.next_week.lessons[0].lesson_id, 'shakshuka');
  assert.equal(after.weeks_behind, 0);
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.deepEqual(kid.map((x) => [x.lesson_id, x.when]), [['brown-butter-cookies', 'this-week']]);
  await a.post(`/api/queue/${ok.id}/unswap`);
  assert.equal((await course()).this_week.lessons[0].lesson_id, 'shakshuka');
});

test('a kid\'s request approved from the queue can replace an assigned meal', async () => {
  const { a, ava, course } = await setup();
  const [first] = (await course()).this_week.lessons;
  const rq = (await a.post(`/api/profiles/${ava}/ask`, { lesson_id: 'brown-butter-cookies' })).body;
  assert.equal(rq.status, 'requested');
  assert.equal((await a.post(`/api/queue/${rq.id}/approve`, { replace: first.queue_id })).status, 200);
  assert.deepEqual((await course()).this_week.lessons, []);
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.deepEqual(kid.map((x) => [x.lesson_id, x.status]), [['brown-butter-cookies', 'assigned']]);
  // Approving on the spot finds the one already on the list.
  assert.equal((await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies' })).body.id, rq.id);
});

test('a meal on someone else\'s list can\'t be replaced', async () => {
  const { a, ava } = await setup();
  await a.post('/api/profiles', { people: [{ name: 'Eli', color: 'sky' }] });
  const eli = (await a.get('/api/profiles')).body.profiles.find((p) => p.name === 'Eli').id;
  const theirs = (await a.post('/api/queue', { lesson_id: 'beef-bulgogi', profile_ids: [eli] })).body.id;
  assert.equal((await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies', replace: theirs })).status, 400);
});

test('a kid\'s list follows the course plan\'s order after it\'s changed', async () => {
  const { a, ava, cid, plan, sunday } = await setup(2);
  let kid = (await a.get(`/api/profiles/${ava}/queue`)).body;
  assert.deepEqual(kid.items.map((x) => x.lesson_id), ['shakshuka', 'beef-bulgogi']);
  const bul = plan.find((x) => x.id === 'beef-bulgogi');
  const moved = [bul, ...plan.filter((x) => x !== bul)];
  assert.equal((await a.put(`/api/courses/${cid}`, { profile_ids: [ava], start_date: sunday, per_week: 2, plan: moved })).status, 200);
  kid = (await a.get(`/api/profiles/${ava}/queue`)).body;
  assert.deepEqual(kid.items.map((x) => x.lesson_id), ['beef-bulgogi', 'shakshuka']);
  assert.deepEqual(kid.order.slice(0, 2), ['beef-bulgogi', 'shakshuka']);
});

// A dish on the kid's path, later on (owner, 2026-10-23): approved now, it
// isn't listed twice.
test('a course lesson approved early as an extra isn\'t also in a later week', async () => {
  const { a, ava, course } = await setup();
  assert.deepEqual((await course()).next_week.lessons.map((x) => x.lesson_id), ['beef-bulgogi']);
  const ok = (await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'beef-bulgogi' })).body;
  assert.equal(ok.status, 'assigned');
  const after = await course();
  assert.deepEqual(after.this_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
  assert.deepEqual(after.next_week.lessons.map((x) => x.lesson_id), ['buttermilk-biscuits'], 'the rest move up');
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.deepEqual(kid.map((x) => x.lesson_id), ['shakshuka', 'beef-bulgogi']);
  assert.equal(kid[1].planned_date, new Date().toISOString().slice(0, 10), 'planned for today');
  // Taken off the list, it goes back to its place in the course.
  await a.del(`/api/queue/${ok.id}`);
  assert.deepEqual((await course()).next_week.lessons.map((x) => x.lesson_id), ['beef-bulgogi']);
});

test('a course lesson approved early, replacing this week\'s: the replaced one goes first next week', async () => {
  const { a, ava, course } = await setup();
  const [first] = (await course()).this_week.lessons;
  const ok = (await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'beef-bulgogi', replace: first.queue_id })).body;
  const after = await course();
  assert.deepEqual(after.this_week.lessons, []);
  assert.deepEqual(after.next_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.deepEqual(kid.map((x) => x.lesson_id), ['beef-bulgogi'], 'once');
  await a.post(`/api/queue/${ok.id}/unswap`);
  const undone = await course();
  assert.deepEqual(undone.this_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
  assert.deepEqual(undone.next_week.lessons.map((x) => x.lesson_id), ['beef-bulgogi']);
});

test('with two a week, replacing the first keeps the second this week', async () => {
  const { a, ava, course } = await setup(2);
  const before = await course();
  assert.deepEqual(before.this_week.lessons.map((x) => x.lesson_id), ['shakshuka', 'beef-bulgogi']);
  await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies', replace: before.this_week.lessons[0].queue_id });
  const after = await course();
  assert.deepEqual(after.this_week.lessons.map((x) => x.lesson_id), ['beef-bulgogi']);
  assert.deepEqual(after.next_week.lessons.map((x) => x.lesson_id), ['shakshuka', 'buttermilk-biscuits']);
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body.items.map((x) => x.lesson_id);
  assert.deepEqual(kid, ['beef-bulgogi', 'brown-butter-cookies']);
});
