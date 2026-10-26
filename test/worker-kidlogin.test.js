// Kid logins (plan §8.3a): a first name and last initial, a cooking picture,
// and a password, set by a parent. A kid's device reaches only that kid's
// kitchen, and the server refuses everything else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client, samplePlan } from './helpers/worker.js';
import { weekOf } from '../src/worker/schedule.js';
import { LOGIN_PICTURES, loginName, loginKey } from '../src/content/login-pictures.js';

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true });
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Eli', color: 'sky' }] });
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, eli] = ['Ava', 'Eli'].map((n) => profiles.find((p) => p.name === n).id);
  return { env, a, ava, eli };
}
const giveLogin = (a, pid, extra = {}) => a.put(`/api/profiles/${pid}/login`, { first: 'Ava', initial: 'c', picture: 'carrot', password: 'carrot1', ...extra });
async function kidDevice(env, name = 'Ava C', picture = 'carrot', password = 'carrot1') {
  const k = client(env);
  const res = await k.post('/api/kid-login', { name, picture, password });
  return { k, res };
}

test('30 pictures with ids, and names matched without case, spaces, or periods', () => {
  assert.equal(LOGIN_PICTURES.length, 30);
  assert.equal(new Set(LOGIN_PICTURES.map((p) => p.id)).size, 30);
  assert.deepEqual(loginName('ava', 'c.'), { name: 'ava C', key: 'avac' });
  assert.equal(loginKey('Ava C.'), loginKey('avac'));
  assert.ok(loginName('Ava', 'Ca').error);
  assert.ok(loginName('', 'C').error);
  assert.ok(loginName('Ava2', 'C').error);
});

test('a parent sets up a login; the kid logs in with name, picture, and password', async () => {
  const { env, a, ava } = await setup();
  const res = await giveLogin(a, ava);
  assert.equal(res.status, 200);
  assert.equal(res.body.login.login_name, 'Ava C');
  assert.equal(res.body.login.picture, 'carrot');
  // Wrong picture, wrong password, wrong name: the same answer.
  for (const [n, pic, pw] of [['Ava C', 'apple', 'carrot1'], ['Ava C', 'carrot', 'nope123'], ['Eva C', 'carrot', 'carrot1']]) {
    const { res: r } = await kidDevice(env, n, pic, pw);
    assert.equal(r.status, 401);
    assert.match(r.body.message, /don't match/);
  }
  const { k, res: ok } = await kidDevice(env, 'ava c.');
  assert.equal(ok.status, 200);
  const me = (await k.get('/api/me')).body;
  assert.equal(me.kid.profile_id, ava);
  assert.equal(me.parent, null);
  assert.equal((await a.get(`/api/profiles/${ava}/login`)).body.login.devices, 1);
});

test('the name and picture together are unique across the app; the password is at least 6', async () => {
  const { env, a, ava } = await setup();
  assert.equal((await giveLogin(a, ava, { password: 'short' })).status, 400);
  assert.equal((await giveLogin(a, ava)).status, 200);
  const b = await family(env, 'Smiths', 'pat@example.com');
  await b.post('/api/profiles', { people: [{ name: 'Ava', color: 'plum' }] });
  const theirs = (await b.get('/api/profiles')).body.profiles[0].id;
  const taken = await giveLogin(b, theirs);
  assert.equal(taken.status, 409);
  const pics = (await b.get('/api/login-pictures?first=Ava&initial=C')).body.pictures;
  assert.equal(pics.find((p) => p.id === 'carrot').taken, true);
  assert.equal(pics.filter((p) => p.taken).length, 1);
  assert.equal((await giveLogin(b, theirs, { picture: 'apple' })).status, 200);
  // Each logs in to their own.
  assert.equal((await (await kidDevice(env, 'Ava C', 'apple')).k.get('/api/me')).body.kid.profile_id, theirs);
  // A profile's own picture isn't taken for it.
  const own = (await a.get(`/api/login-pictures?first=Ava&initial=C&profile=${ava}`)).body.pictures;
  assert.equal(own.find((p) => p.id === 'carrot').taken, false);
});

test('adult profiles have no login; setting one up needs the PIN', async () => {
  const { a, ava } = await setup();
  await a.post('/api/profiles', { people: [{ name: 'Gran', color: 'slate' }], audience: 'adult' });
  const gran = (await a.get('/api/profiles')).body.profiles.find((p) => p.name === 'Gran').id;
  assert.equal((await giveLogin(a, gran, { first: 'Gran' })).status, 400);
  await a.post('/api/pin/lock');
  assert.equal((await giveLogin(a, ava)).status, 403);
});

test("a kid's device reaches its own kitchen and nothing else", async () => {
  const { env, a, ava, eli } = await setup();
  await giveLogin(a, ava);
  const { k } = await kidDevice(env);
  // Allowed, for its own profile.
  for (const path of ['/api/library', `/api/profiles/${ava}/queue`, `/api/profiles/${ava}/cooks`, '/api/recipes', '/api/shared', '/api/patches']) {
    assert.equal((await k.get(path)).status, 200, path);
  }
  assert.equal((await k.put(`/api/profiles/${ava}/theme`, { theme: 'passport' })).status, 200);
  assert.equal((await k.post(`/api/profiles/${ava}/ask`, { lesson_id: 'shakshuka' })).body.status, 'requested');
  // The family's names and avatars only, for a sibling, and whether it's an
  // adult or on Level 4, for a cook's safety banners (§12.8).
  const profiles = (await k.get('/api/profiles')).body.profiles;
  assert.deepEqual(Object.keys(profiles.find((p) => p.id === eli)).sort(), ['audience', 'avatar', 'id', 'level', 'name', 'people']);
  // A sibling's kitchen, and every parent route, even with the right PIN.
  for (const path of [`/api/profiles/${eli}/queue`, `/api/profiles/${eli}/cooks`, '/api/queue', '/api/family', '/api/courses', '/api/shopping', '/api/progress', '/api/owner', `/api/profiles/${ava}/login`]) {
    const r = await k.get(path);
    assert.equal(r.status, 403, path);
    assert.equal(r.body.message, 'Ask an adult.');
  }
  assert.equal((await k.post('/api/pin/unlock', { pin: '1234' })).status, 403);
  assert.equal((await k.post(`/api/profiles/${eli}/ask`, { lesson_id: 'shakshuka' })).status, 403);
  assert.equal((await k.put(`/api/profiles/${eli}/theme`, { theme: 'passport' })).status, 403);
  assert.equal((await k.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava] })).status, 403);
  assert.equal((await k.del(`/api/profiles/${eli}`)).status, 403);
  assert.equal((await k.post('/api/signup/start', { email: 'x@example.com', password: 'password123' })).status, 403);
});

