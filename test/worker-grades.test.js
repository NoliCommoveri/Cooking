// Phase 4b: grading and the homeschool transcript (plan §6.15, §6.17).
// Homeschool mode only, parent-only, and nothing counts on the Sabbath (§6.18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client } from './helpers/worker.js';

// Days by the family's calendar (UTC here): 2026-10-20 is a Tuesday,
// 2026-10-17 and 2026-10-24 Saturdays.
const TUE = '2026-10-20T15:00:00.000Z';
const LAST_SAT = '2026-10-17T15:00:00.000Z';
const SAT = '2026-10-24T15:00:00.000Z';
const WED_NOW = Date.parse('2026-10-21T18:00:00.000Z');

async function setup(t) {
  t.mock.timers.enable({ apis: ['Date'], now: WED_NOW });
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  for (const n of ['Ava', 'Eli']) await a.post('/api/profiles', { people: [{ name: n, color: 'tomato' }] });
  const { profiles } = (await a.get('/api/profiles')).body;
  const [ava, eli] = ['Ava', 'Eli'].map((n) => profiles.find((p) => p.name === n).id);
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], mode: 'homeschool' });
  const cook = async (id, lesson, at, who = [ava, eli]) => a.put(`/api/attempts/${id}`, {
    lesson_id: lesson, servings: 6, profile_ids: who, started_at: new Date(Date.parse(at) - 3600e3).toISOString(), finished_at: at,
  });
  await cook('00000000000000a1', 'shakshuka', TUE);
  await cook('00000000000000a2', 'shakshuka', LAST_SAT, [ava]);
  return { env, a, ava, eli };
}

const RUB = { skill: 4, safety: 3, recipe: 4, result: 3, reflection: 3 };

test('grades and the transcript are homeschool mode only, and parent-only', async (t) => {
  const { env, a, ava } = await setup(t);
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], mode: 'casual' });
  assert.equal((await a.get('/api/grades')).body.error, 'not_homeschool');
  assert.equal((await a.get(`/api/transcript/${ava}`)).body.error, 'not_homeschool');
  await a.put('/api/family', { name: 'Carsons', default_servings: 6, diet_filters: [], mode: 'homeschool' });
  await a.post('/api/pin/lock');
  assert.equal((await a.get('/api/grades')).body.error, 'pin_required');
  const other = await family(env, 'Smiths', 'pat@example.com');
  await other.put('/api/family', { name: 'Smiths', default_servings: 6, diet_filters: [], mode: 'homeschool' });
  assert.equal((await other.get(`/api/transcript/${ava}`)).status, 404);
  assert.equal((await other.put('/api/attempts/00000000000000a1/grade', { profile_id: ava, grade_text: 'A' })).status, 404);
  assert.equal((await client(env).get('/api/grades')).status, 401);
});

test('To grade lists counted cooks per profile; a Sabbath cook is never on it and can\'t be graded', async (t) => {
  const { a, ava, eli } = await setup(t);
  const list = (await a.get('/api/grades')).body;
  assert.equal(list.sabbath, false);
  assert.deepEqual(list.to_grade.map((r) => [r.dish, r.profile]).sort(), [['Shakshuka', 'Ava'], ['Shakshuka', 'Eli']]);
  assert.equal((await a.put('/api/attempts/00000000000000a2/grade', { profile_id: ava, grade_text: 'A' })).body.error, 'sabbath_cook');

  // The rubric, words, or both; each profile on a cook is graded on its own.
  assert.equal((await a.put('/api/attempts/00000000000000a1/grade', { profile_id: ava, rubric: { ...RUB, safety: 5 } })).status, 400);
  assert.equal((await a.put('/api/attempts/00000000000000a1/grade', { profile_id: ava, rubric: { skill: 4 } })).status, 400);
  const res = (await a.put('/api/attempts/00000000000000a1/grade', { profile_id: ava, rubric: RUB, grade_text: 'Great job' })).body;
  assert.equal(res.grade_line, 'Great job · 3.4 / 4');
  await a.put('/api/attempts/00000000000000a1/grade', { profile_id: eli, grade_text: 'B+' });
  assert.equal((await a.get('/api/grades')).body.to_grade.length, 0);
  // Neither takes it off.
  await a.put('/api/attempts/00000000000000a1/grade', { profile_id: eli });
  assert.deepEqual((await a.get('/api/grades')).body.to_grade.map((r) => r.profile), ['Eli']);
});

test('nothing is graded on the Sabbath', async (t) => {
  const { a, ava } = await setup(t);
  t.mock.timers.setTime(Date.parse(SAT));
  await a.post('/api/pin/unlock', { pin: '1234' });
  assert.equal((await a.get('/api/grades')).body.sabbath, true);
  assert.equal((await a.put('/api/attempts/00000000000000a1/grade', { profile_id: ava, grade_text: 'A' })).body.error, 'sabbath');
});

test('the transcript: details, cooks in its dates, skills, hours, and the rubric average', async (t) => {
  const { a, ava } = await setup(t);
  await a.put('/api/attempts/00000000000000a1/grade', { profile_id: ava, rubric: RUB });
  let tr = (await a.get(`/api/transcript/${ava}`)).body;
  assert.deepEqual(tr.rows.map((r) => r.dish), ['Shakshuka'], 'the Sabbath cook is left out');
  assert.equal(tr.rows[0].grade_line, '3.4 / 4');
  assert.equal(tr.skills.length, 1);
  assert.equal(tr.totals.rubric_average, 3.4);
  assert.ok(tr.totals.hours > 0);
  assert.ok(!('reflection' in tr.rows[0]));

  assert.equal((await a.put(`/api/transcript/${ava}`, { from_date: '2026-10-21', to_date: '2026-10-01' })).status, 400);
  await a.put(`/api/transcript/${ava}`, {
    school_name: 'Carson Academy', student_name: 'Ava Carson', course_name: 'Culinary Arts', course_code: 'HE-101', school_year: '2026–2027',
    from_date: '2026-10-21', final_grade: 'A', credit: '0.5',
  });
  tr = (await a.get(`/api/transcript/${ava}`)).body;
  assert.equal(tr.school_name, 'Carson Academy');
  assert.equal(tr.details.course_code, 'HE-101');
  assert.equal(tr.details.final_grade, 'A');
  assert.equal(tr.rows.length, 0, 'from_date leaves out the earlier cook');
  assert.equal(tr.totals.rubric_average, null);
});

test('deleting a profile takes its grades and transcript with it', async (t) => {
  const { env, a, ava } = await setup(t);
  await a.put('/api/attempts/00000000000000a1/grade', { profile_id: ava, grade_text: 'A' });
  await a.put(`/api/transcript/${ava}`, { course_name: 'Culinary Arts' });
  assert.equal((await a.del(`/api/profiles/${ava}`)).status, 200);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM grades').first()).n, 0);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS n FROM transcripts').first()).n, 0);
});
