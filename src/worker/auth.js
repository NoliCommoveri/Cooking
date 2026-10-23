// Parent sessions, kid sessions, and the parent PIN (plan §8.3, §8.3a).
//
// A device logged in as a family keeps a long-lived httpOnly cookie. The table
// stores the SHA-256 of the cookie's token, never the token. Family scoping
// starts here: every API query takes family_id from the session this returns,
// and no endpoint accepts a family id from the browser.
import { sha256Hex, randomHex, verifySecret } from './lib/crypto.js';
import { readCookie, setCookie, clearCookie, fail, now } from './lib/http.js';

export const SESSION_COOKIE = 'cpr_session';
// A kid login (§8.3a): its own cookie and table, scoped to one kid profile. A
// device is logged in as a parent or as a kid, never both.
export const KID_COOKIE = 'cpr_kid';
// A kid login lasts 14 days, renewed each time the app is opened (owner,
// 2026-10-23), so a device left unused logs itself out.
export const KID_SESSION_DAYS = 14;
const KID_SESSION_SECONDS = KID_SESSION_DAYS * 24 * 60 * 60;
// Browsers cap a cookie's life at 400 days, so kitchen devices stay logged in.
const SESSION_SECONDS = 400 * 24 * 60 * 60;
// How long the parent PIN stays unlocked on one device.
export const PIN_MINUTES = 15;
// last_seen and the family's last-active date are written at most this often.
const TOUCH_MS = 60 * 60 * 1000;

// Both return the set-cookie headers. Logging in as one kind ends the other
// kind's session on this device.
export async function startSession(env, parent, request = null) {
  const token = randomHex(32);
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (id, parent_id, family_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), parent.id, parent.family_id, t, t).run();
  if (request) await dropToken(env, 'kid_sessions', readCookie(request, KID_COOKIE));
  return [setCookie(SESSION_COOKIE, token, SESSION_SECONDS), clearCookie(KID_COOKIE)];
}

export async function startKidSession(env, login, request) {
  const token = randomHex(32);
  const t = now();
  await env.DB.prepare('INSERT INTO kid_sessions (id, profile_id, family_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), login.profile_id, login.family_id, t, t).run();
  await dropToken(env, 'sessions', readCookie(request, SESSION_COOKIE));
  return [setCookie(KID_COOKIE, token, KID_SESSION_SECONDS), clearCookie(SESSION_COOKIE)];
}

async function dropToken(env, table, token) {
  if (token) await env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(await sha256Hex(token)).run();
}

export async function endSession(env, request) {
  await dropToken(env, 'sessions', readCookie(request, SESSION_COOKIE));
  await dropToken(env, 'kid_sessions', readCookie(request, KID_COOKIE));
  return [clearCookie(SESSION_COOKIE), clearCookie(KID_COOKIE)];
}

// Every device a kid profile is logged in on is logged out (§8.3a).
export const endKidSessions = (env, fid, pid) => env.DB.prepare('DELETE FROM kid_sessions WHERE profile_id = ? AND family_id = ?').bind(pid, fid);

// The signed-in parent, the signed-in kid ({ kid: true, profile_id, … }), or null.
export async function readSession(env, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return readKidSession(env, request);
  const s = await env.DB.prepare(
    `SELECT s.id, s.parent_id, s.family_id, s.last_seen, s.pin_until, p.email, p.is_owner, p.notice_seen_at
       FROM sessions s JOIN parents p ON p.id = s.parent_id WHERE s.id = ?`,
  ).bind(await sha256Hex(token)).first();
  if (!s) return null;
  if (Date.now() - Date.parse(s.last_seen) > TOUCH_MS) {
    const t = now();
    await env.DB.batch([
      env.DB.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').bind(t, s.id),
      env.DB.prepare('UPDATE families SET last_active_at = ? WHERE id = ?').bind(t, s.family_id),
    ]);
  }
  return { ...s, is_owner: Boolean(s.is_owner), kid: false };
}

// A kid session holds only while its profile still has a login.
async function readKidSession(env, request) {
  const token = readCookie(request, KID_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await env.DB.prepare(
    `SELECT ks.id, ks.profile_id, ks.family_id, ks.last_seen, kl.login_name FROM kid_sessions ks
       JOIN kid_logins kl ON kl.profile_id = ks.profile_id AND kl.family_id = ks.family_id WHERE ks.id = ?`,
  ).bind(await sha256Hex(token)).first();
  if (!s) return null;
  if (Date.now() - Date.parse(s.last_seen) > KID_SESSION_SECONDS * 1000) {
    await env.DB.prepare('DELETE FROM kid_sessions WHERE id = ?').bind(s.id).run();
    return null;
  }
  if (Date.now() - Date.parse(s.last_seen) > TOUCH_MS) {
    const t = now();
    await env.DB.batch([
      env.DB.prepare('UPDATE kid_sessions SET last_seen = ? WHERE id = ?').bind(t, s.id),
      env.DB.prepare('UPDATE families SET last_active_at = ? WHERE id = ?').bind(t, s.family_id),
    ]);
  }
  return { ...s, kid: true, is_owner: false, pin_until: null };
}

// Opening the app renews a kid's login for another 14 days: the session's
// last_seen and the cookie's life both start again. Returns the set-cookie.
export async function renewKidSession(env, s, request) {
  const t = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE kid_sessions SET last_seen = ? WHERE id = ?').bind(t, s.id),
    env.DB.prepare('UPDATE families SET last_active_at = ? WHERE id = ?').bind(t, s.family_id),
  ]);
  return setCookie(KID_COOKIE, readCookie(request, KID_COOKIE), KID_SESSION_SECONDS);
}

// What a kid session may not do, it's told to ask an adult.
export const kidRefused = () => fail(403, 'kid_login', 'Ask an adult.');
// A kid session reaches its own profile only.
export function ownProfile(s, pid) {
  if (s.kid && s.profile_id !== pid) kidRefused();
}

export const pinUnlocked = (s) => Boolean(s?.pin_until && Date.parse(s.pin_until) > Date.now());

export async function requireSession(env, request) {
  return (await readSession(env, request)) ?? fail(401, 'signed_out', 'Log in first.');
}

// Every parent-only screen asks for the PIN (§8.3). It's a convenience lock
// for kitchen devices, not a security boundary.
export async function requireParent(env, request) {
  const s = await requireSession(env, request);
  if (s.kid) kidRefused();
  if (!pinUnlocked(s)) fail(403, 'pin_required', 'Enter the parent PIN.');
  return s;
}

export async function requireOwner(env, request) {
  const s = await requireParent(env, request);
  if (!s.is_owner) fail(403, 'not_owner', 'Only the owner can do that.');
  return s;
}

// Checks the family's PIN, or fails.
export async function checkPin(env, fid, pin) {
  const fam = await env.DB.prepare('SELECT parent_pin_hash FROM families WHERE id = ?').bind(fid).first();
  if (!fam?.parent_pin_hash) fail(409, 'pin_not_set', 'Set a parent PIN first.');
  if (!(await verifySecret(String(pin ?? ''), fam.parent_pin_hash))) fail(403, 'pin_wrong', "That PIN didn't match.");
}

export async function unlockPin(env, s, pin) {
  await checkPin(env, s.family_id, pin);
  const until = new Date(Date.now() + PIN_MINUTES * 60 * 1000).toISOString();
  await env.DB.prepare('UPDATE sessions SET pin_until = ? WHERE id = ?').bind(until, s.id).run();
  return until;
}

export async function lockPin(env, s) {
  await env.DB.prepare('UPDATE sessions SET pin_until = NULL WHERE id = ?').bind(s.id).run();
}
