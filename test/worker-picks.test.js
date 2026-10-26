// Phase 11d1: default picks (plan §6.21). The best version for the people
// cooking plays when the family hasn't picked one, and a new course keeps the
// best dish of each pick-one group. Every family has them; the release switch
// gates only the Levels (§8.6).
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
  // By name: two profiles made in the same millisecond can list either way.
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, ben] = ['Ava', 'Ben'].map((n) => profiles.find((p) => p.name === n).id);
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

test('a family without the preview gets versions and picks too: they are Cook Around the World', async () => {
  const { a, ava } = await setup({ preview: false });
  await rate(a, ava, 'protein', 'beef', 1);
  await a.post('/api/queue', { lesson_id: 'chimichurri-steak', profile_ids: [ava], servings: 6 });
  assert.equal((await queueRow(a, 'chimichurri-steak')).version.id, 'chicken');
  assert.equal((await a.get(`/api/profiles/${ava}/queue`)).body.versions['chimichurri-steak'], 'chicken');
  assert.equal((await a.get('/api/picks/course')).status, 200);
});

test('a new course keeps the best dish of each pick-one group; nothing is dropped', async () => {
  const { a, ava } = await setup();
  await rate(a, ava, 'protein', 'salmon', 5);
  await rate(a, ava, 'protein', 'chicken', 1);
  await rate(a, ava, 'protein', 'beans-lentils', 1);
  const fits = (await a.get(`/api/picks/course?profiles=${ava}`)).body;
  assert.equal(fits.picks['pick:reducing'], 'pineapple-teriyaki-salmon');
  assert.equal(fits.dishes['pineapple-teriyaki-salmon'].fit, 'great');
  // The dressings dishes are chicken and chickpeas: the closest stays, with a note.
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

test('with nothing rated, a new course keeps the first dish of each group', async () => {
  const { a, ava } = await setup({ preview: false });
  await a.post('/api/courses', { start_date: start, per_week: 1, profile_ids: [ava] });
  const plan = (await a.get('/api/courses')).body.courses[0].plan;
  assert.ok(!plan.find((x) => x.id === 'chicken-adobo').removed);
  assert.ok(plan.find((x) => x.id === 'pineapple-teriyaki-salmon').removed);
});

// ---------- 11d2: Add a lesson, Swap, Chef Ruth, and hated extras ----------

test('the library, best first for whoever is cooking, with cooked and queued marked', async () => {
  const { a, ava } = await setup();
  await rate(a, ava, 'protein', 'salmon', 5);
  await rate(a, ava, 'protein', 'chicken', 1);
  await a.post('/api/queue', { lesson_id: 'pineapple-teriyaki-salmon', profile_ids: [ava], servings: 4 });
  const { lessons } = (await a.get(`/api/picks/lessons?profiles=${ava}`)).body;
  assert.equal(lessons[0].why[0], 'Ava loves salmon');
  assert.equal(lessons.find((x) => x.id === 'pineapple-teriyaki-salmon').queued, true);
  // Honey-garlic chicken has salmon and tofu versions, so it fits.
  assert.equal(lessons.find((x) => x.id === 'honey-garlic-chicken').fits, true);
  // Nothing is dropped: a lesson that doesn't fit is last, not gone.
  const last = lessons.at(-1);
  assert.equal(last.fits, false);
  assert.match(last.notes[0], /^Ava: 1 star on chicken$/);
  assert.ok(!lessons.some((x) => x.id === 'unleavened-flatbread'), 'Appointed Times lessons are for Swap');
});

test('an optional ingredient someone on the cook hates is left out of the lesson and the shopping', async () => {
  const { a, ava, ben } = await setup();
  await rate(a, ava, 'ingredient', 'cilantro', 1);
  await a.post('/api/queue', { lesson_id: 'chicken-fajitas', profile_ids: [ava], servings: 4 });
  const mine = (await a.get(`/api/profiles/${ava}/queue`)).body;
  assert.deepEqual(mine.leave_out['chicken-fajitas'], [{ ingredient: 'cilantro', name: 'Fresh cilantro', who: ['Ava'] }]);
  assert.equal((await a.get(`/api/profiles/${ben}/queue`)).body.leave_out['chicken-fajitas'], undefined, "Ben's kitchen keeps it");
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  assert.equal(p.lessons[0].title, 'Chicken fajitas', 'the lesson itself keeps its title');
  assert.equal(p.lessons[0].left_out[0].ingredient, 'cilantro');
  assert.ok(!items(p).some((x) => x.id === 'cilantro'));
  assert.ok(items(p).some((x) => x.id === 'avocado'), 'the other optional ones stay');
  // A saved list leaves it out for whoever is on the cook.
  const { id } = (await a.post('/api/shopping/lists', { keys: [p.lessons[0].key] })).body;
  const l = (await a.get(`/api/shopping/lists/${id}`)).body.list;
  assert.equal(l.lessons[0].left_out[0].name, 'Fresh cilantro');
  assert.ok(!items(l).some((x) => x.id === 'cilantro'));
});

test('a required ingredient is never left out, only ranked', async () => {
  const { a, ava } = await setup();
  await rate(a, ava, 'ingredient', 'garlic', 1);
  await a.post('/api/queue', { lesson_id: 'chicken-fajitas', profile_ids: [ava], servings: 4 });
  assert.equal((await a.get(`/api/profiles/${ava}/queue`)).body.leave_out['chicken-fajitas'], undefined);
  const p = (await a.post('/api/shopping/preview', { count: 1 })).body;
  assert.ok(items(p).some((x) => x.id.startsWith('garlic')));
});

test('Swap keeps its parts in order, and puts the best fit first inside each', async () => {
  const { a, ava } = await setup();
  await a.post('/api/queue', { lesson_id: 'chicken-fajitas', profile_ids: [ava], servings: 4 });
  const qid = (await queueRow(a, 'chicken-fajitas')).id;
  const before = (await a.get(`/api/queue/${qid}/swap`)).body.options.filter((o) => o.group === 'Appointed Times lessons');
  assert.equal(before[0].id, 'unleavened-flatbread');
  await rate(a, ava, 'flavor', 'sweet-treats', 5);
  const after = (await a.get(`/api/queue/${qid}/swap`)).body.options;
  assert.equal(after[0].id, 'cottage-cheese-crescents');
  assert.equal(after[0].fit_label, 'Great fit');
  assert.equal(after[0].group, 'Appointed Times lessons');
});

test('a family without the preview gets fits in Swap and Add a lesson', async () => {
  const { a, ava } = await setup({ preview: false });
  await rate(a, ava, 'flavor', 'sweet-treats', 5);
  await a.post('/api/queue', { lesson_id: 'chicken-fajitas', profile_ids: [ava], servings: 4 });
  const qid = (await queueRow(a, 'chicken-fajitas')).id;
  const { options } = (await a.get(`/api/queue/${qid}/swap`)).body;
  assert.equal(options[0].fit_label, 'Great fit');
  assert.equal((await a.get(`/api/picks/lessons?profiles=${ava}`)).status, 200);
});

// ---------- 11d3: learning from Reflect ----------

const cookIt = (a, id, lid, pids) => a.put(`/api/attempts/${id}`, {
  lesson_id: lid, servings: 4, profile_ids: pids, started_at: new Date(Date.now() - 3600e3).toISOString(), finished_at: new Date().toISOString(),
});
const learned = async (env, pid) => (await env.DB.prepare('SELECT kind, item, adjust, cooks FROM taste_learned WHERE profile_id = ? ORDER BY kind, item').bind(pid).all()).results.map((r) => ({ ...r }));

test("a reflection teaches the cook's protein, flavors, and cuisine, and changing it doesn't count twice", async () => {
  const { env, a, ava, ben } = await setup();
  await cookIt(a, '00000000000000b1', 'chicken-fajitas', [ava, ben]);
  await a.put('/api/attempts/00000000000000b1/reflection', { profile_id: ava, rating: 5, eater_rating: 5 });
  assert.deepEqual(await learned(env, ava), [
    { kind: 'cuisine', item: 'tex-mex', adjust: 1, cooks: 1 },
    { kind: 'flavor', item: 'warm-spices', adjust: 1, cooks: 1 },
    { kind: 'protein', item: 'chicken', adjust: 1, cooks: 1 },
  ]);
  // Ben didn't reflect, but the eaters' rating counts for him, at half.
  assert.equal((await learned(env, ben)).find((r) => r.kind === 'cuisine').adjust, 0.5);
  // It shows in the picks, as a reason.
  const { lessons } = (await a.get(`/api/picks/lessons?profiles=${ava}`)).body;
  assert.ok(lessons.find((x) => x.id === 'chicken-fajitas').why.includes('Ava enjoyed cooking Tex-Mex'));
  // Changed later: rebuilt, not added to.
  await a.put('/api/attempts/00000000000000b1/reflection', { profile_id: ava, rating: 4, eater_rating: 3 });
  assert.equal((await learned(env, ava)).find((r) => r.kind === 'cuisine').adjust, 0.5);
  assert.deepEqual(await learned(env, ben), [], 'eaters at 3 teach nothing');
  // Taking the cook back takes the learning with it; putting it back restores it.
  await a.post('/api/attempts/00000000000000b1/remove');
  assert.deepEqual(await learned(env, ava), []);
  await a.post('/api/attempts/00000000000000b1/restore');
  assert.equal((await learned(env, ava)).length, 3);
  // In Download our data, and gone with the profile.
  assert.ok((await a.get('/api/family/export')).body.tables.taste_learned.length >= 3);
  await a.del(`/api/profiles/${ava}`);
  assert.deepEqual(await learned(env, ava), []);
});

test('a version cooked teaches its own tags', async () => {
  const { env, a, ava } = await setup();
  await a.put(`/api/attempts/00000000000000b2`, {
    lesson_id: 'chicken-fajitas', variation: 'steak', servings: 4, profile_ids: [ava], started_at: new Date(Date.now() - 3600e3).toISOString(), finished_at: new Date().toISOString(),
  });
  await a.put('/api/attempts/00000000000000b2/reflection', { profile_id: ava, rating: 1 });
  const rows = await learned(env, ava);
  assert.ok(rows.some((r) => r.kind === 'protein' && r.item === 'beef' && r.adjust === -1));
  assert.ok(!rows.some((r) => r.item === 'chicken'));
});

test('a family without the preview learns from Reflect too', async () => {
  const { env, a, ava } = await setup({ preview: false });
  await cookIt(a, '00000000000000b3', 'chicken-fajitas', [ava]);
  await a.put('/api/attempts/00000000000000b3/reflection', { profile_id: ava, rating: 5 });
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM taste_learned').first()).n, 3);
});
