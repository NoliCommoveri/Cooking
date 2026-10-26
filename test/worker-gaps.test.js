// Phase 11e: Recipe gaps (plan §6.21). Counts only: which pick-one groups
// leave families short and why, what to write next, coverage, and what people
// cook. No family or profile is named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';

async function setup() {
  const env = await makeEnv();
  const own = await family(env, 'Carsons', 'jen@example.com');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();
  const fam = async (a, name, email, kid) => {
    await a.post('/api/profiles', { people: [{ name: kid, color: 'tomato' }] });
    const fid = (await env.DB.prepare('SELECT family_id FROM parents WHERE email = ?').bind(email).first()).family_id;
    await setPreview(env.DB, fid, true);
    return (await a.get('/api/profiles')).body.profiles[0].id;
  };
  const b = await family(env, 'Lees', 'sam@example.com');
  const c = await family(env, 'Diaz', 'max@example.com');
  return { env, own, b, c, ava: await fam(own, 'Carsons', 'jen@example.com', 'Ava'), zoe: await fam(b, 'Lees', 'sam@example.com', 'Zoe'), max: await fam(c, 'Diaz', 'max@example.com', 'Max') };
}
const rate = (a, pid, kind, item, stars) => a.put(`/api/profiles/${pid}/ratings`, { kind, item, stars });

test('the owner sees which groups leave families short, why, and what to write next; no names', async () => {
  const { own, b, c, ava, zoe } = await setup();
  // Two families hate chicken and beans; the dressings dishes are chicken and chickpeas.
  await rate(own, ava, 'protein', 'chicken', 1);
  await rate(own, ava, 'protein', 'beans-lentils', 1);
  await rate(own, ava, 'protein', 'salmon', 5);
  await rate(b, zoe, 'protein', 'chicken', 1);
  await rate(b, zoe, 'protein', 'beans-lentils', 1);
  await rate(b, zoe, 'protein', 'salmon', 4);
  const r = await own.get('/api/owner/gaps');
  assert.equal(r.status, 200);
  const g = r.body;
  assert.equal(g.families, 2, 'a family that rated nothing is not counted');
  const dressings = g.gaps.find((x) => x.key === 'pick:dressings');
  assert.equal(dressings.families, 2);
  assert.equal(dressings.none, 2);
  assert.deepEqual(dressings.reasons[0], { code: 'protein:chicken', text: 'Chicken 1 star', families: 2 });
  assert.equal(dressings.write_next.kind, 'variation');
  assert.equal(dressings.write_next.lesson_id, 'chicken-caesar');
  assert.equal(dressings.write_next.text, 'A salmon variation of Chicken Caesar + homemade dressing & croutons');
  assert.equal(dressings.write_next.tags.protein, 'salmon');
  assert.match(dressings.write_next.link, /^\/manage\/#\/gap\/variation\/chicken-caesar\?/);
  // A group with a non-chicken choice isn't short: reducing has salmon.
  assert.ok(!g.gaps.some((x) => x.key === 'pick:reducing'));
  // No names anywhere.
  const text = JSON.stringify(g);
  for (const word of ['Ava', 'Zoe', 'Carsons', 'Lees', 'jen@', 'sam@']) assert.ok(!text.includes(word), word);
  // Not for anyone else.
  assert.equal((await c.get('/api/owner/gaps')).status, 403);
});

test('limits make a low fit, and a new dish is suggested where the group has room', async () => {
  const { own, ava } = await setup();
  await rate(own, ava, 'flavor', 'chili-heat', 5);
  // Poaching eggs, a two-dish group with both dishes written.
  await rate(own, ava, 'protein', 'eggs', 2);
  await rate(own, ava, 'flavor', 'rich-tomato', 1);
  await own.put('/api/tastes/limits', { max_minutes: 30, budget: '$', missing_tools: [], adventurous: 'a-bit' });
  const g = (await own.get('/api/owner/gaps')).body;
  const two = g.gaps.find((x) => x.dishes.length < 3 && x.write_next.kind === 'dish');
  assert.ok(two, 'some two-dish group is short on time or budget');
  assert.equal(two.key, 'pick:poaching-eggs');
  assert.equal(two.write_next.text, 'A new gentle eggs dish: eggs, chili heat, mild, under 30 minutes, $');
  assert.ok(two.reasons.some((x) => x.code === 'time' || x.code === 'budget'));
  // A full group over the time limit: a quicker version of its quickest dish.
  const dicing = g.gaps.find((x) => x.key === 'pick:dicing');
  assert.equal(dicing.write_next.text, 'A quicker version of Pico de gallo + Baja fish tacos, under 30 minutes');
  assert.equal(dicing.write_next.tags.protein, 'white-fish');
  // A bread group stays protein-free.
  const fat = g.gaps.find((x) => x.key === 'pick:cutting-in-fat');
  if (fat) assert.ok(!fat.write_next.tags.protein || fat.write_next.tags.protein === 'none');
});

test('coverage counts written versions and planned dishes by protein', async () => {
  const { own } = await setup();
  const { coverage } = (await own.get('/api/owner/gaps')).body;
  const julienne = coverage.rows.find((r) => r.key === 'pick:julienne');
  // Spring rolls, chicken fajitas, and its spicy version are chicken; steak, beans.
  assert.equal(julienne.cells.chicken.written, 3);
  assert.equal(julienne.cells.beef.written, 1);
  assert.equal(julienne.cells['beans-lentils'].written, 1);
  const braising = coverage.rows.find((r) => r.key === 'pick:braising');
  assert.equal(braising.cells.lamb.planned, 1);
});

test('what people cook: swapped, skipped, rated low, and flavor stars', async () => {
  const { own, ava } = await setup();
  await rate(own, ava, 'flavor', 'chili-heat', 4);
  await own.put('/api/attempts/00000000000000c1', {
    lesson_id: 'shakshuka', servings: 4, profile_ids: [ava], started_at: new Date(Date.now() - 3600e3).toISOString(), finished_at: new Date().toISOString(),
  });
  await own.put('/api/attempts/00000000000000c1/reflection', { profile_id: ava, rating: 2 });
  await own.post('/api/queue', { lesson_id: 'chicken-fajitas', profile_ids: [ava], servings: 4 });
  const qid = (await own.get('/api/queue')).body.queued.find((x) => x.lesson_id === 'chicken-fajitas').id;
  await own.post(`/api/queue/${qid}/swap`, { lesson_id: 'unleavened-flatbread' });
  const { cooking } = (await own.get('/api/owner/gaps')).body;
  assert.deepEqual(cooking.rated_low[0], { lesson_id: 'shakshuka', title: 'Shakshuka', low: 1, ratings: 1, average: 2 });
  assert.equal(cooking.swapped[0].lesson_id, 'chicken-fajitas');
  assert.deepEqual(cooking.flavor_stars[0], { id: 'chili-heat', name: 'Chili heat', average: 4, ratings: 1 });
});
