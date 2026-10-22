// Parent sessions and the parent PIN (plan §8.3).
//
// A device logged in as a family keeps a long-lived httpOnly cookie. The table
// stores the SHA-256 of the cookie's token, never the token. Family scoping
// starts here: every API query takes family_id from the session this returns,
// and no endpoint accepts a family id from the browser.
import { sha256Hex, randomHex, verifySecret } from './lib/crypto.js';
import { readCookie, setCookie, clearCookie, fail, now } from './lib/http.js';

export const SESSION_COOKIE = 'cpr_session';
// Browsers cap a cookie's life at 400 days, so kitchen devices stay logged in.
const SESSION_SECONDS = 400 * 24 * 60 * 60;
// How long the parent PIN stays unlocked on one device.
export const PIN_MINUTES = 15;
// last_seen and the family's last-active date are written at most this often.
const TOUCH_MS = 60 * 60 * 1000;

export async function startSession(env, parent) {
  const token = randomHex(32);
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (id, parent_id, family_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), parent.id, parent.family_id, t, t).run();
  return setCookie(SESSION_COOKIE, token, SESSION_SECONDS);
}

export async function endSession(env, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
  return clearCookie(SESSION_COOKIE);
}

// The signed-in parent, or null.
export async function readSession(env, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await env.DB.prepare(
    `SELECT s.id, s.parent_id, s.family_id, s.last_seen, s.pin_until, p.email, p.is_owner
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
  return { ...s, is_owner: Boolean(s.is_owner) };
}

export const pinUnlocked = (s) => Boolean(s?.pin_until && Date.parse(s.pin_until) > Date.now());

export async function requireSession(env, request) {
  return (await readSession(env, request)) ?? fail(401, 'signed_out', 'Log in first.');
}

// Every parent-only screen asks for the PIN (§8.3). It's a convenience lock
// for kitchen devices, not a security boundary.
export async function requireParent(env, request) {
  const s = await requireSession(env, request);
  if (!pinUnlocked(s)) fail(403, 'pin_required', 'Enter the parent PIN.');
  return s;
}

export async function requireOwner(env, request) {
  const s = await requireParent(env, request);
  if (!s.is_owner) fail(403, 'not_owner', 'Only the owner can do that.');
  return s;
}

export async function unlockPin(env, s, pin) {
  const fam = await env.DB.prepare('SELECT parent_pin_hash FROM families WHERE id = ?').bind(s.family_id).first();
  if (!fam?.parent_pin_hash) fail(409, 'pin_not_set', 'Set a parent PIN first.');
  if (!(await verifySecret(pin, fam.parent_pin_hash))) fail(403, 'pin_wrong', "That PIN didn't match.");
  const until = new Date(Date.now() + PIN_MINUTES * 60 * 1000).toISOString();
  await env.DB.prepare('UPDATE sessions SET pin_until = ? WHERE id = ?').bind(until, s.id).run();
  return until;
}

export async function lockPin(env, s) {
  await env.DB.prepare('UPDATE sessions SET pin_until = NULL WHERE id = ?').bind(s.id).run();
}
