// Phase 3a: the queue, kid requests and Cook this, courses and the weekly
// schedule, safety review, and test-cooked (plan §6.1, §6.2, §6.17, §6.18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client, opsClient } from './helpers/worker.js';
import { weekOf } from '../src/worker/schedule.js';

const today = new Date().toISOString().slice(0, 10);
const sunday = weekOf(today);

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Eli', color: 'sky' }] });
  await a.post('/api/profiles', { people: [{ name: 'Mom', color: 'plum' }], audience: 'adult' });
  await b.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, eli, mom] = ['Ava', 'Eli', 'Mom'].map((n) => profiles.find((p) => p.name === n).id);
  const bea = (await b.get('/api/profiles')).body.profiles[0].id;
  return { env, a, b, ava, eli, mom, bea };
}

// Plan our weeks on, for a casual family.
// This week's lessons only: from Thursday, next week's show too.
const thisWeek = (items) => items.filter((x) => x.when !== 'next-week');
const weeksOn = (c, extra = {}) => c.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true, ...extra });
const finish = (c, id, lesson_id, profile_ids) => c.put(`/api/attempts/${id}`, {
  lesson_id, servings: 6, profile_ids, started_at: new Date(Date.now() - 3600e3).toISOString(), finished_at: new Date().toISOString(),
});

test('a kid asks, a parent approves; an adult taps Cook this and it is queued at once', async () => {
  const { a, ava, mom } = await setup();
  const ask = await a.post(`/api/profiles/${ava}/ask`, { lesson_id: 'shakshuka' });
  assert.equal(ask.body.status, 'requested');
  assert.equal((await a.post(`/api/profiles/${ava}/ask`, { lesson_id: 'shakshuka' })).body.id, ask.body.id, 'asking again is the same request');
  assert.equal((await a.post(`/api/profiles/${mom}/ask`, { lesson_id: 'beef-bulgogi' })).body.status, 'assigned');

  let q = (await a.get('/api/queue')).body;
  assert.deepEqual(q.requests.map((r) => r.lesson_id), ['shakshuka']);
  assert.deepEqual(q.queued.map((r) => r.lesson_id), ['beef-bulgogi']);

  assert.equal((await a.post(`/api/queue/${ask.body.id}/decline`)).status, 200);
  q = (await a.get('/api/queue')).body;
  assert.equal(q.requests.length, 0);
  assert.equal(q.put_back[0].id, ask.body.id, 'Not now can be put back');
  await a.post(`/api/queue/${ask.body.id}/put-back`);
  await a.post(`/api/queue/${ask.body.id}/approve`, { servings: 4 });
  q = (await a.get('/api/queue')).body;
  assert.deepEqual(q.queued.map((r) => [r.lesson_id, r.servings]), [['shakshuka', 4], ['beef-bulgogi', 6]]);
  const mine = thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items);
  assert.deepEqual(mine.map((x) => x.status), ['assigned']);
});

test('the parent queue needs the PIN; asking does not', async () => {
  const { a, ava } = await setup();
  await a.post('/api/pin/lock');
  assert.equal((await a.get('/api/queue')).status, 403);
  assert.equal((await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] })).status, 403);
  assert.equal((await a.post(`/api/profiles/${ava}/ask`, { lesson_id: 'shakshuka' })).status, 200);
});

test('a lesson queued for two profiles is one item, and their cook closes it', async () => {
  const { a, ava, eli } = await setup();
  const add = await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava, eli], servings: 6, planned_date: today });
  assert.equal(add.status, 200);
  await finish(a, '00000000000000c1', 'shakshuka', [eli]);
  assert.equal((await a.get('/api/queue')).body.queued.length, 0);
});

test('a removed lesson can be put back', async () => {
  const { a, ava } = await setup();
  const { id } = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] })).body;
  await a.del(`/api/queue/${id}`);
  assert.equal((await a.get('/api/queue')).body.queued.length, 0);
  await a.post(`/api/queue/${id}/put-back`);
  assert.equal((await a.get('/api/queue')).body.queued.length, 1);
});

