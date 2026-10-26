// 14f: Level 4's own features (plan §12.8). Its learners get adult-style
// safety banners, "Have an adult at home" on deep frying and grilling, and a
// portfolio of what they type on the capstone's pages, printed with the
// transcript. Write my recipe is tested with the family recipes it saves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';
import { weekOf } from '../src/worker/schedule.js';
import { WRITING_MAX } from '../src/worker/plan.js';
import { ASSIGN_NOTES } from '../src/content/levels.js';
import { LIBRARY } from '../src/worker/library-data.js';

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

// ---------- Write my recipe ----------

const STEW = {
  title: 'Ava\'s chicken stew', servings: 4, totalMinutes: 90, mealType: 'poultry', method: 'stove',
  ingredients: [{ ingredient: 'chicken-thigh', amount: 2, unit: 'lb' }, { ingredient: 'carrot', amount: 3, unit: 'count', prep: 'sliced' }],
  equipment: ['chef-knife', 'cutting-board', 'saucepan-medium', 'thermometer'],
  steps: [
    { text: 'Cut the chicken into bite-size pieces.', safety: 'solo', raw: true },
    { text: 'Simmer everything in a pot of water.', safety: 'solo', timerSeconds: 3600, timerLabel: 'Simmer stew' },
    { text: 'Check the chicken.', safety: 'solo', target: { temp: 165 } },
  ],
};
const own = (a, pid, body) => a.post(`/api/profiles/${pid}/level-recipe`, body);
const lvOf = async (a, pid) => (await a.get(`/api/profiles/${pid}/queue`)).body.level;
// No Level 4 mastery week has a written dish yet, so these tests make week 1 one.
async function onMastery(fn) {
  const w1 = LIBRARY.levels['sp-4'].weeks[0];
  Object.assign(w1, { mastery: true, ownRecipe: true });
  try { await fn(); } finally { delete w1.mastery; delete w1.ownRecipe; }
}

test("on a mastery week, the learner's own recipe becomes the week's recipe, for the whole course, with Undo", { skip: saturday }, () => onMastery(async () => {
  const { env, a, ava, ben } = await setup();
  await course(a, 'sp-4', [ava, ben]);
  const before = await lvOf(a, ava);
  assert.equal(before.week.week, 1);
  assert.equal(before.week.write, true);
  assert.deepEqual(before.week.mine, []);

  // The same checks as any family recipe: an unclean food is refused.
  const bad = await own(a, ava, { ...STEW, week: 1, ingredients: [...STEW.ingredients, { name: 'Shrimp', amount: 1, unit: 'cup' }] });
  assert.equal(bad.status, 400);
  const checkedBad = (await a.post(`/api/profiles/${ava}/level-recipe/check`, { ...STEW, week: 1, steps: [...STEW.steps, { text: 'Add the bacon.', safety: 'solo' }] })).body;
  assert.match(checkedBad.problems.join(' '), /bacon/);

  // A kid's own login writes it.
  await a.put(`/api/profiles/${ava}/login`, { first: 'Ava', initial: 'c', picture: 'carrot', password: 'carrot1' });
  const k = client(env);
  assert.equal((await k.post('/api/kid-login', { name: 'Ava C', picture: 'carrot', password: 'carrot1' })).status, 200);
  const made = await own(k, ava, { ...STEW, week: 1 });
  assert.equal(made.status, 200);
  assert.deepEqual([made.body.cooks, made.body.held], [true, false]);
  const rid = made.body.id;

  // It's the week's recipe now, for Ben too, and it's queued in place of the dish.
  const lv = await lvOf(a, ava);
  assert.deepEqual([lv.week.recipe, lv.week.recipe_title, lv.week.recipe_written], [rid, "Ava's chicken stew", true]);
  assert.deepEqual(lv.week.mine.map((x) => [x.id, x.current]), [[rid, true]]);
  assert.equal(lv.week.choices.find((c) => c.current).slot, 'own');
  assert.equal(lv.week.swap.by, ava);
  assert.equal(lv.mastery.includes(rid), true, 'the player says cook it on your own');
  assert.equal((await lvOf(a, ben)).week.recipe, rid);
  assert.deepEqual((await a.get(`/api/profiles/${ava}/queue`)).body.items.map((x) => x.lesson_id), [rid]);
  const row = (await a.get('/api/queue')).body.courses[0].this_week.lessons[0];
  assert.deepEqual([row.lesson_id, row.title, row.recipe], [rid, "Ava's chicken stew", true]);
  // It's one of the family's recipes too.
  assert.ok((await a.get('/api/recipes')).body.recipes.some((r) => r.id === rid));

  // The learner edits it; Ben can't, not being its writer.
  const hex = rid.slice(7);
  assert.equal((await k.put(`/api/profiles/${ava}/level-recipe/${hex}`, { ...STEW, title: 'Chicken and carrot stew' })).status, 200);
  assert.equal((await lvOf(a, ava)).week.recipe_title, 'Chicken and carrot stew');
  assert.equal((await a.put(`/api/profiles/${ben}/level-recipe/${hex}`, STEW)).status, 404);

  // Undo puts the dish back; Cook this instead picks the learner's recipe again.
  const dish = before.week.recipe;
  assert.equal((await k.post(`/api/profiles/${ava}/level-swap/undo`, { week: 1, from: dish })).status, 200);
  assert.equal((await lvOf(a, ava)).week.recipe, dish);
  const back = (await lvOf(a, ava)).week.choices.find((c) => c.slot === 'own');
  assert.deepEqual([back.id, back.can], [rid, true]);
  assert.equal((await k.post(`/api/profiles/${ava}/level-swap`, { week: 1, id: rid })).status, 200);
  assert.equal((await lvOf(a, ava)).week.recipe, rid);

  // Cooked, it finishes the week like any recipe, and Progress names it.
  const fin = await a.put('/api/attempts/00000000000014f1', { lesson_id: rid, servings: 4, profile_ids: [ava], started_at: `${sunday}T00:10:00.000Z`, finished_at: `${sunday}T00:40:00.000Z` });
  assert.equal(fin.status, 200);
  const p = (await a.get('/api/progress')).body.profiles.find((x) => x.id === ava);
  assert.deepEqual([p.level.weeks[0].title, Boolean(p.level.weeks[0].cooked)], ['Chicken and carrot stew', true]);
}));

