// Add a lesson's filters (owner, 2026-10-26): proteins narrow, every other
// ingredient is wide, and the most of the family's ingredients come first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findLessons, ingredientMatch, suggest } from '../src/content/find.js';
import { makeEnv, family } from './helpers/worker.js';

const P = { chicken: ['chicken-breast', 'chicken-thigh'], 'white-fish': ['cod'] };
const lesson = (id, ingredients, extra = {}) => ({ id, title: id, ingredients, protein: null, skills: [], minutes: 45, method: 'stove', cuisine: 'x', programs: ['catw'], ...extra });
const L = [
  lesson('chicken-tomato', ['chicken-thigh', 'tomato']),
  lesson('chicken-carrot-tomato', ['chicken-breast', 'carrots', 'tomato']),
  lesson('chicken-rice', ['chicken-breast', 'rice']),
  lesson('fish-carrot', ['cod', 'carrots']),
  lesson('carrot-salad', ['carrots'], { minutes: 20, method: 'no-cook', skills: ['julienne'] }),
];
const ids = (f) => findLessons(L, f, P).map((x) => x.L.id);

test('chicken, tomatoes, and carrots: chicken with either, never fish with carrots', () => {
  assert.deepEqual(ids({ items: ['protein:chicken', 'tomato', 'carrots'] }), ['chicken-carrot-tomato', 'chicken-tomato'], 'the most of yours first');
  assert.deepEqual(ingredientMatch(L[1], ['protein:chicken', 'tomato', 'carrots'], P), ['protein:chicken', 'tomato', 'carrots']);
});

test('a protein alone finds every lesson with it; other ingredients alone are wide', () => {
  assert.deepEqual(ids({ items: ['protein:chicken'] }), ['chicken-tomato', 'chicken-carrot-tomato', 'chicken-rice']);
  assert.deepEqual(ids({ items: ['carrots', 'rice'] }), ['chicken-carrot-tomato', 'chicken-rice', 'fish-carrot', 'carrot-salad']);
  assert.deepEqual(ids({ items: ['protein:chicken', 'protein:white-fish', 'carrots'] }), ['chicken-carrot-tomato', 'fish-carrot'], 'either protein');
});

test('skills, time, method, name, and leaving out what was cooked', () => {
  assert.deepEqual(ids({ skills: ['julienne'] }), ['carrot-salad']);
  assert.deepEqual(ids({ maxMinutes: 30 }), ['carrot-salad']);
  assert.deepEqual(ids({ method: 'no-cook' }), ['carrot-salad']);
  assert.deepEqual(ids({ text: 'RICE' }), ['chicken-rice']);
  assert.deepEqual(ids({ items: ['protein:chicken'], skip: new Set(['chicken-rice']) }), ['chicken-tomato', 'chicken-carrot-tomato']);
});

test('typing narrows the options: start of the name first, the shortest first', () => {
  const opts = [{ name: 'Tomato paste' }, { name: 'Tomatoes' }, { name: 'Sun-dried tomatoes' }, { name: 'Carrots' }];
  assert.deepEqual(suggest(opts, 'tom').map((o) => o.name), ['Tomatoes', 'Tomato paste', 'Sun-dried tomatoes']);
  assert.deepEqual(suggest(opts, '  '), []);
});

test("the queue sends Add a lesson's options and each lesson's card details", async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const q = (await a.get('/api/queue')).body;
  const chicken = q.finder.ingredients.find((x) => x.id === 'protein:chicken');
  assert.equal(chicken.name, 'Chicken');
  assert.ok(!q.finder.ingredients.some((x) => x.id === 'chicken-breast'), 'proteins are searched by their group');
  assert.ok(q.finder.skills.some((x) => x.name === 'Julienne'));
  const rolls = q.library.find((L) => L.id === 'spring-rolls');
  assert.ok(rolls.about && rolls.skill && rolls.minutes && rolls.method === 'stove' && rolls.skills.includes('julienne'));
  const found = findLessons(q.library, { items: ['protein:chicken', 'carrot'] }, q.finder.proteins).map((x) => x.L.id);
  assert.ok(found.includes('spring-rolls'));
});
