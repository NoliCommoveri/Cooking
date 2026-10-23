// Course progress and rewards (plan §5.2, §5.4, Phase 5): ranks, stamps,
// passport pages, the skill tree, skills, and what's new since last shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rewards, rankFor, newSince, RANKS } from '../src/content/rewards.js';

const registry = JSON.parse(readFileSync('public/content/registry.json', 'utf8'));
const course = JSON.parse(readFileSync('public/content/course.json', 'utf8'));
const at = (d) => `2026-10-${String(d).padStart(2, '0')}T15:00:00.000Z`;
const cooked = (ids) => Object.fromEntries(ids.map((id, i) => [id, { times: 1, first: at(i + 1), last: at(i + 1) }]));

test('ranks: 0, 5, 15, 30, 50, and Executive Chef at 75 (owner, 2026-10-23)', () => {
  assert.deepEqual(RANKS.map((r) => [r.name, r.at]), [['Kitchen Apprentice', 0], ['Prep Cook', 5], ['Line Cook', 15], ['Sous Chef', 30], ['Head Chef', 50], ['Executive Chef', 75]]);
  assert.equal(rankFor(0).name, 'Kitchen Apprentice');
  assert.equal(rankFor(4).next.name, 'Prep Cook');
  assert.equal(rankFor(5).name, 'Prep Cook');
  assert.equal(rankFor(49).name, 'Sous Chef');
  assert.equal(rankFor(74).name, 'Head Chef');
  assert.equal(rankFor(75).name, 'Executive Chef');
  assert.equal(rankFor(80).next, null);
});

test('a lesson earns its stamp and skills; a family recipe counts toward rank only', () => {
  const r = rewards({ ...cooked(['shakshuka']), 'recipe:abc': { times: 2, first: at(3), last: at(4) } }, registry, course);
  assert.equal(r.dishes, 2);
  assert.deepEqual(r.stamps.map((s) => [s.id, s.cuisine, s.region]), [['shakshuka', 'north-african', 'mena']]);
  assert.deepEqual(r.skills.filter((s) => s.earned).map((s) => s.id).sort(), ['building-a-sauce', 'poaching-eggs']);
  const mena = r.regions.find((x) => x.id === 'mena');
  assert.equal(mena.done, 1);
  assert.ok(mena.slots.length > 1, 'the page shows the region\'s dishes not cooked yet');
});

test('cooking the same lesson again or an unknown id earns nothing more', () => {
  const r = rewards({ shakshuka: { times: 3, first: at(1), last: at(9) }, 'no-such-dish': { times: 1, first: at(2), last: at(2) } }, registry, course);
  assert.equal(r.dishes, 1);
  assert.equal(r.stamps[0].date, at(1), 'the stamp carries the first date');
});

test('the skill tree has a path per unit, every planned dish on it, and Appointed Times beside it', () => {
  const r = rewards(cooked(['spring-rolls', 'unleavened-flatbread']), registry, course);
  const planned = r.paths.filter((p) => !p.seasonal).reduce((n, p) => n + p.nodes.length, 0);
  assert.equal(planned, course.dishes.length);
  const feast = r.paths.find((p) => p.seasonal);
  assert.deepEqual(feast.nodes.map((n) => n.id), ['unleavened-flatbread', 'cottage-cheese-crescents']);
  assert.equal(feast.done, 1);
  assert.equal(r.paths.find((p) => p.unit === 1).done, 1);
});

test('every planned dish has a passport page', () => {
  const r = rewards({}, registry, course);
  const slots = r.regions.reduce((n, x) => n + x.slots.length, 0);
  assert.equal(slots, course.dishes.length + 2, 'the course and the two Appointed Times lessons');
});

test('what\'s new: nothing the first time, then new stamps, skills, and a rank up', () => {
  const four = rewards(cooked(['spring-rolls', 'chicken-fajitas', 'shoestring-fries', 'shakshuka']), registry, course);
  const first = newSince(null, four);
  assert.deepEqual([first.stamps, first.skills, first.rankUp], [[], [], false]);
  const five = rewards(cooked(['spring-rolls', 'chicken-fajitas', 'shoestring-fries', 'shakshuka', 'beef-bulgogi']), registry, course);
  const news = newSince(first.now, five);
  assert.deepEqual(news.stamps.map((s) => s.id), ['beef-bulgogi']);
  assert.deepEqual(news.skills.map((s) => s.id).sort(), ['marinating', 'thin-slicing']);
  assert.equal(news.rankUp, true);
  const again = newSince(news.now, five);
  assert.deepEqual([again.stamps, again.skills, again.rankUp], [[], [], false]);
});
