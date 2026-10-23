// Chef Ruth's Getting started (plan §6.9): its parts in order, the first
// lesson she offers with no course, and the routes that keep a family's place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client } from './helpers/worker.js';
import { SETUP_STEPS, nextStep, mainProtein, starterLessons } from '../src/content/getting-started.js';
import { applyPending } from '../src/worker/migrate.js';
import { loadContent } from '../tools/lint-content.js';

test('the parts go in order, and she picks up after the last one finished', () => {
  assert.deepEqual(SETUP_STEPS, ['family', 'servings', 'diet', 'learners', 'logins', 'mode', 'course']);
  assert.equal(nextStep(null), 'family');
  assert.equal(nextStep('family'), 'servings');
  assert.equal(nextStep('logins'), 'mode');
  assert.equal(nextStep('course'), null, 'the last part leaves nothing to do');
  assert.equal(nextStep('nonsense'), 'family');
});

test('a lesson\'s main protein comes from its required ingredients', () => {
  const reg = {
    thigh: { section: 'meat-fish', animalSource: 'chicken', animalPart: 'meat', contains: ['meat'] },
    steak: { section: 'meat-fish', animalSource: 'cattle', animalPart: 'meat', contains: ['meat'] },
    tuna: { section: 'canned-jarred', animalSource: 'tuna', animalPart: 'meat', contains: ['fish'] },
    lamb: { section: 'meat-fish', animalSource: 'sheep', animalPart: 'meat', contains: ['meat'] },
    worcestershire: { section: 'sauces', animalSource: 'anchovy', animalPart: 'meat', contains: ['fish'] },
    egg: { section: 'dairy-eggs', animalSource: 'chicken', animalPart: 'egg', contains: ['egg'] },
    tomato: { section: 'produce', animalSource: null, animalPart: null, contains: [] },
  };
  const L = (...ids) => ({ ingredients: ids.map((x) => (typeof x === 'string' ? { ingredient: x } : x)) });
  assert.equal(mainProtein(L('thigh', 'tomato'), reg), 'chicken');
  assert.equal(mainProtein(L('tomato', 'steak'), reg), 'beef');
  assert.equal(mainProtein(L('tuna'), reg), 'fish');
  assert.equal(mainProtein(L('lamb'), reg), 'other');
  assert.equal(mainProtein(L('egg', 'tomato'), reg), 'vegetarian', 'eggs are vegetarian');
  assert.equal(mainProtein(L('tomato', { ingredient: 'worcestershire', optional: true }), reg), 'vegetarian', 'an optional ingredient never counts');
  assert.equal(mainProtein(L('tomato', 'worcestershire'), reg), 'other', 'a fish sauce is not a main protein, and not vegetarian');
  assert.equal(mainProtein(L('worcestershire', 'steak'), reg), 'beef');
});

test('the written lessons she would offer first, and sides are never offered', () => {
  const c = loadContent();
  const reg = Object.fromEntries(c.ingredients.map((i) => [i.id, i]));
  const meal = Object.fromEntries(c.course.dishes.map((d) => [d.id, d.meal]));
  const order = c.course.dishes.map((d) => d.id);
  const lessons = c.lessons.map(({ data }) => data).filter((L) => order.includes(L.id))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .map((L) => ({ id: L.id, protein: mainProtein(L, reg), meal: meal[L.id] }));
  const first = (kind) => starterLessons(kind, lessons).slice(0, 2).map((L) => L.id);
  assert.deepEqual(first('chicken'), ['spring-rolls', 'chicken-fajitas']);
  assert.deepEqual(first('beef'), ['chimichurri-steak', 'smash-burgers']);
  assert.deepEqual(first('fish'), ['tuna-salad-sandwiches', 'fish-tacos']);
  assert.deepEqual(first('vegetarian'), ['fattoush', 'ratatouille'], 'shoestring fries are a side (owner, 2026-10-23)');
});

test('a new family needs Getting started; its place is kept, then it\'s done', async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  let me = (await a.get('/api/me')).body;
  assert.equal(me.family.setup_needed, true);
  assert.equal(me.family.setup_step, null);

  assert.equal((await a.post('/api/setup/step', { step: 'servings' })).status, 200);
  assert.equal((await a.get('/api/me')).body.family.setup_step, 'servings');
  assert.equal((await a.post('/api/setup/step', { step: 'dessert' })).status, 400);

  assert.equal((await a.post('/api/setup/done')).status, 200);
  me = (await a.get('/api/me')).body;
  assert.equal(me.family.setup_needed, false);
  assert.equal(me.family.setup_step, 'course');
  // Running it again later doesn't move a finished family's place.
  await a.post('/api/setup/step', { step: 'diet' });
  assert.equal((await a.get('/api/me')).body.family.setup_step, 'course');
});

