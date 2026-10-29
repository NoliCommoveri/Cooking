// Leaven and the Appointed Times unit (plan §6.19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leavenIn, unleavened, feastView, feastOk, withFeast, feastCook, unleavenedVersion } from '../src/content/leaven.js';
import { lessonVersion } from '../src/content/variations.js';
import { dietView } from '../src/content/diet.js';
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
  assert.equal(unleavened(lesson('soft-unleavened-bread'), REG, LV), true, 'eggs and steam, nothing leaven');
  assert.equal(unleavened(lesson('chicken-fajitas'), REG, LV), false, 'flour tortillas');
  assert.equal(unleavened(recipe([{ ingredient: 'flour-ap' }, { name: 'Matzah meal' }]), REG, LV), false, 'a typed-in ingredient waits on a review');
  assert.equal(LIBRARY.lessons.find((L) => L.id === 'unleavened-flatbread').unleavened, true);
  assert.equal(LIBRARY.lessons.find((L) => L.id === 'buttermilk-biscuits').unleavened, false);
});

test('Appointed Times lessons are U1, U2, outside the numbered course', () => {
  assert.deepEqual(seasonalLabels(CONTENT.units), { 'unleavened-flatbread': 'U1', 'cottage-cheese-crescents': 'U2', 'soft-unleavened-bread': 'U3' });
  assert.equal(LIBRARY.course.some((d) => d.unit === 8), false);
});

