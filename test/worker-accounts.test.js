// Sign-up, login, password reset, the parent PIN, and the owner screens (plan §8.3, §6.2a).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, client, family, codeFor, lastEmailTo, outbox } from './helpers/worker.js';

const start = (c, extra) => c.post('/api/signup/start', { email: 'a@example.com', password: 'password123', ...extra });
const verify = (c, code, addr = 'a@example.com') => c.post('/api/signup/verify', { email: addr, code });
const ago = (min) => new Date(Date.now() - min * 60 * 1000).toISOString();

test('sign-up: email and password, then the emailed code', async () => {
  const env = await makeEnv();
  const c = client(env);
  const res = await start(c);
  assert.equal(res.status, 200);
  const mail = lastEmailTo('a@example.com');
  assert.match(mail.subject, /^\d{6} is your Clean Plate Recipes code$/);
  assert.ok(Date.parse(res.body.resend_at) - Date.now() > 9 * 60 * 1000, 'a new code waits about ten minutes');
  assert.equal((await c.get('/api/me')).body.signed_in, false, 'no account until the code is entered');
  assert.equal((await verify(c, codeFor('a@example.com'))).status, 200);
  const me = (await c.get('/api/me')).body;
  assert.equal(me.signed_in, true);
  assert.equal(me.family.pin_set, false, 'the first run comes next');
  assert.equal(me.family.name, '');
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM signup_verifications').first()).n, 0);
  assert.equal((await client(env).post('/api/login', { email: 'a@example.com', password: 'password123' })).status, 200);
});

test('a wrong code counts down its tries, then stops working', async () => {
  const env = await makeEnv();
  const c = client(env);
  await start(c);
  const good = codeFor('a@example.com');
  const bad = good === '000000' ? '111111' : '000000';
  const first = await verify(c, bad);
  assert.equal(first.status, 400);
  assert.match(first.body.message, /4 tries left/);
  for (let i = 0; i < 4; i++) await verify(c, bad);
  assert.equal((await verify(c, good)).body.error, 'code_used_up');
  // A used-up code can be replaced straight away, without the ten-minute wait.
  assert.equal((await c.post('/api/signup/resend', { email: 'a@example.com' })).status, 200);
  assert.equal((await verify(c, codeFor('a@example.com'))).status, 200);
});

test('an expired code is refused', async () => {
  const env = await makeEnv();
  const c = client(env);
  await start(c);
  await env.DB.prepare('UPDATE signup_verifications SET expires_at = ?').bind(ago(1)).run();
  assert.equal((await verify(c, codeFor('a@example.com'))).body.error, 'code_expired');
});

test('a new code waits ten minutes, then replaces the old one', async () => {
  const env = await makeEnv();
  const c = client(env);
  await start(c);
  const before = outbox.length;
  assert.equal((await c.post('/api/signup/resend', { email: 'a@example.com' })).status, 429);
  assert.equal((await start(c)).status, 200, 'pressing Sign up again is fine');
  assert.equal(outbox.length, before, '…but sends nothing inside the wait');
  const old = codeFor('a@example.com');
  await env.DB.prepare('UPDATE signup_verifications SET sent_at = ?').bind(ago(11)).run();
  assert.equal((await c.post('/api/signup/resend', { email: 'a@example.com' })).status, 200);
  const fresh = codeFor('a@example.com');
  if (fresh !== old) assert.equal((await verify(c, old)).status, 400, 'the old code stops working');
  assert.equal((await verify(c, fresh)).status, 200);
});

test('sign-up again inside the wait keeps the newest password', async () => {
  const env = await makeEnv();
  const c = client(env);
  await start(c);
  await start(c, { password: 'second-password' });
  await verify(c, codeFor('a@example.com'));
  assert.equal((await client(env).post('/api/login', { email: 'a@example.com', password: 'second-password' })).status, 200);
});

test('sign-up refuses a taken email, a short password, and a bad address', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'a@example.com');
  assert.equal((await start(client(env))).body.error, 'email_taken');
  assert.equal((await start(client(env), { email: 'b@example.com', password: 'short' })).status, 400);
  assert.equal((await start(client(env), { email: 'not-an-email' })).status, 400);
  assert.equal((await client(env).post('/api/signup/resend', { email: 'nobody@example.com' })).body.error, 'start_again');
});

