// The weekly schedule of a course (plan §6.18). Nothing here is stored: each
// week's lessons are worked out from the course plan, its pace, the weeks the
// parent skipped or added to, and which lessons are already cooked. Dates are
// the family's own calendar days, 'YYYY-MM-DD'; weeks run Monday to Sunday and
// are named by their Monday.

const DAY = 24 * 60 * 60 * 1000;
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fromDate = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => fromDate(new Date(toDate(s).getTime() + n * DAY));
export const mondayOf = (s) => addDays(s, -((toDate(s).getUTCDay() + 6) % 7));
export const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDate(toDate(s)) === s;

// The family's calendar day for a moment, from the browser's offset in minutes
// (Date.getTimezoneOffset: 300 for US Central daylight time).
export const localDay = (iso, tzOffset = 0) => fromDate(new Date(Date.parse(iso) - tzOffset * 60 * 1000));

// Next week's lessons show from this weekday of the week before (§6.18), so a
// parent can shop on the weekend. 4 = Friday, counting Monday as 0.
export const PREVIEW_FROM = 4;

// course: { start_date, per_week }
// lessons: the lesson ids the schedule can use, in plan order (written, kept in
//   the plan, and not hidden by the family's diet settings)
// done: { lesson id: the day it was first cooked on this course }
// weeks: { week monday: { skipped, extra } }
// today: the family's calendar day
//
// Returns this week and next week ({ week, lessons: [{ id, done, overdue }],
// skipped, extra }), whether next week shows yet, the planned and projected
// finish weeks, and how many weeks behind the plan the course is.
export function schedule({ course, lessons, done = {}, weeks = {}, today }) {
  const per = course.per_week;
  const start = mondayOf(course.start_date);
  const now = mondayOf(today);
  const skipped = (w) => Boolean(weeks[w]?.skipped);
  const extra = (w) => (w === now ? weeks[w]?.extra ?? 0 : 0);

  // Every lesson at the pace, from the start, skipping the skipped weeks: the
  // week the course was set to finish.
  const finishFrom = (from, count, firstCap = per) => {
    let w = from, left = count, cap = firstCap;
    if (left <= 0) return null;
    for (let guard = 0; guard < 1000; guard++, w = addDays(w, 7), cap = per) {
      if (skipped(w)) continue;
      left -= Math.max(0, cap);
      if (left <= 0) return w;
    }
    return null;
  };
  const planned = finishFrom(start, lessons.length);

  // Lessons cooked before this week, and the weeks before this one that weren't
  // skipped: what was due by now and what got done.
  const doneIds = lessons.filter((id) => done[id]);
  const doneBefore = doneIds.filter((id) => done[id] < now).length;
  let weeksBefore = 0;
  for (let w = start; w < now; w = addDays(w, 7)) if (!skipped(w)) weeksBefore++;
  const behindLessons = Math.max(0, Math.min(lessons.length, per * weeksBefore) - doneBefore);

  // This week: what was cooked this week, then the next unfinished lessons up
  // to the week's pace plus any extras. An unfinished lesson from an earlier
  // week is first in line, so everything after it moves back a week.
  const open = lessons.filter((id) => !done[id]);
  const fill = (w, from, cookedHere) => {
    if (w < start) return { list: [], next: from };
    const cap = skipped(w) ? 0 : per + extra(w);
    const room = Math.max(0, cap - cookedHere.length);
    return { list: open.slice(from, from + room), next: from + room };
  };
  const cookedNow = doneIds.filter((id) => done[id] >= now && done[id] < addDays(now, 7));
  const a = fill(now, 0, cookedNow);
  const next = addDays(now, 7);
  const b = fill(next, a.next, []);
  const week = (w, list, cooked, overdueCount) => ({
    week: w,
    skipped: skipped(w),
    extra: extra(w),
    lessons: [
      ...cooked.map((id) => ({ id, done: true, overdue: false })),
      ...list.map((id, i) => ({ id, done: false, overdue: i < overdueCount })),
    ],
  });

  // Projected finish: from here on at the pace, with this week's room as it is.
  let projected;
  if (!open.length) projected = doneIds.length ? mondayOf(doneIds.map((id) => done[id]).sort().at(-1)) : null;
  else {
    const thisRoom = now < start || skipped(now) ? 0 : Math.max(0, per + extra(now) - cookedNow.length);
    projected = now < start ? finishFrom(start, open.length) : finishFrom(now, open.length, thisRoom);
  }
  const weeksBehind = planned && projected && projected > planned ? Math.round((toDate(projected) - toDate(planned)) / (7 * DAY)) : 0;

  return {
    this_week: week(now, now < start ? [] : a.list, cookedNow, now < start ? 0 : behindLessons),
    next_week: week(next, b.list, [], 0),
    shows_next: today >= addDays(now, PREVIEW_FROM),
    started: now >= start,
    planned_finish: planned,
    projected_finish: projected,
    weeks_behind: weeksBehind,
    lessons_behind: now < start ? 0 : behindLessons,
    total: lessons.length,
    done: doneIds.length,
  };
}
