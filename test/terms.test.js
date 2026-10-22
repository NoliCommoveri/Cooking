import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/lint-content.js';
import { findTerms } from '../src/content/terms.js';

const { terms } = loadContent();
const words = text => findTerms(text, terms).map(h => text.slice(h.start, h.end));

test('kitchen words are found in step text, in order', () => {
  assert.deepEqual(words('Dice the onion and mince the garlic.'), ['Dice', 'mince']);
  assert.deepEqual(words('Slice it across the grain.'), ['Slice', 'across the grain']);
});

test('parts of other words are not matched', () => {
  assert.deepEqual(words('Chopsticks and a diced-up dicey plan'), ['diced']);
});
