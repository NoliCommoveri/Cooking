// Lesson numbers come from the course order (owner, 2026-10-22): a pick-one
// group shares a number with a letter, and a family's plan can reorder the
// course and remove dishes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numberCourse, courseEntries, prereqNotes } from '../src/content/course.js';
import { makeDb } from './helpers/d1.js';
import { applyPending } from '../src/worker/migrate.js';
import { MIGRATIONS } from '../src/worker/migrations/index.js';

const C = JSON.parse(readFileSync('content/course.json', 'utf8')).dishes;

test('the suggested order: 75 dishes, 59 numbers, pick-one groups lettered', () => {
  const { labels, total } = numberCourse(C);
  assert.equal(total, 59);
  assert.equal(Object.keys(labels).length, 75);
  assert.deepEqual(['spring-rolls', 'chicken-fajitas', 'shoestring-fries'].map((id) => labels[id]), ['1a', '1b', '1c']);
  assert.equal(labels['chicken-caesar'], '4');
  assert.equal(labels.shakshuka, '8a');
  assert.equal(labels['beef-bulgogi'], '27');
  assert.equal(labels['buttermilk-biscuits'], '40a');
  assert.equal(labels['apple-pie'], '59');
  assert.deepEqual(prereqNotes(C), [], 'the suggested order keeps prerequisites first');
});

test("a family's plan: reordered, with dishes removed", () => {
  const keys = courseEntries(C).map((e) => e.key);
  // Desserts first, the cookies' dish removed, and two of the julienne group gone.
  const plan = { order: [...keys.slice(-4), ...keys.slice(0, -4)], removed: ['brown-butter-cookies', 'chicken-fajitas', 'shoestring-fries'] };
  const { labels, total } = numberCourse(C, plan);
  assert.equal(total, 58);
  assert.equal(labels['malva-pudding'], '1');
  assert.equal(labels['brown-butter-cookies'], undefined);
  assert.equal(labels['spring-rolls'], '4', 'a group left with one dish has no letter');
  assert.equal(labels['apple-pie'], '3');
  const notes = prereqNotes(C, plan).map((n) => n.text);
  assert.ok(notes.some((t) => /Apple pie with lattice comes before Spinach & mushroom quiche/.test(t)), notes.join('\n'));
});

test('a dish added to the course since a plan was saved goes in after the one it follows', () => {
  const keys = courseEntries(C).map((e) => e.key).filter((k) => k !== 'chicken-caesar');
  assert.equal(numberCourse(C, { order: keys, removed: [] }).labels['chicken-caesar'], '4');
});

test('removing a prerequisite is noted', () => {
  const notes = prereqNotes(C, { order: [], removed: ['cacio-e-pepe'] });
  assert.deepEqual(notes.map((n) => n.id), ['eggs-benedict']);
  assert.match(notes[0].text, /removed/);
});

test('migration 0005 renames saved lesson ids', async () => {
  const db = makeDb();
  await applyPending(db, MIGRATIONS.filter((m) => m.id < '0005'));
  await db.prepare("INSERT INTO families (id, created_at) VALUES ('f', 'now')").run();
  await db.prepare("INSERT INTO attempts (id, family_id, lesson_id, lesson_version, servings, started_at) VALUES ('a', 'f', '04-shakshuka', 1, 6, 'now')").run();
  await db.prepare("INSERT INTO lesson_patches (id, lesson_id, base_version, field_path, applied_by, applied_at) VALUES ('p', '14-beef-bulgogi', 1, 'totalMinutes', 'x', 'now')").run();
  await applyPending(db);
  assert.equal((await db.prepare("SELECT lesson_id FROM attempts WHERE id = 'a'").first()).lesson_id, 'shakshuka');
  assert.equal((await db.prepare("SELECT lesson_id FROM lesson_patches WHERE id = 'p'").first()).lesson_id, 'beef-bulgogi');
});
