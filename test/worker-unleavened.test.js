// Unleavened Bread dates (plan §6.20), release 2.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, samplePlan } from './helpers/worker.js';
import { setPreview } from '../src/worker/release.js';
import { unleavenedState } from '../src/worker/unleavened.js';
import { familyDates, yearFor, unleavenedWeek, calendarProblems, lastDay } from '../src/content/calendars.js';
import { CONTENT } from '../src/worker/content-data.js';
import { LIBRARY } from '../src/worker/library-data.js';
import { servingOptions } from '../src/content/scale.js';

const LIB = LIBRARY.lessons;

const CALS = CONTENT.calendars;
// A course of two leavened lessons with no unleavened swaps: smash burgers, then grilled cheese.
const leavenedPlan = async (c) => (await c.get('/api/courses')).body.default_plan.map((x) => ({ ...x, removed: !['smash-burgers', 'grilled-cheese-tomato-soup'].includes(x.id) }));
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
  const queue = async (date) => (await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: date })).body.id;
  const swapOn = async (id) => (await a.get(`/api/queue/${id}/swap`)).body.spring;
  assert.equal(await swapOn(await queue('2027-03-17')), false, 'inside the old fixed window, but not the family\'s days');
  assert.equal(await swapOn(await queue('2027-04-21')), true);
  const mid = await queue('2027-04-14');
  assert.equal(await swapOn(mid), false);
  await a.put('/api/unleavened', { year: 2027, calendar: HEBREW, first_day: '2027-04-22', from: 'date', unleavened_from: '2027-04-12' });
  assert.equal(await swapOn(mid), true, 'from the family\'s own stop day');
});

test('a course holds at its first leavened lesson through the feast: the kitchen notice and the parent card say so', async (t) => {
  on('2027-04-19');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: [], plan_weeks: true });
  const plan = await leavenedPlan(a);
  // Smash burgers come first: their toasted buns have no unleavened swap.
  assert.equal((await a.post('/api/courses', { profile_ids: [ava], start_date: '2027-04-18', per_week: 1, plan })).status, 200);
  const card = (await a.get('/api/queue?tz=0')).body.courses[0];
  assert.equal(card.this_week.held, 'smash-burgers');
  assert.equal(card.this_week.held_until, '2027-04-29');
  assert.deepEqual(card.this_week.lessons, []);
  assert.equal(card.weeks_behind, 0);
  const kitchen = (await a.get(`/api/profiles/${ava}/queue?tz=0`)).body;
  assert.deepEqual(kitchen.unleavened, { paused: true, until: '2027-04-29' });
  assert.ok(!kitchen.items.some((x) => x.lesson_id === 'smash-burgers'), 'not queued while held');

  on('2027-04-29');
  await a.post('/api/pin/unlock', { pin: '1234' });
  const after = (await a.get('/api/queue?tz=0')).body.courses[0];
  assert.equal(after.this_week.held, null);
  assert.deepEqual(after.this_week.lessons.map((x) => x.lesson_id ?? x.id), ['smash-burgers'], 'back the day after the last day');
  assert.equal((await a.get(`/api/profiles/${ava}/queue?tz=0`)).body.unleavened, null);
});

test('through the unleavened days with nothing held, the kitchen gets the happy banner; before release 2, nothing', async (t) => {
  on('2027-04-23');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: [], plan_weeks: true });
  const plan = (await samplePlan(a)).map((x) => ({ ...x, removed: x.id !== 'beef-bulgogi' }));
  await a.post('/api/courses', { profile_ids: [ava], start_date: '2027-04-18', per_week: 1, plan });
  assert.deepEqual((await a.get(`/api/profiles/${ava}/queue?tz=0`)).body.unleavened, { paused: false });

  const { a: b, ava: bea } = await setup({ preview: false });
  await b.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: [], plan_weeks: true });
  await b.post('/api/courses', { profile_ids: [bea], start_date: '2027-04-18', per_week: 1, plan: await samplePlan(b) });
  const old = (await b.get('/api/queue?tz=0')).body.courses[0];
  assert.equal(old.this_week.held, null, 'no pause before the release');
  assert.equal((await b.get(`/api/profiles/${bea}/queue?tz=0`)).body.unleavened, null);
});

