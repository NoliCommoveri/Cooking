// Phase 4c: sharing family recipes (plan §6.10, §6.19): the routine, the
// owner's reviews, the directory with no family named, Report, Hide and Unhide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, outbox } from './helpers/worker.js';

const base = {
  servings: 4, totalMinutes: 30, mealType: 'bread', method: 'stove', why: null, equipment: ['skillet-12'],
  steps: [{ text: 'Cook it in the pan.', safety: 'adult-nearby', hazard: 'Hot pan' }],
};
const FLAT = { ...base, title: 'Quick flatbread', ingredients: [{ ingredient: 'flour-ap', amount: 2, unit: 'cup' }, { ingredient: 'water', amount: 0.5, unit: 'cup' }] };
const YEAST = { ...base, title: 'Yeasted rolls', ingredients: [{ ingredient: 'flour-ap', amount: 2, unit: 'cup' }, { name: 'Active dry yeast', amount: 1, unit: 'tsp' }] };
const SODA = { ...base, title: 'Soda bread', ingredients: [{ ingredient: 'flour-ap', amount: 2, unit: 'cup' }, { ingredient: 'baking-soda', amount: 1, unit: 'tsp' }] };
const CRAB = { ...base, title: 'Crab apple jelly', ingredients: [{ ingredient: 'sugar', amount: 1, unit: 'cup' }] };

async function setup() {
  const env = await makeEnv();
  const owner = await family(env, 'Owners', 'owner@example.com');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'owner@example.com'").run();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  return { env, owner, a, b };
}
const hexOf = (id) => id.slice(7);

test('a recipe from the registry is shared at once, with its badges; the directory names no family', async () => {
  const { a, b } = await setup();
  const { id } = (await a.post('/api/recipes', FLAT)).body;
  const res = (await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'feast' })).body;
  assert.deepEqual(res, { status: 'shared', unleavened: true });
  const dir = (await b.get('/api/shared')).body.recipes;
  assert.equal(dir.length, 1);
  assert.equal(dir[0].title, 'Quick flatbread');
  assert.equal(dir[0].unleavened, true);
  assert.equal(dir[0].feast, true);
  assert.equal(dir[0].mine, false);
  assert.ok(!JSON.stringify(dir).includes('Carsons'), 'no family name');
  assert.equal((await b.get('/api/shared?feast=1')).body.recipes.length, 1);
  assert.equal((await b.get('/api/shared?q=pancake')).body.recipes.length, 0);
  const mine = (await a.get('/api/recipes')).body.recipes[0];
  assert.deepEqual(mine.shared, { kind: 'feast', unleavened: true, hidden: false });

  // Another family adds it as its own copy, which they can cook.
  const copy = (await b.post(`/api/shared/${dir[0].id}/add`)).body.id;
  assert.equal((await b.post(`/api/shared/${dir[0].id}/add`)).body.id, copy, 'adding twice is one copy');
  assert.equal((await b.get('/api/recipes')).body.recipes[0].title, 'Quick flatbread');
  assert.equal((await b.get('/api/shared')).body.recipes[0].added, true);

  // Withdrawn, it's gone from the directory; shared again, it's back.
  await a.del(`/api/recipes/${hexOf(id)}/share`);
  assert.equal((await b.get('/api/shared')).body.recipes.length, 0);
  await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'general' });
  assert.equal((await b.get('/api/shared')).body.recipes[0].feast, false);
});

test('a typed-in ingredient waits for the owner, who decides the badge', async () => {
  const { owner, a, b } = await setup();
  const { id } = (await a.post('/api/recipes', YEAST)).body;
  assert.equal((await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'general' })).body.status, 'needs_review');
  assert.equal((await b.get('/api/shared')).body.recipes.length, 0);
  await a.post(`/api/recipes/${hexOf(id)}/review`, { reason: 'typed_in', kind: 'general' });
  await a.post(`/api/recipes/${hexOf(id)}/review`, { reason: 'typed_in', kind: 'general' });
  const reviews = (await owner.get('/api/owner/recipe-reviews')).body.reviews;
  assert.equal(reviews.length, 1, 'sending twice is one review');
  assert.deepEqual(reviews[0].typed_in, ['Active dry yeast']);
  assert.deepEqual(reviews[0].leaven, ['yeast']);
  assert.equal((await a.get('/api/owner/recipe-reviews')).status, 403, 'owner only');
  await owner.post(`/api/owner/recipe-reviews/${reviews[0].id}/clear`, { unleavened: false });
  const dir = (await b.get('/api/shared')).body.recipes;
  assert.deepEqual(dir.map((x) => [x.title, x.unleavened]), [['Yeasted rolls', false]]);
  assert.equal((await a.get('/api/recipes')).body.recipes[0].review.status, 'cleared');
});

test('a feast-day recipe flagged for leaven: Share recipe shares it without the badge; a cleared review gives it', async () => {
  const { owner, a, b } = await setup();
  const { id } = (await a.post('/api/recipes', SODA)).body;
  const flag = (await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'feast' })).body;
  assert.equal(flag.status, 'leaven_flag');
  assert.deepEqual(flag.found, ['baking soda']);
  // Both buttons: sent for review, and shared without the badge.
  await a.post(`/api/recipes/${hexOf(id)}/review`, { reason: 'leaven', kind: 'feast' });
  assert.equal((await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'feast', without_badge: true })).body.status, 'shared');
  assert.equal((await b.get('/api/shared')).body.recipes[0].unleavened, false);
  const [rev] = (await owner.get('/api/owner/recipe-reviews')).body.reviews;
  await owner.post(`/api/owner/recipe-reviews/${rev.id}/clear`, { unleavened: true });
  assert.equal((await b.get('/api/shared')).body.recipes[0].unleavened, true);
});

