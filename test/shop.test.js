// The shopping list (plan §6.3): merged, rounded to packages, kitchen
// staples grouped as may already have, grouped by store section.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoppingList, SECTIONS } from '../src/content/shop.js';
import { CONTENT } from '../src/worker/content-data.js';
import { lint } from '../src/content/lint.js';

const registry = Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i]));
const L = (id) => CONTENT.lessons.find((x) => x.data.id === id).data;
const find = (list, id) => list.sections.flatMap((s) => s.items).find((x) => x.id === id);

test('every ingredient has a store section from the list and a package size', () => {
  const ids = new Set(SECTIONS.map(([id]) => id));
  for (const i of CONTENT.ingredients) {
    // Water comes from the tap: never bought, so no package.
    if (i.section === 'tap') { assert.equal(i.purchaseUnit, null, i.id); continue; }
    assert.ok(ids.has(i.section), `${i.id}: ${i.section}`);
    assert.ok(i.purchaseUnit?.amount > 0, i.id);
  }
});

test('the linter wants a package size on every ingredient', () => {
  const c = { ...CONTENT, ingredients: CONTENT.ingredients.map((i, n) => (n ? i : (({ purchaseUnit, ...rest }) => rest)(i))) };
  c.registryFiles = { 'ingredients.json': { ingredients: c.ingredients } };
  assert.ok(lint(c).errors.some((e) => /purchaseUnit/.test(e)));
});

test('the same ingredient from two lessons is one line, each lesson at its own size', () => {
  const one = shoppingList({ lessons: [{ lesson: L('buttermilk-biscuits'), servings: 12 }], registry });
  const two = shoppingList({ lessons: [{ lesson: L('buttermilk-biscuits'), servings: 12 }, { lesson: L('brown-butter-cookies'), servings: 12 }], registry });
  const butter = find(two, 'butter-unsalted');
  assert.deepEqual(butter.from, ['Buttermilk biscuits', 'Brown butter chocolate chip cookies']);
  assert.ok(two.sections.flatMap((s) => s.items).filter((x) => x.id === 'butter-unsalted').length === 1);
  assert.notEqual(find(one, 'butter-unsalted').used, butter.used);
  // Rounded up to whole packages, with what's used beside it.
  assert.match(butter.buy, /^\d+ × 1-lb box/);
  assert.equal(find(two, 'egg').buy, '1 dozen eggs');
});

test("kitchen staples stay on the list, grouped as may already have; on-hand items are left off", () => {
  const list = shoppingList({ lessons: [{ lesson: L('shakshuka'), servings: 6 }], registry, staples: ['olive-oil'] });
  assert.deepEqual(list.may_have.map((x) => x.id), ['olive-oil']);
  assert.ok(list.may_have[0].buy, 'a staple still says what to buy');
  assert.equal(find(list, 'olive-oil'), undefined);
  const order = SECTIONS.map(([id]) => id);
  const at = list.sections.map((x) => order.indexOf(x.id));
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
  // Serving pita has an amount, so the list says how much to buy.
  assert.equal(find(list, 'pita').buy, '1 × 6-pack of pitas');
  // Ketchup for dipping is a bottle (owner, 2026-10-24).
  assert.equal(find(shoppingList({ lessons: [{ lesson: L('hash-browns'), servings: 6 }], registry }), 'ketchup').buy, '1 × 20-oz bottle');
  // A line with no amount ("a few grinds") is listed without one.
  const pepper = find(shoppingList({ lessons: [{ lesson: L('french-omelet'), servings: 6 }], registry }), 'black-pepper');
  assert.equal(pepper.buy, null);
  assert.equal(pepper.amountless, true);
  const skipped = shoppingList({ lessons: [{ lesson: L('shakshuka'), servings: 6 }], registry, skip: ['egg'] });
  assert.equal(find(skipped, 'egg'), undefined);
});

test("diet swaps land on the list, and left-out ingredients don't", () => {
  const list = shoppingList({ lessons: [{ lesson: L('beef-bulgogi'), servings: 6 }], registry, filters: ['gluten'] });
  assert.ok(find(list, 'tamari'));
  assert.equal(find(list, 'soy-sauce'), undefined);
});

test('water from the tap is never on a shopping list', () => {
  const registry = Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i]));
  const L = CONTENT.lessons.find((x) => x.data.id === 'unleavened-flatbread').data;
  const list = shoppingList({ lessons: [{ lesson: L, servings: 6 }], registry });
  const ids = list.sections.flatMap((s) => s.items.map((x) => x.id));
  assert.ok(ids.includes('flour-ap'));
  assert.ok(!ids.includes('water'));
});

test('on the unleavened days a lesson\'s unleavened swaps are bought instead, by their ratio', () => {
  const tuna = L('tuna-salad-sandwiches');
  const list = (feast) => shoppingList({ lessons: [{ lesson: tuna, servings: tuna.servings, feast }], registry, leaven: CONTENT.rules.leaven });
  assert.ok(find(list(false), 'bread-sandwich'));
  assert.equal(find(list(true), 'bread-sandwich'), undefined);
  assert.equal(find(list(true), 'soft-unleavened-bread').buy, '1 pan, made from lesson U3', '12 squares for 12 slices');
  const caesar = L('chicken-caesar');
  const c = shoppingList({ lessons: [{ lesson: caesar, servings: caesar.servings, feast: true }], registry, leaven: CONTENT.rules.leaven });
  assert.equal(find(c, 'soft-unleavened-bread').used, '6 squares of soft unleavened bread', 'a baguette is half a pan');
});
