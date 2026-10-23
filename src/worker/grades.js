// Phase 4b: grading and the homeschool transcript (plan §6.15, §6.17). Both
// are homeschool mode only, behind the parent PIN, and never shown to kids.
// A cook counts when it's finished, not taken back, and not on the Sabbath;
// nothing is graded on the Sabbath, and a Sabbath cook can't be graded on
// another day (§6.18). Switching to casual mode hides grades and keeps them.
import { fail, now } from './lib/http.js';
import { requireParent } from './auth.js';
import { LIBRARY } from './library-data.js';
import { tzOf, today } from './plan.js';
import { localDay, isSabbath } from './schedule.js';
import { recipeNames } from './recipes.js';
import { RUBRIC, GRADE_TEXT_MAX, rubricAverage, gradeLine } from '../content/grades.js';

const DETAIL_MAX = 80;

async function homeschool(env, req) {
  const s = await requireParent(env, req);
  const fam = await env.DB.prepare('SELECT name, mode, school_name FROM families WHERE id = ?').bind(s.family_id).first();
  if (fam.mode !== 'homeschool') fail(409, 'not_homeschool', 'Grades and the transcript are part of homeschool mode. Turn it on in Family settings.');
  return { s, fam };
}

const sabbathToday = (req) => isSabbath(today(req));
const noSabbath = (req) => {
  if (sabbathToday(req)) fail(409, 'sabbath', "Grading isn't available on the Sabbath.");
};

// What a cook was: a library lesson or one of the family's recipes, with its time.
async function dishes(env, fid) {
  const names = await recipeNames(env, fid);
  const mins = {};
  for (const r of (await env.DB.prepare('SELECT id, total_minutes FROM family_recipes WHERE family_id = ?').bind(fid).all()).results) mins[`recipe:${r.id}`] = r.total_minutes;
  for (const r of (await env.DB.prepare('SELECT id, body_json FROM community_recipes').all()).results) mins[`shared:${r.id}`] = JSON.parse(r.body_json).totalMinutes ?? null;
  return (lid) => {
    const L = LIBRARY.lessons.find((x) => x.id === lid);
    if (L) return { title: L.title, cuisine: LIBRARY.cuisines[L.cuisine] ?? L.cuisine ?? '', skill: L.skill ?? '', minutes: L.totalMinutes ?? null };
    return { title: names[lid]?.title ?? lid, cuisine: '', skill: 'Family recipe', minutes: mins[lid] ?? null };
  };
}

// Every counted cook of the family's profiles (or one profile), oldest first,
// with its grade and the profile's reflection.
async function counted(env, req, fid, pid = null) {
  const tz = tzOf(req);
  const { results } = await env.DB.prepare(`SELECT ap.profile_id, ap.rating, ap.notes, ap.transfer, a.id, a.lesson_id, a.finished_at,
        g.skill, g.safety, g.recipe, g.result, g.reflection, g.grade_text, g.graded_at
      FROM attempt_profiles ap
      JOIN attempts a ON a.id = ap.attempt_id AND a.family_id = ap.family_id
      LEFT JOIN grades g ON g.attempt_id = a.id AND g.profile_id = ap.profile_id AND g.family_id = ap.family_id
      WHERE ap.family_id = ? ${pid ? 'AND ap.profile_id = ?' : ''} AND a.finished_at IS NOT NULL AND a.removed_at IS NULL
      ORDER BY a.finished_at, a.id`).bind(...(pid ? [fid, pid] : [fid])).all();
  const dish = await dishes(env, fid);
  return results.map((r) => ({ ...r, date: localDay(r.finished_at, tz) })).filter((r) => !isSabbath(r.date)).map((r) => {
    const d = dish(r.lesson_id);
    const g = r.graded_at ? Object.fromEntries([...RUBRIC.map((x) => [x.key, r[x.key]]), ['grade_text', r.grade_text], ['graded_at', r.graded_at]]) : null;
    return {
      cook: r.id, profile_id: r.profile_id, date: r.date, dish: d.title, cuisine: d.cuisine, skill: d.skill, minutes: d.minutes,
      reflection: { rating: r.rating, notes: r.notes, transfer: r.transfer },
      grade: g, grade_line: g ? gradeLine(g) : null,
    };
  });
}

const score = (v, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 4) fail(400, 'invalid', `${label} is scored 1 to 4.`);
  return n;
};
const optText = (v, field, max) => {
  if (v == null || String(v).trim() === '') return null;
  const t = String(v).trim();
  if (t.length > max) fail(400, 'invalid', `${field} is too long (${max} characters at most).`);
  return t;
};
const optDate = (v, field) => {
  if (v == null || v === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) fail(400, 'invalid', `${field} must be a date.`);
  return String(v);
};

async function profileOf(env, fid, pid) {
  return await env.DB.prepare('SELECT * FROM profiles WHERE id = ? AND family_id = ?').bind(pid, fid).first() ?? fail(404, 'not_found', 'No such profile.');
}

