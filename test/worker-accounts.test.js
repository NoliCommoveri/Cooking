// Sign-up, login, password reset, the parent PIN, and the owner screens (plan §8.3, §6.2a).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, client, family } from './helpers/worker.js';
import { newInvite } from '../src/worker/api.js';

const signup = (c, extra) => c.post('/api/signup', { family_name: 'Test', email: 'a@example.com', password: 'password123', ...extra });

test('a sign-up code works once', async () => {
  const env = await makeEnv();
  const code = await newInvite(env, 'test');
  assert.equal((await signup(client(env), { code })).status, 200);
  const again = await signup(client(env), { code, email: 'b@example.com' });
  assert.equal(again.status, 403);
  assert.equal(again.body.error, 'bad_code');
});

test('codes are accepted without the dash and in lower case', async () => {
  const env = await makeEnv();
  const code = await newInvite(env, 'test');
  assert.equal((await signup(client(env), { code: code.replace('-', '').toLowerCase() })).status, 200);
});

test('a revoked code is refused', async () => {
  const env = await makeEnv();
  const code = await newInvite(env, 'test');
  await env.DB.prepare('UPDATE invites SET revoked = 1 WHERE code = ?').bind(code).run();
  assert.equal((await signup(client(env), { code })).status, 403);
});

test('a failed sign-up gives its code back', async () => {
  const env = await makeEnv();
  await family(env, 'First', 'a@example.com');
  const code = await newInvite(env, 'test');
  assert.equal((await signup(client(env), { code })).status, 409); // email taken
  assert.equal((await signup(client(env), { code, email: 'new@example.com' })).status, 200);
});

test('the sign-up keyword works when set, and not when off', async () => {
  const env = await makeEnv();
  assert.equal((await signup(client(env), { keyword: 'basil' })).status, 403);
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('signup_keyword', 'Basil')").run();
  assert.equal((await signup(client(env), { keyword: ' basil ' })).status, 200);
});

test('sign-up needs a code or keyword', async () => {
  const env = await makeEnv();
  assert.equal((await signup(client(env), {})).status, 400);
});

test('login, me, and logout', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  const c = client(env);
  assert.equal((await c.get('/api/me')).body.signed_in, false);
  assert.equal((await c.post('/api/login', { email: 'jen@example.com', password: 'wrong-password' })).status, 401);
  assert.equal((await c.post('/api/login', { email: 'JEN@example.com', password: 'password123' })).status, 200);
  const me = (await c.get('/api/me')).body;
  assert.equal(me.family.name, 'Carsons');
  assert.equal(me.family.pin_set, true);
  assert.equal(me.pin_unlocked_until, null);
  await c.post('/api/logout');
  assert.equal((await c.get('/api/me')).body.signed_in, false);
});

test('a session cookie is httpOnly, Secure, and long-lived', async () => {
  const env = await makeEnv();
  const code = await newInvite(env, 'test');
  const res = await signup(client(env), { code });
  const cookie = res.headers.getSetCookie()[0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /Max-Age=34560000/);
  // The database keeps a hash, not the token.
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(await env.DB.prepare('SELECT 1 FROM sessions WHERE id = ?').bind(token).first(), null);
});

test('API writes must be JSON', async () => {
  const env = await makeEnv();
  const c = client(env);
  assert.equal((await c.form('/api/login', { email: 'a@example.com', password: 'x' })).status, 415);
});