test('the linter wants every Appointed Times lesson listed, and only those', () => {
  const units = CONTENT.units.map((u) => (u.seasonal ? { ...u, lessons: ['unleavened-flatbread', 'shakshuka'] } : u));
  const errors = lint({ ...CONTENT, units, registryFiles: {} }).errors.join('\n');
  assert.match(errors, /lessons doesn't list "cottage-cheese-crescents"/);
  assert.match(errors, /lists "shakshuka", which isn't a written lesson in this unit/);
});

// The unleavened swaps (§6.20): applied on the family's unleavened days.
const anyLesson = (id) => [...CONTENT.lessons, ...(CONTENT.levelLessons ?? [])].find((x) => x.data.id === id).data;

test('unleavened swaps: soft unleavened bread first, then matzah, then gluten-free matzah, by the family\'s diet', () => {
  const tuna = lesson('tuna-salad-sandwiches');
  assert.deepEqual(feastView(tuna, REG, [], LV), { ok: true, applied: [{ for: 'bread-sandwich', use: 'soft-unleavened-bread', ratio: 1 }], leftOut: [] });
  assert.equal(feastView(tuna, REG, ['egg'], LV).applied[0].use, 'matzah', 'soft unleavened bread has egg');
  // Gluten-free: the diet swap's gluten-free bread is still bread, so it's swapped again.
  assert.equal(feastView(tuna, REG, ['gluten'], LV).applied[0].use, 'matzah-gluten-free');
  assert.deepEqual(withFeast(dietView(tuna, REG, ['gluten']), feastView(tuna, REG, ['gluten'], LV)).applied.find((x) => x.for === 'bread-sandwich'), { for: 'bread-sandwich', use: 'matzah-gluten-free' });
  // A diet swap that isn't leaven (gluten-free tortillas) needs none.
  assert.deepEqual(feastView(anyLesson('shish-taouk'), REG, ['gluten'], LV).applied, []);
  assert.equal(feastView(lesson('chicken-caesar'), REG, [], LV).applied[0].ratio, 6, 'half a pan of squares for a baguette');
});

test('a lesson counts as unleavened on those days only when every leaven ingredient is swapped and no step needs a raising agent', () => {
  assert.equal(feastOk(lesson('shakshuka'), REG, [], LV), true);
  assert.equal(feastOk(lesson('buttermilk-biscuits'), REG, [], LV), false);
  assert.equal(feastOk(lesson('skillet-naan'), REG, [], LV), false);
  const soda = { ingredients: [{ ingredient: 'flour-ap' }], steps: [{ text: 'Stir in the baking soda.' }] };
  assert.equal(feastView(soda, REG, [], LV).ok, false);
  // An optional bread with no swap is left out.
  const opt = { ingredients: [{ ingredient: 'baguette', optional: true }], steps: [] };
  assert.deepEqual(feastView(opt, REG, [], LV), { ok: true, applied: [], leftOut: ['baguette'] });
});

// The unleavened versions (§6.20): written out in full where a swap changes the steps.
const NEEDS_VERSION = ['smash-burgers', 'thick-burgers', 'eggs-benedict', 'challah-french-toast', 'grilled-cheese-tomato-soup', 'molletes', 'french-onion-soup',
  'breakfast-burritos', 'pinto-bean-burritos', 'chicken-caesar-wraps', 'mezze-spread', 'skillet-cornbread', 'pan-de-elote', 'banana-bread', 'malva-pudding',
  'alfajores', 'welsh-cakes', 'brown-butter-cookies', 'chocolate-chip-cookies'];

test('each lesson whose steps need its leaven has an unleavened version, and it is unleavened for every diet', () => {
  for (const id of NEEDS_VERSION) {
    const L = anyLesson(id);
    assert.ok(unleavenedVersion(L), id);
    assert.equal(feastView(L, REG, [], LV).ok, false, `${id} can't be cooked on those days as it stands`);
    for (const f of [[], ['gluten'], ['egg'], ['dairy']]) assert.equal(feastOk(L, REG, f, LV), true, `${id} for ${f}`);
    assert.equal(unleavened(lessonVersion(L, unleavenedVersion(L).id), REG, LV), true, `${id}'s version, steps and all`);
  }
});

test('on those days a lesson is cooked as its unleavened version; one its swaps make unleavened keeps its own version', () => {
  const smash = lesson('smash-burgers');
  const turkey = lessonVersion(smash, 'turkey');
  const V = feastCook(smash, turkey, REG, [], LV);
  assert.equal(V.variation, 'unleavened', 'a taste version with buns gives way too');
  assert.equal(V.title, 'Smash burger lettuce wraps + quick pickles');
  assert.equal(V.versionOf, 'Smash burgers + quick pickles');
  assert.ok(!V.ingredients.some((x) => x.ingredient === 'burger-buns'));
  assert.ok(!V.steps.some((s) => s.id === 'toast-buns'));
  const tuna = lesson('tuna-salad-sandwiches');
  assert.equal(feastCook(tuna, tuna, REG, [], LV), tuna, 'its swaps are enough');
  const naan = lesson('skillet-naan');
  assert.equal(feastCook(naan, naan, REG, [], LV), naan, 'no version: it waits for after the feast');
  // A gluten-free family's grilled cheese is made on gluten-free matzah, by the version's diet swap.
  const gc = feastCook(lesson('grilled-cheese-tomato-soup'), lesson('grilled-cheese-tomato-soup'), REG, ['gluten'], LV);
  assert.deepEqual(dietView(gc, REG, ['gluten']).applied.find((x) => x.for === 'soft-unleavened-bread'), { for: 'soft-unleavened-bread', use: 'matzah-gluten-free' });
});

test('the linter wants an unleavened version to be unleavened, steps and all', () => {
  const L = structuredClone(lesson('malva-pudding'));
  const v = unleavenedVersion(L);
  v.steps.change.bake = { ...v.steps.change.bake, look: 'Springy, though it rises less than with baking soda.' };
  const lessons = CONTENT.lessons.map((x) => (x.data.id === 'malva-pudding' ? { ...x, data: L } : x));
  assert.match(lint({ ...CONTENT, lessons }).errors.join('\n'), /malva-pudding.json variation "unleavened": is the unleavened version, but it still has leaven/);
});

test('unleavened swaps are never diet swaps, and the linter wants them to replace leaven with something that isn\'t', () => {
  const r = { ingredients: [{ ingredient: 'pita' }], substitutions: [{ for: 'pita', use: 'matzah-gluten-free', reason: 'unleavened' }], steps: [] };
  assert.deepEqual(dietView(r, REG, ['gluten']).blockedBy, ['pita']);
  const L = lesson('fattoush');
  const bad = { ...L, substitutions: [...L.substitutions, { for: 'pita', use: 'baguette', reason: 'unleavened' }] };
  const lessons = CONTENT.lessons.map((x) => (x.data.id === 'fattoush' ? { ...x, data: bad } : x));
  assert.match(lint({ ...CONTENT, lessons, registryFiles: {} }).errors.join('\n'), /unleavened substitution uses "baguette", which is leaven/);
});
