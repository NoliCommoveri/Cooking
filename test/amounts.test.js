// How much? in cook mode: which ingredients a step names (owner, 2026-10-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ingredientsInStep, phrasesFor } from '../src/content/amounts.js';

const ING = Object.fromEntries(JSON.parse(readFileSync('content/ingredients.json', 'utf8')).ingredients.map((x) => [x.id, x]));
const lesson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const named = (L, stepId) => {
  const s = L.steps.find((x) => x.id === stepId);
  return ingredientsInStep(s, s.text, L.ingredients, ING);
};

test('a step names the ingredients it uses, by their short names', () => {
  const pita = lesson('content/lessons/pita-bread.json');
  assert.deepEqual(named(pita, 'bloom'), ['water', 'yeast-active-dry', 'sugar']);
  assert.deepEqual(named(pita, 'mix'), ['flour-ap', 'salt', 'olive-oil']);
  assert.deepEqual(named(pita, 'bake'), []);
});

test("a longer name wins its words: vegetable oil isn't olive oil, garlic powder isn't garlic", () => {
  const bulgogi = lesson('content/lessons/beef-bulgogi.json');
  assert.deepEqual(named(bulgogi, 'heat'), ['vegetable-oil']);
  const caesar = lesson('content/lessons/chicken-caesar.json');
  assert.ok(!named(caesar, 'croutons-toss').includes('garlic'));
});

test('describing words alone match nothing, a wash step names nothing, and any fish is "the fish"', () => {
  assert.ok(!phrasesFor(ING['sugar-brown'] ?? ING['brown-sugar']).includes('brown'));
  const loaf = lesson('content/levels/recipes/sandwich-loaf.json');
  assert.deepEqual(ingredientsInStep({ type: 'wash', text: 'Wash your hands with soap and water.' }, '', loaf.ingredients, ING), []);
  const tacos = lesson('content/lessons/fish-tacos.json');
  assert.ok(named(tacos, 'fish-pan').length > 0);
});

test('a {qty:} placeholder names its ingredient outright', () => {
  const burgers = lesson('content/levels/recipes/thick-burgers.json');
  const s = burgers.steps.find((x) => x.id === 'shape');
  assert.ok(ingredientsInStep({ ...s, text: 'Season both sides.' }, s.text, burgers.ingredients, ING).includes('black-pepper'));
});

test('"rice" is the rice, not rice vinegar; "salt and pepper" is the spice', () => {
  const stirFry = lesson('content/lessons/vegetable-stir-fry.json');
  assert.deepEqual(named(stirFry, 'cook-rice'), ['rice-white', 'water']);
  const tabbouleh = lesson('content/levels/recipes/tabbouleh.json');
  assert.deepEqual(named(tabbouleh, 'dress'), ['lemon', 'olive-oil', 'salt', 'black-pepper']);
});
