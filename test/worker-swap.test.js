// Phase 4c: Swap for an Appointed Time meal instead (plan §6.19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, samplePlan } from './helpers/worker.js';
import { weekOf } from '../src/worker/schedule.js';
import { LIBRARY } from '../src/worker/library-data.js';

const base = { servings: 4, totalMinutes: 30, method: 'stove', why: null, equipment: ['skillet-12'], steps: [{ text: 'Cook it in the pan.', safety: 'adult-nearby', hazard: 'Hot pan' }] };
const FLAT = { ...base, mealType: 'bread', title: 'Quick flatbread', ingredients: [{ ingredient: 'flour-ap', amount: 2, unit: 'cup' }] };
const SODA = { ...base, mealType: 'bread', title: 'Soda bread', ingredients: [{ ingredient: 'flour-ap', amount: 2, unit: 'cup' }, { ingredient: 'baking-soda', amount: 1, unit: 'tsp' }] };
const LAMB = { ...base, mealType: 'meat', title: 'Feast lamb pita', ingredients: [{ ingredient: 'pita', amount: 4, unit: 'count' }] };

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  return { env, a, b, ava };
}
const groupsOf = (opts) => [...new Set(opts.map((o) => o.group))];

test('in spring the picker offers only Unleavened recipes, in order; the rest of the year, the unit and every feast recipe', async () => {
  const { a, b, ava } = await setup();
  const own = (await a.post('/api/recipes', FLAT)).body.id;
  const soda = (await b.post('/api/recipes', SODA)).body.id;
  await b.post(`/api/recipes/${soda.slice(7)}/share`, { kind: 'feast', without_badge: true });
  const lamb = (await b.post('/api/recipes', LAMB)).body.id;
  await b.post(`/api/recipes/${lamb.slice(7)}/share`, { kind: 'general' });

  const spring = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: '2027-04-21' })).body.id;
  const opts = (await a.get(`/api/queue/${spring}/swap`)).body;
  assert.equal(opts.spring, true);
  assert.deepEqual(groupsOf(opts.options), ['Appointed Times lessons', 'Other lessons', 'Our recipes']);
  assert.deepEqual(opts.options.slice(0, 2).map((o) => o.label), ['U1', 'U2']);
  assert.ok(opts.options.every((o) => o.unleavened));
  assert.ok(!opts.options.some((o) => o.id === 'buttermilk-biscuits'), 'leavened lessons are left out');
  assert.ok(opts.options.some((o) => o.id === own));

  const summer = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: '2027-06-16' })).body.id;
  const year = (await a.get(`/api/queue/${summer}/swap`)).body;
  assert.equal(year.spring, false);
  assert.deepEqual(groupsOf(year.options), ['Appointed Times lessons', 'User-shared recipes']);
  assert.deepEqual(year.options.filter((o) => o.group === 'User-shared recipes').map((o) => o.title), ['Soda bread'], 'feast recipes, unleavened or not; not a general one');
});

test('a course lesson marked Good for Feast Days is offered all year with the badge; in spring only if unleavened', async () => {
  const { a, ava } = await setup();
  const fattoush = LIBRARY.lessons.find((L) => L.id === 'fattoush');
  assert.equal(fattoush.feast, false);
  assert.ok(LIBRARY.lessons.filter((L) => LIBRARY.seasonal.includes(L.unit)).every((L) => L.feast), 'Appointed Times lessons always have it');
  fattoush.feast = true;
  try {
    const summer = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: '2027-06-16' })).body.id;
    const year = (await a.get(`/api/queue/${summer}/swap`)).body;
    assert.deepEqual(groupsOf(year.options), ['Appointed Times lessons', 'Other lessons']);
    assert.deepEqual(year.options.filter((o) => o.group === 'Other lessons').map((o) => [o.id, o.feast, o.unleavened]), [['fattoush', true, false]]);
    const spring = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: '2027-04-21' })).body.id;
    assert.ok(!(await a.get(`/api/queue/${spring}/swap`)).body.options.some((o) => o.id === 'fattoush'), 'pita is leaven');
    const kitchen = (await a.get('/api/library')).body;
    assert.equal(kitchen.lessons.find((L) => L.id === 'fattoush')?.feast, true, 'the kitchen card gets the badge');
    assert.equal((await a.post(`/api/queue/${summer}/swap`, { lesson_id: 'fattoush' })).status, 200);
  } finally {
    fattoush.feast = false;
  }
});

