// Test families (owner screens): pretend families the owner makes from a
// preset and opens on their own device, to see the live app as that family
// would. Opening one signs this device in as its parent and keeps the owner's
// own session aside; Back to my account puts it back. They're ordinary
// families otherwise, so every screen is the real one. Which families are
// test families is kept in settings, so it needs no migration.
import { fail, json, now, readCookie } from './lib/http.js';
import { hashSecret, randomHex } from './lib/crypto.js';
import { requireOwner, startTestSession, endTestSession, RETURN_COOKIE } from './auth.js';
import { LIBRARY } from './library-data.js';
import { servingOptions } from '../content/scale.js';
import { SETUP_STEPS } from '../content/getting-started.js';
import { PARTS } from '../content/levels.js';
import { weekOf, addDays } from './schedule.js';
import { seedCourse, courseOrder } from './plan.js';
import { setPreview } from './release.js';
import { deleteFamily } from './backup.js';

const KEY = 'test_families';
// Every test family's parent PIN, shown on the bar along the top.
export const TEST_PIN = '1234';
const EMAIL_DOMAIN = 'test.invalid';
const id = () => randomHex(8);

export const PRESETS = {
  new: 'New family',
  kids: 'Kids partway through a course',
  adult: 'An adult learner',
};
const PROGRAMS = { '': 'Cook Around the World', ...Object.fromEntries(Object.values(LIBRARY.levels ?? {}).map((V) => [V.id, V.name])) };
const WEEKS_MAX = 30;
// Cook Around the World's pace for a test family.
const PER_WEEK = 2;

const lessonById = Object.fromEntries(LIBRARY.lessons.map((L) => [L.id, L]));

// [{ id, label, created_at }], newest last.
export async function testFamilies(db) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first();
  try { return row ? JSON.parse(row.value) : []; } catch { return []; }
}
const saveList = (db, list) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  .bind(KEY, JSON.stringify(list)).run();

// For /api/me: the test family this device is looking at for the owner, or null.
export async function testingFor(env, request, fid) {
  if (!readCookie(request, RETURN_COOKIE)) return null;
  const t = (await testFamilies(env.DB)).find((x) => x.id === fid);
  return t ? { label: t.label, pin: TEST_PIN } : null;
}

function input(body) {
  const preset = PRESETS[body.preset] ? body.preset : fail(400, 'invalid', `preset must be one of: ${Object.keys(PRESETS).join(', ')}.`);
  if (preset === 'new') return { preset, preview: Boolean(body.preview) };
  const program = String(body.program ?? '');
  if (!(program in PROGRAMS)) fail(400, 'invalid', 'No such program.');
  const weeks = Number(body.weeks ?? 0);
  if (!Number.isInteger(weeks) || weeks < 0 || weeks > WEEKS_MAX) fail(400, 'invalid', `Weeks in is 0 to ${WEEKS_MAX}.`);
  const mode = body.mode === 'homeschool' ? 'homeschool' : 'casual';
  // A Level needs the Levels' release, so a Level family always previews it.
  return { preset, program, weeks, mode, preview: Boolean(program) || Boolean(body.preview) };
}

const labelOf = (v) => (v.preset === 'new' ? PRESETS.new
  : `${v.preset === 'kids' ? 'Kids' : 'Adult'} on ${PROGRAMS[v.program]}, ${v.weeks ? `week ${v.weeks + 1}` : 'just starting'}${v.mode === 'homeschool' ? ' (homeschool)' : ''}`);

const nearest = (L, n) => servingOptions(L).reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));

