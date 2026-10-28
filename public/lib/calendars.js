// Copied from src/content/calendars.js by tools/build-library.js. Don't edit here.
// Unleavened Bread dates (plan §6.20). The standard calendars come from
// content/calendars.json: each one's first day of Unleavened Bread by year.
// The first calendar listed is the one a family uses until it picks. Pure, so
// the Worker, the linter, and the browser share one copy.

const DAY = 86400000;
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fromDate = (d) => d.toISOString().slice(0, 10);
export const plusDays = (s, n) => fromDate(new Date(toDate(s).getTime() + n * DAY));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (s) => typeof s === 'string' && ISO.test(s) && fromDate(toDate(s)) === s;

// The feast is seven days, the 15th to the 21st (Leviticus 23:6).
export const FEAST_DAYS = 7;
export const lastDay = (first) => plusDays(first, FEAST_DAYS - 1);

// A calendar's first day for a year, or null when the file doesn't have it yet.
export const calendarFirstDay = (cal, year) => cal?.firstDays?.[String(year)] ?? null;

// A family's dates for a year. row: its unleavened_dates row for that year, if
// it answered. Until then its calendar's dates are used (the first calendar
// for a family that never picked), and they aren't confirmed. Null when
// there's no date to go by: the family never answered and the calendar
// doesn't have that year.
export function familyDates(calendars, year, row = null, calendarId = null) {
  if (row) return { year, calendar: row.calendar, first_day: row.first_day, last_day: lastDay(row.first_day), unleavened_from: row.unleavened_from, confirmed: Boolean(row.confirmed_at) };
  const cal = calendars.find((c) => c.id === calendarId) ?? calendars[0];
  const first = calendarFirstDay(cal, year);
  return first && { year, calendar: cal.id, first_day: first, last_day: lastDay(first), unleavened_from: first, confirmed: false };
}

// The year the family is asked about on a day: this year's, until its feast
// is over (or when there's no date for this year), then next year's.
// dates(year) gives the family's dates for a year.
export function yearFor(day, dates) {
  const y = Number(day.slice(0, 4));
  const d = dates(y);
  return !d || day > d.last_day ? y + 1 : y;
}

// Whether a week (Sunday to Friday) touches any unleavened day. dates(year)
// gives the family's dates for a year; a week can reach into the next year.
export function unleavenedWeek(sunday, dates) {
  const friday = plusDays(sunday, 5);
  for (const y of new Set([sunday.slice(0, 4), friday.slice(0, 4)])) {
    const d = dates(Number(y));
    if (d && sunday <= d.last_day && friday >= d.unleavened_from) return true;
  }
  return false;
}

// The checks on content/calendars.json, for the linter.
export function calendarProblems(file) {
  const out = [];
  const cals = file?.calendars;
  if (!Array.isArray(cals) || !cals.length) return ['calendars.json: needs at least one calendar'];
  const ids = new Set();
  for (const c of cals) {
    const where = `calendars.json: ${c?.name || c?.id || 'a calendar'}`;
    if (!c?.id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(c.id)) out.push(`${where}: needs an id of lowercase letters, numbers, and dashes`);
    else if (ids.has(c.id)) out.push(`${where}: the id "${c.id}" is used twice`);
    ids.add(c?.id);
    if (!String(c?.name ?? '').trim()) out.push(`${where}: needs a name`);
    for (const [y, d] of Object.entries(c?.firstDays ?? {})) {
      if (!/^\d{4}$/.test(y)) out.push(`${where}: "${y}" isn't a year`);
      else if (!isDay(d)) out.push(`${where}: ${y}'s first day "${d}" isn't a date (YYYY-MM-DD)`);
      else if (d.slice(0, 4) !== y) out.push(`${where}: ${y}'s first day, ${d}, is in another year`);
    }
  }
  return out;
}
