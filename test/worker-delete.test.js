// Delete our family and Download our data (plan §6.14): the family is gone at
// once, the owner can bring it back from /ops for 30 days, and the daily job
// erases it after that.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, client, family, opsClient } from './helpers/worker.js';
import { eraseDeleted, GRACE_DAYS } from '../src/worker/backup.js';
import worker from '../src/worker/index.js';

const FLAT = {
  servings: 4, totalMinutes: 30, mealType: 'bread', method: 'stove', why: null, equipment: ['skillet-12'],
  steps: [{ text: 'Cook it in the pan.', safety: 'adult-nearby', hazard: 'Hot pan' }],
  title: 'Quick flatbread', ingredients: [{ ingredient: 'flour-ap', amount: 2, unit: 'cup' }, { ingredient: 'water', amount: 0.5, unit: 'cup' }],
};

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  await a.put(`/api/profiles/${ava}/login`, { first: 'Ava', initial: 'c', picture: 'carrot', password: 'carrot1' });
  const kid = client(env);
  await kid.post('/api/kid-login', { name: 'Ava C', picture: 'carrot', password: 'carrot1' });
  const fid = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  return { env, a, b, kid, fid };
}

test('Download our data is the family\'s own export, behind the PIN', async () => {
  const { env, a } = await setup();
  const out = (await a.get('/api/family/export')).body;
  assert.equal(out.kind, 'clean-plate-family');
  assert.equal(out.tables.families[0].name, 'Carsons');
  assert.equal(out.tables.profiles.length, 1);
  assert.ok(!out.tables.sessions, 'no sessions in it');
  assert.equal(out.tables.parents.length, 1);
  await a.post('/api/pin/lock');
  assert.equal((await a.get('/api/family/export')).body.error, 'pin_required');
  assert.equal((await client(env).get('/api/family/export')).status, 401);
});

test('Delete our family: the password is checked, then everyone is out and nothing shows', async () => {
  const { env, a, b, kid } = await setup();
  const { id } = (await a.post('/api/recipes', FLAT)).body;
  await a.post(`/api/recipes/${id.slice(7)}/share`, { kind: 'general' });
  assert.equal((await b.get('/api/shared')).body.recipes.length, 1);

  assert.equal((await a.post('/api/family/delete', { password: 'wrong-one' })).body.error, 'password_wrong');
  const res = await a.post('/api/family/delete', { password: 'password123' });
  assert.equal(res.status, 200);
  assert.match(res.body.erase_after, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal((await a.get('/api/me')).body.signed_in, false);
  assert.equal((await kid.get('/api/me')).body.signed_in, false);
  const login = await client(env).post('/api/login', { email: 'jen@example.com', password: 'password123' });
  assert.equal(login.body.error, 'family_deleted');
  assert.match(login.body.message, /bring it back/);
  assert.equal((await client(env).post('/api/kid-login', { name: 'Ava C', picture: 'carrot', password: 'carrot1' })).status, 401);
  assert.equal((await client(env).post('/api/signup/start', { email: 'jen@example.com', password: 'password123' })).body.error, 'family_deleted');
  const before = (await env.DB.prepare('SELECT COUNT(*) AS n FROM password_resets').first()).n;
  await client(env).post('/api/password/forgot', { email: 'jen@example.com' });
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM password_resets').first()).n, before, 'no reset link for a deleted family');
  assert.equal((await b.get('/api/shared')).body.recipes.length, 0, 'its shared recipe left the directory');
  // The other family is untouched.
  assert.equal((await b.get('/api/me')).body.family.name, 'Smiths');
});

test("the owner's family can't delete itself from the app", async () => {
  const { env, a } = await setup();
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();
  assert.equal((await a.post('/api/family/delete', { password: 'password123' })).body.error, 'owner_family');
});

test('/ops lists a deleted family and Bring back puts it back as it was', async () => {
  const { env, a, fid } = await setup();
  await a.post('/api/family/delete', { password: 'password123' });
  const ops = await opsClient(env);
  const page = (await ops.get('/ops')).body;
  assert.match(page, /Deleted by the family/);
  assert.match(page, /Bring back/);
  assert.match((await ops.form(`/ops/undelete/${fid}`, {})).body, /Carsons is back/);
  const c = client(env);
  assert.equal((await c.post('/api/login', { email: 'jen@example.com', password: 'password123' })).status, 200);
  assert.equal((await c.get('/api/profiles')).body.profiles[0].name, 'Ava');
  assert.equal((await client(env).post('/api/kid-login', { name: 'Ava C', picture: 'carrot', password: 'carrot1' })).status, 200);
  assert.match((await ops.form(`/ops/undelete/${fid}`, {})).body, /Nothing was changed/);
});

test('the daily job erases a family 30 days after it was deleted, and its download restores it', async () => {
  const { env, a, b, fid } = await setup();
  // A report from another family on its shared recipe goes with it.
  const { id } = (await a.post('/api/recipes', FLAT)).body;
  await a.post(`/api/recipes/${id.slice(7)}/share`, { kind: 'general' });
  const [shared] = (await b.get('/api/shared')).body.recipes;
  await b.post(`/api/shared/${shared.id}/report`, { kind: 'wrong', note: 'Too much water.' });
  const saved = (await a.get('/api/family/export')).body;
  await a.post('/api/family/delete', { password: 'password123' });

  assert.equal(await eraseDeleted(env.DB), 0, 'not before the grace period');
  const later = Date.now() + (GRACE_DAYS + 1) * 24 * 60 * 60 * 1000;
  assert.equal(await eraseDeleted(env.DB, later), 1);
  assert.equal(await env.DB.prepare('SELECT 1 FROM families WHERE id = ?').bind(fid).first(), null);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM profiles WHERE family_id = ?').bind(fid).first()).n, 0);
  assert.equal((await b.get('/api/me')).body.family.name, 'Smiths');

  // The scheduled handler runs the same job.
  await worker.scheduled({}, env);

  // Its own download brings it back from /ops, live again.
  const ops = await opsClient(env);
  const f = new FormData();
  f.append('file', new Blob([JSON.stringify(saved)], { type: 'application/json' }), 'family.json');
  assert.match((await ops.form('/ops/restore-family', { file: f.get('file') })).body, /Restored/);
  assert.equal((await client(env).post('/api/login', { email: 'jen@example.com', password: 'password123' })).status, 200);
});
