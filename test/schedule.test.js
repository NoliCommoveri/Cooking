// The weekly schedule (plan §6.18): worked out, not stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule, weekOf, addDays, localDay, isSabbath } from '../src/worker/schedule.js';

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

test('before the start, nothing is due, and the first week is next week', () => {
  const early = schedule({ course, lessons: L, today: '2026-08-31' });
  assert.deepEqual(ids(early.this_week), []);
  assert.deepEqual(ids(early.next_week), ['a', 'b']);
  assert.equal(early.started, false);
});

test('the weeks after next follow at the pace, past skipped weeks', () => {
  const weeks = { '2026-09-27': { skipped: true } };
  const s = schedule({ course, lessons: [...L, 'g', 'h'], weeks, today: '2026-09-07' });
  assert.deepEqual(s.ahead, [{ week: '2026-09-20', lessons: ['e', 'f'] }, { week: '2026-10-04', lessons: ['g', 'h'] }]);
});

test('Saturday is the Sabbath', () => {
  assert.equal(isSabbath('2026-10-24'), true);
  assert.equal(isSabbath('2026-10-23'), false);
  assert.equal(isSabbath('2026-10-25'), false);
});

test('a swap for an Appointed Time meal takes a place this week: the lesson goes first next week, and it never counts as behind', () => {
  // Week 2, one lesson a week: c is up, and the parent swaps it for a feast meal.
  const one = { start_date: '2026-09-06', per_week: 1 };
  const done = { a: '2026-09-07' };
  const plain = schedule({ course: one, lessons: L, done, today: '2026-09-14' });
  assert.deepEqual(ids(plain.this_week), ['b']);
  const weeks = { '2026-09-13': { swapped: 1 } };
  const s = schedule({ course: one, lessons: L, done, weeks, today: '2026-09-14' });
  assert.deepEqual(ids(s.this_week), [], 'nothing else is pulled in');
  assert.deepEqual(ids(s.next_week), ['b'], 'it goes first next week');
  assert.equal(s.planned_finish, addDays(plain.planned_finish, 7), 'the planned finish moves back a week');
  // A week later, b not cooked in the swapped week isn't late.
  const later = schedule({ course: one, lessons: L, done, weeks, today: '2026-09-21' });
  assert.equal(later.weeks_behind, 0);
  assert.equal(later.lessons_behind, 0);
  assert.deepEqual(ids(later.this_week), ['b']);
});

test('swapping out the first of two lessons keeps the second this week; the swapped one goes first next week', () => {
  const weeks = { '2026-09-06': { swapped: 1, bumped: ['a'] } };
  const s = schedule({ course, lessons: L, weeks, today: '2026-09-07' });
  assert.deepEqual(ids(s.this_week), ['b']);
  assert.deepEqual(ids(s.next_week), ['a', 'c']);
  assert.deepEqual(s.ahead[0].lessons, ['d', 'e']);
});

test('a lesson queued outside the course comes out of its later place, and the rest move up', () => {
  const s = schedule({ course, lessons: L, taken: new Set(['c']), today: '2026-09-07' });
  assert.deepEqual(ids(s.this_week), ['a', 'b']);
  assert.deepEqual(ids(s.next_week), ['d', 'e']);
  // Replacing b with c: c is taken, b goes first next week, and the lessons
  // between move down.
  const weeks = { '2026-09-06': { swapped: 1, bumped: ['b'] } };
  const r = schedule({ course, lessons: L, taken: new Set(['c']), weeks, today: '2026-09-07' });
  assert.deepEqual(ids(r.this_week), ['a']);
  assert.deepEqual(ids(r.next_week), ['b', 'd']);
  assert.deepEqual(r.ahead[0].lessons, ['e', 'f']);
});

// The Unleavened Bread pause (§6.20): 2027's feast is Thursday, April 22 to
// Wednesday, April 28. The weeks of April 18 and April 25 touch it.
const FEAST = { year: 2027, first_day: '2027-04-22', last_day: '2027-04-28', unleavened_from: '2027-04-22' };
const pauseFor = (leavened, d = FEAST) => ({ dates: (y) => (y === 2027 ? d : null), leavened: (id) => leavened.includes(id) });
const spring = { start_date: '2027-04-04', per_week: 2 };
const atPace = (upTo) => Object.fromEntries(L.slice(0, upTo).map((id, i) => [id, addDays('2027-04-05', 7 * Math.floor(i / 2))]));

test('a week touching the unleavened days runs in order until the next leavened lesson, and holds there', () => {
  // Week of April 18: e and f are due; f is leavened, so e is due and f waits.
  const s = schedule({ course: spring, lessons: L, done: atPace(4), today: '2027-04-19', pause: pauseFor(['f']) });
  assert.deepEqual(ids(s.this_week).filter((x) => !s.this_week.lessons.find((l) => l.id === x).done), ['e']);
  assert.equal(s.this_week.held, 'f');
  assert.equal(s.this_week.held_until, '2027-04-29', 'the day after the last day');
  assert.deepEqual(ids(s.next_week), [], 'the week of April 25 touches the feast too');
  assert.equal(s.next_week.held, 'f');
  assert.equal(s.weeks_behind, 0, 'the pause never counts as behind');
  assert.equal(s.lessons_behind, 0);
  assert.equal(s.projected_finish, s.planned_finish);
  assert.equal(s.planned_finish, '2027-05-02', 'the finish moves back past the feast');
});

test('an unleavened lesson first in line keeps the course going; nothing leavened, nothing held', () => {
  const s = schedule({ course: spring, lessons: L, done: atPace(4), today: '2027-04-19', pause: pauseFor([]) });
  assert.deepEqual(ids(s.this_week).slice(-2), ['e', 'f']);
  assert.equal(s.this_week.held, null);
  assert.equal(s.planned_finish, '2027-04-18');
});

test('the held lesson shows again the day after the last day, and the pause is not behind', () => {
  const done = { ...atPace(4), e: '2027-04-20' };
  const during = schedule({ course: spring, lessons: L, done, today: '2027-04-27', pause: pauseFor(['f']) });
  assert.deepEqual(ids(during.this_week), [], 'held through Wednesday the 28th');
  assert.equal(during.this_week.held, 'f');
  assert.equal(during.lessons_behind, 0);
  const after = schedule({ course: spring, lessons: L, done, today: '2027-04-29', pause: pauseFor(['f']) });
  assert.deepEqual(ids(after.this_week), ['f']);
  assert.equal(after.this_week.held, null);
  assert.equal(after.this_week.lessons[0].overdue, false);
  assert.equal(after.weeks_behind, 0);
});

test('a family that stops leaven early pauses from its own day', () => {
  const early = { ...FEAST, unleavened_from: '2027-04-12' };
  const s = schedule({ course: spring, lessons: L, done: atPace(2), today: '2027-04-12', pause: pauseFor(['d'], early) });
  assert.deepEqual(ids(s.this_week), ['c']);
  assert.equal(s.this_week.held, 'd');
});
