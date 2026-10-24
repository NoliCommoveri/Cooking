// Phase 11c: variations (plan §6.21). A parent picks the version of a lesson
// the family cooks; cooks and shopping lists use it, and a cook of any
// version counts as the lesson. All behind the next release (§8.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';

async function setup({ preview = true } = {}) {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  const fid = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  if (preview) await setPreview(env.DB, fid, true);
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  return { env, a, fid, ava };
}
const items = (x) => [...x.sections.flatMap((s) => s.items), ...(x.may_have ?? [])];
const cook = (a, id, ava, extra = {}) => a.put(`/api/attempts/${id}`, {
  lesson_id: 'chimichurri-steak', servings: 6, profile_ids: [ava], started_at: new Date(Date.now() - 3600e3).toISOString(), finished_at: new Date().toISOString(), ...extra,
});

test('a family without the next release can\'t pick a version, and cooks the lesson itself', async () => {
  const { env, a, ava } = await setup({ preview: false });
  assert.equal((await a.put('/api/variations/chimichurri-steak', { variation: 'chicken' })).status, 404);
  assert.deepEqual((await a.get('/api/me')).body.family.variations, {});
  assert.equal((await cook(a, '00000000000000a1', ava, { variation: 'chicken' })).status, 200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM attempt_variations').first()).n, 0);
});

test('picking a version: only one the lesson has, and the lesson itself is a choice', async () => {
  const { a } = await setup();
  assert.equal((await a.put('/api/variations/chimichurri-steak', { variation: 'tofu' })).status, 400);
  assert.equal((await a.put('/api/variations/mac-and-cheese', { variation: '' })).status, 404, 'a lesson with no other versions');
  const r = await a.put('/api/variations/chimichurri-steak', { variation: 'chicken' });
  assert.equal(r.body.title, 'Chimichurri chicken');
  assert.deepEqual((await a.get('/api/me')).body.family.variations, { 'chimichurri-steak': 'chicken' });
  await a.put('/api/variations/chimichurri-steak', { variation: '' });
  assert.deepEqual((await a.get('/api/me')).body.family.variations, { 'chimichurri-steak': '' });
});

test('a cook records its version and still counts as the lesson', async () => {
  const { env, a, ava } = await setup();
  assert.equal((await cook(a, '00000000000000a2', ava, { variation: 'chicken' })).status, 200);
  assert.equal((await env.DB.prepare('SELECT variation FROM attempt_variations WHERE attempt_id = ?').bind('00000000000000a2').first()).variation, 'chicken');
  const { cooks } = (await a.get(`/api/profiles/${ava}/cooks`)).body;
  assert.equal(cooks['chimichurri-steak'].times, 1);
  // An unknown version is a cook of the lesson itself, so a retry always lands.
  assert.equal((await cook(a, '00000000000000a3', ava, { variation: 'gone' })).status, 200);
  assert.equal(await env.DB.prepare('SELECT 1 FROM attempt_variations WHERE attempt_id = ?').bind('00000000000000a3').first(), null);
});

test('shopping buys for the chosen version, and a list keeps the version it was made for', async () => {
  const { a, ava } = await setup();
  await a.post('/api/queue', { lesson_id: 'chimichurri-steak', profile_ids: [ava], servings: 6 });
  await a.put('/api/variations/chimichurri-steak', { variation: 'chicken' });
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  assert.equal(p.lessons[0].title, 'Chimichurri chicken');
  assert.ok(items(p).some((x) => x.id === 'chicken-thigh'));
  assert.ok(!items(p).some((x) => x.id === 'beef-sirloin'));
  const { id } = (await a.post('/api/shopping/lists', { keys: [p.lessons[0].key] })).body;
  await a.put('/api/variations/chimichurri-steak', { variation: '' });
  const l = (await a.get(`/api/shopping/lists/${id}`)).body.list;
  assert.equal(l.lessons[0].title, 'Chimichurri chicken');
  assert.ok(items(l).some((x) => x.id === 'chicken-thigh'), 'still the version it was made for');
  const now = (await a.post('/api/shopping/preview', { count: 1 })).body;
  assert.ok(items(now).some((x) => x.id === 'beef-sirloin'), 'the next list uses the new pick');
});

test('choices go with the family, and are in Download our data', async () => {
  const { env, a, fid, ava } = await setup();
  await a.put('/api/variations/chimichurri-steak', { variation: 'chicken' });
  await cook(a, '00000000000000a4', ava, { variation: 'chicken' });
  const dl = (await a.get('/api/family/export')).body;
  assert.equal(dl.tables.variation_choices.length, 1);
  assert.equal(dl.tables.attempt_variations.length, 1);
  // Taking the profile away takes its cooks, and their version rows.
  await a.del(`/api/profiles/${ava}`);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM attempt_variations WHERE family_id = ?').bind(fid).first()).n, 0);
});