test('queue input is checked', async () => {
  const { a, ava, bea } = await setup();
  const bad = [
    { lesson_id: 'nope', profile_ids: [ava] },
    { lesson_id: 'shakshuka', profile_ids: [] },
    { lesson_id: 'shakshuka', profile_ids: [bea] },
    { lesson_id: 'shakshuka', profile_ids: [ava], servings: 0 },
    { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: 'soon' },
  ];
  for (const body of bad) assert.equal((await a.post('/api/queue', body)).status, 400, JSON.stringify(body));
});

test("one family can't see or change another's queue, courses, or requests", async () => {
  const { a, b, ava, bea } = await setup();
  const { id } = (await a.post(`/api/profiles/${ava}/ask`, { lesson_id: 'shakshuka' })).body;
  assert.equal((await b.post(`/api/queue/${id}/approve`)).status, 404);
  assert.equal((await b.del(`/api/queue/${id}`)).status, 404);
  assert.equal((await b.get(`/api/profiles/${ava}/queue`)).status, 404);
  assert.equal((await b.post(`/api/profiles/${ava}/ask`, { lesson_id: 'shakshuka' })).status, 404);
  assert.equal((await b.get('/api/queue')).body.requests.length, 0);
  const c = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1 })).body.id;
  assert.equal((await b.get('/api/courses')).body.courses.length, 0);
  assert.equal((await b.put(`/api/courses/${c}`, { profile_ids: [bea], start_date: sunday, per_week: 1 })).status, 404);
  assert.equal((await b.post(`/api/courses/${c}/skip-recipe`, { lesson_id: 'shakshuka' })).status, 404);
  assert.equal((await b.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1 })).status, 400);
});

test("a course loads this week's lessons into the queue, for all its profiles", async () => {
  const { a, ava, eli } = await setup();
  await weeksOn(a);
  const { id } = (await a.post('/api/courses', { profile_ids: [ava, eli], start_date: sunday, per_week: 1 })).body;
  let q = (await a.get('/api/queue')).body;
  const c = q.courses.find((x) => x.id === id);
  // Only the 4 written lessons can be scheduled, in course order.
  assert.equal(c.total, 4);
  assert.ok(c.unwritten > 0);
  assert.deepEqual(c.this_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
  const kid = (await a.get(`/api/profiles/${eli}/queue`)).body;
  assert.deepEqual(thisWeek(kid.items).map((x) => [x.lesson_id, x.when]), [['shakshuka', 'this-week']]);
  assert.equal(kid.items[0].due, null, 'no due dates in casual mode');
  // Lesson numbers follow the course plan: shakshuka's pick-one group keeps
  // one dish, so it loses its letter.
  assert.equal(kid.labels.shakshuka, '8');

  // Cooked: the week's slot is used; the next lesson waits for next week.
  await finish(a, '00000000000000c2', 'shakshuka', [ava]);
  q = (await a.get('/api/queue')).body;
  assert.deepEqual(q.courses[0].this_week.lessons.map((x) => [x.lesson_id, x.done]), [['shakshuka', true]]);
  assert.equal(q.courses[0].done, 1);
  assert.equal(thisWeek((await a.get(`/api/profiles/${eli}/queue`)).body.items).length, 0);

  // Cook another recipe: the next one, this week only. Undo takes it away.
  await a.post(`/api/courses/${id}/week`, { extra: 1 });
  q = (await a.get('/api/queue')).body;
  assert.deepEqual(q.courses[0].this_week.lessons.map((x) => x.lesson_id), ['shakshuka', 'beef-bulgogi']);
  assert.equal(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items)[0].lesson_id, 'beef-bulgogi');
  await a.post(`/api/courses/${id}/week`, { extra: -1 });
  assert.equal(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items).length, 0, 'an extra not wanted leaves the queue');
});

