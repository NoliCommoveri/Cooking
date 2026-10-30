// Print and complete offline (plan §6.22), release 3: the weeks to print, and
// marking a week's parts and recipe done away from the app.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, samplePlan } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';
import { LIBRARY } from '../src/worker/library-data.js';

const W = LIBRARY.levels['sp-3'].weeks;

function on(day) {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${day}T15:00:00Z`) });
}

async function setup({ preview = true } = {}) {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], plan_weeks: true });
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await a.post('/api/profiles', { people: [{ name: 'Ben', color: 'sky' }] });
  const fid = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  if (preview) await setPreview(env.DB, fid, true);
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, ben] = ['Ava', 'Ben'].map((n) => profiles.find((p) => p.name === n).id);
  return { env, a, ava, ben, fid };
}
const level = (a, pids) => a.post('/api/courses', { program: 'sp-3', start_date: '2027-01-10', per_week: 1, profile_ids: pids, starts: 'familiar' });

test('the weeks to print: this week and the next, each recipe in the version the course plays, and a Level week\'s parts with their pages', async (t) => {
  on('2027-01-12');
  t.after(() => mock.timers.reset());
  const { a, ava, ben } = await setup();
  await level(a, [ava, ben]);
  const d = (await a.get(`/api/profiles/${ava}/offline?weeks=3&tz=0`)).body;
  assert.equal(d.course.name, 'Level 3 Cook');
  assert.deepEqual(d.profiles.map((p) => p.name).sort(), ['Ava', 'Ben']);
  assert.deepEqual(d.weeks.map((w) => w.week_start), ['2027-01-10', '2027-01-17', '2027-01-24']);
  const first = d.weeks[0].entries[0];
  assert.equal(first.id, 'bean-quesadillas');
  assert.equal(first.level_week, 1);
  assert.deepEqual(first.parts.map((p) => p.part), ['knowledge', 'drill', 'sabbath']);
  assert.equal(first.parts[0].title, W[0].knowledge.title);
  assert.ok(first.parts[0].body?.length || first.parts[0].steps?.length, 'the page itself, to print');
  const eight = (await a.get(`/api/profiles/${ava}/offline?weeks=20&tz=0`)).body.weeks;
  assert.equal(eight.length, 8, 'at most 8 weeks');
  // A shared lesson plays the Level's own version (14e).
  const shared = eight.flatMap((w) => w.entries).find((e) => LIBRARY.lessons.find((L) => L.id === e.id)?.variations?.some((v) => v.level === 'sp-3'));
  if (shared) assert.equal(shared.variation, 'sp-3', shared.id);
});

test('completed offline: the parts and the recipe, for everyone ticked, on the day picked; the recipe is a full cook', async (t) => {
  on('2027-01-14');
  t.after(() => mock.timers.reset());
  const { a, ava, ben } = await setup();
  const { id: cid } = (await level(a, [ava, ben])).body;
  const res = await a.post(`/api/profiles/${ava}/offline?tz=0`, {
    date: '2027-01-12', profile_ids: [ava, ben], recipes: ['bean-quesadillas'],
    parts: [{ week: 1, part: 'knowledge' }, { week: 1, part: 'drill' }, { week: 1, part: 'sabbath' }],
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.deepEqual(res.body.cooked, ['bean-quesadillas']);
  assert.equal(res.body.parts, 6, 'three parts for two profiles');
  // The week is done, and the course moves on.
  const card = (await a.get('/api/queue?tz=0')).body.courses.find((c) => c.id === cid);
  assert.ok(card.this_week.lessons.every((x) => x.done));
  // It counts on Print our progress, for both, on the day picked.
  const p = (await a.get('/api/progress')).body.profiles.find((x) => x.id === ben);
  assert.ok(p.rows.some((r) => !r.part && r.dish === 'Black bean and vegetable quesadillas' || (!r.part && /quesadilla/i.test(r.dish))));
  assert.equal(p.rows.filter((r) => r.part).length, 3);
  const cook = (await a.get(`/api/profiles/${ava}/cooks?tz=0`)).body.cooks['bean-quesadillas'];
  assert.ok(cook, 'a cook of the lesson');
  // Marked again: nothing new.
  const again = (await a.post(`/api/profiles/${ava}/offline?tz=0`, { date: '2027-01-13', recipes: ['bean-quesadillas'], parts: [{ week: 1, part: 'drill' }] })).body;
  assert.deepEqual([again.cooked, again.parts], [[], 0]);
});

test('completed offline refuses the Sabbath, a day still to come, and a recipe or part not on the course', async (t) => {
  on('2027-01-14');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  await level(a, [ava]);
  const mark = (body) => a.post(`/api/profiles/${ava}/offline?tz=0`, { recipes: ['bean-quesadillas'], ...body });
  const sat = await mark({ date: '2027-01-09' });
  assert.equal(sat.status, 409);
  assert.match(sat.body.message, /Nothing done on the Sabbath counts/);
  assert.equal((await mark({ date: '2027-01-15' })).status, 400, 'tomorrow');
  assert.equal((await mark({ date: '2027-01-12', recipes: ['homemade-pizza'] })).status, 400);
  assert.equal((await mark({ date: '2027-01-12', recipes: [], parts: [{ week: 1, part: 'lunch' }] })).status, 400);
  assert.equal((await mark({ date: '2027-01-12', recipes: [] })).status, 400, 'nothing ticked');
});

test('Cook Around the World prints and marks recipes only; a kid marks their own; it all waits for release 3', async (t) => {
  on('2027-01-14');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  await a.post('/api/courses', { profile_ids: [ava], start_date: '2027-01-10', per_week: 1, plan: await samplePlan(a) });
  const d = (await a.get(`/api/profiles/${ava}/offline?weeks=2&tz=0`)).body;
  assert.deepEqual(d.weeks.map((w) => w.entries.map((e) => [e.id, Boolean(e.parts)])), [[['shakshuka', false]], [['beef-bulgogi', false]]]);
  assert.equal((await a.post(`/api/profiles/${ava}/offline?tz=0`, { date: '2027-01-13', recipes: ['shakshuka'] })).body.cooked[0], 'shakshuka');

  const { a: b, ava: bea } = await setup({ preview: false });
  await b.post('/api/courses', { profile_ids: [bea], start_date: '2027-01-10', per_week: 1, plan: await samplePlan(b) });
  assert.equal((await b.get(`/api/profiles/${bea}/offline?tz=0`)).status, 404);
});
