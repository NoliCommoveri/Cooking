// Shopping, optional (plan §6.3): what the upcoming lessons need, week by
// week, and shopping lists for the next few uncooked lessons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, opsClient, samplePlan } from './helpers/worker.js';
import { weekOf, addDays } from '../src/worker/schedule.js';

const today = new Date().toISOString().slice(0, 10);
const sunday = weekOf(today);

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Eli', color: 'sky' }] });
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, eli] = ['Ava', 'Eli'].map((n) => profiles.find((p) => p.name === n).id);
  return { env, a, b, ava, eli };
}
const items = (x) => [...x.sections.flatMap((s) => s.items), ...(x.may_have ?? [])];

test("what you'll need: undated lessons first, then week by week, with a course's weeks ahead", async () => {
  const { a, ava, eli } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true });
  await a.post('/api/courses', { profile_ids: [ava, eli], start_date: sunday, per_week: 1, plan: await samplePlan(a) });
  await a.post('/api/queue', { lesson_id: 'brown-butter-cookies', profile_ids: [ava], servings: 6 });
  const d = (await a.get('/api/shopping')).body;
  // The cookies are queued by hand, so the course doesn't list them again.
  assert.deepEqual(d.weeks.map((w) => w.week), [null, sunday, addDays(sunday, 7), addDays(sunday, 14)]);
  assert.deepEqual(d.upcoming.map((x) => x.lesson_id), ['brown-butter-cookies', 'shakshuka', 'beef-bulgogi', 'buttermilk-biscuits']);
  // A lesson for two siblings is one cook.
  assert.deepEqual(d.weeks[1].lessons[0].profile_ids.sort(), [ava, eli].sort());
  assert.ok(items(d.weeks[1].needs).some((x) => x.id === 'egg'));
});

test('a shopping list: preview the next lessons, leave off what is on hand, check off the rest', async () => {
  const { a, ava } = await setup();
  await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], servings: 6 });
  await a.post('/api/queue', { lesson_id: 'buttermilk-biscuits', profile_ids: [ava], servings: 12 });
  await a.put('/api/pantry', { ingredient_ids: ['olive-oil'] });
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  assert.deepEqual(p.lessons.map((x) => x.lesson_id), ['shakshuka']);
  assert.deepEqual(p.may_have.map((x) => x.id), ['olive-oil']);
  assert.equal((await a.post('/api/shopping/preview', { count: 3 })).status, 400);

  const both = (await a.post('/api/shopping/preview', { count: 2 })).body;
  const { id } = (await a.post('/api/shopping/lists', { keys: both.lessons.map((x) => x.key), on_hand: ['egg'] })).body;
  let l = (await a.get(`/api/shopping/lists/${id}`)).body.list;
  assert.deepEqual(l.lessons.map((x) => x.lesson_id), ['shakshuka', 'buttermilk-biscuits']);
  assert.equal(items(l).some((x) => x.id === 'egg'), false);
  assert.deepEqual(l.on_hand.map((x) => x.id), ['egg']);
  assert.ok(l.may_have.some((x) => x.id === 'olive-oil'), 'staples still need shopping for');

  await a.post(`/api/shopping/lists/${id}/on-hand`, { ingredient_id: 'egg', on_hand: false });
  await a.post(`/api/shopping/lists/${id}/check`, { ingredient_id: 'egg', checked: true });
  l = (await a.get(`/api/shopping/lists/${id}`)).body.list;
  assert.ok(items(l).some((x) => x.id === 'egg'));
  assert.deepEqual(l.checked, ['egg']);

  // Making another list starts from the next uncooked lesson again.
  assert.equal((await a.post('/api/shopping/preview', { count: 1 })).body.lessons[0].lesson_id, 'shakshuka');
  // The lesson card can say what was shopped for.
  const mine = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.equal(mine.find((x) => x.lesson_id === 'buttermilk-biscuits').shopped_for, 12);
});