export function register(on) {
  // The Grades page: every counted cook still waiting for a grade.
  on('GET', '/api/grades', async (req, env) => {
    const { s } = await homeschool(env, req);
    const { results: profiles } = await env.DB.prepare('SELECT id, name FROM profiles WHERE family_id = ? ORDER BY created_at, id').bind(s.family_id).all();
    const rows = await counted(env, req, s.family_id);
    const name = Object.fromEntries(profiles.map((p) => [p.id, p.name]));
    return {
      sabbath: sabbathToday(req),
      to_grade: rows.filter((r) => !r.grade).reverse().map((r) => ({ ...r, profile: name[r.profile_id] })),
      graded: rows.filter((r) => r.grade).length,
    };
  });

  // Grade one profile on one cook: the rubric, a grade in the parent's words,
  // or both. Neither takes the grade off.
  on('PUT', '/api/attempts/([0-9a-f]{16})/grade', async (req, env, body, [aid]) => {
    const { s } = await homeschool(env, req);
    noSabbath(req);
    const pid = String(body.profile_id ?? '');
    const row = await env.DB.prepare(`SELECT a.finished_at, a.removed_at FROM attempts a JOIN attempt_profiles ap ON ap.attempt_id = a.id AND ap.family_id = a.family_id
        WHERE a.id = ? AND a.family_id = ? AND ap.profile_id = ?`).bind(aid, s.family_id, pid).first() ?? fail(404, 'not_found', 'No such cook for that profile.');
    if (!row.finished_at || row.removed_at) fail(409, 'not_counted', "That cook doesn't count, so it can't be graded.");
    if (isSabbath(localDay(row.finished_at, tzOf(req)))) fail(409, 'sabbath_cook', "A cook on the Sabbath doesn't count, so it can't be graded.");
    const rubric = body.rubric == null ? null : Object.fromEntries(RUBRIC.map((r) => [r.key, score(body.rubric[r.key], r.label)]));
    const text = optText(body.grade_text, 'The grade', GRADE_TEXT_MAX);
    if (!rubric && !text) {
      await env.DB.prepare('DELETE FROM grades WHERE attempt_id = ? AND profile_id = ? AND family_id = ?').bind(aid, pid, s.family_id).run();
      return { ok: true, grade: null };
    }
    const g = { ...Object.fromEntries(RUBRIC.map((r) => [r.key, rubric?.[r.key] ?? null])), grade_text: text };
    await env.DB.prepare(`INSERT INTO grades (attempt_id, profile_id, family_id, skill, safety, recipe, result, reflection, grade_text, graded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(attempt_id, profile_id) DO UPDATE SET skill = excluded.skill, safety = excluded.safety, recipe = excluded.recipe,
          result = excluded.result, reflection = excluded.reflection, grade_text = excluded.grade_text, graded_at = excluded.graded_at`)
      .bind(aid, pid, s.family_id, g.skill, g.safety, g.recipe, g.result, g.reflection, g.grade_text, now()).run();
    return { ok: true, grade: g, grade_line: gradeLine(g) };
  });

  // One profile's transcript: its details, the cooks in its dates, the skills,
  // and the totals the parent decides the final grade and credit from.
  on('GET', '/api/transcript/([0-9a-f]{16})', async (req, env, body, [pid]) => {
    const { s, fam } = await homeschool(env, req);
    const p = await profileOf(env, s.family_id, pid);
    const t = await env.DB.prepare('SELECT * FROM transcripts WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id).first() ?? {};
    const rows = (await counted(env, req, s.family_id, pid))
      .filter((r) => (!t.from_date || r.date >= t.from_date) && (!t.to_date || r.date <= t.to_date))
      .map(({ reflection, ...r }) => r);
    const skills = [];
    for (const r of rows) if (r.skill && r.skill !== 'Family recipe' && !skills.some((x) => x.name === r.skill)) skills.push({ name: r.skill, date: r.date });
    const avgs = rows.map((r) => rubricAverage(r.grade)).filter((a) => a != null);
    return {
      school_name: fam.school_name ?? '',
      family: fam.name,
      profile: { id: p.id, name: p.name },
      details: {
        student_name: t.student_name ?? '', course_name: t.course_name ?? '', course_code: t.course_code ?? '', school_year: t.school_year ?? '',
        from_date: t.from_date ?? '', to_date: t.to_date ?? '', final_grade: t.final_grade ?? '', credit: t.credit ?? '',
      },
      rows,
      skills,
      totals: {
        cooks: rows.length,
        hours: Math.round(rows.reduce((n, r) => n + (r.minutes ?? 0), 0) / 6) / 10,
        graded: rows.filter((r) => r.grade).length,
        rubric_graded: avgs.length,
        rubric_average: avgs.length ? Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 10) / 10 : null,
      },
    };
  });

  on('PUT', '/api/transcript/([0-9a-f]{16})', async (req, env, body, [pid]) => {
    const { s } = await homeschool(env, req);
    await profileOf(env, s.family_id, pid);
    const d = {
      student_name: optText(body.student_name, 'The student name', DETAIL_MAX),
      course_name: optText(body.course_name, 'The course name', DETAIL_MAX),
      course_code: optText(body.course_code, 'The course code', 20),
      school_year: optText(body.school_year, 'The school year', 20),
      from_date: optDate(body.from_date, 'From'),
      to_date: optDate(body.to_date, 'To'),
      final_grade: optText(body.final_grade, 'The final grade', GRADE_TEXT_MAX),
      credit: optText(body.credit, 'The credit', 20),
    };
    if (d.from_date && d.to_date && d.from_date > d.to_date) fail(400, 'invalid', 'From must be before To.');
    const keys = Object.keys(d);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO transcripts (profile_id, family_id, ${keys.join(', ')}, updated_at) VALUES (?, ?, ${keys.map(() => '?').join(', ')}, ?)
          ON CONFLICT(profile_id) DO UPDATE SET ${keys.map((k) => `${k} = excluded.${k}`).join(', ')}, updated_at = excluded.updated_at`)
        .bind(pid, s.family_id, ...keys.map((k) => d[k]), now()),
      env.DB.prepare('UPDATE families SET school_name = ? WHERE id = ?').bind(optText(body.school_name, 'The homeschool name', DETAIL_MAX), s.family_id),
    ]);
    return { ok: true };
  });
}
