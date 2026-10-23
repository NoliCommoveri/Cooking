// The weekly schedule of a course (plan §6.18). Nothing here is stored: each
// week's lessons are worked out from the course plan, its pace, the weeks the
// parent skipped or added to, and which lessons are already cooked. Dates are
// the family's own calendar days, 'YYYY-MM-DD'. Weeks run Sunday to Friday,
// with Saturday the Sabbath (owner, 2026-10-22), and are named by their Sunday.

const DAY = 24 * 60 * 60 * 1000;
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fromDate = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => fromDate(new Date(toDate(s).getTime() + n * DAY));
export const weekOf = (s) => addDays(s, -toDate(s).getUTCDay());
// Nothing cooked or graded on the Sabbath counts (owner, 2026-10-22, §6.18).
export const isSabbath = (s) => toDate(s).getUTCDay() === 6;
export const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDate(toDate(s)) === s;

// The family's calendar day for a moment, from the browser's offset in minutes
// (Date.getTimezoneOffset: 300 for US Central daylight time).
export const localDay = (iso, tzOffset = 0) => fromDate(new Date(Date.parse(iso) - tzOffset * 60 * 1000));

// A lesson is due on the Friday of its week. 5 = Friday.
export const DUE_DAY = 5;

// course: { start_date, per_week }
// lessons: the lesson ids the schedule can use, in plan order (written, kept in
//   the plan, and not hidden by the family's diet settings)
// done: { lesson id: the day it was first cooked on this course }
// free: lesson ids cooked through a lesson queued outside the course (a kid's
//   approved request, added as an extra or replacing an assigned meal): they
//   count as done but never take one of a week's places, so cooking one early
//   doesn't push the week's assigned lessons back (owner, 2026-10-23)
// weeks: { week's Sunday: { skipped, extra, swapped } }
// today: the family's calendar day
//
// Returns this week and next week ({ week, lessons: [{ id, done, overdue }],
// skipped, extra }), the weeks after ({ week, lessons: [ids] }), whether next
// week shows yet, the planned and projected
// finish weeks, and how many weeks behind the plan the course is.
export function schedule({ course, lessons, done = {}, free = new Set(), weeks = {}, today }) {
  const per = course.per_week;
  const start = weekOf(course.start_date);
  const now = weekOf(today);
  const skipped = (w) => Boolean(weeks[w]?.skipped);
  const extra = (w) => (w === now ? weeks[w]?.extra ?? 0 : 0);
  // A week's course lessons swapped for an Appointed Time meal (§6.19). Each
  // one takes a place at the pace, so the rest move back and the planned
  // finish moves with them: a swap never counts as behind (owner, 2026-10-22).
  const swapped = (w) => weeks[w]?.swapped ?? 0;
  const capOf = (w) => Math.max(0, per - swapped(w));

  // Every lesson at the pace, from the start, skipping the skipped weeks: the
  // week the course was set to finish.
  const finishFrom = (from, count, firstCap) => {
    let w = from, left = count, cap = firstCap ?? capOf(from);
    if (left <= 0) return null;
    for (let guard = 0; guard < 1000; guard++, w = addDays(w, 7), cap = capOf(w)) {
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
  let dueBefore = 0;
  for (let w = start; w < now; w = addDays(w, 7)) if (!skipped(w)) dueBefore += capOf(w);
  const behindLessons = Math.max(0, Math.min(lessons.length, dueBefore) - doneBefore);

  // This week: what was cooked this week, then the next unfinished lessons up
  // to the week's pace plus any extras. An unfinished lesson from an earlier
  // week is first in line, so everything after it moves back a week.
  const open = lessons.filter((id) => !done[id]);
  const fill = (w, from, cookedHere) => {
    if (w < start) return { list: [], next: from };
    const cap = skipped(w) ? 0 : capOf(w) + extra(w);
    const room = Math.max(0, cap - cookedHere.length);
    // The ones past the pace are this week's extras (Cook another recipe).
    const paced = skipped(w) ? 0 : Math.max(0, capOf(w) - cookedHere.length);
    return { list: open.slice(from, from + room), next: from + room, paced };
  };
  const cookedNow = doneIds.filter((id) => done[id] >= now && done[id] < addDays(now, 7) && !free.has(id));
  const a = fill(now, 0, cookedNow);
  const next = addDays(now, 7);
  const b = fill(next, a.next, []);
  // The weeks after next, at the pace, for the parent's "What you'll need".
  const ahead = [];
  for (let w = addDays(next, 7), from = b.next, guard = 0; from < open.length && guard < 520; w = addDays(w, 7), guard++) {
    if (w < start || skipped(w)) continue;
    ahead.push({ week: w, lessons: open.slice(from, from + capOf(w)) });
    from += capOf(w);
  }
  const week = (w, list, cooked, overdueCount, paced = list.length) => ({
    week: w,
    skipped: skipped(w),
    extra: extra(w),
    swapped: swapped(w),
    lessons: [
      ...cooked.map((id) => ({ id, done: true, overdue: false, extra: false })),
      ...list.map((id, i) => ({ id, done: false, overdue: i < overdueCount, extra: i >= paced })),
    ],
  });

  // Projected finish: from here on at the pace, with this week's room as it is.
  let projected;
  if (!open.length) projected = doneIds.length ? weekOf(doneIds.map((id) => done[id]).sort().at(-1)) : null;
  else {
    const thisRoom = now < start || skipped(now) ? 0 : Math.max(0, capOf(now) + extra(now) - cookedNow.length);
    projected = now < start ? finishFrom(start, open.length) : finishFrom(now, open.length, thisRoom);
  }
  const weeksBehind = planned && projected && projected > planned ? Math.round((toDate(projected) - toDate(planned)) / (7 * DAY)) : 0;

  return {
    this_week: week(now, now < start ? [] : a.list, cookedNow, now < start ? 0 : behindLessons, a.paced),
    next_week: week(next, b.list, [], 0),
    ahead,
    started: now >= start,
    planned_finish: planned,
    projected_finish: projected,
    weeks_behind: weeksBehind,
    lessons_behind: now < start ? 0 : behindLessons,
    total: lessons.length,
    done: doneIds.length,
  };
}
