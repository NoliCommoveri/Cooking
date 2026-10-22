// Fix requests and lesson patches (plan §6.11, Phase 2e). The plan's testing
// line: the hard block and food-safety checks reject a bad patch, and revert
// restores the lesson.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client, lastEmailTo } from './helpers/worker.js';

const L = 'shakshuka';

async function setup() {
  const env = await makeEnv();
  const jen = await family(env, 'Carsons', 'jen@example.com');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();
  const pat = await family(env, 'Smiths', 'pat@example.com');
  await pat.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  await pat.post('/api/profiles', { people: [{ name: 'Mom', color: 'plum' }], audience: 'adult' });
  // By name: profiles made in the same millisecond come back in id order.
  const { profiles } = (await pat.get('/api/profiles')).body;
  const kid = profiles.find((p) => p.name === 'Bea').id, adult = profiles.find((p) => p.name === 'Mom').id;
  return { env, jen, pat, kid, adult };
}
const suggest = (c, body) => c.post('/api/fix-requests', { lesson_id: L, kind: 'amount', note: 'Too many eggs for us.', ...body });
const live = async (c) => (await c.get('/api/patches')).body.lessons[L];
const firstOpen = async (jen) => (await jen.get('/api/owner/fixes')).body.open[0];

test('a parent suggests a fix, the owner applies it, every family sees it, and revert puts it back', async () => {
  const { env, jen, pat, kid } = await setup();
  const res = await suggest(pat, { profile_id: kid, field: 'ingredients.egg.amount', suggested_value: 5, servings: 6 });
  assert.equal(res.status, 200);
  const q = await firstOpen(jen);
  assert.equal(q.current, 6);
  assert.equal(q.suggested, 5);
  assert.equal(q.field_label, 'Amount');
  assert.ok(!JSON.stringify(q).includes('Smiths'), 'the owner sees no family');

  const applied = await jen.post(`/api/owner/fixes/${q.id}/apply`, { reply: 'Thanks!' });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.version, 2);
  // Every family, and the public demo, gets the patch.
  for (const c of [jen, pat, client(env)]) assert.deepEqual((await live(c)).patches, [{ path: 'ingredients.egg.amount', value: 5 }]);
  const mine = (await pat.get(`/api/lessons/${L}/fixes`)).body.fixes[0];
  assert.equal(mine.status, 'fixed');
  assert.equal(mine.owner_reply, 'Thanks!');

  const { patches } = (await jen.get('/api/owner/fixes')).body;
  assert.equal((await jen.post(`/api/owner/patches/${patches[0].id}/revert`)).status, 200);
  const after = await live(pat);
  assert.deepEqual(after.patches, [], 'the lesson is back the way it was');
  assert.equal(after.version, 3, 'a revert raises the version too');
  assert.equal((await firstOpen(jen)).id, q.id, 'the request is back in the queue, where Apply can put it live again');
});

test('a cook records the live version', async () => {
  const { env, jen, pat, kid } = await setup();
  await suggest(pat, { profile_id: kid, field: 'ingredients.egg.amount', suggested_value: 5 });
  await jen.post(`/api/owner/fixes/${(await firstOpen(jen)).id}/apply`, {});
  const t = new Date().toISOString();
  await pat.put('/api/attempts/00000000000000f1', { lesson_id: L, servings: 6, profile_ids: [kid], started_at: t });
  assert.equal((await env.DB.prepare("SELECT lesson_version FROM attempts WHERE id = '00000000000000f1'").first()).lesson_version, 2);
});

test('the hard block: a fix that names an unclean food never goes live, even edited by the owner', async () => {
  const { jen, pat, kid } = await setup();
  await suggest(pat, { profile_id: kid, kind: 'other', field: 'steps.serve.text', suggested_value: 'Turn off the heat and top with crumbled bacon.' });
  const q = await firstOpen(jen);
  const res = await jen.post(`/api/owner/fixes/${q.id}/apply`, {});
  assert.equal(res.status, 422);
  assert.match(res.body.problems.join(' '), /blocked food \("bacon"\)/);
  const edited = await jen.post(`/api/owner/fixes/${q.id}/apply`, { value: 'Top with a little shrimp.' });
  assert.equal(edited.status, 422);
  assert.equal(await live(pat), undefined, 'nothing went live');
});

