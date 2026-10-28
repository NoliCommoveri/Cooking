// Unleavened Bread dates (plan §6.20), release 2.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';
import { unleavenedState } from '../src/worker/unleavened.js';
import { familyDates, yearFor, unleavenedWeek, calendarProblems, lastDay } from '../src/content/calendars.js';
import { CONTENT } from '../src/worker/content-data.js';

const CALS = CONTENT.calendars;
const HEBREW = 'hebrew-lunisolar';

// The Worker's clock, set to a day (UTC noon), for one test.
function on(day) {
  mock.timers.reset();
  mock.timers.enable({ apis: ['Date'], now: new Date(`${day}T12:00:00Z`) });
}

async function setup({ preview = true } = {}) {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const fid = (await env.DB.prepare('SELECT family_id FROM parents WHERE email = ?').bind('jen@example.com').first()).family_id;
  if (preview) await setPreview(env.DB, fid, true);
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  return { env, a, ava, fid };
}

test('the Hebrew lunisolar calendar has its first days for 2027 to 2036, and the file passes its checks', () => {
  assert.equal(CALS[0].id, HEBREW, 'the first calendar is the one used until a family picks');
  assert.equal(CALS[0].name, 'Hebrew lunisolar calendar');
  assert.deepEqual(Object.values(CALS[0].firstDays), ['2027-04-22', '2028-04-11', '2029-03-31', '2030-04-18', '2031-04-08', '2032-03-27', '2033-04-14', '2034-04-04', '2035-04-24', '2036-04-12']);
  assert.equal(lastDay('2027-04-22'), '2027-04-28', 'seven days, the 15th to the 21st');
  assert.deepEqual(calendarProblems(CONTENT.calendarsFile), []);
  assert.equal(calendarProblems({ calendars: [{ id: 'x', name: 'X', firstDays: { 2027: '2028-04-11' } }] }).length, 1, 'a date in another year');
  assert.equal(calendarProblems({ calendars: [{ id: 'x', name: 'X', firstDays: { 2027: '2027-02-30' } }] }).length, 1, 'not a date');
});

test('the year asked about: this spring until its feast is over, then the next; the fall asks about next spring', () => {
  const dates = (y) => familyDates(CALS, y);
  assert.equal(yearFor('2026-10-28', dates), 2027, 'a fall start answers for the coming spring');
  assert.equal(yearFor('2027-01-01', dates), 2027);
  assert.equal(yearFor('2027-04-28', dates), 2027, 'the last day of the feast');
  assert.equal(yearFor('2027-04-29', dates), 2028);
});

test('a week touches the unleavened days from the family\'s stop day to the feast\'s last day', () => {
  const plain = (y) => familyDates(CALS, y);
  assert.equal(unleavenedWeek('2027-04-11', plain), false, 'the week before the feast');
  assert.equal(unleavenedWeek('2027-04-18', plain), true);
  assert.equal(unleavenedWeek('2027-04-25', plain), true, 'the feast ends Wednesday the 28th');
  assert.equal(unleavenedWeek('2027-05-02', plain), false);
  const early = (y) => familyDates(CALS, y, y === 2027 ? { calendar: HEBREW, first_day: '2027-04-22', unleavened_from: '2027-04-12', confirmed_at: 'x' } : null);
  assert.equal(unleavenedWeek('2027-04-11', early), true, 'stopping leaven from the 12th');
});

test('before release 2 there are no family dates, and Swap keeps the fixed window', async () => {
  const { a } = await setup({ preview: false });
  assert.equal((await a.get('/api/unleavened')).status, 404);
});

test('a family in the fall is asked about next spring, sees its calendar\'s dates, and saves its own', async (t) => {
  on('2026-10-28');
  t.after(() => mock.timers.reset());
  const { env, a, fid } = await setup();
  let st = (await a.get('/api/unleavened')).body;
  assert.equal(st.year, 2027);
  assert.deepEqual(st.dates, { year: 2027, calendar: HEBREW, first_day: '2027-04-22', last_day: '2027-04-28', unleavened_from: '2027-04-22', confirmed: false });
  assert.equal(st.ask, false, 'the reminders wait for January 1');
  assert.equal(st.calendars[0].first_day, '2027-04-22');

  const put = (body) => a.put('/api/unleavened', { year: 2027, calendar: HEBREW, first_day: '2027-04-22', from: 'feast', ...body });
  assert.equal((await put({ year: 2026 })).status, 400, 'only the year asked about');
  assert.equal((await put({ calendar: 'nope' })).status, 400);
  assert.equal((await put({ first_day: '2027-07-01' })).status, 400, 'more than a month off the calendar');
  assert.equal((await put({ from: 'date', unleavened_from: '2027-04-22' })).status, 400, 'the stop day comes before the feast');
  assert.equal((await put({ from: 'date', unleavened_from: '2026-12-31' })).status, 400, 'and in the same year');

  const saved = await put({ first_day: '2027-04-23', from: 'date', unleavened_from: '2027-04-16' });
  assert.equal(saved.status, 200);
  st = saved.body;
  assert.deepEqual(st.dates, { year: 2027, calendar: HEBREW, first_day: '2027-04-23', last_day: '2027-04-29', unleavened_from: '2027-04-16', confirmed: true });

  // Later days (a jump this far would end the parent's session).
  assert.equal((await unleavenedState(env, fid, '2027-01-02')).ask, false, 'answered in the fall: not asked again in January');
  st = await unleavenedState(env, fid, '2027-04-30');
  assert.equal(st.year, 2028, 'after the feast, the next spring');
  assert.equal(st.ask, false);
  st = await unleavenedState(env, fid, '2028-01-01');
  assert.equal(st.ask, true, 'a new year, not answered yet: asked from January 1');
  assert.equal(st.dates.first_day, '2028-04-11', 'until then, its calendar\'s dates');
});

test('Swap goes unleavened-only on the family\'s own weeks', async (t) => {
  on('2026-10-28');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  const swapOn = async (date) => {
    const id = (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: date })).body.id;
    return (await a.get(`/api/queue/${id}/swap`)).body.spring;
  };
  assert.equal(await swapOn('2027-03-17'), false, 'inside the old fixed window, but not the family\'s days');
  assert.equal(await swapOn('2027-04-21'), true);
  assert.equal(await swapOn('2027-04-14'), false);
  await a.put('/api/unleavened', { year: 2027, calendar: HEBREW, first_day: '2027-04-22', from: 'date', unleavened_from: '2027-04-12' });
  assert.equal(await swapOn('2027-04-14'), true, 'from the family\'s own stop day');
});