test('the beta word, when set, is asked for first', async () => {
  const env = await makeEnv();
  assert.equal((await client(env).get('/api/signup')).body.beta_word, false);
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('beta_word', 'Sabbath')").run();
  assert.equal((await client(env).get('/api/signup')).body.beta_word, true, 'says a word is needed, not what it is');
  assert.doesNotMatch(JSON.stringify((await client(env).get('/api/signup')).body), /Sabbath/);
  const before = outbox.length;
  assert.equal((await start(client(env))).body.error, 'bad_beta_word');
  assert.equal((await start(client(env), { beta_word: 'nope' })).status, 403);
  assert.equal(outbox.length, before, 'no email without the word');
  assert.equal((await start(client(env), { beta_word: ' sabbath ' })).status, 200);
});

test('without email set up, sign-up says so and stores nothing', async () => {
  const env = await makeEnv({ RESEND_API_KEY: undefined });
  const res = await start(client(env));
  assert.equal(res.status, 503);
  assert.equal(res.body.error, 'email_failed');
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM signup_verifications').first()).n, 0);
});

test('the first run sets the family name and PIN together', async () => {
  const env = await makeEnv();
  const c = await family(env, 'unused', 'a@example.com', { pin: null });
  assert.equal((await c.post('/api/pin/set', { pin: '1234' })).status, 400, 'needs a family name');
  assert.equal((await c.post('/api/pin/set', { family_name: 'The Carsons', pin: '1234' })).status, 200);
  assert.equal((await c.get('/api/me')).body.family.name, 'The Carsons');
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
  const c = client(env);
  await start(c);
  const res = await verify(c, codeFor('a@example.com'));
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
  const env = await makeEnv();
  const first = await family(env, 'Carsons', 'jen@example.com');
  const anon = client(env);
  const before = outbox.length;
  assert.deepEqual((await anon.post('/api/password/forgot', { email: 'nobody@example.com' })).body, { ok: true });
  assert.equal(outbox.length, before, 'no account, no email, same answer');
  await anon.post('/api/password/forgot', { email: 'jen@example.com' });
  const token = lastEmailTo('jen@example.com').text.match(/#\/reset\/([0-9a-f]{64})/)[1];

  assert.equal((await anon.post('/api/password/reset', { token, password: 'short' })).status, 400);
  assert.equal((await anon.post('/api/password/reset', { token, password: 'new-password' })).status, 200);
  assert.equal((await anon.get('/api/me')).body.signed_in, true);
  assert.equal((await first.get('/api/me')).body.signed_in, false, 'the old session is gone');
  assert.equal((await client(env).post('/api/password/reset', { token, password: 'another-one' })).status, 400, 'one use');
  assert.equal((await client(env).post('/api/login', { email: 'jen@example.com', password: 'new-password' })).status, 200);
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
  assert.equal((await c.post('/api/pin/set', { family_name: 'Carsons', pin: '12' })).status, 400);
  assert.equal((await c.post('/api/pin/set', { family_name: 'Carsons', pin: '2468' })).status, 200);
  assert.equal((await c.post('/api/pin/set', { family_name: 'Carsons', pin: '1111' })).status, 409, 'set only once');
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
  assert.deepEqual(f.family, { name: 'The Carsons', default_servings: 4, diet_filters: ['dairy'], pin_set: true, voice_enabled: false, mode: 'casual', plan_weeks: false, photos_enabled: false, setup_needed: true, setup_step: null });
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

test('the owner sets and clears the beta word, and resets a password', async () => {
  const env = await makeEnv();
  const owner = await family(env, 'Carsons', 'jen@example.com');
  await family(env, 'Smiths', 'pat@example.com');
  assert.equal((await owner.get('/api/owner')).body.error, 'not_owner');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();

  assert.equal((await owner.put('/api/owner/beta-word', { beta_word: 'Sabbath' })).body.beta_word, 'Sabbath');
  assert.equal((await owner.get('/api/owner')).body.beta_word, 'Sabbath');
  assert.equal((await start(client(env), { email: 'y@example.com' })).status, 403);
  assert.equal((await start(client(env), { email: 'y@example.com', beta_word: 'sabbath' })).status, 200);
  assert.equal((await owner.get('/api/owner')).body.waiting, 1, 'one sign-up waiting on its code');
  assert.equal((await owner.put('/api/owner/beta-word', { beta_word: '' })).body.beta_word, null);
  assert.equal((await start(client(env), { email: 'z@example.com' })).status, 200, 'open again');

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