test('no leavened recipe can be planned on the unleavened days, however it\'s added; after them it can', async (t) => {
  on('2027-04-01');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  await a.post('/api/pin/unlock', { pin: '1234' });
  const add = (lesson_id, planned_date) => a.post('/api/queue', { lesson_id, profile_ids: [ava], planned_date });

  // Add a lesson: smash burgers (buns, with no unleavened swap) can't be on the 23rd; bulgogi can.
  const refused = await add('smash-burgers', '2027-04-23');
  assert.equal(refused.status, 409);
  assert.match(refused.body.message, /April 23 is during Unleavened Bread \(April 22 to April 28\)\. We check dates so leaven doesn.t slip onto your feast days\. Pick April 29 or later\./);
  assert.equal((await add('smash-burgers', '2027-04-29')).status, 200, 'the day after the last day');
  assert.equal((await add('smash-burgers', null)).status, 200, 'with no date');
  assert.equal((await add('beef-bulgogi', '2027-04-23')).status, 200, 'an unleavened lesson');

  // Changing a queued lesson's date into the days; its servings still change.
  const sid = (await add('smash-burgers', '2027-04-15')).body.id;
  assert.equal((await a.put(`/api/queue/${sid}`, { planned_date: '2027-04-25' })).status, 409);
  assert.equal((await a.put(`/api/queue/${sid}`, { servings: 2 })).status, 200);

  // A kid's request, approved for a day in the feast.
  const ask = await a.post(`/api/profiles/${ava}/ask`, { lesson_id: 'grilled-cheese-tomato-soup' });
  assert.equal(ask.body.status, 'requested');
  assert.equal((await a.post(`/api/queue/${ask.body.id}/approve`, { planned_date: '2027-04-24' })).status, 409);
  assert.equal((await a.post(`/api/queue/${ask.body.id}/approve`, { planned_date: '2027-05-03' })).status, 200);

  // Put back: a lesson removed, then the family's stop day moves earlier.
  assert.equal((await a.del(`/api/queue/${sid}`)).status, 200);
  await a.put('/api/unleavened', { year: 2027, calendar: HEBREW, first_day: '2027-04-22', from: 'date', unleavened_from: '2027-04-12' });
  assert.equal((await a.post(`/api/queue/${sid}/put-back`)).status, 409);

  // Cooking it now, on a day in the feast (approved on the spot).
  on('2027-04-23');
  await a.post('/api/pin/unlock', { pin: '1234' });
  assert.equal((await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'challah-french-toast' })).status, 409);
  assert.equal((await a.post(`/api/profiles/${ava}/approve`, { lesson_id: 'minestrone' })).status, 200);
});

test('a course lesson already shopped for loses its week while the pause holds it, and gets it back after', async (t) => {
  on('2027-04-12');
  t.after(() => mock.timers.reset());
  const { env, a, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: [], plan_weeks: true });
  await a.post('/api/courses', { profile_ids: [ava], start_date: '2027-04-11', per_week: 1, plan: await leavenedPlan(a) });
  await a.get('/api/queue?tz=0');
  const row = () => env.DB.prepare("SELECT * FROM queue WHERE lesson_id = 'smash-burgers' AND course_id IS NOT NULL").first();
  assert.equal((await row()).week_start, '2027-04-11');
  await env.DB.prepare("UPDATE queue SET status = 'shopped' WHERE lesson_id = 'smash-burgers'").run();

  on('2027-04-19');
  await a.post('/api/pin/unlock', { pin: '1234' });
  assert.equal((await a.get('/api/queue?tz=0')).body.courses[0].this_week.held, 'smash-burgers');
  const held = await row();
  assert.equal(held.status, 'shopped', 'still on the queue');
  assert.equal(held.week_start, null, 'not due in the feast');
  const item = (await a.get(`/api/profiles/${ava}/queue?tz=0`)).body.items.find((x) => x.lesson_id === 'smash-burgers');
  assert.equal(item?.due ?? null, null);

  on('2027-04-29');
  await a.post('/api/pin/unlock', { pin: '1234' });
  await a.get('/api/queue?tz=0');
  assert.equal((await row()).week_start, '2027-04-25', 'due again the day after the last day');
});

test('before release 2, a leavened lesson can be planned on any day', async (t) => {
  on('2027-04-01');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup({ preview: false });
  assert.equal((await a.post('/api/queue', { lesson_id: 'shakshuka', profile_ids: [ava], planned_date: '2027-04-23' })).status, 200);
});

