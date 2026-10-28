// Unleavened Bread dates (plan §6.20), with release 2. A family picks a
// standard calendar (content/calendars.json), sees its first day of the feast
// for the year, and confirms it or picks its own; and says when the house
// goes unleavened: on the first day of the feast, or from a day it picks
// before it. Its unleavened days run from that day to the feast's last day.
// Until a family answers for a year, its calendar's dates are used (the first
// calendar for a family that never picked), not confirmed.
//
// The year asked about is this year's until its feast is over, then next
// year's, so a family that starts in the fall answers for the coming spring.
// The reminders (Chef Ruth's yearly ask and the note on the queue) wait for
// January 1 of that year, and never show for a year already answered.
import { fail, now } from './lib/http.js';
import { requireParent } from './auth.js';
import { CONTENT } from './content-data.js';
import { family, today } from './plan.js';
import { UNLEAVENED_RELEASE } from './release.js';
import { familyDates, yearFor, isDay, plusDays, calendarFirstDay, unleavenedOn, unleavenedRange } from '../content/calendars.js';
import { LIBRARY } from './library-data.js';
import { RECIPE_ID, SHARED_ID, stored, REGISTRY } from './recipes.js';
import { unleavened } from '../content/leaven.js';

const calendars = () => CONTENT.calendars;

// A family's dates by year: (year) => its dates, or null.
export async function datesFor(env, fid) {
  const rows = (await env.DB.prepare('SELECT * FROM unleavened_dates WHERE family_id = ? ORDER BY year').bind(fid).all()).results;
  const byYear = Object.fromEntries(rows.map((r) => [r.year, r]));
  // A year not answered yet follows the calendar the family picked last.
  const lastCal = rows.at(-1)?.calendar ?? null;
  return (year) => familyDates(calendars(), year, byYear[year] ?? null, lastCal);
}

// What the parent screens and Chef Ruth need on a day.
export async function unleavenedState(env, fid, day) {
  const dates = await datesFor(env, fid);
  const year = yearFor(day, dates);
  const d = dates(year);
  return {
    year,
    dates: d,
    calendars: calendars().map((c) => ({ id: c.id, name: c.name, first_day: calendarFirstDay(c, year) })),
    // From January 1 of the year asked about, until it's answered.
    ask: !d?.confirmed && day >= `${year}-01-01`,
  };
}

// Whether a lesson has leaven: a library lesson without the Unleavened badge,
// a family recipe that doesn't pass the leaven check, or a shared recipe not
// marked unleavened.
const lessonById = Object.fromEntries(LIBRARY.lessons.map((L) => [L.id, L]));
export async function leavened(env, fid, lid) {
  if (RECIPE_ID.test(lid)) {
    const row = await env.DB.prepare('SELECT body_json, version FROM family_recipes WHERE id = ? AND family_id = ?').bind(RECIPE_ID.exec(lid)[1], fid).first();
    return Boolean(row) && !unleavened(stored(row), REGISTRY, CONTENT.rules.leaven);
  }
  if (SHARED_ID.test(lid)) {
    const row = await env.DB.prepare('SELECT unleavened FROM community_recipes WHERE id = ?').bind(SHARED_ID.exec(lid)[1]).first();
    return Boolean(row) && !row.unleavened;
  }
  return Boolean(lessonById[lid]) && !lessonById[lid].unleavened;
}

async function titleOf(env, fid, lid) {
  if (RECIPE_ID.test(lid)) return (await env.DB.prepare('SELECT title FROM family_recipes WHERE id = ? AND family_id = ?').bind(RECIPE_ID.exec(lid)[1], fid).first())?.title ?? 'That recipe';
  if (SHARED_ID.test(lid)) return (await env.DB.prepare('SELECT title FROM community_recipes WHERE id = ?').bind(SHARED_ID.exec(lid)[1]).first())?.title ?? 'That recipe';
  return lessonById[lid]?.title ?? 'That lesson';
}

const words = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });

// No leavened recipe is ever due during the family's unleavened days (§6.20,
// owner, 2026-10-27: "Leavened recipes cannot be added to be due during the
// feast, period."). It can be planned for after them. date: a planned day;
// week: a week's Sunday (a meal that takes another's place in that week).
// title: the lesson's, looked up when not given. There is no override. The
// wording is the owner's pick (2026-10-28): it says why the app checks, as
// help planning, not as a refusal.
export async function feastGuard(env, fam, lid, title, { date = null, week = null } = {}) {
  if (fam.release < UNLEAVENED_RELEASE || (!date && !week)) return;
  const dates = await datesFor(env, fam.id);
  const onDay = date && unleavenedOn(date, dates);
  const d = onDay || (week && unleavenedRange(week, dates));
  if (!d || !(await leavened(env, fam.id, lid))) return;
  title ??= await titleOf(env, fam.id, lid);
  const span = `${words(d.unleavened_from)} to ${words(d.last_day)}`;
  const why = "We check dates so leaven doesn't slip onto your feast days.";
  fail(409, 'unleavened', onDay
    ? `${title} has leaven, and ${words(date)} is during Unleavened Bread (${span}). ${why} Pick ${words(plusDays(d.last_day, 1))} or later.`
    : `${title} has leaven, and that week is during Unleavened Bread (${span}). ${why} Pick an unleavened recipe for that week.`);
}

async function onRelease(env, s) {
  const fam = await family(env, s.family_id);
  if (fam.release < UNLEAVENED_RELEASE) fail(404, 'not_found', 'No such route.');
  return fam;
}

export function register(on) {
  on('GET', '/api/unleavened', async (req, env) => {
    const s = await requireParent(env, req);
    await onRelease(env, s);
    return unleavenedState(env, s.family_id, today(req));
  });

  on('PUT', '/api/unleavened', async (req, env, body) => {
    const s = await requireParent(env, req);
    await onRelease(env, s);
    const { year } = await unleavenedState(env, s.family_id, today(req));
    if (Number(body.year) !== year) fail(400, 'invalid', `These are the dates for ${year}.`);
    const cal = calendars().find((c) => c.id === body.calendar) ?? fail(400, 'invalid', 'Pick one of the calendars.');
    const first = String(body.first_day ?? '');
    if (!isDay(first) || first.slice(0, 4) !== String(year)) fail(400, 'invalid', `Pick the first day of Unleavened Bread in ${year}.`);
    const standard = calendarFirstDay(cal, year);
    if (standard && (first < plusDays(standard, -30) || first > plusDays(standard, 30))) fail(400, 'invalid', `That's more than a month from the ${cal.name}'s first day. Check the date.`);
    let from = first;
    if (body.from === 'date') {
      from = String(body.unleavened_from ?? '');
      if (!isDay(from)) fail(400, 'invalid', 'Pick the day to stop suggesting leavened recipes.');
      if (from >= first) fail(400, 'invalid', 'That day has to be before the first day of the feast.');
      if (from.slice(0, 4) !== String(year)) fail(400, 'invalid', `That day has to be in ${year}.`);
    } else if (body.from !== 'feast') fail(400, 'invalid', 'Pick when to stop suggesting leavened recipes.');
    const t = now();
    await env.DB.prepare(`INSERT INTO unleavened_dates (family_id, year, calendar, first_day, unleavened_from, confirmed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(family_id, year) DO UPDATE SET calendar = excluded.calendar, first_day = excluded.first_day, unleavened_from = excluded.unleavened_from, confirmed_at = excluded.confirmed_at, updated_at = excluded.updated_at`)
      .bind(s.family_id, year, cal.id, first, from, t, t).run();
    return unleavenedState(env, s.family_id, today(req));
  });
}
