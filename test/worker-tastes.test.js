// Phase 11b: tastes (plan §6.21): star ratings per profile, one favorite per
// list, and the family's limits, for every family.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';

async function setup({ preview = true } = {}) {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Ben', color: 'sky' }] });
  const fid = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  if (preview) await setPreview(env.DB, fid, true);
  const profiles = (await a.get('/api/profiles')).body.profiles;
  return { env, a, fid, ava: profiles[0].id, ben: profiles[1]?.id };
}

test('a family without the preview has Our tastes: it is part of Cook Around the World', async () => {
  const { a, ava } = await setup({ preview: false });
  assert.equal((await a.get('/api/tastes')).status, 200);
  assert.equal((await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'beef', stars: 4 })).status, 200);
});

test('the lists, with example dishes and Meals heavy on vegetables', async () => {
  const { a } = await setup();
  const t = (await a.get('/api/tastes')).body;
  assert.ok(t.lists.protein.some((p) => p.id === 'beef'));
  const flavors = t.lists.flavor;
  assert.ok(flavors.find((f) => f.id === 'warm-spices').examples.includes('chana masala'));
  assert.equal(flavors.at(-1).id, 'veggie-heavy');
  assert.ok(t.lists.ingredient.some((i) => i.id === 'mushrooms'));
  assert.deepEqual(t.stars.map(([n]) => n), [5, 4, 3, 2, 1]);
  assert.ok(t.choices.tools.every((x) => x.name));
});

test('star ratings per profile, Haven\'t tried, and clearing one', async () => {
  const { a, ava, ben } = await setup();
  assert.equal((await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'beef', stars: 4 })).body.ratings.protein.beef, 4);
  assert.equal((await a.put(`/api/profiles/${ava}/ratings`, { kind: 'ingredient', item: 'mushrooms', stars: null })).body.ratings.ingredient.mushrooms, null);
  await a.put(`/api/profiles/${ben}/ratings`, { kind: 'protein', item: 'beef', stars: 1 });
  const t = (await a.get('/api/tastes')).body;
  assert.equal(t.ratings[ava].protein.beef, 4);
  assert.equal(t.ratings[ben].protein.beef, 1, 'each profile has its own');
  assert.ok('mushrooms' in t.ratings[ava].ingredient, 'Haven\'t tried is kept');
  const cleared = (await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'beef', clear: true })).body.ratings;
  assert.ok(!('beef' in cleared.protein));
  assert.equal((await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'pork', stars: 5 })).status, 400, 'only items on the lists');
  assert.equal((await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'beef', stars: 6 })).status, 400);
  assert.equal((await a.put(`/api/profiles/${ava}/ratings`, { kind: 'flavor', item: 'veggie-heavy', stars: 5 })).status, 200);
});

test('one absolute favorite per list; moving it asks first', async () => {
  const { a, ava } = await setup();
  await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'chicken', stars: 5 });
  const taken = await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'beef', stars: 5 });
  assert.equal(taken.status, 409);
  assert.match(taken.body.message, /Chicken is already the absolute favorite/);
  assert.equal((await a.put(`/api/profiles/${ava}/ratings`, { kind: 'flavor', item: 'tangy', stars: 5 })).status, 200, 'another list has its own');
  const moved = (await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'beef', stars: 5, replace: true })).body.ratings;
  assert.equal(moved.protein.beef, 5);
  assert.equal(moved.protein.chicken, 4, 'the old favorite moves to love');
});

test('the family\'s limits', async () => {
  const { a } = await setup();
  const res = (await a.put('/api/tastes/limits', { max_minutes: 45, budget: '$$', missing_tools: ['immersion-blender', 'spaceship'], adventurous: 'a-bit' })).body.limits;
  assert.deepEqual(res, { max_minutes: 45, budget: '$$', missing_tools: ['immersion-blender'], adventurous: 'a-bit' });
  assert.equal((await a.put('/api/tastes/limits', { max_minutes: 20 })).status, 400);
  assert.deepEqual((await a.put('/api/tastes/limits', {})).body.limits, { max_minutes: null, budget: null, missing_tools: [], adventurous: null }, 'no limits');
});

test('a deleted profile\'s ratings go with it, and a family\'s download has them', async () => {
  const { env, a, ava, fid } = await setup();
  await a.put(`/api/profiles/${ava}/ratings`, { kind: 'protein', item: 'beef', stars: 4 });
  const dl = (await a.get('/api/family/export')).body;
  assert.equal(dl.tables.profile_ratings.length, 1, 'in Download our data');
  await a.del(`/api/profiles/${ava}`);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM profile_ratings WHERE family_id = ?').bind(fid).first()).n, 0);
});
