// Phase 3b: shopping trips and the pantry (plan §6.3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, opsClient } from './helpers/worker.js';
import { shopWeek, addDays } from '../src/worker/schedule.js';

const today = new Date().toISOString().slice(0, 10);

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Eli', color: 'sky' }] });
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, eli] = ['Ava', 'Eli'].map((n) => profiles.find((p) => p.name === n).id);
  const q1 = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava, eli], servings: 6 })).body.id;
  const q2 = (await a.post('/api/queue', { lesson_id: 'buttermilk-biscuits', profile_ids: [ava], servings: 12 })).body.id;
  return { env, a, b, ava, eli, q1, q2 };
}

test('a trip lists its lessons merged; check-offs are kept; ending it marks the lessons shopped, and Reopen undoes it', async () => {
  const { a, ava, q1, q2 } = await setup();
  let d = (await a.get('/api/trips')).body;
  assert.equal(d.trip, null);
  assert.deepEqual(d.candidates.map((x) => x.id).sort(), [q1, q2].sort());
  const { id } = (await a.post('/api/trips', { queue_ids: [q1, q2] })).body;
  assert.equal((await a.post('/api/trips', { queue_ids: [q1] })).status, 409, 'one open trip at a time');
  d = (await a.get('/api/trips')).body;
  assert.equal(d.trip.id, id);
  assert.equal(d.candidates.length, 0);
  const items = d.trip.list.sections.flatMap((s) => s.items);
  // A lesson queued once for two profiles is one cook: counted once.
  assert.equal(items.find((x) => x.id === 'egg').buy, '1 dozen eggs');
  assert.ok(items.find((x) => x.id === 'butter-unsalted'));

  await a.post(`/api/trips/${id}/check`, { ingredient_id: 'egg', checked: true });
  assert.deepEqual((await a.get(`/api/trips/${id}`)).body.trip.checked, ['egg']);
  await a.post(`/api/trips/${id}/check`, { ingredient_id: 'egg', checked: false });
  assert.deepEqual((await a.get(`/api/trips/${id}`)).body.trip.checked, []);

  await a.post(`/api/trips/${id}/end`);
  let q = (await a.get('/api/queue')).body.queued;
  assert.deepEqual(q.map((x) => x.status), ['shopped', 'shopped']);
  // The lesson card can say what was shopped for.
  const mine = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.equal(mine.find((x) => x.id === q2).shopped_for, 12);
  await a.post(`/api/trips/${id}/reopen`);
  q = (await a.get('/api/queue')).body.queued;
  assert.deepEqual(q.map((x) => x.status), ['assigned', 'assigned']);
});

test('lessons can be added to and taken off an open trip; a cancelled trip can be reopened', async () => {
  const { a, q1, q2 } = await setup();
  const { id } = (await a.post('/api/trips', { queue_ids: [q1] })).body;
  await a.put(`/api/trips/${id}`, { add_queue_ids: [q2], perish_days: 3 });
  let t = (await a.get(`/api/trips/${id}`)).body.trip;
  assert.equal(t.lessons.length, 2);
  assert.equal(t.perish_days, 3);
  await a.put(`/api/trips/${id}`, { remove_queue_id: q1 });
  t = (await a.get(`/api/trips/${id}`)).body.trip;
  assert.deepEqual(t.lessons.map((x) => x.id), [q2]);
  await a.post(`/api/trips/${id}/cancel`);
  assert.equal((await a.get('/api/trips')).body.trip, null);
  await a.post(`/api/trips/${id}/reopen`);
  assert.equal((await a.get('/api/trips')).body.trip.id, id);
});

test('the pantry sets staples aside on the list', async () => {
  const { a, q1 } = await setup();
  await a.put('/api/pantry', { ingredient_ids: ['olive-oil', 'salt'] });
  assert.deepEqual((await a.get('/api/pantry')).body.pantry.sort(), ['olive-oil', 'salt']);
  const { id } = (await a.post('/api/trips', { queue_ids: [q1] })).body;
  const t = (await a.get(`/api/trips/${id}`)).body.trip;
  assert.ok(t.list.have.some((x) => x.id === 'olive-oil'));
  assert.equal((await a.put('/api/pantry', { ingredient_ids: ['nope'] })).status, 400);
});

