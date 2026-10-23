// The app's JSON API (plan §8.3, §6.2, §6.2a). Every family query is scoped by
// the session's family_id; no route takes a family id from the browser. The
// owner routes are the one cross-family view, and they return family names,
// profile counts, and last-active dates only.
import { ApiError, fail, json, now, readCookie } from './lib/http.js';
import { hashSecret, verifySecret, randomHex, sha256Hex, timingSafeEqual } from './lib/crypto.js';
import {
  startSession, endSession, readSession, requireSession, requireParent, requireOwner,
  pinUnlocked, unlockPin, lockPin, ownProfile, kidRefused, endKidSessions, renewKidSession, SESSION_COOKIE, KID_COOKIE,
} from './auth.js';
import { sendEmail, emailReady, resetEmail, signupCodeEmail, fixReportEmail } from './email.js';
import { livePatches, liveLesson, patchProblems } from './lessons.js';
import { cleanValue, getAt, setAt, patchSpec, showValue } from '../content/patch.js';
import { LIBRARY } from './library-data.js';
import { dietView } from '../content/diet.js';
import { FREE_MAX, servingOptions } from '../content/scale.js';
import { numberCourse } from '../content/course.js';
import { register as registerPlan, markCooked, tzOf } from './plan.js';
import { localDay, isSabbath } from './schedule.js';
import { register as registerShopping } from './shopping.js';
import { register as registerRecipes, lessonFor, recipeNames } from './recipes.js';
import { register as registerSharing } from './sharing.js';
import { register as registerSwap } from './swap.js';
import { register as registerKidLogins } from './kidlogin.js';
import { register as registerSetup } from './setup.js';
import { register as registerGrades } from './grades.js';
import { RUBRIC, gradeLine } from '../content/grades.js';
import { exportFamily, deleteFamily, eraseAfter } from './backup.js';

export const THEMES = ['quest', 'passport'];
export const AVATAR_COLORS = ['tomato', 'butter', 'basil', 'sky', 'plum', 'peach', 'mint', 'slate'];
const RESET_MINUTES = 60;
const id = () => randomHex(8);

// ---------- input checks ----------

const text = (v, field, { max = 60, min = 1 } = {}) => {
  const s = String(v ?? '').trim();
  if (s.length < min) fail(400, 'invalid', `${field} is required.`);
  if (s.length > max) fail(400, 'invalid', `${field} is too long (${max} characters at most).`);
  return s;
};
const email = (v) => {
  const s = String(v ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) || s.length > 200) fail(400, 'invalid', 'Enter a real email address.');
  return s;
};
const password = (v) => {
  const s = String(v ?? '');
  if (s.length < 8) fail(400, 'invalid', 'Passwords need at least 8 characters.');
  if (s.length > 200) fail(400, 'invalid', 'That password is too long.');
  return s;
};
const pin = (v) => {
  const s = String(v ?? '').trim();
  if (!/^\d{4,8}$/.test(s)) fail(400, 'invalid', 'The PIN is 4 to 8 digits.');
  return s;
};
const oneOf = (v, list, field) => (list.includes(v) ? v : fail(400, 'invalid', `${field} must be one of: ${list.join(', ')}.`));

function profileInput(body) {
  const people = Array.isArray(body.people) ? body.people : [];
  if (people.length < 1 || people.length > 8) fail(400, 'invalid', 'A profile has 1 to 8 people on it.');
  const cleanPeople = people.map((p) => ({ name: text(p?.name, 'Each name', { max: 30 }), color: oneOf(p?.color, AVATAR_COLORS, 'color') }));
  const name = body.name ? text(body.name, 'Locker name', { max: 40 }) : cleanPeople.map((p) => p.name).join(' & ').slice(0, 40);
  return {
    name,
    people: cleanPeople,
    avatar: cleanPeople[0].color,
    theme: oneOf(body.theme ?? 'quest', THEMES, 'theme'),
    // A shared profile with any kid on it is a kid profile (§1); the parent says which.
    audience: oneOf(body.audience ?? 'kid', ['kid', 'adult'], 'audience'),
  };
}

const profileOut = (r) => ({
  id: r.id, name: r.name, avatar: r.avatar, people: JSON.parse(r.people), theme: r.theme, audience: r.audience, track: r.track,
  // The kitchen intro (§6.9): 'new' until finished or skipped. Until /ops
  // applies migration 0016 there's no column, and it doesn't open on its own.
  intro: r.intro_seen_at === undefined ? null : r.intro_seen_at ? 'seen' : 'new',
});

const familyOut = (f) => ({
  name: f.name, default_servings: f.default_servings, diet_filters: JSON.parse(f.diet_filters), pin_set: Boolean(f.parent_pin_hash),
  voice_enabled: Boolean(f.voice_enabled), mode: f.mode, plan_weeks: Boolean(f.plan_weeks), photos_enabled: Boolean(f.photos_enabled),
  // Chef Ruth's Getting started (§6.9): still to finish, and the last part done.
  // Until /ops applies migration 0014 the columns aren't there, and the old
  // first run (family name and PIN) still works.
  setup_needed: f.setup_done_at === null, setup_step: f.setup_step ?? null,
});

// The family has a lesson in the queue or a dish cooked, so Chef Ruth's
// Getting started is done for good and leaves her menu (owner, 2026-10-23).
// Until /ops applies migration 0015 there's no removed_at, and it stays.
async function cooking(env, fid) {
  try {
    return Boolean((await env.DB.prepare(`SELECT EXISTS (SELECT 1 FROM queue WHERE family_id = ? AND status IN ('assigned', 'shopped', 'cooked'))
        OR EXISTS (SELECT 1 FROM attempts WHERE family_id = ? AND finished_at IS NOT NULL AND removed_at IS NULL) AS yes`).bind(fid, fid).first()).yes);
  } catch {
    return false;
  }
}

// ---------- routes ----------

// A kid login (§8.3a) reaches a route only if it's registered with { kid: true };
// every other route refuses it before its handler runs. A kid route that takes
// a profile checks it's the kid's own (ownProfile).
const routes = [];
const on = (method, pattern, handler, { kid = false } = {}) => routes.push({ method, re: new RegExp(`^${pattern}$`), handler, kid });
const KID = { kid: true };

on('GET', '/api/me', async (req, env) => {
  const s = await readSession(env, req);
  if (!s) return { signed_in: false };
  const fam = await env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(s.family_id).first();
  // A kid's device knows only its own profile and the family's settings.
  // Each launch asks this, so it renews the kid's login for 14 more days.
  if (s.kid) {
    return json({ signed_in: true, kid: { profile_id: s.profile_id, login_name: s.login_name }, parent: null, family: familyOut(fam), pin_unlocked_until: null },
      200, { 'set-cookie': await renewKidSession(env, s, req) });
  }
  return {
    signed_in: true,
    parent: { email: s.email, is_owner: s.is_owner, test_cook_notice: !s.notice_seen_at },
    family: { ...familyOut(fam), cooking: await cooking(env, s.family_id) },
    pin_unlocked_until: pinUnlocked(s) ? s.pin_until : null,
  };
}, KID);