test("a kid's cooks: one it's on, saved; one it isn't on, refused; its own reflection only", async () => {
  const { env, a, ava, eli } = await setup();
  await giveLogin(a, ava);
  const { k } = await kidDevice(env);
  const t = new Date().toISOString();
  const cook = { lesson_id: 'shakshuka', servings: 6, started_at: t, finished_at: t };
  assert.equal((await k.put('/api/attempts/aaaaaaaaaaaaaaa1', { ...cook, profile_ids: [eli] })).status, 403);
  // Cooking with a sibling saves for both.
  assert.equal((await k.put('/api/attempts/aaaaaaaaaaaaaaa2', { ...cook, profile_ids: [ava, eli] })).status, 200);
  assert.equal((await k.put('/api/attempts/aaaaaaaaaaaaaaa2/reflection', { profile_id: ava, rating: 5 })).status, 200);
  assert.equal((await k.put('/api/attempts/aaaaaaaaaaaaaaa2/reflection', { profile_id: eli, rating: 1 })).status, 403);
  // A cook made on the parent's device for the sibling alone isn't reachable.
  await a.put('/api/attempts/aaaaaaaaaaaaaaa3', { ...cook, finished_at: null, profile_ids: [eli] });
  assert.equal((await k.put('/api/attempts/aaaaaaaaaaaaaaa3', { ...cook, profile_ids: [ava] })).status, 403);
});

