// Leaven and the Appointed Times unit (plan §6.19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leavenIn, unleavened } from '../src/content/leaven.js';
import { seasonalLabels } from '../src/content/course.js';
import { lint } from '../src/content/lint.js';
import { CONTENT } from '../src/worker/content-data.js';
import { LIBRARY } from '../src/worker/library-data.js';

const REG = Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i]));
const LV = CONTENT.rules.leaven;
const lesson = (id) => CONTENT.lessons.find((x) => x.data.id === id).data;
const recipe = (ingredients, steps = []) => ({ ingredients, steps });

test('leaven is found in registry ingredients, typed-in names, and step text', () => {
  assert.deepEqual(leavenIn(lesson('buttermilk-biscuits'), REG, LV).found.sort(), ['baking powder', 'baking soda']);
  assert.deepEqual(leavenIn(recipe([{ name: 'Active dry yeast' }]), REG, LV), { found: ['yeast'], typedIn: 1 });
  assert.deepEqual(leavenIn(recipe([{ ingredient: 'flour-ap' }], [{ text: 'Add a pinch of baking soda.' }]), REG, LV).found, ['baking soda']);
  // Plurals count, and an allowed phrase doesn't.
  assert.deepEqual(leavenIn(recipe([{ name: 'Hamburger buns' }]), REG, LV).found, ['buns']);
  assert.deepEqual(leavenIn(recipe([], [{ text: 'This is unleavened bread, made with no yeast.' }]), REG, LV).found, []);
});

test('baguettes and rolls are bread; a bread knife or a cracker-sized piece is not leaven (owner, 2026-10-27)', () => {
  for (const id of ['baguette', 'ciabatta-rolls', 'bolillo-rolls']) assert.ok(leavenIn(recipe([{ ingredient: id }]), REG, LV).found.length, id);
  for (const text of ['Split it with the bread knife.', 'Pieces about the size of a cracker.', 'Rub it in until it looks like breadcrumbs.']) {
    assert.deepEqual(leavenIn(recipe([], [{ text }]), REG, LV).found, [], text);
  }
  const badge = (id) => LIBRARY.lessons.find((L) => L.id === id).unleavened;
  assert.equal(badge('french-onion-soup'), false);
  assert.equal(badge('ratatouille'), false, 'an optional baguette is still leaven');
  assert.equal(badge('arepas'), true);
});

test("fermented foods that aren't a raising agent aren't leaven (owner, 2026-10-22)", () => {
  for (const name of ['Beer', 'Soy sauce', 'Apple cider vinegar', 'Worcestershire sauce', 'White miso', 'Matzah', 'Corn tortillas']) {
    assert.deepEqual(leavenIn(recipe([{ name }]), REG, LV).found, [], name);
  }
});

test('Unleavened: every ingredient from the registry and none of it leaven', () => {
  assert.equal(unleavened(lesson('unleavened-flatbread'), REG, LV), true);
  assert.equal(unleavened(lesson('cottage-cheese-crescents'), REG, LV), true);
  assert.equal(unleavened(lesson('chicken-fajitas'), REG, LV), false, 'flour tortillas');
  assert.equal(unleavened(recipe([{ ingredient: 'flour-ap' }, { name: 'Matzah meal' }]), REG, LV), false, 'a typed-in ingredient waits on a review');
  assert.equal(LIBRARY.lessons.find((L) => L.id === 'unleavened-flatbread').unleavened, true);
  assert.equal(LIBRARY.lessons.find((L) => L.id === 'buttermilk-biscuits').unleavened, false);
});

test('Appointed Times lessons are U1, U2, outside the numbered course', () => {
  assert.deepEqual(seasonalLabels(CONTENT.units), { 'unleavened-flatbread': 'U1', 'cottage-cheese-crescents': 'U2' });
  assert.equal(LIBRARY.course.some((d) => d.unit === 8), false);
});

test('the linter wants every Appointed Times lesson listed, and only those', () => {
  const units = CONTENT.units.map((u) => (u.seasonal ? { ...u, lessons: ['unleavened-flatbread', 'shakshuka'] } : u));
  const errors = lint({ ...CONTENT, units, registryFiles: {} }).errors.join('\n');
  assert.match(errors, /lessons doesn't list "cottage-cheese-crescents"/);
  assert.match(errors, /lists "shakshuka", which isn't a written lesson in this unit/);
});
