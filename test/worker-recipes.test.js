// Phase 4c: family recipes (plan §6.10): the checks, saving and editing,
// family scoping, and a recipe queued, shopped for, and cooked like a lesson.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { normalizeRecipe, recipeProblems, recipeLesson } from '../src/content/recipe.js';
import { CONTENT } from '../src/worker/content-data.js';
import { scaleLesson } from '../src/content/scale.js';

const CTX = {
  ingredients: Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i])),
  equipment: Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e])),
  rules: CONTENT.rules,
};
const problems = (body) => recipeProblems(normalizeRecipe(body), CTX);

// Grandma's lamb stew: a registry ingredient, a typed-in one, a raw step, and a doneness check.
const STEW = {
  title: "Grandma's chicken stew", servings: 4, totalMinutes: 90, mealType: 'poultry', method: 'stove',
  why: { title: 'Why we make this', body: 'Grandma made it every winter.' },
  ingredients: [
    { ingredient: 'chicken-thigh', amount: 2, unit: 'lb' },
    { ingredient: 'carrot', amount: 3, unit: 'count', prep: 'sliced' },
    { name: 'Pearl barley', amount: 0.5, unit: 'cup' },
    { ingredient: 'salt', amount: null, text: 'to taste' },
  ],
  equipment: ['chef-knife', 'cutting-board', 'saucepan-medium', 'thermometer'],
  steps: [
    { text: 'Cut the chicken into bite-size pieces.', safety: 'adult-nearby', hazard: 'Sharp knife', raw: true },
    { text: 'Simmer everything in a pot of water.', safety: 'adult-nearby', hazard: 'Hot stove', timerSeconds: 3600, timerLabel: 'Simmer stew' },
    { text: 'Check the chicken.', safety: 'adult-nearby', hazard: 'Hot stove', target: { temp: 165 } },
  ],
};

test('a recipe is tidied: a wash-hands step follows each raw step', () => {
  const r = normalizeRecipe(STEW);
  assert.deepEqual(r.steps.map((s) => s.type ?? 'step'), ['step', 'wash', 'step', 'doneness']);
  assert.deepEqual(r.steps.map((s) => s.id), ['s1', 's2', 's3', 's4']);
  assert.deepEqual(problems(STEW), []);
  // Sent back with its wash step, it isn't doubled.
  assert.equal(normalizeRecipe(r).steps.length, 4);
});

test('the hard block has no exception: unclean registry ingredients and blocked words are refused', () => {
  assert.match(problems({ ...STEW, title: 'Bacon and chicken stew' }).join(' '), /"bacon", which is an unclean food/);
  assert.match(problems({ ...STEW, ingredients: [...STEW.ingredients, { name: 'Shrimp', amount: 1, unit: 'cup' }] }).join(' '), /"shrimp"/);
  assert.match(problems({ ...STEW, steps: [...STEW.steps, { text: 'Serve with crab legs.', safety: 'solo' }] }).join(' '), /Step 5 names "crab"/);
  // An allowed phrase is fine.
  assert.deepEqual(problems({ ...STEW, ingredients: [...STEW.ingredients, { name: 'Turkey bacon', amount: 4, unit: 'count' }] }), []);
});

test('food safety: raw meat needs its raw step and a doneness check at the safe minimum', () => {
  const noRaw = { ...STEW, steps: STEW.steps.map(({ raw, ...s }) => s) };
  assert.match(problems(noRaw).join(' '), /Mark the step where the raw/);
  const low = { ...STEW, steps: STEW.steps.map((s) => (s.target ? { ...s, target: { temp: 150 } } : s)) };
  assert.match(problems(low).join(' '), /at least 165°F/);
  const none = { ...STEW, steps: STEW.steps.filter((s) => !s.target) };
  assert.match(problems(none).join(' '), /Add a doneness check/);
  assert.match(problems({ ...STEW, steps: [{ text: 'Bake it.', safety: 'adult-nearby' }] }).join(' '), /needs the hazard/);
});

