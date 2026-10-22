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
  const pita = find(list, 'pita');
  assert.equal(pita.buy, null);
  assert.equal(pita.amountless, true);
  const skipped = shoppingList({ lessons: [{ lesson: L('shakshuka'), servings: 6 }], registry, skip: ['egg'] });
  assert.equal(find(skipped, 'egg'), undefined);
});

test("diet swaps land on the list, and left-out ingredients don't", () => {
  const list = shoppingList({ lessons: [{ lesson: L('beef-bulgogi'), servings: 6 }], registry, filters: ['gluten'] });
  assert.ok(find(list, 'tamari'));
  assert.equal(find(list, 'soy-sauce'), undefined);
});