test('Skip this recipe pulls in the next one, and Put back undoes it', async () => {
  const { a, ava } = await setup();
  await weeksOn(a);
  const { id } = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1 })).body;
  await a.post(`/api/courses/${id}/skip-recipe`, { lesson_id: 'shakshuka' });
  let c = (await a.get('/api/queue')).body.courses[0];
  assert.deepEqual(c.this_week.lessons.map((x) => x.lesson_id), ['beef-bulgogi']);
  assert.deepEqual(c.skipped_recipes.map((x) => x.lesson_id), ['shakshuka']);
  assert.equal(c.total, 3);
  await a.post(`/api/courses/${id}/put-back-recipe`, { lesson_id: 'shakshuka' });
  c = (await a.get('/api/queue')).body.courses[0];
  assert.deepEqual(c.this_week.lessons.map((x) => x.lesson_id), ['shakshuka']);
  assert.deepEqual(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items).map((x) => x.lesson_id), ['shakshuka']);
});

test('Skip this week empties the week and can be put back; past weeks are closed', async () => {
  const { a, ava } = await setup();
  await weeksOn(a);
  const { id } = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1 })).body;
  await a.post(`/api/courses/${id}/week`, { week: sunday, skipped: true });
  let c = (await a.get('/api/queue')).body.courses[0];
  assert.equal(c.this_week.skipped, true);
  assert.equal(c.this_week.lessons.length, 0);
  assert.equal(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items).length, 0);
  await a.post(`/api/courses/${id}/week`, { week: sunday, skipped: false });
  c = (await a.get('/api/queue')).body.courses[0];
  assert.equal(c.this_week.lessons.length, 1);
  const lastWeek = new Date(Date.parse(sunday) - 7 * 864e5).toISOString().slice(0, 10);
  assert.equal((await a.post(`/api/courses/${id}/week`, { week: lastWeek, skipped: true })).status, 400);
});

test('homeschool mode shows kids a due day; weeks stay off in casual mode until turned on', async () => {
  const { a, ava } = await setup();
  await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1 });
  assert.equal(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items).length, 0, 'Plan our weeks is off');
  await weeksOn(a, { plan_weeks: false, mode: 'homeschool' });
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body;
  const friday = new Date(Date.parse(sunday) + 5 * 864e5).toISOString().slice(0, 10);
  assert.equal(kid.items[0].due, friday);
  assert.equal(kid.mode, 'homeschool');
});

test('a profile is on one course at a time; an ended course can be put back', async () => {
  const { a, ava, eli } = await setup();
  await weeksOn(a);
  const first = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 2 })).body.id;
  assert.equal((await a.post('/api/courses', { profile_ids: [ava, eli], start_date: sunday, per_week: 1 })).status, 409);
  assert.equal(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items).length, 2);
  await a.post(`/api/courses/${first}/end`);
  assert.equal(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items).length, 0, 'an ended course leaves the queue');
  assert.equal((await a.get('/api/courses')).body.courses[0].archived_at !== null, true);
  await a.post(`/api/courses/${first}/put-back`);
  assert.equal(thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items).length, 2);
});

test('a course plan can be reordered, and dishes taken out', async () => {
  const { a, ava } = await setup();
  await weeksOn(a);
  const { courses, default_plan } = (await a.get('/api/courses')).body;
  assert.equal(courses.length, 0);
  // Bulgogi first, cookies out.
  const plan = [default_plan.find((x) => x.id === 'beef-bulgogi'), ...default_plan.filter((x) => x.id !== 'beef-bulgogi')]
    .map((x) => (x.id === 'brown-butter-cookies' ? { ...x, removed: true } : x));
  const { id } = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 4, plan })).body;
  const c = (await a.get('/api/queue')).body.courses[0];
  assert.deepEqual(c.this_week.lessons.map((x) => x.lesson_id), ['beef-bulgogi', 'shakshuka', 'buttermilk-biscuits']);
  const saved = (await a.get('/api/courses')).body.courses[0];
  assert.equal(saved.id, id);
  assert.equal(saved.plan[0].id, 'beef-bulgogi');
  assert.equal((await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 9 })).status, 400);
  assert.equal((await a.put(`/api/courses/${id}`, { profile_ids: [ava], start_date: sunday, per_week: 1, plan: [{ id: 'nope' }] })).status, 400);
});

