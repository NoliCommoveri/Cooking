// Cooks saved for every profile on them (plan §1, §8.4, Phase 2b), and the
// parents' one-time test-cook notice (§6.9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client } from './helpers/worker.js';

const t0 = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
const t1 = () => new Date().toISOString();
const cook = (profile_ids, extra = {}) => ({ lesson_id: '04-shakshuka', servings: 6, profile_ids, started_at: t0(), ...extra });

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  for (const n of ['Ava', 'Eli']) await a.post('/api/profiles', { people: [{ name: n, color: 'tomato' }] });
  await b.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  const [ava, eli] = (await a.get('/api/profiles')).body.profiles.map((p) => p.id);
  const bea = (await b.get('/api/profiles')).body.profiles[0].id;
  return { env, a, b, ava, eli, bea };
}

test('a cook shared by two profiles counts for both, once finished', async () => {
  const { a, ava, eli } = await setup();
  const id = '0123456789abcdef';
  assert.equal((await a.put(`/api/attempts/${id}`, cook([ava, eli], { checklist_state: { stage: 'cook', step: 2 } }))).status, 200);
  assert.deepEqual((await a.get(`/api/profiles/${ava}/cooks`)).body.cooks, {}, 'not cooked until finished');
  const done = await a.put(`/api/attempts/${id}`, cook([ava, eli], { finished_at: t1() }));
  assert.equal(done.status, 200);
  for (const p of [ava, eli]) assert.equal((await a.get(`/api/profiles/${p}/cooks`)).body.cooks['04-shakshuka'].times, 1);
});

test('sending the same cook again saves it once, and a finished cook stays as it was', async () => {
  const { env, a, ava, eli } = await setup();
  const id = '00000000000000a1';
  const fin = t1();
  await a.put(`/api/attempts/${id}`, cook([ava], { finished_at: fin }));
  const again = await a.put(`/api/attempts/${id}`, cook([ava, eli], { finished_at: t1(), servings: 4 }));
  assert.equal(again.status, 200);
  assert.equal(again.body.finished_at, fin);
  const row = await env.DB.prepare('SELECT servings, lesson_version FROM attempts WHERE id = ?').bind(id).first();
  assert.equal(row.servings, 6);
  assert.equal(row.lesson_version, 1);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM attempt_profiles WHERE attempt_id = ?').bind(id).first()).n, 1);
});

test('who is on a cook can change until it finishes', async () => {
  const { env, a, ava, eli } = await setup();
  const id = '00000000000000a2';
  await a.put(`/api/attempts/${id}`, cook([ava, eli]));
  await a.put(`/api/attempts/${id}`, cook([eli]));
  const { results } = await env.DB.prepare('SELECT profile_id FROM attempt_profiles WHERE attempt_id = ?').bind(id).all();
  assert.deepEqual(results.map((r) => r.profile_id), [eli]);
});

test('a cook is checked: a real lesson, a size it offers, and at least one profile', async () => {
  const { a, ava } = await setup();
  const bad = [
    cook([ava], { lesson_id: 'nope' }),
    cook([ava], { servings: 99 }),
    cook([ava], { lesson_id: '38-buttermilk-biscuits', servings: 7 }),
    cook([]),
    cook([ava], { started_at: 'yesterday' }),
    cook([ava], { started_at: t1(), finished_at: t0() }),
    cook([ava], { checklist_state: { big: 'x'.repeat(5000) } }),
  ];
  for (const [i, body] of bad.entries()) assert.equal((await a.put('/api/attempts/00000000000000b0', body)).status, 400, `case ${i}`);
});

test("a family can't put another family's profile on a cook, or reach another family's cook", async () => {
  const { env, a, b, ava, bea } = await setup();
  assert.equal((await a.put('/api/attempts/00000000000000c1', cook([ava, bea]))).status, 400);
  assert.equal((await a.put('/api/attempts/00000000000000c2', cook([bea]))).status, 400);
  // Bea's family's cook: a guessed id reads as not found and is left alone.
  await b.put('/api/attempts/00000000000000c3', cook([bea]));
  assert.equal((await a.put('/api/attempts/00000000000000c3', cook([ava], { finished_at: t1() }))).status, 404);
  const row = await env.DB.prepare('SELECT finished_at FROM attempts WHERE id = ?').bind('00000000000000c3').first();
  assert.equal(row.finished_at, null);
  assert.equal((await a.get(`/api/profiles/${bea}/cooks`)).status, 404);
});

test('deleting a profile takes it off its cooks, and a cook left with nobody goes too', async () => {
  const { env, a, ava, eli } = await setup();
  await a.put('/api/attempts/00000000000000d1', cook([ava, eli], { finished_at: t1() }));
  await a.put('/api/attempts/00000000000000d2', cook([ava], { finished_at: t1() }));
  assert.equal((await a.del(`/api/profiles/${ava}`)).status, 200);
  const left = (await env.DB.prepare('SELECT id FROM attempts ORDER BY id').all()).results.map((r) => r.id);
  assert.deepEqual(left, ['00000000000000d1']);
  assert.equal((await a.get(`/api/profiles/${eli}/cooks`)).body.cooks['04-shakshuka'].times, 1);
});

test('the test-cook notice shows to each parent until they close it', async () => {
  const { a } = await setup();
  assert.equal((await a.get('/api/me')).body.parent.test_cook_notice, true);
  assert.equal((await a.post('/api/notice/test-cook')).status, 200);
  assert.equal((await a.get('/api/me')).body.parent.test_cook_notice, false);
});

test("one parent closing the notice doesn't close it for another", async () => {
  const { env, a } = await setup();
  await a.post('/api/parents', { email: 'sam@example.com', password: 'password123' });
  await a.post('/api/notice/test-cook');
  const sam = client(env);
  await sam.post('/api/login', { email: 'sam@example.com', password: 'password123' });
  assert.equal((await sam.get('/api/me')).body.parent.test_cook_notice, true);
});
