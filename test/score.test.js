// Phase 11d1: scoring (plan §6.21). On the main track nothing is ruled out;
// dishes are only ranked (owner, 2026-10-24).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreDish, rankVersions, WEIGHTS } from '../src/content/score.js';

const rated = (name, ratings) => ({ id: name.toLowerCase(), name, ratings: { protein: {}, flavor: {}, ingredient: {}, ...ratings } });
const names = { protein: { beef: 'Beef', chicken: 'Chicken' }, flavor: { 'herby-lemony': 'Herby and lemony' }, ingredient: { mushrooms: 'Mushrooms' }, tool: { 'immersion-blender': 'Immersion blender' } };
const ctx = (profiles, limits = {}) => ({ profiles, limits, names });

// A made-up lesson: no written lesson uses mushrooms yet.
const stroganoff = {
  id: 'stroganoff', title: 'Chicken stroganoff', totalMinutes: 40,
  tags: { protein: 'chicken', flavors: ['herby-lemony'], budget: '$$', familiar: 'everyday', veggies: 'light' },
  tasteItems: { required: ['mushrooms'], optional: [] }, tools: [],
  variations: [
    { id: 'beef-mushroom', title: 'Beef stroganoff', tags: { protein: 'beef', flavors: ['herby-lemony'], budget: '$$', familiar: 'everyday', veggies: 'light' }, tasteItems: { required: ['mushrooms'], optional: [] }, totalMinutes: 40, tools: [] },
    { id: 'beef', title: 'Beef and noodles', tags: { protein: 'beef', flavors: ['herby-lemony'], budget: '$$', familiar: 'everyday', veggies: 'light' }, tasteItems: { required: [], optional: [] }, totalMinutes: 40, tools: [] },
  ],
};

test('a kid who rates mushrooms 1 star and beef 4 gets the beef version with no mushrooms', () => {
  const sam = rated('Sam', { protein: { beef: 4 }, ingredient: { mushrooms: 1 } });
  const ranked = rankVersions(stroganoff, ctx([sam]));
  assert.equal(ranked[0].id, 'beef');
  assert.equal(ranked[0].fits, true);
  assert.deepEqual(ranked[0].why, ['Sam loves beef']);
  // The mushroom versions don't fit, and say why, but they stay on the list.
  assert.equal(ranked.length, 3);
  assert.ok(ranked.slice(1).every((v) => !v.fits && v.label === "Doesn't fit"));
  assert.ok(ranked[1].notes.includes('Sam: 1 star on mushrooms'));
});

test('limits take points off with a note, and never rule a dish out', () => {
  const sam = rated('Sam', { protein: { chicken: 3 } });
  const long = { tags: { protein: 'chicken', budget: '$$$' }, totalMinutes: 75, tools: ['immersion-blender'] };
  const s = scoreDish(long, ctx([sam], { max_minutes: 45, budget: '$', missing_tools: ['immersion-blender'] }));
  assert.equal(s.fits, true);
  // 1 for chicken; 2 for 30 minutes over, 2 for two $ over, 2 for the tool.
  assert.equal(s.score, 1 + 2 * WEIGHTS.perStepOver + 2 * WEIGHTS.perBudgetOver + WEIGHTS.perMissingTool);
  assert.deepEqual(s.notes, ['Takes 75 minutes; your nights are 45', '$$$ a serving; your budget is $', 'Needs immersion blender']);
  // Alone, it's still the pick; beside a dish within the limits, it loses.
  const quick = { tags: { protein: 'chicken', budget: '$' }, totalMinutes: 30, tools: [] };
  const lesson = { ...long, id: 'long', title: 'Long', variations: [{ ...quick, id: 'quick', title: 'Quick' }] };
  assert.equal(rankVersions(lesson, ctx([sam], { max_minutes: 45, budget: '$', missing_tools: ['immersion-blender'] }))[0].id, 'quick');
});

test("a 1 star on a flavor or an optional ingredient doesn't rule a version out", () => {
  const sam = rated('Sam', { flavor: { 'herby-lemony': 1 }, ingredient: { mushrooms: 1 } });
  const s = scoreDish({ tags: { protein: 'chicken', flavors: ['herby-lemony'] }, tasteItems: { required: [], optional: ['mushrooms'] } }, ctx([sam]));
  assert.equal(s.fits, true);
  assert.equal(s.score, WEIGHTS.stars[1]);
});

test("Haven't tried counts by how adventurous the family is; nothing rated gives no fit word", () => {
  const sam = rated('Sam', { protein: { chicken: null } });
  const dish = { tags: { protein: 'chicken' } };
  assert.equal(scoreDish(dish, ctx([sam], { adventurous: 'adventurous' })).score, 0.5);
  assert.equal(scoreDish(dish, ctx([sam], { adventurous: 'familiar' })).score, -0.5);
  const none = scoreDish(dish, ctx([rated('Ada', {})]));
  assert.equal(none.known, false);
  assert.equal(none.label, null);
});

test('the cook is everyone on it: the average, and ties go to the least-unhappy', () => {
  const ava = rated('Ava', { protein: { beef: 5, chicken: 3 } });
  const ben = rated('Ben', { protein: { beef: 2, chicken: 3 } });
  // Beef: (3 + 0) / 2 = 1.5; chicken: 1. Beef wins on the average.
  const lesson = { id: 'x', title: 'Chicken', tags: { protein: 'chicken' }, variations: [{ id: 'beef', title: 'Beef', tags: { protein: 'beef' } }] };
  assert.equal(rankVersions(lesson, ctx([ava, ben]))[0].id, 'beef');
  // Even: chicken is 1 for both; beef is 2 for one and 0 for the other.
  const even = [rated('Ava', { protein: { beef: 4, chicken: 3 } }), rated('Ben', { protein: { beef: 2, chicken: 3 } })];
  assert.equal(rankVersions(lesson, ctx(even))[0].id, '');
});