test("one family can't see or touch another's trips or pantry", async () => {
  const { a, b, q1 } = await setup();
  const { id } = (await a.post('/api/trips', { queue_ids: [q1] })).body;
  assert.equal((await b.get(`/api/trips/${id}`)).status, 404);
  assert.equal((await b.post(`/api/trips/${id}/check`, { ingredient_id: 'egg', checked: true })).status, 404);
  assert.equal((await b.post(`/api/trips/${id}/end`)).status, 404);
  assert.equal((await b.post('/api/trips', { queue_ids: [q1] })).status, 400);
  assert.equal((await b.get('/api/trips')).body.trip, null);
  await a.put('/api/pantry', { ingredient_ids: ['salt'] });
  assert.deepEqual((await b.get('/api/pantry')).body.pantry, []);
});

test('trip input is checked, and the trip needs the PIN', async () => {
  const { a, q1 } = await setup();
  assert.equal((await a.post('/api/trips', { queue_ids: [] })).status, 400);
  assert.equal((await a.post('/api/trips', { queue_ids: [q1], perish_days: 0 })).status, 400);
  const { id } = (await a.post('/api/trips', { queue_ids: [q1] })).body;
  assert.equal((await a.post(`/api/trips/${id}/check`, { ingredient_id: 'nope', checked: true })).status, 400);
  await a.post('/api/pin/lock');
  assert.equal((await a.get('/api/trips')).status, 403);
});

test("a course lesson on an open trip stays in the queue when it's skipped", async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true });
  // Starting the week being shopped for, so its first lesson is on offer.
  const c = (await a.post('/api/courses', { profile_ids: [ava], start_date: shopWeek(today), per_week: 1 })).body.id;
  const d = (await a.get('/api/trips')).body;
  const shak = d.candidates.find((x) => x.lesson_id === 'shakshuka');
  await a.post('/api/trips', { queue_ids: [shak.id] });
  await a.post(`/api/courses/${c}/skip-recipe`, { lesson_id: 'shakshuka' });
  await a.get('/api/queue');
  const row = await env.DB.prepare('SELECT status FROM queue WHERE id = ?').bind(shak.id).first();
  assert.equal(row?.status, 'assigned');
});

test('trips, their lessons, check-offs, and the pantry are in a family download', async () => {
  const { env, a, q1 } = await setup();
  const { id } = (await a.post('/api/trips', { queue_ids: [q1] })).body;
  await a.post(`/api/trips/${id}/check`, { ingredient_id: 'egg', checked: true });
  await a.put('/api/pantry', { ingredient_ids: ['salt'] });
  const ops = await opsClient(env);
  const fid = (await env.DB.prepare("SELECT id FROM families WHERE name = 'Carsons'").first()).id;
  const res = await ops.get(`/ops/family/${fid}.json`);
  const exported = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  for (const t of ['shopping_trips', 'trip_lessons', 'shopping_checks', 'pantry']) assert.ok(exported.tables[t]?.length, t);
});

test('a trip is for one week: lessons dated for another week are not offered, and cannot be added', async () => {
  const { a, ava, q1 } = await setup();
  const week = shopWeek(today);
  const later = (await a.post('/api/queue', { lesson_id: 'beef-bulgogi', profile_ids: [ava], planned_date: addDays(week, 14) })).body.id;
  const inWeek = (await a.post('/api/queue', { lesson_id: 'brown-butter-cookies', profile_ids: [ava], servings: 6, planned_date: addDays(week, 2) })).body.id;
  const d = (await a.get('/api/trips')).body;
  assert.equal(d.shop_week, week);
  const ids = d.candidates.map((x) => x.id);
  assert.ok(ids.includes(inWeek));
  assert.ok(ids.includes(q1), 'a lesson with no date can always be shopped for');
  assert.ok(!ids.includes(later));
  assert.equal((await a.post('/api/trips', { queue_ids: [later] })).status, 400);
});