test('the shape is checked', () => {
  const p = problems({ title: '', servings: 0, totalMinutes: 'x', mealType: 'brunch', ingredients: [{ ingredient: 'not-real', amount: 1, unit: 'cup' }, { name: 'Sumac', amount: 1, unit: 'pinch' }], steps: [] }).join(' ');
  for (const m of [/title/, /Servings/, /Total time/, /meal type/, /Ingredient 1 isn't in the ingredient list/, /Ingredient 2, Sumac: pick an amount and a unit/, /at least one step/]) assert.match(p, m);
});

test('as a lesson, a typed-in ingredient has its own id and scales as a plain amount', () => {
  const { lesson, extra } = recipeLesson('recipe:00000000000000a1', { ...normalizeRecipe(STEW), version: 2 });
  assert.equal(lesson.version, 2);
  assert.equal(lesson.image, 'meals/poultry.svg');
  assert.equal(lesson.ingredients[2].ingredient, 'typed-00000000000000a1-3');
  const scaled = scaleLesson(lesson, { ...CTX.ingredients, ...extra }, 8);
  assert.equal(scaled.ingredients[2].line, '1 cup pearl barley');
  assert.equal(scaled.steps.find((s) => s.type === 'wash').safety, 'solo');
});

async function setup() {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  return { env, a, b, ava };
}

test('a parent saves, edits, deletes, and puts back a recipe; another family never sees it', async () => {
  const { a, b } = await setup();
  const check = (await a.post('/api/recipes/check', STEW)).body;
  assert.deepEqual(check.problems, []);
  assert.equal(check.leaven.typedIn, 1);
  const bad = await a.post('/api/recipes', { ...STEW, title: 'Pork stew' });
  assert.equal(bad.status, 400);
  assert.match(JSON.stringify(bad.body), /pork/);

  const { id } = (await a.post('/api/recipes', STEW)).body;
  assert.match(id, /^recipe:[0-9a-f]{16}$/);
  const hex = id.slice(7);
  let list = (await a.get('/api/recipes')).body.recipes;
  assert.deepEqual(list.map((r) => [r.title, r.typed_in, r.unleavened, r.visible]), [["Grandma's chicken stew", 1, false, true]]);
  assert.equal((await a.put(`/api/recipes/${hex}`, { ...STEW, servings: 6 })).body.version, 2);
  const one = (await a.get(`/api/recipes/${hex}`)).body;
  assert.equal(one.recipe.servings, 6);
  assert.equal(one.lesson.id, id);

  assert.equal((await b.get(`/api/recipes/${hex}`)).status, 404);
  assert.deepEqual((await b.get('/api/recipes')).body.recipes, []);
  assert.equal((await b.put(`/api/recipes/${hex}`, STEW)).status, 404);
  assert.equal((await b.del(`/api/recipes/${hex}`)).status, 404);

  await a.del(`/api/recipes/${hex}`);
  assert.deepEqual((await a.get('/api/recipes')).body.recipes, []);
  await a.post(`/api/recipes/${hex}/restore`);
  assert.equal((await a.get('/api/recipes')).body.recipes.length, 1);

  // Parent screens only.
  await a.post('/api/pin/lock');
  assert.equal((await a.post('/api/recipes', STEW)).status, 403);
  assert.equal((await a.get('/api/recipes')).status, 200, 'the kitchen can list them');
});

test('a diet filter hides a recipe that needs a tagged ingredient', async () => {
  const { a } = await setup();
  await a.post('/api/recipes', STEW);
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: ['meat'] });
  assert.equal((await a.get('/api/recipes')).body.recipes[0].visible, false);
});

test('a recipe is queued, on the shopping list unmerged, and cooked like a lesson', async () => {
  const { a, ava } = await setup();
  const { id } = (await a.post('/api/recipes', STEW)).body;
  assert.ok((await a.get('/api/queue')).body.recipes.some((r) => r.id === id));
  const q = await a.post('/api/queue', { lesson_id: id, profile_ids: [ava], servings: 4 });
  assert.equal(q.status, 200);
  const queue = (await a.get('/api/queue')).body.queued;
  assert.deepEqual(queue.map((x) => [x.title, x.recipe, x.image]), [["Grandma's chicken stew", true, 'img/meals/poultry.svg']]);
  assert.deepEqual((await a.get(`/api/profiles/${ava}/queue`)).body.items.map((x) => x.title), ["Grandma's chicken stew"]);
  // The safety review works for recipes too.
  assert.equal((await a.get(`/api/lessons/${id}/safety`)).body.level, 'adult-nearby');

  const shop = (await a.get('/api/shopping')).body;
  const items = shop.weeks.flatMap((w) => [...w.needs.sections.flatMap((s) => s.items), ...w.needs.may_have]);
  assert.ok(items.some((x) => x.id === 'chicken-thigh'));
  const barley = items.find((x) => x.name === 'Pearl barley');
  assert.equal(barley.used, '½ cup');

  const t = new Date().toISOString();
  const cook = await a.put('/api/attempts/00000000000000b1', { lesson_id: id, servings: 4, profile_ids: [ava], started_at: t, finished_at: t });
  assert.equal(cook.status, 200);
  assert.equal((await a.get('/api/queue')).body.queued.length, 0, 'the cook closed it');
  assert.equal((await a.get(`/api/profiles/${ava}/cooks`)).body.cooks[id].times, 1);
  const rows = (await a.get('/api/progress')).body.profiles[0].rows;
  assert.equal(rows[0].dish, "Grandma's chicken stew");
});

test("another family can't queue or cook a family's recipe", async () => {
  const { a, b } = await setup();
  const { id } = (await a.post('/api/recipes', STEW)).body;
  await b.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  const bea = (await b.get('/api/profiles')).body.profiles[0].id;
  assert.equal((await b.post('/api/queue', { lesson_id: id, profile_ids: [bea] })).status, 400);
  const t = new Date().toISOString();
  assert.equal((await b.put('/api/attempts/00000000000000b2', { lesson_id: id, servings: 4, profile_ids: [bea], started_at: t, finished_at: t })).status, 400);
});