on('POST', '/api/login', async (req, env, body) => {
  const row = await env.DB.prepare('SELECT p.*, f.deleted_at FROM parents p JOIN families f ON f.id = p.family_id WHERE p.email = ?').bind(email(body.email)).first();
  if (!row || !(await verifySecret(String(body.password ?? ''), row.password_hash))) {
    fail(401, 'login_failed', "That email and password don't match.");
  }
  if (row.deleted_at) fail(403, 'family_deleted', deletedMessage(row.deleted_at));
  return json({ ok: true }, 200, { 'set-cookie': await startSession(env, row, req) });
}, KID);

on('POST', '/api/logout', async (req, env) => json({ ok: true }, 200, { 'set-cookie': await endSession(env, req) }), KID);

// Open sign-up (§8.3). Anyone can sign up with an email and a password. A
// six-digit code goes to that email, and entering it creates the family. While
// the beta word is set, sign-up asks for it first.
export const CODE_MINUTES = 30;      // a code works this long
export const RESEND_MINUTES = 10;    // a new code can be asked for after this
export const CODE_TRIES = 5;         // wrong guesses before a code stops working

const betaWord = async (env) => (await env.DB.prepare("SELECT value FROM settings WHERE key = 'beta_word'").first())?.value ?? null;
const codeHash = (addr, code) => sha256Hex(`${addr}:${code}`);
const minutesFrom = (iso, m) => new Date(Date.parse(iso) + m * 60 * 1000).toISOString();

function sixDigits() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

// Makes a fresh code for this email, replacing any earlier one, and emails it.
async function sendCode(env, addr, passwordHash) {
  const code = sixDigits();
  const t = now();
  const mail = await sendEmail(env, { to: addr, ...signupCodeEmail(code, CODE_MINUTES) });
  if (!mail.sent) fail(503, 'email_failed', "We couldn't send the email just now. Try again in a few minutes.");
  await env.DB.prepare(`INSERT INTO signup_verifications (email, password_hash, code_hash, attempts, sent_at, expires_at)
      VALUES (?, ?, ?, 0, ?, ?)
      ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, code_hash = excluded.code_hash,
        attempts = 0, sent_at = excluded.sent_at, expires_at = excluded.expires_at`)
    .bind(addr, passwordHash, await codeHash(addr, code), t, minutesFrom(t, CODE_MINUTES)).run();
  return { ok: true, email: addr, resend_at: minutesFrom(t, RESEND_MINUTES) };
}

// An email already in a family can't sign up. A deleted family's email is
// free again once the family is erased (§6.14).
async function emailFree(env, addr) {
  const had = await env.DB.prepare('SELECT f.deleted_at FROM parents p JOIN families f ON f.id = p.family_id WHERE p.email = ?').bind(addr).first();
  if (had?.deleted_at) fail(409, 'family_deleted', `${deletedMessage(had.deleted_at)} After that, this email can sign up again.`);
  if (had) fail(409, 'email_taken', 'That email already has an account. Log in instead.');
}

const deletedMessage = (deletedAt) => `This family's account was deleted. It's erased for good after ${eraseAfter(deletedAt).slice(0, 10)}; until then, the app's owner can bring it back if you ask.`;

// A code that has run out or been guessed at too often can be replaced straight away.
const spent = (row) => Date.parse(row.expires_at) < Date.now() || row.attempts >= CODE_TRIES;

on('GET', '/api/signup', async (req, env) => ({ beta_word: Boolean(await betaWord(env)) }));

on('POST', '/api/signup/start', async (req, env, body) => {
  const word = await betaWord(env);
  if (word && String(body.beta_word ?? '').trim().toLowerCase() !== word.trim().toLowerCase()) {
    fail(403, 'bad_beta_word', "That beta word doesn't match.");
  }
  const addr = email(body.email);
  const pwHash = await hashSecret(password(body.password));
  await emailFree(env, addr);
  const row = await env.DB.prepare('SELECT * FROM signup_verifications WHERE email = ?').bind(addr).first();
  if (row && !spent(row) && Date.now() < Date.parse(minutesFrom(row.sent_at, RESEND_MINUTES))) {
    // Pressing Sign up again doesn't send another email inside the wait; the
    // code already sent still works, now with this password.
    await env.DB.prepare('UPDATE signup_verifications SET password_hash = ? WHERE email = ?').bind(pwHash, addr).run();
    return { ok: true, email: addr, resend_at: minutesFrom(row.sent_at, RESEND_MINUTES) };
  }
  return sendCode(env, addr, pwHash);
});

on('POST', '/api/signup/resend', async (req, env, body) => {
  const addr = email(body.email);
  const row = await env.DB.prepare('SELECT * FROM signup_verifications WHERE email = ?').bind(addr).first();
  if (!row) fail(404, 'start_again', 'Start sign-up again.');
  const resendAt = minutesFrom(row.sent_at, RESEND_MINUTES);
  if (!spent(row) && Date.now() < Date.parse(resendAt)) fail(429, 'wait', 'You can ask for a new code soon.');
  return sendCode(env, addr, row.password_hash);
});