// Makes the family and returns its id.
export async function makeTestFamily(env, v) {
  const fid = id(), parentId = id(), t = now();
  const today = new Date().toISOString().slice(0, 10);
  const start = addDays(weekOf(today), -7 * (v.weeks ?? 0));
  const stmts = [];
  // Nobody can log in as a test family: its password is random and never kept.
  const pw = await hashSecret(randomHex(16));
  const parent = (at) => env.DB.prepare('INSERT INTO parents (id, family_id, email, password_hash, created_at, notice_seen_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(parentId, fid, `test-${fid}@${EMAIL_DOMAIN}`, pw, at, v.preset === 'new' ? null : at);

  if (v.preset === 'new') {
    // As a sign-up leaves it: no name and no PIN, so Getting started opens.
    stmts.push(env.DB.prepare('INSERT INTO families (id, created_at, last_active_at) VALUES (?, ?, ?)').bind(fid, t, t), parent(t));
    await env.DB.batch(stmts);
  } else {
    const at = `${start}T12:00:00.000Z`;
    const servings = v.preset === 'kids' ? 4 : 2;
    stmts.push(env.DB.prepare(`INSERT INTO families (id, name, default_servings, diet_filters, parent_pin_hash, created_at, last_active_at, mode, plan_weeks, setup_step, setup_done_at)
        VALUES (?, ?, ?, '[]', ?, ?, ?, ?, 1, ?, ?)`).bind(fid, v.preset === 'kids' ? 'Test Kids' : 'Test Adult', servings, await hashSecret(TEST_PIN), at, t, v.mode, SETUP_STEPS.at(-1), at), parent(at));
    const people = v.preset === 'kids'
      ? [['Ava', 'tomato', 'quest', 'kid'], ['Ben', 'sky', 'passport', 'kid']]
      : [['Jordan', 'basil', 'passport', 'adult']];
    const pids = people.map(() => id());
    people.forEach(([name, color, theme, audience], i) => stmts.push(env.DB.prepare(`INSERT INTO profiles (id, family_id, name, avatar, people, theme, audience, created_at, intro_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)// A second apart, so the lockers keep this order.
      .bind(pids[i], fid, name, color, JSON.stringify([{ name, color }]), theme, audience, `${start}T12:00:0${i}.000Z`, v.weeks ? at : null)));
    await env.DB.batch(stmts);
    if (v.preview) await setPreview(env.DB, fid, true);
    const cid = await seedCourse(env, fid, { pids, program: v.program || null, start, per: PER_WEEK });
    await seedCooks(env, fid, cid, pids, { start, weeks: v.weeks, per: v.program ? 1 : PER_WEEK, servings, level: Boolean(v.program) });
  }
  if (v.preset === 'new' && v.preview) await setPreview(env.DB, fid, true);
  await saveList(env.DB, [...(await testFamilies(env.DB)), { id: fid, label: labelOf(v), created_at: t }]);
  return fid;
}

// The course's first lessons cooked, each in its week (a Monday, then a
// Wednesday, never the Sabbath), rated by everyone on it, and a Level week's
// parts checked off the same day.
async function seedCooks(env, fid, cid, pids, { start, weeks, per, servings, level }) {
  const { usable, weekOf: weekOfLesson } = await courseOrder(env, fid, cid);
  const stmts = [];
  usable.slice(0, weeks * per).forEach((lid, i) => {
    const L = lessonById[lid];
    const day = addDays(start, 7 * Math.floor(i / per) + 1 + 2 * (i % per));
    const aid = id();
    stmts.push(env.DB.prepare(`INSERT INTO attempts (id, family_id, lesson_id, lesson_version, servings, started_at, finished_at, checklist_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, '{}')`).bind(aid, fid, lid, L.version, nearest(L, servings), `${day}T17:00:00.000Z`, `${day}T18:00:00.000Z`));
    pids.forEach((pid, j) => stmts.push(env.DB.prepare('INSERT INTO attempt_profiles (attempt_id, family_id, profile_id, rating, reflected_at) VALUES (?, ?, ?, ?, ?)')
      .bind(aid, fid, pid, (i + j) % 3 ? 5 : 4, `${day}T18:05:00.000Z`)));
    if (level && weekOfLesson[lid]) {
      for (const part of PARTS) for (const pid of pids) {
        stmts.push(env.DB.prepare('INSERT INTO level_tasks (family_id, course_id, week, part, profile_id, done_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(fid, cid, weekOfLesson[lid], part, pid, `${day}T18:10:00.000Z`));
      }
    }
  });
  if (stmts.length) await env.DB.batch(stmts);
}

export function register(on) {
  on('GET', '/api/owner/test-families', async (req, env) => {
    await requireOwner(env, req);
    const list = await testFamilies(env.DB);
    const out = [];
    for (const x of list.toReversed()) {
      const f = await env.DB.prepare('SELECT name, deleted_at, (SELECT COUNT(*) FROM profiles p WHERE p.family_id = families.id) AS profiles FROM families WHERE id = ?').bind(x.id).first();
      if (f && !f.deleted_at) out.push({ ...x, name: f.name, profiles: f.profiles });
    }
    return { families: out, presets: PRESETS, programs: PROGRAMS, weeks_max: WEEKS_MAX, pin: TEST_PIN };
  });

  on('POST', '/api/owner/test-families', async (req, env, body) => {
    await requireOwner(env, req);
    return { ok: true, id: await makeTestFamily(env, input(body)) };
  });

  // Opens it on this device. The owner's session is kept for Back to my account.
  on('POST', '/api/owner/test-families/([0-9a-f]{16})/open', async (req, env, body, [fid]) => {
    await requireOwner(env, req);
    if (!(await testFamilies(env.DB)).some((x) => x.id === fid)) fail(404, 'not_found', 'No such test family.');
    const parent = await env.DB.prepare('SELECT p.id, p.family_id FROM parents p JOIN families f ON f.id = p.family_id WHERE p.family_id = ? AND f.deleted_at IS NULL').bind(fid).first()
      ?? fail(404, 'not_found', 'No such test family.');
    return json({ ok: true }, 200, { 'set-cookie': await startTestSession(env, parent, req) });
  });

  on('POST', '/api/test-family/leave', async (req, env) => json({ ok: true }, 200, { 'set-cookie': await endTestSession(env, req) }));

  // Like Delete our family: gone at once, and /ops can bring it back for 30 days.
  on('DELETE', '/api/owner/test-families/([0-9a-f]{16})', async (req, env, body, [fid]) => {
    await requireOwner(env, req);
    if (!(await testFamilies(env.DB)).some((x) => x.id === fid)) fail(404, 'not_found', 'No such test family.');
    await deleteFamily(env.DB, fid);
    return { ok: true };
  });
}
