import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatVolume, formatWeight, formatButter, roundCount, mixed, VOLUME, WEIGHT } from '../src/content/units.js';

const tsp = n => n * VOLUME.tsp;

test('volumes show as measuring-set amounts', () => {
  assert.equal(formatVolume(tsp(0.75)), '¾ tsp');
  assert.equal(formatVolume(tsp(1.5)), '1 ½ tsp');
  assert.equal(formatVolume(tsp(3)), '1 tbsp');
  assert.equal(formatVolume(tsp(4.5)), '1 tbsp + 1 ½ tsp');
  assert.equal(formatVolume(tsp(12)), '¼ cup');
  assert.equal(formatVolume(tsp(16)), '⅓ cup');
  assert.equal(formatVolume(tsp(18)), '¼ cup + 2 tbsp');
  assert.equal(formatVolume(tsp(48)), '1 cup');
  assert.equal(formatVolume(tsp(108)), '2 ¼ cups');
  assert.equal(formatVolume(tsp(0.02)), 'a pinch');
});

test('16 tablespoons becomes a cup', () => {
  assert.equal(formatVolume(16 * VOLUME.tbsp), '1 cup');
});

test('weights switch from ounces to pounds', () => {
  assert.equal(formatWeight(12 * WEIGHT.oz), '12 oz');
  assert.equal(formatWeight(2 * WEIGHT.lb), '2 lb');
  assert.equal(formatWeight(1.25 * WEIGHT.lb), '1 ¼ lb');
});

test('butter shows as sticks and tablespoons', () => {
  assert.equal(formatButter(8 * 14.2), '1 stick (8 tbsp)');
  assert.equal(formatButter(10 * 14.2), '1 stick + 2 tbsp');
  assert.equal(formatButter(4 * 14.2), '4 tbsp');
});

test('counts round the way each line says, never below the minimum', () => {
  assert.equal(roundCount(2.2, 'up'), 3);
  assert.equal(roundCount(2.7, 'down'), 2);
  assert.equal(roundCount(2.5, 'nearest'), 3);
  assert.equal(roundCount(0.2, 'nearest'), 1);
});

test('mixed numbers', () => {
  assert.equal(mixed(2.25), '2 ¼');
  assert.equal(mixed(0.5), '½');
  assert.equal(mixed(3), '3');
});
