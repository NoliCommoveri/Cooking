// Phase 4, first part: Reflect (§3), Print our progress (§6.15), and the
// per-family photos switch on /ops (§2.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, opsClient } from './helpers/worker.js';

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  for (const n of ['Ava', 'Eli']) await a.post('/api/profiles', { people: [{ name: n, color: 'tomato' }] });
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, eli] = ['Ava', 'Eli'].map((n) => profiles.find((p) => p.name === n).id);
  const cook = '00000000000000e1';
  await a.put(`/api/attempts/${cook}`, {
    lesson_id: 'shakshuka', servings: 6, profile_ids: [ava, eli], started_at: new Date(Date.now() - 3600e3).toISOString(), finished_at: new Date().toISOString(),
  });
  return { env, a, b, ava, eli, cook };
}

test('each profile on a cook reflects on it; the eaters get one rating; it can be changed later', async () => {
  const { env, a, ava, eli, cook } = await setup();
  assert.equal((await a.put(`/api/attempts/${cook}/reflection`, { profile_id: ava, rating: 5, notes: 'Less salt', transfer: 'Chili', eater_rating: 4 })).status, 200);
  await a.put(`/api/attempts/${cook}/reflection`, { profile_id: eli, rating: 3 });
  const rows = (await env.DB.prepare('SELECT profile_id, rating, notes, transfer, reflected_at FROM attempt_profiles WHERE attempt_id = ?').bind(cook).all()).results;
  const r = Object.fromEntries(rows.map((x) => [x.profile_id, x]));
  assert.deepEqual([r[ava].rating, r[ava].notes, r[ava].transfer], [5, 'Less salt', 'Chili']);
  assert.equal(r[eli].rating, 3);
  assert.ok(r[eli].reflected_at);
  assert.equal((await env.DB.prepare('SELECT eater_rating FROM attempts WHERE id = ?').bind(cook).first()).eater_rating, 4);
  await a.put(`/api/attempts/${cook}/reflection`, { profile_id: ava, rating: 4 });
  assert.equal((await env.DB.prepare('SELECT rating FROM attempt_profiles WHERE attempt_id = ? AND profile_id = ?').bind(cook, ava).first()).rating, 4);
});

test('a reflection is checked, and only for the family and profiles on the cook', async () => {
  const { a, b, ava, cook } = await setup();
  for (const body of [{ profile_id: ava, rating: 6 }, { profile_id: ava, rating: 0 }, { profile_id: 'nope', rating: 3 }, { profile_id: ava, notes: 'x'.repeat(1001) }]) {
    assert.equal((await a.put(`/api/attempts/${cook}/reflection`, body)).status, 400, JSON.stringify(body));
  }
  await b.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  const bea = (await b.get('/api/profiles')).body.profiles[0].id;
  assert.equal((await b.put(`/api/attempts/${cook}/reflection`, { profile_id: bea, rating: 3 })).status, 404);
  assert.equal((await a.put('/api/attempts/0000000000000fff/reflection', { profile_id: ava, rating: 3 })).status, 404);
});

test('Print our progress lists each profile\'s cooks with their own rating; parents only', async () => {
  const { a, b, ava, cook } = await setup();
  await a.put(`/api/attempts/${cook}/reflection`, { profile_id: ava, rating: 5 });
  const d = (await a.get('/api/progress')).body;
  assert.equal(d.family, 'Carsons');
  const byName = Object.fromEntries(d.profiles.map((p) => [p.name, p.rows]));
  assert.deepEqual(byName.Ava.map((r) => [r.dish, r.cuisine, r.rating]), [['Shakshuka', 'North African', 5]]);
  assert.equal(byName.Eli[0].rating, null);
  assert.ok(byName.Eli[0].skill);
  assert.equal((await b.get('/api/progress')).body.profiles.length, 0);
  await a.post('/api/pin/lock');
  assert.equal((await a.get('/api/progress')).status, 403);
});

test('/ops turns photos on and off for one family; it starts off', async () => {
  const { env, a } = await setup();
  assert.equal((await a.get('/api/me')).body.family.photos_enabled, false);
  const ops = await opsClient(env);
  const fid = (await env.DB.prepare("SELECT id FROM families WHERE name = 'Carsons'").first()).id;
  assert.match((await ops.get('/ops')).body, /Turn photos on/);
  await ops.form(`/ops/photos/${fid}`, { on: '1' });
  assert.equal((await a.get('/api/me')).body.family.photos_enabled, true);
  await ops.form(`/ops/photos/${fid}`, { on: '0' });
  assert.equal((await a.get('/api/me')).body.family.photos_enabled, false);
  const smiths = (await env.DB.prepare("SELECT photos_enabled FROM families WHERE name = 'Smiths'").first()).photos_enabled;
  assert.equal(smiths, 0);
});