test('food safety: a thermometer target can go up but never below the safe minimum', async () => {
  const { jen, pat, kid } = await setup();
  await suggest(pat, { profile_id: kid, kind: 'safety', field: 'steps.check-eggs.target.temp', suggested_value: 145 });
  let q = await firstOpen(jen);
  const low = await jen.post(`/api/owner/fixes/${q.id}/apply`, {});
  assert.equal(low.status, 422);
  assert.match(low.body.problems.join(' '), /can't go below 160°F/);
  assert.equal((await jen.post(`/api/owner/fixes/${q.id}/apply`, { value: 165 })).status, 200, 'the owner can raise it instead');
});

test("a fix keeps the lesson's other checks: a timer can't lose its length, and a unit must convert", async () => {
  const { jen, pat, kid } = await setup();
  await suggest(pat, { profile_id: kid, field: 'ingredients.olive-oil.unit', suggested_value: 'lb' });
  const res = await jen.post(`/api/owner/fixes/${(await firstOpen(jen)).id}/apply`, {});
  assert.equal(res.status, 422);
  assert.match(res.body.problems.join(' '), /no conversion/);
  assert.equal((await suggest(pat, { profile_id: kid, field: 'steps.check-eggs.text', suggested_value: '' })).status, 400);
});

test("only the fields a fix may change can be picked; adding an ingredient isn't one", async () => {
  const { pat, kid } = await setup();
  for (const field of ['ingredients.pork.amount', 'steps.nope.text', 'title', 'ingredients.egg.ingredient', 'steps.check-eggs.safety']) {
    assert.equal((await suggest(pat, { profile_id: kid, field, suggested_value: 'x' })).status, 400, field);
  }
  assert.equal((await suggest(pat, { profile_id: kid, field: 'ingredients.egg.amount', suggested_value: 6 })).status, 400, 'no change');
  assert.equal((await suggest(pat, { profile_id: kid, kind: 'other' })).status, 200, 'a report with no part picked is fine');
});

test('a kid profile needs the parent PIN to suggest a fix; an adult profile does not', async () => {
  const { pat, kid, adult } = await setup();
  await pat.post('/api/pin/lock');
  assert.equal((await suggest(pat, { profile_id: kid })).status, 403);
  assert.equal((await suggest(pat, {})).status, 403);
  assert.equal((await suggest(pat, { profile_id: adult })).status, 200);
});

test('safety and unclean reports email the owner right away', async () => {
  const { pat, adult } = await setup();
  await suggest(pat, { profile_id: adult, kind: 'unclean', note: 'The feta we found has pork rennet?' });
  const mail = lastEmailTo('jen@example.com');
  assert.match(mail.subject, /Unclean ingredient: Shakshuka/);
  assert.match(mail.text, /pork rennet/);
});

test("decline, then reopen; families see only their own fixes; others can't use owner routes", async () => {
  const { jen, pat, kid } = await setup();
  await suggest(pat, { profile_id: kid });
  const q = await firstOpen(jen);
  assert.equal((await jen.post(`/api/owner/fixes/${q.id}/close`, { status: 'needs_content_change', reply: 'Needs a new step.' })).status, 200);
  assert.equal((await pat.get(`/api/lessons/${L}/fixes`)).body.fixes[0].status, 'needs_content_change');
  assert.deepEqual((await jen.get(`/api/lessons/${L}/fixes`)).body.fixes, [], "the owner's own family has none");
  assert.equal((await jen.post(`/api/owner/fixes/${q.id}/reopen`)).status, 200);
  assert.equal((await firstOpen(jen)).id, q.id);
  for (const p of [`/api/owner/fixes/${q.id}/apply`, `/api/owner/fixes/${q.id}/close`, `/api/owner/fixes/${q.id}/reopen`]) {
    assert.equal((await pat.post(p, { status: 'declined' })).status, 403, p);
  }
  assert.equal((await pat.get('/api/owner/fixes')).status, 403);
});

test('a later fix to the same part has to be reverted first', async () => {
  const { jen, pat, kid } = await setup();
  for (const v of [5, 4]) {
    await suggest(pat, { profile_id: kid, field: 'ingredients.egg.amount', suggested_value: v });
    await jen.post(`/api/owner/fixes/${(await firstOpen(jen)).id}/apply`, {});
  }
  const [newer, older] = (await jen.get('/api/owner/fixes')).body.patches;
  assert.equal(older.can_revert, false);
  assert.equal((await jen.post(`/api/owner/patches/${older.id}/revert`)).status, 409);
  assert.equal((await jen.post(`/api/owner/patches/${newer.id}/revert`)).status, 200);
  assert.deepEqual((await live(pat)).patches, [{ path: 'ingredients.egg.amount', value: 5 }]);
});

test('a patched total time shows in the library', async () => {
  const { jen, pat, kid } = await setup();
  await suggest(pat, { profile_id: kid, field: 'totalMinutes', suggested_value: 45 });
  await jen.post(`/api/owner/fixes/${(await firstOpen(jen)).id}/apply`, {});
  assert.equal((await pat.get('/api/library')).body.lessons.find((x) => x.id === L).totalMinutes, 45);
});