test('a lesson queued by hand comes off the queue; Undo puts it back', async () => {
  const { a, ava } = await setup();
  const qid = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: '2027-04-21' })).body.id;
  const res = (await a.post(`/api/queue/${qid}/swap`, { lesson_id: 'unleavened-flatbread' })).body;
  let q = (await a.get('/api/queue')).body;
  assert.deepEqual(q.queued.map((x) => [x.lesson_id, x.swap, x.profile_ids.length]), [['unleavened-flatbread', true, 1]]);
  assert.ok(!q.put_back.some((x) => x.id === qid), 'Undo puts it back, not Put back');
  assert.equal((await a.post(`/api/queue/${res.id}/swap`, { lesson_id: 'cottage-cheese-crescents' })).status, 409, 'a swap is undone, not swapped again');
  assert.equal((await a.post(`/api/queue/${qid}/swap`, { lesson_id: 'unleavened-flatbread' })).status, 409, 'the original is off the queue');
  await a.post(`/api/queue/${res.id}/unswap`);
  q = (await a.get('/api/queue')).body;
  assert.deepEqual(q.queued.map((x) => x.lesson_id), ['shakshuka']);
  assert.equal((await a.post(`/api/queue/${qid}/swap`, { lesson_id: 'buttermilk-biscuits' })).status, 400, 'only what the picker offers');
});

test('picking a User-shared recipe adds it to the family\'s recipes', async () => {
  const { a, b, ava } = await setup();
  const soda = (await b.post('/api/recipes', SODA)).body.id;
  await b.post(`/api/recipes/${soda.slice(7)}/share`, { kind: 'feast', without_badge: true });
  const qid = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: '2027-06-16' })).body.id;
  const pick = (await a.get(`/api/queue/${qid}/swap`)).body.options.find((o) => o.group === 'User-shared recipes');
  await a.post(`/api/queue/${qid}/swap`, { lesson_id: pick.id });
  const mine = (await a.get('/api/recipes')).body.recipes;
  assert.deepEqual(mine.map((r) => r.title), ['Soda bread']);
  assert.equal((await a.get('/api/queue')).body.queued[0].lesson_id, mine[0].id);
});

test('a course lesson swapped this week goes first next week, and the course is never behind for it', async () => {
  const { a, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true });
  const sunday = weekOf(new Date().toISOString().slice(0, 10));
  const { id: cid } = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1, plan: await samplePlan(a) })).body;
  let q = (await a.get('/api/queue')).body;
  const c = q.courses.find((x) => x.id === cid);
  const [first] = c.this_week.lessons;
  const planned = c.planned_finish;
  const swap = (await a.post(`/api/queue/${first.queue_id}/swap`, { lesson_id: 'unleavened-flatbread' })).body;
  q = (await a.get('/api/queue')).body;
  const after = q.courses.find((x) => x.id === cid);
  assert.deepEqual(after.this_week.lessons, [], 'nothing else is pulled in');
  assert.equal(after.next_week.lessons[0].lesson_id, first.lesson_id, 'it goes first next week');
  assert.equal(after.weeks_behind, 0);
  assert.ok(after.planned_finish > planned, 'the planned finish moves back');
  assert.deepEqual(q.queued.map((x) => [x.lesson_id, x.swap]), [['unleavened-flatbread', true]]);
  const kid = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.deepEqual(kid.map((x) => [x.lesson_id, x.when]), [['unleavened-flatbread', 'this-week']]);
  await a.post(`/api/queue/${swap.id}/unswap`);
  q = (await a.get('/api/queue')).body;
  assert.equal(q.courses.find((x) => x.id === cid).this_week.lessons[0].lesson_id, first.lesson_id);
  assert.equal(q.courses.find((x) => x.id === cid).planned_finish, planned);
  assert.equal(q.queued.length, 0);
});

test('diet settings apply to the picker, and another family can\'t swap', async () => {
  const { a, b, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: ['dairy'] });
  const qid = (await a.post('/api/queue', { lesson_id: 'spring-rolls', profile_ids: [ava], planned_date: '2027-04-21' })).body.id;
  const opts = (await a.get(`/api/queue/${qid}/swap`)).body.options;
  assert.ok(!opts.some((o) => o.id === 'cottage-cheese-crescents'), 'dairy');
  assert.equal((await b.get(`/api/queue/${qid}/swap`)).status, 404);
  assert.equal((await b.post(`/api/queue/${qid}/swap`, { lesson_id: 'unleavened-flatbread' })).status, 404);
});
