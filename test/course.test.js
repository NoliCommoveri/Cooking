// Lesson numbers come from the course order (owner, 2026-10-22): a pick-one
// group shares a number with a letter, and a family's plan can reorder the
// course and remove dishes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numberCourse, courseEntries, prereqNotes, courseNo } from '../src/content/course.js';
import { weekLabels, suggestProgram, PLACE_QUIZ, PLACE_PARTS, READY_FOR } from '../src/content/levels.js';

const C = JSON.parse(readFileSync('content/course.json', 'utf8')).dishes;

test('the suggested order: 99 dishes, 59 numbers, pick-one groups lettered', () => {
  const { labels, total } = numberCourse(C);
  assert.equal(total, 59);
  assert.equal(Object.keys(labels).length, 99);
  assert.deepEqual(['spring-rolls', 'chicken-fajitas', 'shoestring-fries'].map((id) => labels[id]), ['S1a', 'S1b', 'S1c']);
  assert.equal(labels['chicken-caesar'], 'S4a');
  assert.equal(labels['chicken-souvlaki-pitas'], 'S4b', 'a dish added to a group shares its number');
  assert.equal(labels['vegetable-stir-fry'], 'S9c', 'a Level 3 recipe fills a group with room');
  assert.equal(labels['pita-bread'], labels['skillet-naan'].replace('a', 'b'), 'a new pair shares one number');
  assert.equal(labels['chicken-jambalaya'], labels['jollof-rice'].replace('a', 'b'), 'jambalaya pairs with jollof');
  assert.equal(labels.shakshuka, 'S8a');
  assert.equal(labels['beef-bulgogi'], 'S27');
  assert.equal(labels.japchae, labels['lomo-saltado'].replace('a', 'c'), 'japchae is the third thin-slicing dish');
  assert.equal(labels['buttermilk-biscuits'], 'S40a');
  assert.equal(labels['apple-pie'], 'S59');
  assert.deepEqual(prereqNotes(C), [], 'the suggested order keeps prerequisites first');
});

test("a family's plan: reordered, with dishes removed", () => {
  const keys = courseEntries(C).map((e) => e.key);
  // Desserts first, the cookies' dish removed, and two of the julienne group gone.
  const plan = { order: [...keys.slice(-4), ...keys.slice(0, -4)], removed: ['brown-butter-cookies', 'chicken-fajitas', 'shoestring-fries'] };
  const { labels, total } = numberCourse(C, plan);
  assert.equal(total, 58);
  assert.equal(labels['malva-pudding'], 'S1');
  assert.equal(labels['brown-butter-cookies'], undefined);
  assert.equal(labels['spring-rolls'], 'S4', 'a group left with one dish has no letter');
  assert.equal(labels['apple-pie'], 'S3');
  const notes = prereqNotes(C, plan).map((n) => n.text);
  assert.ok(notes.some((t) => /Apple pie with lattice comes before Spinach & mushroom quiche/.test(t)), notes.join('\n'));
});

test('a dish added to the course since a plan was saved goes in after the one it follows', () => {
  const keys = courseEntries(C).map((e) => e.key).filter((k) => k !== 'smash-burgers');
  assert.equal(numberCourse(C, { order: keys, removed: [] }).labels['smash-burgers'], 'S5');
});

test('removing a prerequisite is noted', () => {
  const notes = prereqNotes(C, { order: [], removed: ['cacio-e-pepe'] });
  assert.deepEqual(notes.map((n) => n.id), ['eggs-benedict']);
  assert.match(notes[0].text, /removed/);
});

test("a Cook Around the World label counts its place in the course; others stay as they are", () => {
  assert.deepEqual(['S27', 'S8a', 'U1', 'C4a', null].map(courseNo), ['27', '8a', 'U1', 'C4a', null]);
});

test("a Level's labels: its letter, the week, and a for Familiar or b for Explore", () => {
  assert.deepEqual(weekLabels([{ week: 4, familiar: 'minestrone', explore: 'ajapsandali' }, { week: 35, kind: 'capstone' }], 'C'), { minestrone: 'C4a', ajapsandali: 'C4b' });
});

test("Help me choose suggests by the lowest answer, and Cook Around the World only for just the recipes at Level 3 or 4", () => {
  const offered = ['sp-2', 'sp-3', 'sp-4'];
  const s = (levels, parts, o = offered) => suggestProgram(levels, parts, o);
  assert.deepEqual(s([4, 4, 4], 'parts'), { id: 'sp-4', under: false, caw: false, partsOff: false });
  assert.deepEqual(s([4, 3, 4], 'recipes'), { id: 'sp-3', under: false, caw: true, partsOff: true });
  assert.deepEqual(s([4, 4, 4], 'recipes'), { id: 'sp-4', under: false, caw: true, partsOff: true });
  // Ready for a chef's knife but not the stove: Level 2, never Cook Around the World.
  assert.deepEqual(s([3, 2, 4], 'recipes'), { id: 'sp-2', under: false, caw: false, partsOff: true });
  assert.deepEqual(s([3, 2, 4], 'parts'), { id: 'sp-2', under: false, caw: false, partsOff: false });
  // Level 1 isn't offered yet: the lowest Level, marked under.
  assert.deepEqual(s([1, 3, 3], 'parts'), { id: 'sp-2', under: true, caw: false, partsOff: false });
  assert.deepEqual(s([1, 1, 1], 'parts', [...offered, 'sp-1']), { id: 'sp-1', under: false, caw: false, partsOff: false });
  // Every readiness answer points at a Level, and each program has its line.
  for (const { answers } of PLACE_QUIZ) assert.deepEqual(answers.map(([, n]) => n), [1, 2, 3, 4]);
  assert.deepEqual(PLACE_PARTS.answers.map(([v]) => v), ['parts', 'recipes']);
  assert.deepEqual(Object.keys(READY_FOR), ['caw', 'levels']);
});