test('password reset: email link, one use, logs out other devices', async () => {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }); };
  try {
    const env = await makeEnv({ RESEND_API_KEY: 'k', MAIL_FROM: 'Cook <c@example.com>' });
    const first = await family(env, 'Carsons', 'jen@example.com');

    const anon = client(env);
    assert.deepEqual((await anon.post('/api/password/forgot', { email: 'nobody@example.com' })).body, { ok: true });
    assert.equal(sent.length, 0);
    await anon.post('/api/password/forgot', { email: 'jen@example.com' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://api.resend.com/emails');
    assert.deepEqual(sent[0].body.to, ['jen@example.com']);
    const token = sent[0].body.text.match(/#\/reset\/([0-9a-f]{64})/)[1];

    assert.equal((await anon.post('/api/password/reset', { token, password: 'short' })).status, 400);
    assert.equal((await anon.post('/api/password/reset', { token, password: 'new-password' })).status, 200);
    assert.equal((await anon.get('/api/me')).body.signed_in, true);
    assert.equal((await first.get('/api/me')).body.signed_in, false, 'the old session is gone');
    assert.equal((await client(env).post('/api/password/reset', { token, password: 'another-one' })).status, 400, 'one use');
    assert.equal((await client(env).post('/api/login', { email: 'jen@example.com', password: 'new-password' })).status, 200);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('an expired reset link is refused', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  const { sha256Hex } = await import('../src/worker/lib/crypto.js');
  const p = await env.DB.prepare('SELECT id, family_id FROM parents').first();
  await env.DB.prepare('INSERT INTO password_resets (token_hash, family_id, parent_id, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex('a'.repeat(64)), p.family_id, p.id, new Date(Date.now() - 1000).toISOString()).run();
  assert.equal((await client(env).post('/api/password/reset', { token: 'a'.repeat(64), password: 'new-password' })).status, 400);
});

test('the parent PIN gates parent screens and can be reset with the password', async () => {
  const env = await makeEnv();
  const c = await family(env, 'Carsons', 'jen@example.com', { pin: null });
  assert.equal((await c.get('/api/family')).status, 403);
  assert.equal((await c.post('/api/pin/unlock', { pin: '1234' })).body.error, 'pin_not_set');
  assert.equal((await c.post('/api/pin/set', { pin: '12' })).status, 400);
  assert.equal((await c.post('/api/pin/set', { pin: '2468' })).status, 200);
  assert.equal((await c.post('/api/pin/set', { pin: '1111' })).status, 409, 'set only once');
  assert.equal((await c.get('/api/family')).status, 200, 'setting it unlocks');

  await c.post('/api/pin/lock');
  assert.equal((await c.get('/api/family')).body.error, 'pin_required');
  assert.equal((await c.post('/api/pin/unlock', { pin: '1111' })).body.error, 'pin_wrong');
  assert.equal((await c.post('/api/pin/unlock', { pin: '2468' })).status, 200);
  assert.equal((await c.get('/api/family')).status, 200);

  await c.post('/api/pin/lock');
  assert.equal((await c.post('/api/pin/reset', { password: 'nope-nope', pin: '9999' })).status, 403);
  assert.equal((await c.post('/api/pin/reset', { password: 'password123', pin: '9999' })).status, 200);
  await c.post('/api/pin/lock');
  assert.equal((await c.post('/api/pin/unlock', { pin: '9999' })).status, 200);
});

test('the unlock wears off', async () => {
  const env = await makeEnv();
  const c = await family(env, 'Carsons', 'jen@example.com');
  await env.DB.prepare('UPDATE sessions SET pin_until = ?').bind(new Date(Date.now() - 1000).toISOString()).run();
  assert.equal((await c.get('/api/family')).body.error, 'pin_required');
});

test('family settings save, and reject bad values', async () => {
  const env = await makeEnv();
  const c = await family(env, 'Carsons', 'jen@example.com');
  assert.equal((await c.put('/api/family', { name: 'The Carsons', default_servings: 4, diet_filters: ['dairy'] })).status, 200);
  const f = (await c.get('/api/family')).body;
  assert.deepEqual(f.family, { name: 'The Carsons', default_servings: 4, diet_filters: ['dairy'], pin_set: true });
  assert.deepEqual(f.parents, ['jen@example.com']);
  assert.equal((await c.put('/api/family', { name: 'X', default_servings: 40, diet_filters: [] })).status, 400);
  assert.equal((await c.put('/api/family', { name: 'X', default_servings: 4, diet_filters: ['pork'] })).status, 400);
});

test('a second parent login for the same family', async () => {
  const env = await makeEnv();
  const c = await family(env, 'Carsons', 'jen@example.com');
  assert.equal((await c.post('/api/parents', { email: 'sam@example.com', password: 'password456' })).status, 200);
  assert.equal((await c.post('/api/parents', { email: 'sam@example.com', password: 'password456' })).status, 409);
  const sam = client(env);
  await sam.post('/api/login', { email: 'sam@example.com', password: 'password456' });
  assert.equal((await sam.get('/api/me')).body.family.name, 'Carsons');
});

test('profiles: add, edit, theme switch without the PIN, delete', async () => {
  const env = await makeEnv();
  const c = await family(env, 'Carsons', 'jen@example.com');
  const made = await c.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }, { name: 'Leo', color: 'sky' }], theme: 'quest', audience: 'kid' });
  assert.equal(made.status, 200);
  let list = (await c.get('/api/profiles')).body.profiles;
  assert.equal(list[0].name, 'Ava & Leo');
  assert.equal(list[0].people.length, 2);
  assert.equal(list[0].track, 'core');

  await c.post('/api/pin/lock');
  assert.equal((await c.post('/api/profiles', { people: [{ name: 'Mom', color: 'basil' }] })).status, 403);
  assert.equal((await c.put(`/api/profiles/${made.body.id}/theme`, { theme: 'passport' })).status, 200);
  assert.equal((await c.put(`/api/profiles/${made.body.id}/theme`, { theme: 'foodtruck' })).status, 400);
  assert.equal((await c.get('/api/profiles')).body.profiles[0].theme, 'passport');

  await c.post('/api/pin/unlock', { pin: '1234' });
  assert.equal((await c.put(`/api/profiles/${made.body.id}`, { name: 'Twins', people: [{ name: 'Ava', color: 'tomato' }], theme: 'quest', audience: 'kid' })).status, 200);
  assert.equal((await c.post('/api/profiles', { people: [{ name: 'Mom', color: 'purple' }] })).status, 400);
  assert.equal((await c.post('/api/profiles', { people: [] })).status, 400);
  list = (await c.get('/api/profiles')).body.profiles;
  assert.equal(list[0].name, 'Twins');
  assert.equal((await c.del(`/api/profiles/${made.body.id}`)).status, 200);
  assert.equal((await c.get('/api/profiles')).body.profiles.length, 0);
});

