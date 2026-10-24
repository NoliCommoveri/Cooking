// Phase 11d1: default picks (plan §6.21). The best version for the people
// cooking plays when the family hasn't picked one, and a new course keeps the
// best dish of each pick-one group. All behind the next release (§8.6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';

async function setup({ preview = true } = {}) {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Ben', color: 'sky' }] });
  const fid = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  if (preview) await setPreview(env.DB, fid, true);
  const [ava, ben] = (await a.get('/api/profiles')).body.profiles.map((p) => p.id);
  return { env, a, ava, ben };
}
const rate = (a, pid, kind, item, stars) => a.put(`/api/profiles/${pid}/ratings`, { kind, item, stars });
const queueRow = async (a, lid) => (await a.get('/api/queue')).body.queued.find((x) => x.lesson_id === lid);
const items = (x) => [...x.sections.flatMap((s) => s.items), ...(x.may_have ?? [])];
const start = '2026-11-01';

test('the best version for whoever is cooking plays, until the family picks one', async () => {
  const { a, ava, ben } = await setup();
  await rate(a, ava, 'protein', 'beef', 1);
  await rate(a, ava, 'protein', 'chicken', 4);
  await a.post('/api/queue', { lesson_id: 'chimichurri-steak', profile_ids: [ava], servings: 6 });
  let row = await queueRow(a, 'chimichurri-steak');
  assert.equal(row.version.id, 'chicken');
  assert.equal(row.version.saved, false);
  assert.deepEqual(row.version.best_for, ['Ava']);
  assert.equal(row.version.options[0].label, 'Great fit');
  assert.deepEqual(row.version.options[0].why, ['Ava loves chicken']);
  assert.equal(row.version.options[1].label, "Doesn't fit");
  // The kitchen plays it, and shopping buys for it.
  assert.equal((await a.get(`/api/profiles/${ava}/queue`)).body.versions['chimichurri-steak'], 'chicken');
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  assert.equal(p.lessons[0].title, 'Chimichurri chicken');
  assert.ok(items(p).some((x) => x.id === 'chicken-thigh'));
  // Ben, not on the cook, is scored only in his own kitchen.
  await rate(a, ben, 'protein', 'beef', 5);
  assert.equal((await a.get(`/api/profiles/${ben}/queue`)).body.versions['chimichurri-steak'], '');
  // The family's pick wins; null takes it off again.
  await a.put('/api/variations/chimichurri-steak', { variation: '' });
  row = await queueRow(a, 'chimichurri-steak');
  assert.equal(row.version.id, '');
  assert.equal(row.version.saved, true);
  await a.put('/api/variations/chimichurri-steak', { variation: null });
  assert.equal((await queueRow(a, 'chimichurri-steak')).version.id, 'chicken');
  assert.deepEqual((await a.get('/api/me')).body.family.variations, {});
});

test('a family without the next release gets the lesson itself and no version info', async () => {
  const { a, ava } = await setup({ preview: false });
  await a.post('/api/queue', { lesson_id: 'chimichurri-steak', profile_ids: [ava], servings: 6 });
  assert.equal((await queueRow(a, 'chimichurri-steak')).version, null);
  assert.deepEqual((await a.get(`/api/profiles/${ava}/queue`)).body.versions, {});
  assert.equal((await a.get('/api/picks/course')).status, 404);
});

test('a new course keeps the best dish of each pick-one group; nothing is dropped', async () => {
  const { a, ava } = await setup();
  await rate(a, ava, 'protein', 'salmon', 5);
  await rate(a, ava, 'protein', 'chicken', 1);
  const fits = (await a.get(`/api/picks/course?profiles=${ava}`)).body;
  assert.equal(fits.picks['pick:reducing'], 'pineapple-teriyaki-salmon');
  assert.equal(fits.dishes['pineapple-teriyaki-salmon'].fit, 'great');
  // Both dressings dishes are chicken: the closest stays, with a note.
  assert.match(fits.notes['pick:dressings'], /^Nothing for .* fits everyone yet; this one is closest\.$/);
  assert.equal(fits.picks['pick:julienne'], 'chicken-fajitas', 'fajitas has beef and bean versions');
  assert.equal(fits.dishes['chicken-fajitas'].version_title, 'Steak fajitas');
  // Chef Ruth sends no plan: the server picks.
  assert.equal((await a.post('/api/courses', { start_date: start, per_week: 1, profile_ids: [ava] })).status, 200);
  const plan = (await a.get('/api/courses')).body.courses[0].plan;
  const kept = (id) => !plan.find((x) => x.id === id).removed;
  assert.ok(kept('pineapple-teriyaki-salmon') && !kept('chicken-adobo') && !kept('chicken-piccata'));
  assert.ok(kept('chicken-caesar'), 'a skill is never skipped');
  assert.ok(plan.filter((x) => !x.removed).length >= 59);
});

test('without the next release a new course keeps the first dish of each group', async () => {
  const { a, ava } = await setup({ preview: false });
  await a.post('/api/courses', { start_date: start, per_week: 1, profile_ids: [ava] });
  const plan = (await a.get('/api/courses')).body.courses[0].plan;
  assert.ok(!plan.find((x) => x.id === 'chicken-adobo').removed);
  assert.ok(plan.find((x) => x.id === 'pineapple-teriyaki-salmon').removed);
});
