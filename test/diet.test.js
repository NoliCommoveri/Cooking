// Per-family diet filters on the library (plan §2.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dietView } from '../src/content/diet.js';
import { LIBRARY } from '../src/worker/library-data.js';
import { buildLibrary, buildPublic } from '../tools/build-library.js';
import { makeEnv, family } from './helpers/worker.js';

const ING = {
  flour: { contains: ['gluten'] },
  'gf-flour': { contains: [] },
  butter: { contains: ['dairy'] },
  milk: { contains: ['dairy'] },
  'oat-milk': { contains: ['gluten'] },
  salt: { contains: [] },
};
const lesson = (lines, substitutions = []) => ({ ingredients: lines.map((ingredient) => ({ ingredient })), substitutions });

test('no filters shows everything', () => {
  assert.equal(dietView(lesson(['flour', 'butter']), ING, []).visible, true);
});

test('a conflicting ingredient hides the lesson', () => {
  const v = dietView(lesson(['flour', 'butter', 'salt']), ING, ['dairy']);
  assert.equal(v.visible, false);
  assert.deepEqual(v.blockedBy, ['butter']);
});

test('a diet-reason substitution that clears the tag shows it with the swap', () => {
  const v = dietView(lesson(['flour', 'salt'], [{ for: 'flour', use: 'gf-flour', reason: 'gluten' }]), ING, ['gluten']);
  assert.equal(v.visible, true);
  assert.deepEqual(v.applied, [{ for: 'flour', use: 'gf-flour' }]);
});

test('a substitution that brings in another filtered tag does not count', () => {
  const v = dietView(lesson(['milk'], [{ for: 'milk', use: 'oat-milk', reason: 'dairy' }]), ING, ['dairy', 'gluten']);
  assert.equal(v.visible, false);
});

test('an optional ingredient with a filtered tag is left out, not a reason to hide', () => {
  const L = { ingredients: [{ ingredient: 'salt' }, { ingredient: 'butter', optional: true }], substitutions: [] };
  const v = dietView(L, ING, ['dairy']);
  assert.equal(v.visible, true);
  assert.deepEqual(v.leftOut, ['butter']);
});

test('an availability substitution is not a diet swap', () => {
  const v = dietView(lesson(['flour'], [{ for: 'flour', use: 'gf-flour', reason: 'availability' }]), ING, ['gluten']);
  assert.equal(v.visible, false);
});

test('src/worker/library-data.js is up to date with the content (run: node tools/build-library.js)', () => {
  assert.equal(readFileSync(new URL('../src/worker/library-data.js', import.meta.url), 'utf8'), buildLibrary());
});

test('public/content and public/lib are up to date (run: node tools/build-library.js)', () => {
  const files = buildPublic();
  for (const [path, text] of Object.entries(files)) {
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
    assert.equal(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), text, `${path} is out of date`);
  }
  const lessons = readdirSync(new URL('../public/content/lessons/', import.meta.url));
  assert.equal(lessons.length, Object.keys(files).filter((p) => p.startsWith('public/content/lessons/')).length, 'no stray lesson files');
});

test('every lesson has a web picture for the app (run: python3 tools/build-dish-images.py)', () => {
  for (const L of LIBRARY.lessons) assert.ok(existsSync(new URL(`../public/${L.image}`, import.meta.url)), L.image);
});

test('the library API applies the family\'s filters', async () => {
  const env = await makeEnv();
  const c = await family(env, 'Carsons', 'jen@example.com');
  const all = (await c.get('/api/library')).body;
  assert.equal(all.lessons.length, LIBRARY.lessons.length);
  assert.equal(all.hidden, 0);

  await c.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: ['gluten'] });
  const gf = (await c.get('/api/library')).body;
  const bulgogi = gf.lessons.find((l) => l.number === 14);
  assert.ok(bulgogi, 'bulgogi stays: tamari replaces soy sauce');
  assert.deepEqual(bulgogi.substitutions.map((s) => s.use), ['Tamari']);
  assert.ok(!gf.lessons.some((l) => l.number === 38), 'biscuits have flour and no swap');

  await c.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: ['dairy'] });
  const df = (await c.get('/api/library')).body;
  const shakshuka = df.lessons.find((l) => l.number === 4);
  assert.ok(shakshuka, 'shakshuka stays: its feta is optional');
  assert.ok(shakshuka.left_out.length > 0);
  assert.equal(gf.hidden, all.lessons.length - gf.lessons.length);
});