test('the setup routes need the parent PIN, and each family keeps its own place', async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/setup/step', { step: 'mode' });
  assert.equal((await b.get('/api/me')).body.family.setup_step, null);
  await a.post('/api/pin/lock');
  assert.equal((await a.post('/api/setup/step', { step: 'course' })).status, 403);
  assert.equal((await a.get('/api/setup/starters?kind=beef')).status, 403);
  assert.equal((await client(env).post('/api/setup/done')).status, 401);
});

test('starters follow the family\'s diet filters', async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const veg = (await a.get('/api/setup/starters?kind=vegetarian')).body.lessons;
  assert.equal(veg[0].id, 'fattoush');
  assert.equal(veg[0].label, '2a');
  assert.match(veg[0].about, /Lebanese salad/);
  assert.ok(!veg.some((L) => L.id === 'shoestring-fries'));
  // A fish-free family has no fish lesson to start with.
  const f = (await a.get('/api/family')).body.family;
  await a.put('/api/family', { ...f, diet_filters: ['fish'] });
  assert.deepEqual((await a.get('/api/setup/starters?kind=fish')).body.lessons, []);
  assert.equal((await a.get('/api/setup/starters?kind=pork')).status, 400);
});

test('a family that set its PIN before migration 0014 is already set up', async () => {
  const env = await makeEnv({ migrate: false });
  // Apply everything up to 0013, sign a family up, then apply 0014.
  const { MIGRATIONS } = await import('../src/worker/migrations/index.js');
  const later = MIGRATIONS.splice(MIGRATIONS.findIndex((m) => m.id === '0014'));
  try {
    await applyPending(env.DB);
    const a = await family(env, 'Carsons', 'jen@example.com');
    const before = (await a.get('/api/me')).body.family;
    assert.equal(before.setup_needed, false, 'without the columns, the old first run carries on');
    MIGRATIONS.push(...later);
    await applyPending(env.DB);
    assert.equal((await a.get('/api/me')).body.family.setup_needed, false);
    const b = await family(env, 'Smiths', 'pat@example.com');
    assert.equal((await b.get('/api/me')).body.family.setup_needed, true);
  } finally {
    if (!MIGRATIONS.includes(later[0])) MIGRATIONS.push(...later);
  }
});

test('Show me around visits every parent screen, starting with the Queue, and the owner\'s only for the owner', async () => {
  const { readFileSync } = await import('node:fs');
  const { tourStops } = await import('../public/ruth.js');
  const app = readFileSync('public/app.js', 'utf8');
  const pages = [...app.slice(app.indexOf('const PARENT_PAGES')).matchAll(/\{ key: '([a-z]+)', group: '[a-z]+', label: '[^']+'(, owner: true)? \}/g)];
  assert.ok(pages.length >= 10, 'found the parent pages');
  const all = tourStops(true).map((t) => t.hash.replace('#/parent/', ''));
  assert.equal(all[0], 'queue');
  assert.deepEqual([...all].sort(), pages.map((m) => m[1]).sort(), 'every parent screen, and nothing else');
  const family = tourStops(false).map((t) => t.hash.replace('#/parent/', ''));
  assert.deepEqual([...family].sort(), pages.filter((m) => !m[2]).map((m) => m[1]).sort());
  for (const t of tourStops(true)) assert.ok(t.what && t.how.length, `${t.name} says what it's for and how to use it`);
});

test('Getting started is one-time: it leaves her menu once a lesson is queued or a dish is cooked', async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  const cooking = async (c) => (await c.get('/api/me')).body.family.cooking;
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await b.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  const bea = (await b.get('/api/profiles')).body.profiles[0].id;
  assert.equal(await cooking(a), false);

  const { id: qid } = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] })).body;
  assert.equal(await cooking(a), true, 'a lesson in the queue');
  assert.equal(await cooking(b), false, 'not another family\'s');
  assert.equal((await a.del(`/api/queue/${qid}`)).status, 200);
  assert.equal(await cooking(a), false, 'a removed lesson isn\'t in the queue');

  const t = new Date().toISOString();
  await b.put('/api/attempts/00000000000000c1', { lesson_id: 'shakshuka', servings: 4, profile_ids: [bea], started_at: t });
  assert.equal(await cooking(b), false, 'a cook not finished yet');
  await b.put('/api/attempts/00000000000000c1', { lesson_id: 'shakshuka', servings: 4, profile_ids: [bea], started_at: t, finished_at: t });
  assert.equal(await cooking(b), true, 'a dish cooked');
  await b.post('/api/attempts/00000000000000c1/remove');
  assert.equal(await cooking(b), false, 'a cook a parent took back doesn\'t count');
});
