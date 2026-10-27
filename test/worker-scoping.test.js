// Family scoping (plan §2.5, §8.3): two families, and neither can reach the
// other's profiles, settings, or parents through any route.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';

async function twoFamilies() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await b.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  const aId = (await a.get('/api/profiles')).body.profiles[0].id;
  const bId = (await b.get('/api/profiles')).body.profiles[0].id;
  return { env, a, b, aId, bId };
}

test('each family sees only its own profiles', async () => {
  const { a, b } = await twoFamilies();
  assert.deepEqual((await a.get('/api/profiles')).body.profiles.map((p) => p.name), ['Ava']);
  assert.deepEqual((await b.get('/api/profiles')).body.profiles.map((p) => p.name), ['Bea']);
});

test("a family can't edit, retheme, or delete another family's profile", async () => {
  const { a, b, bId } = await twoFamilies();
  const body = { people: [{ name: 'Hacked', color: 'tomato' }] };
  assert.equal((await a.put(`/api/profiles/${bId}`, body)).status, 404);
  assert.equal((await a.put(`/api/profiles/${bId}/theme`, { theme: 'quest' })).status, 404);
  assert.equal((await a.del(`/api/profiles/${bId}`)).status, 404);
  const still = (await b.get('/api/profiles')).body.profiles[0];
  assert.equal(still.name, 'Bea');
  assert.equal(still.theme, 'passport');
});

test('family settings and parent lists stay in their family', async () => {
  const { a, b } = await twoFamilies();
  await a.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: ['dairy'] });
  const fb = (await b.get('/api/family')).body;
  assert.equal(fb.family.name, 'Smiths');
  assert.equal(fb.family.default_servings, 6);
  assert.deepEqual(fb.parents, ['pat@example.com']);
  assert.deepEqual((await b.get('/api/me')).body.family.diet_filters, []);
});

test('a family id sent by the browser is ignored', async () => {
  const { env, a, b } = await twoFamilies();
  const bFamily = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'pat@example.com'").first()).family_id;
  await a.post('/api/profiles', { family_id: bFamily, people: [{ name: 'Sneaky', color: 'tomato' }] });
  await a.put('/api/family', { family_id: bFamily, name: 'Renamed', default_servings: 6, diet_filters: [] });
  assert.deepEqual((await b.get('/api/profiles')).body.profiles.map((p) => p.name), ['Bea']);
  assert.equal((await b.get('/api/family')).body.family.name, 'Smiths');
});

test('one family\'s PIN does not unlock the other', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com', { pin: '1111' });
  const b = await family(env, 'Smiths', 'pat@example.com', { pin: '2222' });
  await b.post('/api/pin/lock');
  assert.equal((await b.post('/api/pin/unlock', { pin: '1111' })).status, 403);
});

test('a non-owner reaches no cross-family route', async () => {
  const { a } = await twoFamilies();
  for (const [m, p] of [['get', '/api/owner'], ['put', '/api/owner/beta-word'], ['post', '/api/owner/parent-password']]) {
    assert.equal((await a[m](p, {})).status, 403, `${m} ${p}`);
  }
});

test('signed-out requests reach nothing', async () => {
  const { env } = await twoFamilies();
  const { client } = await import('./helpers/worker.js');
  const anon = client(env);
  for (const p of ['/api/profiles', '/api/library', '/api/family', '/api/owner']) {
    assert.equal((await anon.get(p)).status, 401, p);
  }
});

test("voice step control is off until a parent turns it on, and only for that family", async () => {
  const { a, b } = await twoFamilies();
  assert.equal((await a.get('/api/me')).body.family.voice_enabled, false);
  const base = { name: 'Carsons', default_servings: 6, diet_filters: [] };
  assert.equal((await a.put('/api/family', { ...base, voice_enabled: 'yes' })).status, 400);
  assert.equal((await a.put('/api/family', { ...base, voice_enabled: true })).status, 200);
  assert.equal((await a.get('/api/me')).body.family.voice_enabled, true);
  // Saving settings without the field leaves it as it was.
  await a.put('/api/family', { ...base, default_servings: 4 });
  assert.equal((await a.get('/api/family')).body.family.voice_enabled, true);
  assert.equal((await b.get('/api/me')).body.family.voice_enabled, false);
  // Behind the parent PIN.
  await a.post('/api/pin/lock');
  assert.equal((await a.put('/api/family', { ...base, voice_enabled: false })).status, 403);
});
