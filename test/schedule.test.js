// The weekly schedule (plan §6.18): worked out, not stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, weekOf, addDays, localDay, shopWeek } from '../src/worker/schedule.js';

const L = ['a', 'b', 'c', 'd', 'e', 'f'];
const course = { start_date: '2026-09-06', per_week: 2 }; // a Sunday
const ids = (w) => w.lessons.map((x) => x.id);

test('weeks run Sunday to Friday (Saturday is the Sabbath), and family days come from the browser offset', () => {
  assert.equal(weekOf('2026-09-12'), '2026-09-06'); // Saturday
  assert.equal(weekOf('2026-09-06'), '2026-09-06');
  assert.equal(addDays('2026-09-06', 7), '2026-09-13');
  // 2am UTC Monday is still Sunday evening in Chicago.
  assert.equal(localDay('2026-09-14T02:00:00Z', 300), '2026-09-13');
});

test('on track: each week holds the next lessons at the pace', () => {
  const s = schedule({ course, lessons: L, today: '2026-09-07' });
  assert.deepEqual(ids(s.this_week), ['a', 'b']);
  assert.deepEqual(ids(s.next_week), ['c', 'd']);
  assert.equal(s.planned_finish, '2026-09-20');
  assert.equal(s.projected_finish, '2026-09-20');
  assert.equal(s.weeks_behind, 0);
  assert.equal(s.shows_next, false, 'next week shows from Thursday');
  assert.equal(schedule({ course, lessons: L, today: '2026-09-10' }).shows_next, true);
});

test('a lesson not cooked goes first next week, and everything shifts', () => {
  const s = schedule({ course, lessons: L, done: { a: '2026-09-08' }, today: '2026-09-14' });
  assert.deepEqual(ids(s.this_week), ['b', 'c']);
  assert.deepEqual(s.this_week.lessons.map((x) => x.overdue), [true, false]);
  assert.equal(s.lessons_behind, 1);
  assert.equal(s.projected_finish, '2026-09-27');
  assert.equal(s.weeks_behind, 1);
});

test('cooking ahead counts, and the rest moves up', () => {
  const s = schedule({ course, lessons: L, done: { a: '2026-09-07', b: '2026-09-07', c: '2026-09-08' }, today: '2026-09-09' });
  assert.deepEqual(ids(s.this_week), ['a', 'b', 'c']);
  assert.ok(s.this_week.lessons.every((x) => x.done));
  assert.deepEqual(ids(s.next_week), ['d', 'e']);
  assert.equal(s.projected_finish, '2026-09-20');
});

test('a skipped week holds nothing and pushes the plan back without counting as behind', () => {
  const weeks = { '2026-09-13': { skipped: true } };
  const s = schedule({ course, lessons: L, done: { a: '2026-09-07', b: '2026-09-08' }, weeks, today: '2026-09-14' });
  assert.deepEqual(ids(s.this_week), []);
  assert.deepEqual(ids(s.next_week), ['c', 'd']);
  assert.equal(s.planned_finish, '2026-09-27');
  assert.equal(s.weeks_behind, 0);
  // The week after a skip: nothing is overdue.
  const t = schedule({ course, lessons: L, done: { a: '2026-09-07', b: '2026-09-08' }, weeks, today: '2026-09-21' });
  assert.equal(t.lessons_behind, 0);
});

test('an extra lesson is this week only, and not overdue if it is not cooked', () => {
  const weeks = { '2026-09-06': { extra: 1 } };
  const s = schedule({ course, lessons: L, weeks, today: '2026-09-07' });
  assert.deepEqual(ids(s.this_week), ['a', 'b', 'c']);
  assert.deepEqual(s.this_week.lessons.map((x) => x.extra), [false, false, true]);
  const next = schedule({ course, lessons: L, done: { a: '2026-09-07', b: '2026-09-07' }, weeks, today: '2026-09-14' });
  assert.deepEqual(ids(next.this_week), ['c', 'd']);
  assert.equal(next.lessons_behind, 0);
});

test('before the start, nothing is due; the first week shows from the Thursday before', () => {
  const early = schedule({ course, lessons: L, today: '2026-08-31' });
  assert.deepEqual(ids(early.this_week), []);
  assert.deepEqual(ids(early.next_week), ['a', 'b']);
  assert.equal(early.shows_next, false);
  assert.equal(schedule({ course, lessons: L, today: '2026-09-03' }).shows_next, true);
  assert.equal(early.started, false);
});

test('shopping is for this week until Thursday, then for next week', () => {
  assert.equal(shopWeek('2026-09-06'), '2026-09-06'); // Sunday
  assert.equal(shopWeek('2026-09-09'), '2026-09-06'); // Wednesday
  assert.equal(shopWeek('2026-09-10'), '2026-09-13'); // Thursday
  assert.equal(shopWeek('2026-09-12'), '2026-09-13'); // Saturday
});
