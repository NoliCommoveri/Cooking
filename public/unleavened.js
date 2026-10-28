// The family's Unleavened Bread dates (plan §6.20): the form Chef Ruth asks in
// Getting started and her yearly task, and Family settings shows. st is
// GET /api/unleavened: the year asked about, the family's dates for it (its
// calendar's until it answers), and the standard calendars.
import { lastDay } from './lib/calendars.js';

// The release the dates come with (src/worker/release.js).
export const UNLEAVENED_RELEASE = 2;

const long = { weekday: 'long', month: 'long', day: 'numeric' };

// The dates in words: "Thursday, April 22 to Wednesday, April 28".
export function feastWords(fmtDay, d) {
  return `${fmtDay(d.first_day, long)} to ${fmtDay(d.last_day, long)}`;
}

// What the family answered, in a line.
export function answerWords(fmtDay, d) {
  const stop = d.unleavened_from === d.first_day ? 'from the first day' : `from ${fmtDay(d.unleavened_from, { month: 'long', day: 'numeric' })}`;
  return `${feastWords(fmtDay, d)}. No leavened recipes ${stop}.`;
}

// The form's fields, and read(values) for the PUT body.
export function unleavenedFields({ el, fmtDay }, st) {
  const d = st.dates ?? { calendar: st.calendars[0]?.id, first_day: st.calendars[0]?.first_day ?? '', unleavened_from: '' };
  const calOf = (id) => st.calendars.find((c) => c.id === id) ?? st.calendars[0];
  const evening = (day) => fmtDay(new Date(new Date(`${day}T12:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10), { month: 'long', day: 'numeric' });

  const first = el('input', { type: 'date', name: 'first_day', value: d.first_day ?? '', required: true, min: `${st.year}-01-01`, max: `${st.year}-12-31` });
  const calHint = el('p', { class: 'mut small', style: 'margin:0' });
  const runs = el('p', { class: 'mut small', style: 'margin:0' });
  const showCal = (id) => {
    const c = calOf(id);
    calHint.textContent = c?.first_day
      ? `The ${c.name}'s first day is ${fmtDay(c.first_day, long)} (beginning at sunset on ${evening(c.first_day)}). Change it if your family keeps a different day.`
      : `The ${c?.name ?? 'calendar'} doesn't have ${st.year}'s date yet. Pick your family's first day.`;
  };
  const showRuns = () => { runs.textContent = /^\d{4}-\d{2}-\d{2}$/.test(first.value) ? `The feast runs seven days: ${fmtDay(first.value, long)} to ${fmtDay(lastDay(first.value), long)}.` : ''; };
  first.addEventListener('input', showRuns);
  showCal(d.calendar);
  showRuns();

  const cals = el('fieldset', {}, el('legend', {}, 'Which calendar do you keep?'),
    el('div', { class: 'grid2' }, st.calendars.map((c) => el('label', { class: 'choice' },
      el('input', { type: 'radio', name: 'calendar', value: c.id, checked: c.id === d.calendar, onchange: () => {
        showCal(c.id);
        if (c.first_day) { first.value = c.first_day; showRuns(); }
      } }),
      el('span', {}, c.name)))));

  const fromDay = el('input', { type: 'date', name: 'unleavened_from', value: d.unleavened_from && d.unleavened_from !== d.first_day ? d.unleavened_from : '', 'aria-label': 'The day to stop', min: `${st.year}-01-01` });
  const picked = Boolean(d.unleavened_from && d.unleavened_from !== d.first_day);
  const dayBox = el('div', { hidden: !picked }, fromDay);
  const stop = el('fieldset', {}, el('legend', {}, 'When should we stop suggesting leavened recipes?'),
    el('p', { class: 'mut small', style: 'margin:0' }, 'Some families clear out their leaven before the feast; others use it up first.'),
    el('div', { class: 'grid2' },
      el('label', { class: 'choice' }, el('input', { type: 'radio', name: 'from', value: 'feast', checked: !picked, onchange: () => { dayBox.hidden = true; } }), el('span', {}, 'On the first day of the feast')),
      el('label', { class: 'choice' }, el('input', { type: 'radio', name: 'from', value: 'date', checked: picked, onchange: () => { dayBox.hidden = false; fromDay.focus(); } }), el('span', {}, 'From a date we pick'))),
    dayBox);

  const nodes = [
    cals,
    el('label', { class: 'f' }, el('span', {}, `First day of Unleavened Bread in ${st.year}`), first),
    calHint, runs, stop,
  ];
  const read = (v) => {
    if (!v.calendar) throw new Error('Pick a calendar.');
    if (!v.first_day) throw new Error('Pick the first day of the feast.');
    if (v.from === 'date' && !v.unleavened_from) throw new Error('Pick the day to stop suggesting leavened recipes.');
    return { year: st.year, calendar: v.calendar, first_day: v.first_day, from: v.from === 'date' ? 'date' : 'feast', unleavened_from: v.from === 'date' ? v.unleavened_from : undefined };
  };
  return { nodes, read };
}