test('Write my recipe: only on its week, a week that takes one, and a course the parent can still edit', { skip: saturday }, () => onMastery(async () => {
  const { a, ava } = await setup();
  const { id: cid } = (await course(a, 'sp-4', [ava])).body;
  // Week 5 isn't a mastery week; week 4 is, but isn't this week.
  assert.equal((await own(a, ava, { ...STEW, week: 5 })).status, 400);
  assert.equal((await own(a, ava, { ...STEW, week: 4 })).status, 409);
  const rid = (await own(a, ava, { ...STEW, week: 1 })).body.id;
  // Saving Edit course keeps the learner's recipe as week 1's.
  const c = (await a.get('/api/courses')).body.courses.find((x) => x.id === cid);
  const w1 = c.plan.find((x) => x.week === 1);
  assert.deepEqual([w1.id, w1.changed], [rid, true]);
  const saved = await a.put(`/api/courses/${cid}`, { name: c.name ?? '', start_date: c.start_date, per_week: 1, profile_ids: [ava], starts: 'familiar', weeks: c.plan.filter((x) => x.changed).map((x) => ({ week: x.week, id: x.id })) });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal((await lvOf(a, ava)).week.recipe, rid);
}));

test('a recipe for the capstone menu is kept for its week, without changing the plan', { skip: saturday }, async () => {
  const { a, ava } = await setup();
  await course(a, 'sp-4', [ava]);
  const plan = (await a.get('/api/courses')).body.courses[0].plan.map((x) => x.id);
  const made = await own(a, ava, { ...STEW, week: 36 });
  assert.equal(made.status, 200);
  assert.deepEqual([made.body.cooks, made.body.held], [false, false]);
  assert.deepEqual((await a.get('/api/courses')).body.courses[0].plan.map((x) => x.id), plan, 'the capstone has no recipe week');
  assert.ok((await a.get('/api/recipes')).body.recipes.some((r) => r.id === made.body.id));
  // A typed-in ingredient is fine for the family's own recipe.
  assert.equal((await own(a, ava, { ...STEW, title: 'Barley bread', week: 34, ingredients: [{ name: 'Pearl barley', amount: 1, unit: 'cup' }] })).status, 200);
});

test('before /ops applies the draft, Write my recipe saves nothing and says so', { skip: saturday }, async () => {
  const { env, a, ava } = await setup();
  await course(a, 'sp-4', [ava]);
  await env.DB.prepare('DROP TABLE level_recipes').run();
  const r = await own(a, ava, { ...STEW, week: 36 });
  assert.equal(r.status, 503);
  assert.equal((await a.get('/api/recipes')).body.recipes.length, 0);
  // The kitchen still reads.
  assert.equal((await a.get(`/api/profiles/${ava}/queue`)).status, 200);
});