test('a sign-up request: one pending per email, the owner approves or declines', async () => {
  const env = await makeEnv();
  const owner = await family(env, 'Carsons', 'jen@example.com');
  const anon = client(env);
  assert.equal((await anon.post('/api/signup-requests', { name: 'Pat', email: 'pat@example.com', note: 'From church' })).status, 200);
  assert.equal((await anon.post('/api/signup-requests', { name: 'Pat', email: 'pat@example.com' })).body.already, true);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM signup_requests').first()).n, 1);

  assert.equal((await owner.get('/api/owner')).body.error, 'not_owner');
  await env.DB.prepare('UPDATE parents SET is_owner = 1').run();
  const view = (await owner.get('/api/owner')).body;
  assert.equal(view.requests[0].name, 'Pat');
  assert.equal(view.email_ready, false);

  const ok = (await owner.post(`/api/owner/requests/${view.requests[0].id}/approve`)).body;
  assert.match(ok.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(ok.emailed, false, 'no email key: the owner passes the code on by hand');
  assert.equal((await signup(client(env), { code: ok.code, email: 'pat@example.com' })).status, 200);

  await anon.post('/api/signup-requests', { name: 'Sam', email: 'sam@example.com' });
  const sam = (await owner.get('/api/owner')).body.requests.find((r) => r.name === 'Sam');
  await owner.post(`/api/owner/requests/${sam.id}/decline`);
  assert.equal((await owner.get('/api/owner')).body.requests.find((r) => r.name === 'Sam').status, 'declined');
  assert.equal((await anon.post('/api/signup-requests', { name: 'Sam', email: 'sam@example.com' })).body.already, undefined, 'can ask again after a decline');
});

test('the owner makes and revokes codes, sets the keyword, and resets a password', async () => {
  const env = await makeEnv();
  const owner = await family(env, 'Carsons', 'jen@example.com');
  await family(env, 'Smiths', 'pat@example.com');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();

  const { code } = (await owner.post('/api/owner/invites', {})).body;
  await owner.post(`/api/owner/invites/${code}/revoke`);
  assert.equal((await signup(client(env), { code, email: 'x@example.com' })).status, 403);

  assert.equal((await owner.put('/api/owner/keyword', { keyword: 'Basil' })).body.keyword, 'Basil');
  assert.equal((await signup(client(env), { keyword: 'basil', email: 'y@example.com' })).status, 200);
  assert.equal((await owner.put('/api/owner/keyword', { keyword: '' })).body.keyword, null);
  assert.equal((await signup(client(env), { keyword: 'basil', email: 'z@example.com' })).status, 403);

  assert.equal((await owner.post('/api/owner/parent-password', { email: 'pat@example.com', password: 'fresh-password' })).status, 200);
  assert.equal((await client(env).post('/api/login', { email: 'pat@example.com', password: 'fresh-password' })).status, 200);
});

test('the owner\'s family list holds names, counts, and dates only', async () => {
  const env = await makeEnv();
  const owner = await family(env, 'Carsons', 'jen@example.com');
  const smiths = await family(env, 'Smiths', 'pat@example.com');
  await smiths.post('/api/profiles', { people: [{ name: 'Secret Kid', color: 'tomato' }] });
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();
  const { families } = (await owner.get('/api/owner')).body;
  const s = families.find((f) => f.name === 'Smiths');
  assert.deepEqual(Object.keys(s).sort(), ['created_at', 'last_active_at', 'name', 'profiles']);
  assert.equal(s.profiles, 1);
  assert.doesNotMatch(JSON.stringify(families), /Secret Kid|pat@example/);
});
