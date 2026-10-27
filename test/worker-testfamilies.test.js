// Test families (owner screens): a pretend family made from a preset, opened
// on the owner's device as that family's parent, and Back to my account.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';

async function setup() {
  const env = await makeEnv();
  const o = await family(env, 'Carsons', 'jen@example.com');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();
  return { env, o };
}
const make = async (o, body) => {
  const res = await o.post('/api/owner/test-families', body);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.id;
};

test('only the owner makes or opens test families', async () => {
  const { env, o } = await setup();
  const b = await family(env, 'Lees', 'sam@example.com');
  assert.equal((await b.post('/api/owner/test-families', { preset: 'new' })).status, 403);
  const fid = await make(o, { preset: 'new' });
  assert.equal((await b.post(`/api/owner/test-families/${fid}/open`)).status, 403);
  // A family that isn't a test family can't be opened.
  const lees = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'sam@example.com'").first()).family_id;
  assert.equal((await o.post(`/api/owner/test-families/${lees}/open`)).status, 404);
});

test('a new test family opens on Getting started, and Back to my account returns', async () => {
  const { o } = await setup();
  const fid = await make(o, { preset: 'new' });
  const list = (await o.get('/api/owner/test-families')).body.families;
  assert.deepEqual(list.map((x) => [x.id, x.label]), [[fid, 'New family']]);
  assert.equal((await o.get('/api/owner')).body.families.length, 1, 'not on the Families list');

  assert.equal((await o.post(`/api/owner/test-families/${fid}/open`)).status, 200);
  const me = (await o.get('/api/me')).body;
  assert.equal(me.parent.is_owner, false);
  assert.equal(me.family.setup_needed, true);
  assert.equal(me.family.pin_set, false);
  assert.deepEqual(me.testing, { label: 'New family', pin: '1234' });
  assert.equal((await o.get('/api/owner')).status, 403, 'no owner screens inside it');
  // Ruth's first step works as for a real sign-up.
  assert.equal((await o.post('/api/pin/set', { family_name: 'Testers', pin: '4321' })).status, 200);

  assert.equal((await o.post('/api/test-family/leave')).status, 200);
  const back = (await o.get('/api/me')).body;
  assert.equal(back.parent.email, 'jen@example.com');
  assert.equal(back.testing, null);
  assert.equal(back.family.name, 'Carsons');
});

test('kids partway through Cook Around the World', async () => {
  const { o } = await setup();
  const fid = await make(o, { preset: 'kids', program: '', weeks: 3, mode: 'homeschool' });
  await o.post(`/api/owner/test-families/${fid}/open`);
  const me = (await o.get('/api/me')).body;
  assert.equal(me.family.setup_needed, false);
  assert.equal(me.family.next_release_preview, false);
  const { profiles } = (await o.get('/api/profiles')).body;
  assert.deepEqual(profiles.map((p) => [p.name, p.audience]), [['Ava', 'kid'], ['Ben', 'kid']]);
  const cooks = (await o.get(`/api/profiles/${profiles[0].id}/cooks`)).body.cooks;
  assert.equal(Object.keys(cooks).length, 6, 'two a week for three weeks');
  const c = (await o.get('/api/queue')).body.courses[0];
  assert.equal(c.lessons_behind, 0);
  assert.ok(c.this_week.lessons.length > 0, "this week's lessons are queued");
  // The PIN on the bar unlocks the parent screens.
  await o.post('/api/pin/lock');
  assert.equal((await o.post('/api/pin/unlock', { pin: '1234' })).status, 200);
});

test('an adult learner on a Level sees the Levels, a few weeks in', async () => {
  const { o } = await setup();
  const fid = await make(o, { preset: 'adult', program: 'sp-3', weeks: 2 });
  await o.post(`/api/owner/test-families/${fid}/open`);
  const me = (await o.get('/api/me')).body;
  assert.equal(me.family.next_release_preview, true, 'a Level needs the release preview');
  assert.match(me.testing.label, /^Adult on Level 3 Cook, week 3/);
  const { profiles } = (await o.get('/api/profiles')).body;
  assert.deepEqual(profiles.map((p) => [p.name, p.audience, p.level]), [['Jordan', 'adult', 'sp-3']]);
  const c = (await o.get('/api/queue')).body.courses[0];
  assert.equal(c.level.week, 3);
});

test('signing out inside a test family signs the owner out too; Remove takes it off the list', async () => {
  const { env, o } = await setup();
  const fid = await make(o, { preset: 'kids', program: '', weeks: 0 });
  await o.post(`/api/owner/test-families/${fid}/open`);
  await o.post('/api/logout');
  assert.equal((await o.get('/api/me')).body.signed_in, false);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM sessions').first()).n, 0);

  await o.post('/api/login', { email: 'jen@example.com', password: 'password123' });
  await o.post('/api/pin/unlock', { pin: '1234' });
  assert.equal((await o.del(`/api/owner/test-families/${fid}`)).status, 200);
  assert.deepEqual((await o.get('/api/owner/test-families')).body.families, []);
  assert.ok((await env.DB.prepare('SELECT deleted_at FROM families WHERE id = ?').bind(fid).first()).deleted_at, 'deleted, so /ops can bring it back');
});