test('safety review lists the steps an adult is needed for; test-cooked can be marked and undone', async () => {
  const { a } = await setup();
  const s = (await a.get('/api/lessons/shakshuka/safety')).body;
  assert.ok(s.steps.length > 0);
  assert.ok(s.steps.every((x) => x.safety !== 'solo'));
  await a.post('/api/test-cooks', { lesson_id: 'shakshuka' });
  assert.equal((await a.get('/api/queue')).body.test_cooks.shakshuka.by_me, true);
  await a.del('/api/test-cooks/shakshuka');
  assert.deepEqual((await a.get('/api/queue')).body.test_cooks, {});
});

test("the queue and courses are in a family's download; a deleted profile leaves its queued lessons", async () => {
  const { env, a, ava, eli } = await setup();
  await weeksOn(a);
  await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] });
  await a.post('/api/queue', { lesson_id: 'beef-bulgogi', profile_ids: [ava, eli] });
  await a.post('/api/courses', { profile_ids: [eli], start_date: sunday, per_week: 1 });
  await a.get('/api/queue');
  const ops = await opsClient(env);
  const fid = (await env.DB.prepare("SELECT id FROM families WHERE name = 'Carsons'").first()).id;
  const backup = await ops.get(`/ops/family/${fid}.json`);
  assert.equal(backup.status, 200);
  const exported = typeof backup.body === 'string' ? JSON.parse(backup.body) : backup.body;
  for (const t of ['queue', 'queue_profiles', 'courses', 'course_profiles', 'course_lessons']) assert.ok(exported.tables[t]?.length, t);

  await a.del(`/api/profiles/${ava}`);
  const q = (await a.get('/api/queue')).body;
  assert.deepEqual(q.queued.map((x) => [x.lesson_id, x.profile_ids]), [['beef-bulgogi', [eli]]]);
});

test('a request for a lesson the course already loaded shows once to the kid, and the parent is told', async () => {
  const { a, ava } = await setup();
  await weeksOn(a);
  await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1 });
  await a.post(`/api/profiles/${ava}/ask`, { lesson_id: 'shakshuka' });
  const kid = thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items);
  assert.deepEqual(kid.map((x) => [x.lesson_id, x.status]), [['shakshuka', 'assigned']]);
  assert.equal((await a.get('/api/queue')).body.requests[0].already_queued, true);
});

test('a pick-one group can keep more than one dish; one is kept by default', async () => {
  const { a, ava } = await setup();
  await weeksOn(a);
  const { default_plan } = (await a.get('/api/courses')).body;
  const group = default_plan.filter((x) => ['shakshuka', 'spaghetti-marinara', 'honey-garlic-chicken'].includes(x.id));
  assert.deepEqual(group.map((x) => x.removed), [false, true, true]);
  const plan = default_plan.map((x) => (x.id === 'spaghetti-marinara' ? { ...x, removed: false } : x));
  await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1, plan });
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body;
  assert.equal(kid.labels.shakshuka, '8a');
  assert.equal(kid.labels['spaghetti-marinara'], '8b');
  assert.equal((await a.get('/api/courses')).body.courses[0].plan.find((x) => x.id === 'spaghetti-marinara').removed, false);
});

test('an extra lesson has no due day for kids, even in homeschool mode', async () => {
  const { a, ava } = await setup();
  await weeksOn(a, { plan_weeks: false, mode: 'homeschool' });
  const { id } = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1 })).body;
  await a.post(`/api/courses/${id}/week`, { extra: 1 });
  const items = thisWeek((await a.get(`/api/profiles/${ava}/queue`)).body.items);
  assert.deepEqual(items.map((x) => [x.lesson_id, Boolean(x.due)]), [['shakshuka', true], ['beef-bulgogi', false]]);
  assert.equal((await a.get('/api/queue')).body.courses[0].this_week.lessons[1].extra, true);
});