test('a list made before a course lesson was queued still says what it was shopped for', async () => {
  const { a, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: [], plan_weeks: true });
  const c = (await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1, plan: await samplePlan(a) })).body.id;
  // Shop for the third lesson, two weeks out: not queued until its week comes.
  const p = (await a.post('/api/shopping/preview', { count: 3 })).body;
  const later = p.lessons[2];
  assert.equal(later.queue_id, null);
  await a.post('/api/shopping/lists', { keys: p.lessons.map((x) => x.key) });
  // It comes early: Cook another recipe, twice, queues it this week.
  await a.post(`/api/courses/${c}/week`, { extra: 1 });
  await a.post(`/api/courses/${c}/week`, { extra: 1 });
  const mine = (await a.get(`/api/profiles/${ava}/queue`)).body.items;
  assert.equal(mine.find((x) => x.lesson_id === later.lesson_id).shopped_for, later.servings);
});

test('nothing waits on shopping: a lesson never shopped for can be cooked', async () => {
  const { a, ava } = await setup();
  const { id } = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] })).body;
  const done = await a.put('/api/attempts/00000000000000d1', {
    lesson_id: 'shakshuka', servings: 6, profile_ids: [ava], started_at: new Date(Date.now() - 3600e3).toISOString(), finished_at: new Date().toISOString(),
  });
  assert.equal(done.status, 200);
  assert.equal((await a.get('/api/queue')).body.queued.some((x) => x.id === id), false, 'cooked, so off the queue');
});

test('Done shopping and Delete each have an undo', async () => {
  const { a, ava } = await setup();
  await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] });
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  const { id } = (await a.post('/api/shopping/lists', { keys: [p.lessons[0].key] })).body;
  await a.post(`/api/shopping/lists/${id}/done`);
  assert.ok((await a.get('/api/shopping')).body.lists[0].done_at);
  await a.post(`/api/shopping/lists/${id}/not-done`);
  assert.equal((await a.get('/api/shopping')).body.lists[0].done_at, null);
  await a.post(`/api/shopping/lists/${id}/delete`);
  assert.equal((await a.get('/api/shopping')).body.lists.length, 0);
  assert.equal((await a.get(`/api/shopping/lists/${id}`)).status, 404);
  await a.post(`/api/shopping/lists/${id}/restore`);
  assert.equal((await a.get('/api/shopping')).body.lists.length, 1);
});

test("one family can't see or touch another's lists or staples; input is checked; the PIN is needed", async () => {
  const { a, b, ava } = await setup();
  await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] });
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  const { id } = (await a.post('/api/shopping/lists', { keys: [p.lessons[0].key] })).body;
  assert.equal((await b.get(`/api/shopping/lists/${id}`)).status, 404);
  assert.equal((await b.post(`/api/shopping/lists/${id}/check`, { ingredient_id: 'egg', checked: true })).status, 404);
  assert.equal((await b.post(`/api/shopping/lists/${id}/delete`)).status, 404);
  assert.equal((await b.post('/api/shopping/lists', { keys: [p.lessons[0].key] })).status, 409);
  assert.equal((await b.get('/api/shopping')).body.lists.length, 0);
  await a.put('/api/pantry', { ingredient_ids: ['salt'] });
  assert.deepEqual((await b.get('/api/pantry')).body.pantry, []);
  assert.equal((await a.post(`/api/shopping/lists/${id}/check`, { ingredient_id: 'nope', checked: true })).status, 400);
  assert.equal((await a.put('/api/pantry', { ingredient_ids: ['nope'] })).status, 400);
  await a.post('/api/pin/lock');
  assert.equal((await a.get('/api/shopping')).status, 403);
});

test('lists, their lessons, on-hand marks, check-offs, and staples are in a family download', async () => {
  const { env, a, ava } = await setup();
  await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] });
  await a.put('/api/pantry', { ingredient_ids: ['salt'] });
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  const { id } = (await a.post('/api/shopping/lists', { keys: [p.lessons[0].key], on_hand: ['egg'] })).body;
  await a.post(`/api/shopping/lists/${id}/check`, { ingredient_id: 'garlic', checked: true });
  const ops = await opsClient(env);
  const fid = (await env.DB.prepare("SELECT id FROM families WHERE name = 'Carsons'").first()).id;
  const res = await ops.get(`/ops/family/${fid}.json`);
  const exported = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
  for (const t of ['shopping_lists', 'list_lessons', 'list_on_hand', 'list_checks', 'pantry']) assert.ok(exported.tables[t]?.length, t);
});