test('the kitchen knows when today is an unleavened day, on a course or not, and when it ends', async (t) => {
  on('2027-04-23');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  assert.deepEqual((await a.get(`/api/profiles/${ava}/queue?tz=0`)).body.feast_today, { until: '2027-04-29' });
  on('2027-04-29');
  await a.post('/api/pin/unlock', { pin: '1234' });
  assert.equal((await a.get(`/api/profiles/${ava}/queue?tz=0`)).body.feast_today, null, 'the day after the last day');

  const { a: b, ava: bea } = await setup({ preview: false });
  on('2027-04-23');
  assert.equal((await b.get(`/api/profiles/${bea}/queue?tz=0`)).body.feast_today, null, 'not before release 2');
});

test('a Level course pauses at its bread week in the feast, as its setup note says', async (t) => {
  on('2027-01-05');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: [], plan_weeks: true });
  const made = await a.post('/api/courses', { profile_ids: [ava], start_date: '2027-01-10', per_week: 1, program: 'sp-3', starts: 'familiar' });
  assert.equal(made.status, 200, JSON.stringify(made.body));
  const sizes = (lid) => servingOptions(LIB.find((x) => x.id === lid))[0];
  // On pace: each week's recipe cooked on its Tuesday, January 10 to April 11.
  for (let n = 0, w = '2027-01-10'; w < '2027-04-18'; n++, w = new Date(Date.parse(w) + 7 * 864e5).toISOString().slice(0, 10)) {
    const tue = new Date(Date.parse(w) + 2 * 864e5).toISOString().slice(0, 10);
    on(tue);
    await a.post('/api/pin/unlock', { pin: '1234' });
    const due = (await a.get('/api/queue?tz=0')).body.courses[0].this_week.lessons.find((x) => !x.done);
    if (!due) continue;
    const r = await a.put(`/api/attempts/${String(n + 1).padStart(16, '0')}`, { lesson_id: due.lesson_id ?? due.id, servings: sizes(due.lesson_id ?? due.id), profile_ids: [ava], started_at: `${tue}T10:00:00Z`, finished_at: `${tue}T11:00:00Z` });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  on('2027-04-19');
  await a.post('/api/pin/unlock', { pin: '1234' });
  const card = (await a.get('/api/queue?tz=0')).body.courses[0];
  assert.equal(card.weeks_behind, 0);
  assert.equal(card.this_week.held, 'challah', 'Week 15, as the setup note says');
  assert.equal(card.this_week.held_until, '2027-04-29');
});

test('with their unleavened swaps, lessons are cooked in the feast: planned, not paused, offered in Swap, and in the library', async (t) => {
  on('2027-04-19');
  t.after(() => mock.timers.reset());
  const { a, ava } = await setup();
  await a.put('/api/family', { name: 'Carsons', default_servings: 4, diet_filters: [], plan_weeks: true });
  await a.post('/api/pin/unlock', { pin: '1234' });
  assert.equal((await a.post('/api/queue', { lesson_id: 'tuna-salad-sandwiches', profile_ids: [ava], planned_date: '2027-04-23' })).status, 200);
  // Shakshuka is first in the sample plan: its pita has a swap, so nothing is held.
  await a.post('/api/courses', { profile_ids: [ava], start_date: '2027-04-18', per_week: 1, plan: await samplePlan(a) });
  const card = (await a.get('/api/queue?tz=0')).body.courses[0];
  assert.equal(card.this_week.held, null);
  assert.deepEqual(card.this_week.lessons.map((x) => x.lesson_id ?? x.id), ['shakshuka']);
  const id = (await a.post('/api/queue', { lesson_id: 'beef-bulgogi', profile_ids: [ava], planned_date: '2027-04-23' })).body.id;
  const options = (await a.get(`/api/queue/${id}/swap`)).body.options.map((o) => o.id);
  assert.ok(options.includes('tuna-salad-sandwiches'));
  assert.ok(!options.includes('smash-burgers'));
  const lib = (await a.get('/api/library')).body.lessons;
  assert.equal(lib.find((x) => x.id === 'tuna-salad-sandwiches').feast_ok, true);
  assert.equal(lib.find((x) => x.id === 'smash-burgers').feast_ok, false);
});
