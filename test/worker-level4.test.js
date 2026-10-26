// 14f: Level 4's own features (plan §12.8). Its learners get adult-style
// safety banners, "Have an adult at home" on deep frying and grilling, and a
// portfolio of what they type on the capstone's pages, printed with the
// transcript. Write my recipe is tested with the family recipes it saves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';
import { weekOf } from '../src/worker/schedule.js';
import { WRITING_MAX } from '../src/worker/plan.js';
import { ASSIGN_NOTES } from '../src/content/levels.js';

const sunday = weekOf(new Date().toISOString().slice(0, 10));
const saturday = new Date().getDay() === 6;

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true, mode: 'homeschool' });
  for (const name of ['Ava', 'Ben', 'Cal']) await a.post('/api/profiles', { people: [{ name, color: 'tomato' }] });
  const fid = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  await setPreview(env.DB, fid, true);
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, ben, cal] = ['Ava', 'Ben', 'Cal'].map((n) => profiles.find((p) => p.name === n).id);
  return { env, a, ava, ben, cal, fid };
}
const course = (a, program, pids) => a.post('/api/courses', { program, start_date: sunday, per_week: 1, profile_ids: pids, starts: 'familiar' });
const write = (a, pid, body) => a.put(`/api/profiles/${pid}/level-writing`, body);

test("the owner's note for parents is Level 4's, word for word", () => {
  assert.deepEqual(Object.keys(ASSIGN_NOTES), ['sp-4']);
  assert.match(ASSIGN_NOTES['sp-4'], /^Note: While lessons do review some fundamentals in culinary technique, Level 4 is intended for somewhat experienced cooks/);
  assert.match(ASSIGN_NOTES['sp-4'], /drain, work with oils, and perform cutting unassisted\.$/);
});

test("each profile says which Level it's on, for the player's safety banners", async () => {
  const { a, ava, ben, cal } = await setup();
  await course(a, 'sp-4', [ava]);
  await course(a, 'sp-3', [ben]);
  const { profiles } = (await a.get('/api/profiles')).body;
  const lv = Object.fromEntries(profiles.map((p) => [p.id, p.level]));
  assert.deepEqual([lv[ava], lv[ben], lv[cal]], ['sp-4', 'sp-3', null]);
  assert.ok(profiles.every((p) => p.audience === 'kid'));
});

test('a Level 4 course says Have an adult at home on its deep frying and grilling weeks', async () => {
  const { a, ava } = await setup();
  await course(a, 'sp-4', [ava]);
  const lv = (await a.get(`/api/profiles/${ava}/queue`)).body.level;
  const weekOf = (id) => lv.week_of[id];
  assert.deepEqual(lv.adult_home.map(weekOf).sort((x, y) => x - y), [26, 28]);
  assert.equal(lv.week.adult_home, [26, 28].includes(lv.week.week));
});

test('what a learner types on a capstone page is kept, and printed as the portfolio', async () => {
  const { a, ava, ben } = await setup();
  await course(a, 'sp-4', [ava]);
  await course(a, 'sp-3', [ben]);
  const t0 = (await a.get(`/api/transcript/${ava}`)).body.portfolio;
  assert.equal(t0.name, 'Level 4 Chef');
  assert.deepEqual(t0.pieces.map((x) => [x.week, x.part, x.id]), [[34, 'drill', 'menu'], [34, 'drill', 'budget'], [34, 'drill', 'guest-list'], [35, 'sabbath', 'prep-timeline'], [36, 'knowledge', 'reflection']]);
  assert.ok(t0.pieces.every((x) => x.body === ''));
  // Level 3 has no writing boxes, so no portfolio.
  assert.equal((await a.get(`/api/transcript/${ben}`)).body.portfolio, null);
  if (saturday) {
    assert.equal((await write(a, ava, { week: 34, part: 'drill', field: 'menu', body: 'Challah' })).status, 409, 'not on the Sabbath');
    return;
  }

  assert.equal((await write(a, ava, { week: 34, part: 'drill', field: 'menu', body: '  Roast chicken\r\nChallah  ' })).status, 200);
  assert.equal((await write(a, ava, { week: 36, part: 'knowledge', field: 'reflection', body: 'It went well.' })).status, 200);
  const t = (await a.get(`/api/transcript/${ava}`)).body.portfolio;
  assert.equal(t.pieces.find((x) => x.id === 'menu').body, 'Roast chicken\nChallah');
  assert.equal(t.pieces.find((x) => x.id === 'reflection').body, 'It went well.');
  // Saving again replaces it; an empty box clears it.
  await write(a, ava, { week: 34, part: 'drill', field: 'menu', body: 'Brisket' });
  await write(a, ava, { week: 36, part: 'knowledge', field: 'reflection', body: '   ' });
  const t2 = (await a.get(`/api/transcript/${ava}`)).body.portfolio;
  assert.deepEqual([t2.pieces.find((x) => x.id === 'menu').body, t2.pieces.find((x) => x.id === 'reflection').body], ['Brisket', '']);

  // Only the page's own boxes, a string, and not too long.
  assert.equal((await write(a, ava, { week: 34, part: 'knowledge', field: 'menu', body: 'x' })).status, 400);
  assert.equal((await write(a, ava, { week: 34, part: 'drill', field: 'essay', body: 'x' })).status, 400);
  assert.equal((await write(a, ava, { week: 34, part: 'drill', field: 'menu', body: 5 })).status, 400);
  assert.equal((await write(a, ava, { week: 34, part: 'drill', field: 'menu', body: 'x'.repeat(WRITING_MAX + 1) })).status, 400);
  // A profile not on a Level 4 course has nowhere to write it.
  assert.equal((await write(a, ben, { week: 34, part: 'drill', field: 'menu', body: 'x' })).status, 400);
});

test('another family writes nothing, and a deleted profile takes its writing with it', async () => {
  if (saturday) return;
  const { env, a, ava } = await setup();
  await course(a, 'sp-4', [ava]);
  const b = await family(env, 'Others', 'sam@example.com');
  assert.ok([403, 404].includes((await write(b, ava, { week: 34, part: 'drill', field: 'menu', body: 'x' })).status));
  await write(a, ava, { week: 34, part: 'drill', field: 'menu', body: 'Brisket' });
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM level_writing').first()).n, 1);
  assert.equal((await a.del(`/api/profiles/${ava}`)).status, 200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM level_writing').first()).n, 0);
});

test('before /ops applies the draft, writing says it waits for Re-apply draft', async () => {
  if (saturday) return;
  const { env, a, ava } = await setup();
  await course(a, 'sp-4', [ava]);
  await env.DB.prepare('DROP TABLE level_writing').run();
  const r = await write(a, ava, { week: 34, part: 'drill', field: 'menu', body: 'x' });
  assert.equal(r.status, 503);
  assert.match(r.body.message ?? r.body.error ?? JSON.stringify(r.body), /Re-apply draft/);
  assert.ok((await a.get(`/api/transcript/${ava}`)).body.portfolio.pieces.every((x) => x.body === ''));
  // The profile still deletes.
  assert.equal((await a.del(`/api/profiles/${ava}`)).status, 200);
});