test('a declined review tells the family why', async () => {
  const { owner, a } = await setup();
  const { id } = (await a.post('/api/recipes', SODA)).body;
  await a.post(`/api/recipes/${hexOf(id)}/review`, { reason: 'leaven', kind: 'feast' });
  const [rev] = (await owner.get('/api/owner/recipe-reviews')).body.reviews;
  assert.equal((await owner.post(`/api/owner/recipe-reviews/${rev.id}/decline`, {})).status, 400, 'a note is needed');
  await owner.post(`/api/owner/recipe-reviews/${rev.id}/decline`, { note: 'Baking soda is leaven.' });
  assert.deepEqual((await a.get('/api/recipes')).body.recipes[0].review, { reason: 'leaven', status: 'declined', owner_reply: 'Baking soda is leaven.', current: true });
});

test('a blocked word: the recipe is held for review; clearing it frees the recipe and only that word', async () => {
  const { owner, a, b } = await setup();
  const refused = await a.post('/api/recipes', CRAB);
  assert.equal(refused.status, 400);
  const check = (await a.post('/api/recipes/check', CRAB)).body;
  assert.equal(check.reviewable, true);
  assert.deepEqual(check.blocked, ['crab']);
  const { id, held } = (await a.post('/api/recipes', { ...CRAB, send_for_review: true })).body;
  assert.equal(held, true);
  // Held: not cookable, not shareable, not in the queue picker.
  assert.equal((await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'general' })).status, 409);
  assert.equal((await a.get('/api/queue')).body.recipes.length, 0);
  const [rev] = (await owner.get('/api/owner/recipe-reviews')).body.reviews;
  assert.deepEqual(rev.blocked, ['crab']);
  await owner.post(`/api/owner/recipe-reviews/${rev.id}/clear`, {});
  const row = (await a.get(`/api/recipes/${hexOf(id)}`)).body;
  assert.equal(row.held, false);
  assert.deepEqual(row.cleared, ['crab']);
  assert.equal((await a.get('/api/queue')).body.recipes.length, 1);
  // An edit keeps the cleared word, but a new blocked word is refused again.
  assert.equal((await a.put(`/api/recipes/${hexOf(id)}`, { ...CRAB, servings: 6 })).status, 200);
  assert.equal((await a.put(`/api/recipes/${hexOf(id)}`, { ...CRAB, title: 'Crab apple and shrimp jelly' })).status, 400);
  // Shared, the copy carries the cleared word, so the other family can edit theirs.
  await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'general' });
  const [shared] = (await b.get('/api/shared')).body.recipes;
  const copy = (await b.post(`/api/shared/${shared.id}/add`)).body.id;
  assert.equal((await b.put(`/api/recipes/${hexOf(copy)}`, { ...CRAB, servings: 2 })).status, 200);
});

test('a blocked word beside any other problem can\'t be sent for review', async () => {
  const { a } = await setup();
  // A blocked word beside any other problem isn't only a false alarm, so it
  // can't be sent; the species check on a registry ingredient is the same.
  const check = (await a.post('/api/recipes/check', { ...CRAB, steps: [] })).body;
  assert.equal(check.reviewable, false);
  assert.equal((await a.post('/api/recipes', { ...CRAB, steps: [], send_for_review: true })).status, 400);
});

test('report, hide, and unhide; unclean reports email the owner; a copy already added stays', async () => {
  const { owner, a, b } = await setup();
  const { id } = (await a.post('/api/recipes', FLAT)).body;
  await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'general' });
  const [c] = (await b.get('/api/shared')).body.recipes;
  await b.post(`/api/shared/${c.id}/add`);
  assert.equal((await b.post(`/api/shared/${c.id}/report`, { kind: 'unclean', note: '' })).status, 400);
  const before = outbox.length;
  await b.post(`/api/shared/${c.id}/report`, { kind: 'unclean', note: 'It says to fry it in lard.' });
  assert.equal(outbox.length, before + 1);
  assert.match(outbox.at(-1).subject, /Unclean ingredient: Quick flatbread/);
  const reps = (await owner.get('/api/owner/recipe-reports')).body;
  assert.equal(reps.reports.length, 1);
  await owner.post(`/api/owner/shared/${c.id}/hide`);
  assert.equal((await a.get('/api/shared')).body.recipes.length, 0);
  assert.equal((await owner.get('/api/owner/recipe-reports')).body.reports.length, 0, 'hiding answers its reports');
  assert.equal((await owner.get('/api/owner/recipe-reports')).body.hidden.length, 1);
  const copy = (await b.get('/api/recipes')).body.recipes[0];
  assert.equal(copy.source_hidden, true, 'the copy says it left the directory');
  assert.equal((await a.get('/api/recipes')).body.recipes[0].shared.hidden, true);
  // Sharing again doesn't undo the owner's hide.
  await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'general' });
  assert.equal((await b.get('/api/shared')).body.recipes.length, 0);
  await owner.post(`/api/owner/shared/${c.id}/unhide`);
  assert.equal((await b.get('/api/shared')).body.recipes.length, 1);
  assert.equal((await a.post(`/api/owner/shared/${c.id}/hide`)).status, 403, 'owner only');
});

test('a deleted recipe leaves the directory', async () => {
  const { a, b } = await setup();
  const { id } = (await a.post('/api/recipes', FLAT)).body;
  await a.post(`/api/recipes/${hexOf(id)}/share`, { kind: 'general' });
  await a.del(`/api/recipes/${hexOf(id)}`);
  assert.equal((await b.get('/api/shared')).body.recipes.length, 0);
});
