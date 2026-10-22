import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/lint-content.js';
import { scaleLesson, servingOptions } from '../src/content/scale.js';

const c = loadContent();
const REG = Object.fromEntries(c.ingredients.map(i => [i.id, i]));
const lesson = n => c.lessons.find(l => l.data.id === n).data;
const line = (r, id) => r.ingredients.find(i => i.id === id);

test('free scaling offers 1 to 12; fixed offers only its multipliers', () => {
  assert.deepEqual(servingOptions(lesson('shakshuka')), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(servingOptions(lesson('buttermilk-biscuits')), [3, 6, 12]);
});

test('shakshuka for 4: one egg each, and the step says so', () => {
  const r = scaleLesson(lesson('shakshuka'), REG, 4);
  assert.equal(line(r, 'egg').line, '4 large eggs');
  assert.match(r.steps.find(s => s.id === 'crack').text, /\(4 in all\)/);
  assert.equal(r.note, null);
});

test('the pan note appears above 8 servings', () => {
  assert.match(scaleLesson(lesson('shakshuka'), REG, 10).note, /two 12-inch skillets/);
});

test('"to taste" and "for the pan" lines don\'t scale', () => {
  const small = scaleLesson(lesson('beef-bulgogi'), REG, 2), big = scaleLesson(lesson('beef-bulgogi'), REG, 12);
  assert.equal(line(small, 'vegetable-oil').amount, line(big, 'vegetable-oil').amount);
  assert.equal(line(scaleLesson(lesson('shakshuka'), REG, 2), 'black-pepper').line, 'Black pepper, a few grinds');
});

test('fixed sizes refuse in-between serving counts', () => {
  assert.throws(() => scaleLesson(lesson('buttermilk-biscuits'), REG, 4), /can't be made for 4/);
  const half = scaleLesson(lesson('brown-butter-cookies'), REG, 3);
  assert.equal(line(half, 'egg').line, '1 large egg');
  assert.match(half.note, /12 cookies/);
});

test('every lesson renders at every allowed size with nothing left unfilled', () => {
  for (const { data: L } of c.lessons) for (const n of servingOptions(L)) {
    const out = JSON.stringify(scaleLesson(L, REG, n));
    assert.doesNotMatch(out, /NaN|undefined|Infinity|\{(n|qty):/, `${L.id} at ${n}`);
  }
});