on('POST', '/api/signup/verify', async (req, env, body) => {
  const addr = email(body.email);
  const code = String(body.code ?? '').replace(/\D/g, '');
  const row = await env.DB.prepare('SELECT * FROM signup_verifications WHERE email = ?').bind(addr).first();
  if (!row) fail(404, 'start_again', 'Start sign-up again.');
  if (Date.parse(row.expires_at) < Date.now()) fail(400, 'code_expired', 'That code has expired. Ask for a new one.');
  if (row.attempts >= CODE_TRIES) fail(400, 'code_used_up', 'Too many tries. Ask for a new code.');
  if (code.length !== 6 || !timingSafeEqual(await codeHash(addr, code), row.code_hash)) {
    await env.DB.prepare('UPDATE signup_verifications SET attempts = attempts + 1 WHERE email = ?').bind(addr).run();
    const left = CODE_TRIES - row.attempts - 1;
    fail(400, 'code_wrong', left > 0 ? `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many tries. Ask for a new code.');
  }
  await emailFree(env, addr);
  const t = now();
  const parent = { id: id(), family_id: id() };
  await env.DB.batch([
    env.DB.prepare('INSERT INTO families (id, created_at, last_active_at) VALUES (?, ?, ?)').bind(parent.family_id, t, t),
    env.DB.prepare('INSERT INTO parents (id, family_id, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(parent.id, parent.family_id, addr, row.password_hash, t),
    env.DB.prepare('DELETE FROM signup_verifications WHERE email = ?').bind(addr),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': await startSession(env, parent, req) });
});

on('POST', '/api/password/forgot', async (req, env, body) => {
  const row = await env.DB.prepare('SELECT p.id, p.family_id FROM parents p JOIN families f ON f.id = p.family_id WHERE p.email = ? AND f.deleted_at IS NULL').bind(email(body.email)).first();
  if (row) {
    const token = randomHex(32);
    const expires = new Date(Date.now() + RESET_MINUTES * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO password_resets (token_hash, family_id, parent_id, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(token), row.family_id, row.id, expires).run();
    await sendEmail(env, { to: email(body.email), ...resetEmail(`${new URL(req.url).origin}/#/reset/${token}`) });
  }
  return { ok: true };
});

on('POST', '/api/password/reset', async (req, env, body) => {
  const pw = password(body.password);
  const hash = await sha256Hex(String(body.token ?? ''));
  // Deleting a family removes its reset links, so a deleted family has none.
  const r = await env.DB.prepare('SELECT * FROM password_resets WHERE token_hash = ?').bind(hash).first();
  if (!r || r.used_at || Date.parse(r.expires_at) < Date.now()) {
    fail(400, 'bad_link', 'That reset link has expired or was already used. Ask for a new one.');
  }
  // A new password logs out every device that used the old one.
  await env.DB.batch([
    env.DB.prepare('UPDATE parents SET password_hash = ? WHERE id = ?').bind(await hashSecret(pw), r.parent_id),
    env.DB.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?').bind(now(), hash),
    env.DB.prepare('DELETE FROM sessions WHERE parent_id = ?').bind(r.parent_id),
  ]);
  const parent = await env.DB.prepare('SELECT id, family_id FROM parents WHERE id = ?').bind(r.parent_id).first();
  return json({ ok: true }, 200, { 'set-cookie': await startSession(env, parent, req) });
});

// ---------- the parent PIN ----------

// Set once, in the first run. Changing it later goes through /api/pin/reset.
// The first run: the family's name and its parent PIN, set once. Changing the
// PIN later goes through /api/pin/reset.
on('POST', '/api/pin/set', async (req, env, body) => {
  const s = await requireSession(env, req);
  const p = pin(body.pin);
  const res = await env.DB.prepare('UPDATE families SET name = ?, parent_pin_hash = ? WHERE id = ? AND parent_pin_hash IS NULL')
    .bind(text(body.family_name, 'Family name'), await hashSecret(p), s.family_id).run();
  if (!res.meta.changes) fail(409, 'pin_set', 'This family already has a PIN.');
  return { ok: true, pin_unlocked_until: await unlockPin(env, s, p) };
});

on('POST', '/api/pin/unlock', async (req, env, body) => {
  const s = await requireSession(env, req);
  return { ok: true, pin_unlocked_until: await unlockPin(env, s, String(body.pin ?? '')) };
});

on('POST', '/api/pin/lock', async (req, env) => {
  await lockPin(env, await requireSession(env, req));
  return { ok: true };
});

// A forgotten PIN is reset with the parent's account password (§8.3).
on('POST', '/api/pin/reset', async (req, env, body) => {
  const s = await requireSession(env, req);
  const row = await env.DB.prepare('SELECT password_hash FROM parents WHERE id = ?').bind(s.parent_id).first();
  if (!(await verifySecret(String(body.password ?? ''), row.password_hash))) fail(403, 'password_wrong', "That password didn't match.");
  const p = pin(body.pin);
  await env.DB.prepare('UPDATE families SET parent_pin_hash = ? WHERE id = ?').bind(await hashSecret(p), s.family_id).run();
  return { ok: true, pin_unlocked_until: await unlockPin(env, s, p) };
});

// ---------- profiles and the library ----------

// A kid's device gets the family's names and avatars (for Cooking with
// someone?) and its own profile in full.
on('GET', '/api/profiles', async (req, env) => {
  const s = await requireSession(env, req);
  const { results } = await env.DB.prepare('SELECT * FROM profiles WHERE family_id = ? ORDER BY created_at, id').bind(s.family_id).all();
  const out = results.map(profileOut);
  if (!s.kid) return { profiles: out };
  return { profiles: out.map((p) => (p.id === s.profile_id ? p : { id: p.id, name: p.name, avatar: p.avatar, people: p.people })) };
}, KID);

on('POST', '/api/profiles', async (req, env, body) => {
  const s = await requireParent(env, req);
  const p = profileInput(body);
  const pid = id();
  await env.DB.prepare('INSERT INTO profiles (id, family_id, name, avatar, people, theme, audience, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(pid, s.family_id, p.name, p.avatar, JSON.stringify(p.people), p.theme, p.audience, now()).run();
  return { ok: true, id: pid };
});

on('PUT', '/api/profiles/([0-9a-f]{16})', async (req, env, body, [pid]) => {
  const s = await requireParent(env, req);
  const p = profileInput(body);
  const res = await env.DB.prepare('UPDATE profiles SET name = ?, avatar = ?, people = ?, theme = ?, audience = ? WHERE id = ? AND family_id = ?')
    .bind(p.name, p.avatar, JSON.stringify(p.people), p.theme, p.audience, pid, s.family_id).run();
  if (!res.meta.changes) fail(404, 'not_found', 'No such profile.');
  // Kid logins are for kid profiles only (§8.3a): changing to adult turns it off.
  if (p.audience === 'adult') {
    await env.DB.batch([endKidSessions(env, s.family_id, pid), env.DB.prepare('DELETE FROM kid_logins WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id)]);
  }
  return { ok: true };
});

// A kid picks their own theme and can switch at any time (§5.2), so this one
// doesn't ask for the PIN.
on('PUT', '/api/profiles/([0-9a-f]{16})/theme', async (req, env, body, [pid]) => {
  const s = await requireSession(env, req);
  ownProfile(s, pid);
  const res = await env.DB.prepare('UPDATE profiles SET theme = ? WHERE id = ? AND family_id = ?')
    .bind(oneOf(body.theme, THEMES, 'theme'), pid, s.family_id).run();
  if (!res.meta.changes) fail(404, 'not_found', 'No such profile.');
  return { ok: true };
}, KID);

// The kitchen intro was finished or skipped (§6.9): it won't open on its own
// again. Before migration 0016 there's nowhere to keep it, and that's fine.
on('POST', '/api/profiles/([0-9a-f]{16})/intro', async (req, env, body, [pid]) => {
  const s = await requireSession(env, req);
  ownProfile(s, pid);
  if (!(await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first())) fail(404, 'not_found', 'No such profile.');
  try {
    await env.DB.prepare('UPDATE profiles SET intro_seen_at = COALESCE(intro_seen_at, ?) WHERE id = ? AND family_id = ?').bind(now(), pid, s.family_id).run();
  } catch { /* not migrated yet */ }
  return { ok: true };
}, KID);

// A deleted profile comes off every cook it was on. A cook nobody is left on
// goes with it.
on('DELETE', '/api/profiles/([0-9a-f]{16})', async (req, env, body, [pid]) => {
  const s = await requireParent(env, req);
  if (!(await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first())) {
    fail(404, 'not_found', 'No such profile.');
  }
  await env.DB.batch([
    // Its login goes, and every device it was logged in on is logged out (§8.3a).
    endKidSessions(env, s.family_id, pid),
    env.DB.prepare('DELETE FROM kid_logins WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id),
    env.DB.prepare('DELETE FROM grades WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id),
    env.DB.prepare('DELETE FROM transcripts WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id),
    env.DB.prepare('DELETE FROM attempt_profiles WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id),
    // Off every queued lesson and course too; a queued lesson nobody is left on goes.
    env.DB.prepare('DELETE FROM queue_profiles WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id),
    env.DB.prepare(`DELETE FROM queue WHERE family_id = ?
      AND NOT EXISTS (SELECT 1 FROM queue_profiles qp WHERE qp.queue_id = queue.id)`).bind(s.family_id),
    env.DB.prepare('DELETE FROM course_profiles WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id),
    env.DB.prepare(`DELETE FROM attempts WHERE family_id = ?
      AND NOT EXISTS (SELECT 1 FROM attempt_profiles ap WHERE ap.attempt_id = attempts.id)`).bind(s.family_id),
    env.DB.prepare('DELETE FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id),
  ]);
  return { ok: true };
});

// The shared library with this family's diet filters applied (§2.1).
on('GET', '/api/library', async (req, env) => {
  const s = await requireSession(env, req);
  const fam = await env.DB.prepare('SELECT diet_filters FROM families WHERE id = ?').bind(s.family_id).first();
  const filters = JSON.parse(fam.diet_filters);
  const name = (i) => LIBRARY.ingredients[i]?.name ?? i;
  // A patched total time shows on the card too (§6.11).
  const live = await livePatches(env.DB);
  const minutes = (L) => live[L.id]?.patches.findLast((p) => p.path === 'totalMinutes')?.value ?? L.totalMinutes;
  // Lesson numbers in the suggested course order (§4.1).
  const { labels: numbered, total } = numberCourse(LIBRARY.course);
  // Appointed Times lessons are A1, A2… beside the numbered course (§6.19).
  const labels = { ...numbered, ...LIBRARY.seasonalLabels };
  const pickOf = Object.fromEntries(LIBRARY.course.filter((d) => d.pickOne).map((d) => [d.id, d.pickOne]));
  const lessons = [];
  let hidden = 0;
  for (const L of LIBRARY.lessons) {
    const view = dietView(L, LIBRARY.ingredients, filters);
    if (!view.visible) { hidden++; continue; }
    lessons.push({
      id: L.id, label: labels[L.id], unit: L.unit, title: L.title, image: L.image, cuisine: LIBRARY.cuisines[L.cuisine] ?? L.cuisine,
      skill: L.skill, servings: L.servings, totalMinutes: minutes(L),
      substitutions: view.applied.map((x) => ({ for: name(x.for), use: name(x.use) })),
      left_out: view.leftOut.map(name), unleavened: L.unleavened,
      // The kitchen's search (a name or an ingredient), and the pick-one group
      // its path counts once.
      search: [L.title, L.skill, LIBRARY.cuisines[L.cuisine], ...L.ingredients.map((x) => name(x.ingredient))].join(' ').toLowerCase(),
      pick: pickOf[L.id] ?? null,
    });
  }
  return { lessons, hidden, units: LIBRARY.units, seasonal: LIBRARY.seasonal, labels, total };
}, KID);

// ---------- cooks (attempts, §1, §8.4) ----------

// A cook is saved for every profile on it. The device that starts the cook
// makes its id, and sends the whole cook each time it changes, so a retry after
// a dropped connection lands once. A finished cook can't be changed.
const STATE_MAX = 4000;
const isoTime = (v, field) => {
  const t = Date.parse(v);
  if (typeof v !== 'string' || Number.isNaN(t)) fail(400, 'invalid', `${field} must be a time.`);
  // A device clock a little ahead is fine; a date far in the future is not.
  if (t > Date.now() + 24 * 60 * 60 * 1000) fail(400, 'invalid', `${field} is in the future.`);
  return new Date(t).toISOString();
};

on('PUT', '/api/attempts/([0-9a-f]{16})', async (req, env, body, [aid]) => {
  const s = await requireSession(env, req);
  // A library lesson, or one of this family's recipes ("recipe:<id>", §6.10).
  const found = await lessonFor(env, s.family_id, String(body.lesson_id ?? ''), { deleted: true }) ?? fail(400, 'invalid', 'No such lesson.');
  const L = found.lesson;
  const servings = Number(body.servings);
  if (!servingOptions(L).includes(servings)) fail(400, 'invalid', `${L.title} can't be made for ${body.servings}.`);
  const ids = Array.isArray(body.profile_ids) ? [...new Set(body.profile_ids.map(String))] : [];
  if (ids.length < 1 || ids.length > 20) fail(400, 'invalid', 'A cook has 1 to 20 profiles on it.');
  const { results: mine } = await env.DB.prepare(
    `SELECT id FROM profiles WHERE family_id = ? AND id IN (${ids.map(() => '?').join(', ')})`,
  ).bind(s.family_id, ...ids).all();
  if (mine.length !== ids.length) fail(400, 'invalid', 'A profile on this cook is not in your family.');
  // A kid's device saves cooks the kid is on (§8.3a).
  if (s.kid && !ids.includes(s.profile_id)) kidRefused();
  const started = isoTime(body.started_at, 'started_at');
  const finished = body.finished_at == null ? null : isoTime(body.finished_at, 'finished_at');
  if (finished && finished < started) fail(400, 'invalid', 'A cook finishes after it starts.');
  const state = JSON.stringify(body.checklist_state ?? {});
  if (state.length > STATE_MAX) fail(400, 'invalid', 'checklist_state is too big.');

  const had = await env.DB.prepare('SELECT family_id, lesson_id, finished_at FROM attempts WHERE id = ?').bind(aid).first();
  // Another family's cook with this id reads as not found, never as theirs.
  if (had && had.family_id !== s.family_id) fail(404, 'not_found', 'No such cook.');
  if (had && s.kid && !(await env.DB.prepare('SELECT 1 FROM attempt_profiles WHERE attempt_id = ? AND family_id = ? AND profile_id = ?').bind(aid, s.family_id, s.profile_id).first())) {
    kidRefused();
  }
  if (had && had.lesson_id !== L.id) fail(409, 'conflict', 'That cook is of another lesson.');
  if (had?.finished_at) return { ok: true, id: aid, finished_at: had.finished_at };
  await env.DB.batch([
    had
      ? env.DB.prepare('UPDATE attempts SET servings = ?, finished_at = ?, checklist_state = ? WHERE id = ? AND family_id = ? AND finished_at IS NULL')
        .bind(servings, finished, state, aid, s.family_id)
      : env.DB.prepare(`INSERT INTO attempts (id, family_id, lesson_id, lesson_version, servings, started_at, finished_at, checklist_state)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(aid, s.family_id, L.id, L.recipe ? L.version : (await livePatches(env.DB, L.id))[L.id]?.version ?? L.version, servings, started, finished, state),
    // Who's on it can change until it's finished; anyone kept keeps their reflection.
    env.DB.prepare(`DELETE FROM attempt_profiles WHERE attempt_id = ? AND family_id = ?
      AND profile_id NOT IN (${ids.map(() => '?').join(', ')})`).bind(aid, s.family_id, ...ids),
    ...ids.map((pid) => env.DB.prepare('INSERT OR IGNORE INTO attempt_profiles (attempt_id, family_id, profile_id) VALUES (?, ?, ?)')
      .bind(aid, s.family_id, pid)),
  ]);
  // A finished cook closes the queued lesson it was for (§6.2), unless it was
  // on the Sabbath: nothing cooked then counts (§6.18), so the lesson stays up next.
  if (finished && !isSabbath(localDay(finished, tzOf(req)))) await markCooked(env, s.family_id, L.id, ids, aid);
  return { ok: true, id: aid, finished_at: finished };
}, KID);

// The lessons a profile has finished, with how many times, when first (the
// date on its stamp, Phase 5), and when last.
// Cooks on the Sabbath don't count (§6.18).
on('GET', '/api/profiles/([0-9a-f]{16})/cooks', async (req, env, body, [pid]) => {
  const s = await requireSession(env, req);
  ownProfile(s, pid);
  if (!(await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first())) {
    fail(404, 'not_found', 'No such profile.');
  }
  const { results } = await env.DB.prepare(
    `SELECT a.lesson_id, a.finished_at
       FROM attempts a JOIN attempt_profiles ap ON ap.attempt_id = a.id
      WHERE ap.profile_id = ? AND ap.family_id = ? AND a.family_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL
      ORDER BY a.finished_at`,
  ).bind(pid, s.family_id, s.family_id).all();
  const tz = tzOf(req);
  const cooks = {};
  for (const r of results) {
    if (isSabbath(localDay(r.finished_at, tz))) continue;
    cooks[r.lesson_id] = { times: (cooks[r.lesson_id]?.times ?? 0) + 1, first: cooks[r.lesson_id]?.first ?? r.finished_at, last: r.finished_at };
  }
  return { cooks };
}, KID);

// The Reflect stage (§3): each profile on a cook rates it 1 to 5, says what
// they'd change, and can answer the transfer question; anyone can add how the
// eaters liked it. Saved after the cook finishes, and can be changed later.
const rating = (v, field) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 5) fail(400, 'invalid', `${field} is 1 to 5.`);
  return n;
};
const note = (v, field, max) => (v == null || String(v).trim() === '' ? null : text(v, field, { max }));

on('PUT', '/api/attempts/([0-9a-f]{16})/reflection', async (req, env, body, [aid]) => {
  const s = await requireSession(env, req);
  const cook = await env.DB.prepare('SELECT id FROM attempts WHERE id = ? AND family_id = ?').bind(aid, s.family_id).first() ?? fail(404, 'not_found', 'No such cook.');
  const pid = String(body.profile_id ?? '');
  ownProfile(s, pid);
  const on = await env.DB.prepare('SELECT 1 FROM attempt_profiles WHERE attempt_id = ? AND family_id = ? AND profile_id = ?').bind(cook.id, s.family_id, pid).first();
  if (!on) fail(400, 'invalid', "That profile isn't on this cook.");
  const stmts = [env.DB.prepare('UPDATE attempt_profiles SET rating = ?, notes = ?, transfer = ?, reflected_at = ? WHERE attempt_id = ? AND family_id = ? AND profile_id = ?')
    .bind(rating(body.rating, 'The rating'), note(body.notes, 'What you would change', 1000), note(body.transfer, 'The other dish', 300), now(), cook.id, s.family_id, pid)];
  if (body.eater_rating !== undefined) {
    stmts.push(env.DB.prepare('UPDATE attempts SET eater_rating = ? WHERE id = ? AND family_id = ?').bind(rating(body.eater_rating, "The eaters' rating"), cook.id, s.family_id));
  }
  await env.DB.batch(stmts);
  return { ok: true };
}, KID);

// A parent takes back a cook a kid marked done but didn't make (a test run on
// the couch). It's removed for everyone on it: it no longer finishes a lesson,
// earns anything, or shows on Print our progress, and the queued lesson it
// closed goes back on the queue. Undo puts it back as it was.
on('POST', '/api/attempts/([0-9a-f]{16})/remove', async (req, env, body, [aid]) => {
  const s = await requireParent(env, req);
  const cook = await env.DB.prepare('SELECT * FROM attempts WHERE id = ? AND family_id = ? AND finished_at IS NOT NULL').bind(aid, s.family_id).first()
    ?? fail(404, 'not_found', 'No such cook.');
  if (cook.removed_at) return { ok: true };
  const stmts = [env.DB.prepare('UPDATE attempts SET removed_at = ?, queue_id = NULL WHERE id = ? AND family_id = ?').bind(now(), aid, s.family_id)];
  if (cook.queue_id) {
    stmts.push(env.DB.prepare("UPDATE queue SET status = 'assigned', closed_at = NULL WHERE id = ? AND family_id = ? AND status = 'cooked'").bind(cook.queue_id, s.family_id));
  }
  await env.DB.batch(stmts);
  return { ok: true };
});

on('POST', '/api/attempts/([0-9a-f]{16})/restore', async (req, env, body, [aid]) => {
  const s = await requireParent(env, req);
  const cook = await env.DB.prepare('SELECT * FROM attempts WHERE id = ? AND family_id = ? AND finished_at IS NOT NULL').bind(aid, s.family_id).first()
    ?? fail(404, 'not_found', 'No such cook.');
  if (!cook.removed_at) return { ok: true };
  await env.DB.prepare('UPDATE attempts SET removed_at = NULL WHERE id = ? AND family_id = ?').bind(aid, s.family_id).run();
  // It closes a queued lesson again, as when it was first finished.
  if (!isSabbath(localDay(cook.finished_at, tzOf(req)))) {
    const ids = (await env.DB.prepare('SELECT profile_id FROM attempt_profiles WHERE attempt_id = ? AND family_id = ?').bind(aid, s.family_id).all()).results.map((r) => r.profile_id);
    if (ids.length) await markCooked(env, s.family_id, cook.lesson_id, ids, aid);
  }
  return { ok: true };
});

// ---------- Print our progress (§6.15) ----------

// Every lesson each profile has cooked, oldest first: date, dish, cuisine,
// skill, and that profile's rating. ?tz= gives the family's calendar day.
// Cooks on the Sabbath don't count, so they aren't listed (§6.18).
on('GET', '/api/progress', async (req, env) => {
  const s = await requireParent(env, req);
  const tz = Number(new URL(req.url).searchParams.get('tz') ?? 0);
  const offset = Number.isInteger(tz) && Math.abs(tz) <= 840 ? tz : 0;
  const day = (iso) => new Date(Date.parse(iso) - offset * 60 * 1000).toISOString().slice(0, 10);
  const { results: profiles } = await env.DB.prepare('SELECT * FROM profiles WHERE family_id = ? ORDER BY created_at, id').bind(s.family_id).all();
  // Homeschool mode adds each row's grade, for the Grade button (Phase 4b).
  const fam = await env.DB.prepare('SELECT name, mode FROM families WHERE id = ?').bind(s.family_id).first();
  const { results } = await env.DB.prepare(`SELECT ap.profile_id, ap.rating, ap.notes, ap.transfer, a.id, a.lesson_id, a.finished_at, a.servings,
        g.skill AS g_skill, g.safety AS g_safety, g.recipe AS g_recipe, g.result AS g_result, g.reflection AS g_reflection, g.grade_text, g.graded_at
      FROM attempt_profiles ap
      JOIN attempts a ON a.id = ap.attempt_id AND a.family_id = ap.family_id
      LEFT JOIN grades g ON g.attempt_id = a.id AND g.profile_id = ap.profile_id AND g.family_id = ap.family_id
      WHERE ap.family_id = ? AND a.finished_at IS NOT NULL AND a.removed_at IS NULL ORDER BY a.finished_at, a.id`).bind(s.family_id).all();
  const homeschool = fam.mode === 'homeschool';
  const gradeOf = (r) => (r.graded_at ? Object.fromEntries([...RUBRIC.map((x) => [x.key, r[`g_${x.key}`]]), ['grade_text', r.grade_text]]) : null);
  const recipes = await recipeNames(env, s.family_id);
  const lesson = (lid) => LIBRARY.lessons.find((L) => L.id === lid) ?? (recipes[lid] && { title: recipes[lid].title, cuisine: null, skill: 'Family recipe' });
  return {
    family: fam.name,
    homeschool,
    profiles: profiles.map((p) => ({
      id: p.id, name: p.name,
      rows: results.filter((r) => r.profile_id === p.id && !isSabbath(day(r.finished_at))).map((r) => {
        const L = lesson(r.lesson_id);
        const row = { cook: r.id, date: day(r.finished_at), dish: L?.title ?? r.lesson_id, cuisine: LIBRARY.cuisines[L?.cuisine] ?? L?.cuisine ?? '', skill: L?.skill ?? '', rating: r.rating };
        if (!homeschool) return row;
        const g = gradeOf(r);
        return { ...row, reflection: { rating: r.rating, notes: r.notes, transfer: r.transfer }, grade: g, grade_line: g ? gradeLine(g) : null };
      }),
    })),
  };
});

// ---------- the test-cook notice (§6.9) ----------

// Shown once to each parent until the first-run wizard carries it.
on('POST', '/api/notice/test-cook', async (req, env) => {
  const s = await requireSession(env, req);
  await env.DB.prepare('UPDATE parents SET notice_seen_at = ? WHERE id = ? AND notice_seen_at IS NULL').bind(now(), s.parent_id).run();
  return { ok: true };
});

// ---------- fix requests and lesson patches (§6.11) ----------

export const FIX_KINDS = { amount: 'Wrong amount or time', unclear: 'Unclear step', safety: 'Safety problem', unclean: 'Unclean ingredient', other: 'Something else' };
const URGENT = new Set(['safety', 'unclean']);
const OPEN_MAX = 30; // open requests one family can have at once
const asJson = (v) => (v === undefined ? null : JSON.stringify(v));
const fromJson = (v) => (v == null ? null : JSON.parse(v));

// The live lessons' patches, for the player and the demo. Lesson content only,
// so no login is needed.
on('GET', '/api/patches', async (req, env) => {
  const live = await livePatches(env.DB);
  return { lessons: Object.fromEntries(Object.entries(live).map(([id, e]) => [id, { version: e.version, patches: e.patches.map(({ path, value }) => ({ path, value })) }])) };
}, KID);

// Where a step sits, for people: "step 3".
const stepWhere = (L, stepId) => {
  const i = L?.steps.findIndex((s) => s.id === stepId) ?? -1;
  return i >= 0 ? `step ${i + 1}` : null;
};

function requestOut(r, L) {
  const spec = r.field ? patchSpec(r.field) : null;
  return {
    id: r.id, lesson_id: r.lesson_id, lesson_title: L?.title ?? r.lesson_id, kind: r.kind, kind_label: FIX_KINDS[r.kind],
    step: r.step, where: stepWhere(L, r.step) ?? 'the lesson', field: r.field, field_label: spec?.label ?? null, field_kind: spec?.kind ?? null,
    current: fromJson(r.current_value), suggested: fromJson(r.suggested_value), note: r.note, servings: r.servings,
    status: r.status, owner_reply: r.owner_reply, created_at: r.created_at, closed_at: r.closed_at,
    // Fixed by a lesson patch (before the manager section), or by a save in it (§7.5).
    patched: Boolean(r.patch_id),
  };
}

// "Suggest a fix" (§6.11). A kid profile's device needs the parent PIN; an
// adult profile can send one without it.
on('POST', '/api/fix-requests', async (req, env, body) => {
  let s = await requireSession(env, req);
  const profileId = body.profile_id == null ? null : String(body.profile_id);
  const profile = profileId ? await env.DB.prepare('SELECT id, audience FROM profiles WHERE id = ? AND family_id = ?').bind(profileId, s.family_id).first() : null;
  if (profileId && !profile) fail(400, 'invalid', 'No such profile.');
  if (profile?.audience !== 'adult') s = await requireParent(env, req);
  const L = await liveLesson(env.DB, String(body.lesson_id ?? '')) ?? fail(400, 'invalid', 'No such lesson.');
  const kind = oneOf(body.kind, Object.keys(FIX_KINDS), 'kind');
  const step = body.step == null || body.step === '' ? null : String(body.step);
  if (step && !L.steps.some((x) => x.id === step)) fail(400, 'invalid', 'No such step.');
  let field = null, current = null, suggested = null;
  if (body.field) {
    field = String(body.field);
    const now = getAt(L, field);
    if (now === undefined || !patchSpec(field)) fail(400, 'invalid', "That part can't be picked for this lesson.");
    if (step && !field.startsWith(`steps.${step}.`)) fail(400, 'invalid', 'That part is from another step.');
    try { suggested = cleanValue(field, body.suggested_value ?? null); } catch (e) { fail(400, 'invalid', e.message); }
    if (JSON.stringify(suggested) === JSON.stringify(now)) fail(400, 'invalid', 'That is what it says now. Say what it should say instead.');
    current = now;
  }
  const note = text(body.note, "What's wrong", { max: 1000 });
  const servings = Number.isInteger(body.servings) && body.servings > 0 && body.servings <= 100 ? body.servings : null;
  const open = (await env.DB.prepare("SELECT COUNT(*) AS n FROM fix_requests WHERE family_id = ? AND status = 'open'").bind(s.family_id).first()).n;
  if (open >= OPEN_MAX) fail(429, 'too_many', `Your family has ${open} fixes waiting for review. Try again once some are answered.`);
  const fid = id();
  await env.DB.prepare(`INSERT INTO fix_requests (id, family_id, reporter_parent_id, reporter_profile_id, lesson_id, lesson_version, step, servings,
      kind, field, current_value, suggested_value, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(fid, s.family_id, s.parent_id, profileId, L.id, L.version, step, servings, kind, field, field ? asJson(current) : null, field ? asJson(suggested) : null, note, now()).run();
  // Safety and unclean-ingredient reports reach the owner right away. The
  // report is saved either way; email trouble doesn't fail it.
  if (URGENT.has(kind)) {
    const owners = (await env.DB.prepare('SELECT email FROM parents WHERE is_owner = 1').all()).results.map((r) => r.email);
    if (owners.length) {
      const spec = field ? patchSpec(field) : null;
      await sendEmail(env, { to: owners, ...fixReportEmail({
        kind: FIX_KINDS[kind], lesson: L.title, where: stepWhere(L, step) ?? 'the lesson', note,
        change: spec ? `${spec.label}: "${showValue(spec.kind, current)}" should be "${showValue(spec.kind, suggested)}"` : null,
      }) });
    }
  }
  return { ok: true, id: fid };
});

// This family's fixes on one lesson, so they see what came of them.
on('GET', '/api/lessons/([a-z0-9-]+)/fixes', async (req, env, body, [lid]) => {
  const s = await requireSession(env, req);
  const L = await liveLesson(env.DB, lid) ?? fail(404, 'not_found', 'No such lesson.');
  const { results } = await env.DB.prepare(`SELECT f.*, p.new_value AS applied FROM fix_requests f LEFT JOIN lesson_patches p ON p.id = f.patch_id
      WHERE f.family_id = ? AND f.lesson_id = ? ORDER BY f.created_at DESC LIMIT 20`).bind(s.family_id, lid).all();
  // A fixed one says what it says now: the value the owner applied.
  return { fixes: results.map((r) => ({ ...requestOut(r, L), applied: r.status === 'fixed' ? fromJson(r.applied ?? r.suggested_value) : undefined })) };
}, KID);

// The owner's queue. Requests show no family: the owner sees the lesson, the
// report, and the suggestion, nothing about who sent it (§6.2a).
on('GET', '/api/owner/fixes', async (req, env) => {
  await requireOwner(env, req);
  const lessons = {};
  const L = async (lid) => (lessons[lid] ??= await liveLesson(env.DB, lid));
  const out = async (rows) => {
    const list = [];
    for (const r of rows) {
      const o = requestOut(r, await L(r.lesson_id));
      // What the lesson says now, which may differ from when it was reported.
      if (r.field && lessons[r.lesson_id]) o.live = getAt(lessons[r.lesson_id], r.field) ?? null;
      list.push(o);
    }
    return list;
  };
  const open = (await env.DB.prepare("SELECT * FROM fix_requests WHERE status = 'open' ORDER BY lesson_id, created_at").all()).results;
  const closed = (await env.DB.prepare("SELECT * FROM fix_requests WHERE status != 'open' ORDER BY closed_at DESC LIMIT 50").all()).results;
  const patches = (await env.DB.prepare('SELECT * FROM lesson_patches ORDER BY applied_at DESC LIMIT 100').all()).results;
  // A live patch can be reverted when no later live patch changed the same field.
  const laterLive = (p) => patches.some((q) => q.lesson_id === p.lesson_id && q.field_path === p.field_path && !q.reverted_at && (q.applied_at > p.applied_at || (q.applied_at === p.applied_at && q.id > p.id)));
  return {
    open: await out(open),
    closed: await out(closed),
    patches: await Promise.all(patches.map(async (p) => {
      const spec = patchSpec(p.field_path);
      const lesson = await L(p.lesson_id);
      const step = /^steps\.([a-z0-9-]+)\./.exec(p.field_path)?.[1];
      return {
        id: p.id, lesson_id: p.lesson_id, lesson_title: lesson?.title ?? p.lesson_id, where: stepWhere(lesson, step) ?? 'the lesson',
        field_label: spec?.label ?? p.field_path, field_kind: spec?.kind ?? 'text', old: fromJson(p.old_value), new: fromJson(p.new_value),
        applied_at: p.applied_at, reverted_at: p.reverted_at, can_revert: !p.reverted_at && !laterLive(p),
      };
    })),
    kinds: FIX_KINDS,
  };
});

const openRequest = async (env, fid) => {
  const r = await env.DB.prepare('SELECT * FROM fix_requests WHERE id = ?').bind(fid).first() ?? fail(404, 'not_found', 'No such fix request.');
  if (r.status !== 'open') fail(409, 'not_open', 'That fix request is already answered.');
  return r;
};
const reply = (v) => (v == null || String(v).trim() === '' ? null : text(v, 'Reply', { max: 500 }));

// Apply: the suggestion as written or as the owner edited it becomes a lesson
// patch, live for every family, once it passes the checks.
on('POST', '/api/owner/fixes/([0-9a-f]{16})/apply', async (req, env, body, [fid]) => {
  const s = await requireOwner(env, req);
  const r = await openRequest(env, fid);
  if (!r.field) fail(400, 'no_field', 'This report has no part picked, so there is nothing to apply. Decline it or mark it as needing a content change.');
  const L = await liveLesson(env.DB, r.lesson_id) ?? fail(409, 'gone', 'That lesson is no longer in the library.');
  let value;
  try { value = cleanValue(r.field, body.value === undefined ? fromJson(r.suggested_value) : body.value); } catch (e) { fail(400, 'invalid', e.message); }
  const old = getAt(L, r.field);
  if (old === undefined) fail(409, 'gone', 'That part is no longer in the lesson.');
  if (JSON.stringify(old) === JSON.stringify(value)) fail(400, 'invalid', 'The lesson already says that.');
  const problems = patchProblems(setAt(L, r.field, value));
  if (problems.length) return json({ error: 'checks_failed', message: "This fix can't go live:", problems }, 422);
  const pid = id(), t = now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO lesson_patches (id, lesson_id, base_version, field_path, old_value, new_value, fix_request_id, applied_by, applied_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(pid, r.lesson_id, L.version, r.field, asJson(old), asJson(value), r.id, s.parent_id, t),
    env.DB.prepare("UPDATE fix_requests SET status = 'fixed', patch_id = ?, owner_reply = ?, closed_at = ? WHERE id = ?").bind(pid, reply(body.reply), t, r.id),
  ]);
  return { ok: true, patch_id: pid, version: L.version + 1 };
});

on('POST', '/api/owner/fixes/([0-9a-f]{16})/close', async (req, env, body, [fid]) => {
  await requireOwner(env, req);
  const r = await openRequest(env, fid);
  const status = oneOf(body.status, ['declined', 'duplicate', 'needs_content_change'], 'status');
  await env.DB.prepare('UPDATE fix_requests SET status = ?, owner_reply = ?, closed_at = ? WHERE id = ?').bind(status, reply(body.reply), now(), r.id).run();
  return { ok: true };
});

// The restore for Decline and the others: back into the queue.
on('POST', '/api/owner/fixes/([0-9a-f]{16})/reopen', async (req, env, body, [fid]) => {
  await requireOwner(env, req);
  const r = await env.DB.prepare('SELECT * FROM fix_requests WHERE id = ?').bind(fid).first() ?? fail(404, 'not_found', 'No such fix request.');
  if (r.status === 'open') return { ok: true };
  if (r.status === 'fixed') fail(409, 'is_fixed', 'That one was applied. Revert its patch to undo it.');
  await env.DB.prepare("UPDATE fix_requests SET status = 'open', closed_at = NULL WHERE id = ?").bind(r.id).run();
  return { ok: true };
});

// Revert puts the field back the way it was, for every family. Its fix
// request goes back to the queue, where Apply can put it live again.
on('POST', '/api/owner/patches/([0-9a-f]{16})/revert', async (req, env, body, [pid]) => {
  await requireOwner(env, req);
  const p = await env.DB.prepare('SELECT * FROM lesson_patches WHERE id = ?').bind(pid).first() ?? fail(404, 'not_found', 'No such patch.');
  if (p.reverted_at) fail(409, 'reverted', 'That patch is already reverted.');
  const later = await env.DB.prepare(`SELECT 1 FROM lesson_patches WHERE lesson_id = ? AND field_path = ? AND reverted_at IS NULL AND id != ?
      AND (applied_at > ? OR (applied_at = ? AND id > ?))`).bind(p.lesson_id, p.field_path, p.id, p.applied_at, p.applied_at, p.id).first();
  if (later) fail(409, 'later_patch', 'A later fix changed the same part. Revert that one first.');
  const L = await liveLesson(env.DB, p.lesson_id);
  if (L) {
    const problems = patchProblems(setAt(L, p.field_path, fromJson(p.old_value)));
    if (problems.length) return json({ error: 'checks_failed', message: "Reverting this would leave the lesson failing its checks:", problems }, 422);
  }
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE lesson_patches SET reverted_at = ? WHERE id = ?').bind(t, p.id),
    env.DB.prepare("UPDATE fix_requests SET status = 'open', closed_at = NULL WHERE id = ? AND status = 'fixed'").bind(p.fix_request_id),
  ]);
  return { ok: true };
});

// ---------- family settings ----------

on('GET', '/api/family', async (req, env) => {
  const s = await requireParent(env, req);
  const fam = await env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(s.family_id).first();
  const parents = (await env.DB.prepare('SELECT email FROM parents WHERE family_id = ? ORDER BY created_at').bind(s.family_id).all()).results;
  return { family: familyOut(fam), parents: parents.map((p) => p.email), diet_tags: LIBRARY.dietTags, servings_max: FREE_MAX };
});

on('PUT', '/api/family', async (req, env, body) => {
  const s = await requireParent(env, req);
  const servings = Number(body.default_servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > FREE_MAX) fail(400, 'invalid', `Servings must be 1 to ${FREE_MAX}.`);
  const filters = Array.isArray(body.diet_filters) ? [...new Set(body.diet_filters)] : fail(400, 'invalid', 'diet_filters must be a list.');
  for (const f of filters) oneOf(f, LIBRARY.dietTags, 'Each diet filter');
  // Voice step control (§6.12) is left as it is when the body doesn't mention it.
  if (body.voice_enabled !== undefined && typeof body.voice_enabled !== 'boolean') fail(400, 'invalid', 'voice_enabled must be true or false.');
  // So are the mode (§6.17) and Plan our weeks (§6.18). Switching never deletes anything.
  const mode = body.mode === undefined ? null : oneOf(body.mode, ['casual', 'homeschool'], 'mode');
  if (body.plan_weeks !== undefined && typeof body.plan_weeks !== 'boolean') fail(400, 'invalid', 'plan_weeks must be true or false.');
  const keep = (v) => (v === undefined ? null : Number(v));
  await env.DB.prepare(`UPDATE families SET name = ?, default_servings = ?, diet_filters = ?, voice_enabled = COALESCE(?, voice_enabled),
      mode = COALESCE(?, mode), plan_weeks = COALESCE(?, plan_weeks) WHERE id = ?`)
    .bind(text(body.name, 'Family name'), servings, JSON.stringify(filters), keep(body.voice_enabled), mode, keep(body.plan_weeks), s.family_id).run();
  return { ok: true };
});

// Another parent login for the same family.
on('POST', '/api/parents', async (req, env, body) => {
  const s = await requireParent(env, req);
  const addr = email(body.email);
  if (await env.DB.prepare('SELECT 1 FROM parents WHERE email = ?').bind(addr).first()) fail(409, 'email_taken', 'That email already has an account.');
  await env.DB.prepare('INSERT INTO parents (id, family_id, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id(), s.family_id, addr, await hashSecret(password(body.password)), now()).run();
  return { ok: true };
});

// ---------- Download our data and Delete our family (§6.14) ----------

// The family's own copy of everything: the same file /ops downloads for it,
// so it can also be put back with Restore a family.
on('GET', '/api/family/export', async (req, env) => {
  const s = await requireParent(env, req);
  return exportFamily(env.DB, s.family_id);
});

// Behind the parent PIN and this parent's password. The family is gone at
// once, and erased after the grace period (backup.js).
on('POST', '/api/family/delete', async (req, env, body) => {
  const s = await requireParent(env, req);
  const row = await env.DB.prepare('SELECT password_hash FROM parents WHERE id = ?').bind(s.parent_id).first();
  if (!(await verifySecret(String(body.password ?? ''), row.password_hash))) fail(403, 'password_wrong', "That password didn't match.");
  // The owner's family holds the owner screens and the manager sign-in.
  if (await env.DB.prepare('SELECT 1 FROM parents WHERE family_id = ? AND is_owner = 1').bind(s.family_id).first()) {
    fail(409, 'owner_family', "The owner's family can't be deleted here. Use Remove on /ops.");
  }
  const at = await deleteFamily(env.DB, s.family_id);
  return json({ ok: true, erase_after: eraseAfter(at) }, 200, { 'set-cookie': await endSession(env, req) });
});

// ---------- owner screens (§6.2a) ----------

on('GET', '/api/owner', async (req, env) => {
  await requireOwner(env, req);
  const all = async (sql) => (await env.DB.prepare(sql).all()).results;
  return {
    beta_word: await betaWord(env),
    waiting: (await env.DB.prepare('SELECT COUNT(*) AS n FROM signup_verifications WHERE expires_at > ?').bind(now()).first()).n,
    families: await all(`SELECT f.name, f.created_at, f.last_active_at,
        (SELECT COUNT(*) FROM profiles p WHERE p.family_id = f.id) AS profiles
      FROM families f WHERE f.deleted_at IS NULL ORDER BY f.created_at DESC`),
    email_ready: emailReady(env),
  };
});

// null or an empty string turns the beta word off, and sign-up is fully open.
on('PUT', '/api/owner/beta-word', async (req, env, body) => {
  await requireOwner(env, req);
  const word = body.beta_word == null || String(body.beta_word).trim() === '' ? null : text(body.beta_word, 'Beta word', { max: 40 });
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('beta_word', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(word).run();
  return { ok: true, beta_word: word };
});
on('POST', '/api/owner/parent-password', async (req, env, body) => {
  await requireOwner(env, req);
  const row = await env.DB.prepare('SELECT id FROM parents WHERE email = ?').bind(email(body.email)).first();
  if (!row) fail(404, 'not_found', 'No parent has that email.');
  await env.DB.batch([
    env.DB.prepare('UPDATE parents SET password_hash = ? WHERE id = ?').bind(await hashSecret(password(body.password)), row.id),
    env.DB.prepare('DELETE FROM sessions WHERE parent_id = ?').bind(row.id),
  ]);
  return { ok: true };
});

// The queue, courses, requests, safety review, and test-cooked (plan.js);
// shopping and kitchen staples (shopping.js).
registerPlan(on);
registerShopping(on);
registerRecipes(on);
registerSharing(on);
registerSwap(on);
registerKidLogins(on);
registerSetup(on);
registerGrades(on);

// ---------- dispatch ----------

export async function handleApi(request, env) {
  const url = new URL(request.url);
  try {
    if (!env.DB) fail(503, 'not_ready', 'The database is not connected yet.');
    const route = routes.find((r) => r.method === request.method && r.re.test(url.pathname));
    if (!route) fail(404, 'not_found', 'No such API route.');
    // A kid login is refused everything not on its list (§8.3a).
    if (!route.kid && readCookie(request, KID_COOKIE) && !readCookie(request, SESSION_COOKIE) && (await readSession(env, request))?.kid) kidRefused();
    let body = {};
    if (request.method !== 'GET') {
      // A JSON body is required, which also keeps other sites' plain forms out.
      if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) fail(415, 'json_only', 'Send JSON.');
      const raw = await request.text();
      try { body = raw ? JSON.parse(raw) : {}; } catch { fail(400, 'invalid', 'That body is not JSON.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'invalid', 'Send a JSON object.');
    }
    const out = await route.handler(request, env, body, url.pathname.match(route.re).slice(1));
    return out instanceof Response ? out : json(out);
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.code, message: err.message }, err.status);
    if (/no such table/i.test(String(err?.message))) return json({ error: 'not_ready', message: 'The database is not set up yet. Apply migrations on /ops.' }, 503);
    console.log(`API error on ${request.method} ${url.pathname}: ${err?.stack ?? err}`);
    return json({ error: 'internal', message: 'Something went wrong.' }, 500);
  }
}
