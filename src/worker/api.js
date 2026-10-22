// The app's JSON API (plan §8.3, §6.2, §6.2a). Every family query is scoped by
// the session's family_id; no route takes a family id from the browser. The
// owner routes are the one cross-family view, and they return family names,
// profile counts, and last-active dates only.
import { ApiError, fail, json, now } from './lib/http.js';
import { hashSecret, verifySecret, randomHex, sha256Hex, timingSafeEqual } from './lib/crypto.js';
import {
  startSession, endSession, readSession, requireSession, requireParent, requireOwner,
  pinUnlocked, unlockPin, lockPin,
} from './auth.js';
import { sendEmail, emailReady, resetEmail, signupCodeEmail } from './email.js';
import { LIBRARY } from './library-data.js';
import { dietView } from '../content/diet.js';
import { FREE_MAX } from '../content/scale.js';

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
});

const familyOut = (f) => ({
  name: f.name, default_servings: f.default_servings, diet_filters: JSON.parse(f.diet_filters), pin_set: Boolean(f.parent_pin_hash),
});

// ---------- routes ----------

const routes = [];
const on = (method, pattern, handler) => routes.push({ method, re: new RegExp(`^${pattern}$`), handler });

on('GET', '/api/me', async (req, env) => {
  const s = await readSession(env, req);
  if (!s) return { signed_in: false };
  const fam = await env.DB.prepare('SELECT * FROM families WHERE id = ?').bind(s.family_id).first();
  return {
    signed_in: true,
    parent: { email: s.email, is_owner: s.is_owner },
    family: familyOut(fam),
    pin_unlocked_until: pinUnlocked(s) ? s.pin_until : null,
  };
});

on('POST', '/api/login', async (req, env, body) => {
  const row = await env.DB.prepare('SELECT * FROM parents WHERE email = ?').bind(email(body.email)).first();
  if (!row || !(await verifySecret(String(body.password ?? ''), row.password_hash))) {
    fail(401, 'login_failed', "That email and password don't match.");
  }
  return json({ ok: true }, 200, { 'set-cookie': await startSession(env, row) });
});

on('POST', '/api/logout', async (req, env) => json({ ok: true }, 200, { 'set-cookie': await endSession(env, req) }));

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
  if (await env.DB.prepare('SELECT 1 FROM parents WHERE email = ?').bind(addr).first()) {
    fail(409, 'email_taken', 'That email already has an account. Log in instead.');
  }
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
  if (await env.DB.prepare('SELECT 1 FROM parents WHERE email = ?').bind(addr).first()) {
    fail(409, 'email_taken', 'That email already has an account. Log in instead.');
  }
  const t = now();
  const parent = { id: id(), family_id: id() };
  await env.DB.batch([
    env.DB.prepare('INSERT INTO families (id, created_at, last_active_at) VALUES (?, ?, ?)').bind(parent.family_id, t, t),
    env.DB.prepare('INSERT INTO parents (id, family_id, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(parent.id, parent.family_id, addr, row.password_hash, t),
    env.DB.prepare('DELETE FROM signup_verifications WHERE email = ?').bind(addr),
  ]);
  return json({ ok: true }, 200, { 'set-cookie': await startSession(env, parent) });
});

on('POST', '/api/password/forgot', async (req, env, body) => {
  const row = await env.DB.prepare('SELECT id, family_id FROM parents WHERE email = ?').bind(email(body.email)).first();
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
  return json({ ok: true }, 200, { 'set-cookie': await startSession(env, parent) });
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

on('GET', '/api/profiles', async (req, env) => {
  const s = await requireSession(env, req);
  const { results } = await env.DB.prepare('SELECT * FROM profiles WHERE family_id = ? ORDER BY created_at, id').bind(s.family_id).all();
  return { profiles: results.map(profileOut) };
});

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
  return { ok: true };
});

// A kid picks their own theme and can switch at any time (§5.2), so this one
// doesn't ask for the PIN.
on('PUT', '/api/profiles/([0-9a-f]{16})/theme', async (req, env, body, [pid]) => {
  const s = await requireSession(env, req);
  const res = await env.DB.prepare('UPDATE profiles SET theme = ? WHERE id = ? AND family_id = ?')
    .bind(oneOf(body.theme, THEMES, 'theme'), pid, s.family_id).run();
  if (!res.meta.changes) fail(404, 'not_found', 'No such profile.');
  return { ok: true };
});

on('DELETE', '/api/profiles/([0-9a-f]{16})', async (req, env, body, [pid]) => {
  const s = await requireParent(env, req);
  const res = await env.DB.prepare('DELETE FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).run();
  if (!res.meta.changes) fail(404, 'not_found', 'No such profile.');
  return { ok: true };
});

// The shared library with this family's diet filters applied (§2.1).
on('GET', '/api/library', async (req, env) => {
  const s = await requireSession(env, req);
  const fam = await env.DB.prepare('SELECT diet_filters FROM families WHERE id = ?').bind(s.family_id).first();
  const filters = JSON.parse(fam.diet_filters);
  const name = (i) => LIBRARY.ingredients[i]?.name ?? i;
  const lessons = [];
  let hidden = 0;
  for (const L of LIBRARY.lessons) {
    const view = dietView(L, LIBRARY.ingredients, filters);
    if (!view.visible) { hidden++; continue; }
    lessons.push({
      id: L.id, number: L.number, unit: L.unit, title: L.title, image: L.image, cuisine: LIBRARY.cuisines[L.cuisine] ?? L.cuisine,
      skill: L.skill, servings: L.servings, totalMinutes: L.totalMinutes,
      substitutions: view.applied.map((x) => ({ for: name(x.for), use: name(x.use) })),
    });
  }
  return { lessons, hidden, units: LIBRARY.units };
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
  await env.DB.prepare('UPDATE families SET name = ?, default_servings = ?, diet_filters = ? WHERE id = ?')
    .bind(text(body.name, 'Family name'), servings, JSON.stringify(filters), s.family_id).run();
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

// ---------- owner screens (§6.2a) ----------

on('GET', '/api/owner', async (req, env) => {
  await requireOwner(env, req);
  const all = async (sql) => (await env.DB.prepare(sql).all()).results;
  return {
    beta_word: await betaWord(env),
    waiting: (await env.DB.prepare('SELECT COUNT(*) AS n FROM signup_verifications WHERE expires_at > ?').bind(now()).first()).n,
    families: await all(`SELECT f.name, f.created_at, f.last_active_at,
        (SELECT COUNT(*) FROM profiles p WHERE p.family_id = f.id) AS profiles
      FROM families f ORDER BY f.created_at DESC`),
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

// ---------- dispatch ----------

export async function handleApi(request, env) {
  const url = new URL(request.url);
  try {
    if (!env.DB) fail(503, 'not_ready', 'The database is not connected yet.');
    const route = routes.find((r) => r.method === request.method && r.re.test(url.pathname));
    if (!route) fail(404, 'not_found', 'No such API route.');
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