test('Ask an adult to start on a kid device: the PIN approves that one thing and unlocks nothing', async () => {
  const { env, a, ava } = await setup();
  const sunday = weekOf(new Date().toISOString().slice(0, 10));
  await a.post('/api/courses', { profile_ids: [ava], start_date: sunday, per_week: 1, plan: await samplePlan(a) });
  await giveLogin(a, ava);
  const { k } = await kidDevice(env);
  assert.equal((await k.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies', pin: '9999' })).status, 403);
  const ok = await k.post(`/api/profiles/${ava}/approve`, { lesson_id: 'brown-butter-cookies', pin: '1234' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.status, 'assigned');
  assert.equal((await k.get('/api/me')).body.pin_unlocked_until, null);
  assert.equal((await k.get('/api/queue')).status, 403);
});

test('logging in as one kind logs the other out on that device', async () => {
  const { env, a, ava } = await setup();
  await giveLogin(a, ava);
  const d = client(env);
  assert.equal((await d.post('/api/login', { email: 'jen@example.com', password: 'password123' })).status, 200);
  await d.post('/api/kid-login', { name: 'Ava C', picture: 'carrot', password: 'carrot1' });
  assert.equal((await d.get('/api/me')).body.kid.profile_id, ava);
  assert.equal(d.jar.has('cpr_session'), false);
  await d.post('/api/login', { email: 'jen@example.com', password: 'password123' });
  const me = (await d.get('/api/me')).body;
  assert.equal(me.kid, undefined);
  assert.equal(me.parent.email, 'jen@example.com');
  assert.equal((await a.get(`/api/profiles/${ava}/login`)).body.login.devices, 0);
});

test('what ends a kid session: log out, a new password, a new picture, log out everywhere, turning it off, adult, deleting', async () => {
  const { env, a, ava } = await setup();
  await giveLogin(a, ava);
  const signedOut = async (k) => (await k.get('/api/me')).body.signed_in === false;

  let { k } = await kidDevice(env);
  await k.post('/api/logout');
  assert.ok(await signedOut(k));

  ({ k } = await kidDevice(env));
  await a.put(`/api/profiles/${ava}/login`, { password: 'newpass1' });
  assert.ok(await signedOut(k), 'a new password');
  ({ k } = await kidDevice(env, 'Ava C', 'carrot', 'newpass1'));
  await a.put(`/api/profiles/${ava}/login`, { picture: 'apple' });
  assert.ok(await signedOut(k), 'a new picture');
  assert.equal((await kidDevice(env, 'Ava C', 'apple', 'newpass1')).res.status, 200, 'the password stays');

  ({ k } = await kidDevice(env, 'Ava C', 'apple', 'newpass1'));
  await a.post(`/api/profiles/${ava}/login/logout-all`);
  assert.ok(await signedOut(k), 'log out everywhere');

  ({ k } = await kidDevice(env, 'Ava C', 'apple', 'newpass1'));
  await a.del(`/api/profiles/${ava}/login`);
  assert.ok(await signedOut(k), 'turned off');
  assert.equal((await a.get(`/api/profiles/${ava}/login`)).body.login, null);
  assert.equal((await giveLogin(a, ava)).status, 200, 'and on again');

  ({ k } = await kidDevice(env));
  await a.put(`/api/profiles/${ava}`, { people: [{ name: 'Ava', color: 'tomato' }], audience: 'adult' });
  assert.ok(await signedOut(k), 'changed to adult');
  assert.equal((await a.get(`/api/profiles/${ava}/login`)).body.login, null);

  await a.put(`/api/profiles/${ava}`, { people: [{ name: 'Ava', color: 'tomato' }], audience: 'kid' });
  await giveLogin(a, ava);
  ({ k } = await kidDevice(env));
  assert.equal((await a.del(`/api/profiles/${ava}`)).status, 200);
  assert.ok(await signedOut(k), 'profile deleted');
});

test("a family's export has its kid logins (hashes only) and no kid sessions", async () => {
  const { env, a, ava } = await setup();
  await giveLogin(a, ava);
  await kidDevice(env);
  const { exportFamily } = await import('../src/worker/backup.js');
  const fid = (await env.DB.prepare('SELECT family_id FROM profiles WHERE id = ?').bind(ava).first()).family_id;
  const out = await exportFamily(env.DB, fid);
  assert.equal(out.tables.kid_logins.length, 1);
  assert.match(out.tables.kid_logins[0].password_hash, /\S/);
  assert.notEqual(out.tables.kid_logins[0].password_hash, 'carrot1');
  assert.equal(out.tables.kid_sessions, undefined);
});

test('a kid login lasts 14 days, and opening the app renews it', async () => {
  const { env, a, ava } = await setup();
  await giveLogin(a, ava);
  const { k, res } = await kidDevice(env);
  assert.match(res.headers.getSetCookie().find((c) => c.startsWith('cpr_kid=')), /Max-Age=1209600/);
  const age = (days) => env.DB.prepare('UPDATE kid_sessions SET last_seen = ? WHERE profile_id = ?').bind(new Date(Date.now() - days * 864e5).toISOString(), ava).run();
  // Opened on day 13: still logged in, and the 14 days start again.
  await age(13);
  const me = await k.get('/api/me');
  assert.equal(me.body.kid.profile_id, ava);
  assert.match(me.headers.getSetCookie().find((c) => c.startsWith('cpr_kid=')), /Max-Age=1209600/);
  const seen = (await env.DB.prepare('SELECT last_seen FROM kid_sessions WHERE profile_id = ?').bind(ava).first()).last_seen;
  assert.ok(Date.now() - Date.parse(seen) < 60000);
  // Not opened for more than 14 days: logged out.
  await age(15);
  assert.equal((await k.get('/api/me')).body.signed_in, false);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM kid_sessions').first()).n, 0);
});
