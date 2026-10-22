// Hashing and tokens, all through Web Crypto so the same code runs in the
// Worker and in Node's tests (plan §8.3).
const enc = new TextEncoder();

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function fromHex(h) {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

// Constant-time comparison. Length isn't secret here; content is.
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function randomHex(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return hex(buf);
}

// PBKDF2-SHA256. Passwords and the parent PIN are stored as one string,
// "pbkdf2$<iterations>$<salt>$<hash>", so the plan's single *_hash column holds
// everything and the cost can be raised later without breaking old rows.
// 100,000 rounds stays well inside the Workers CPU limit.
export const PBKDF2_ITERATIONS = 100_000;

async function derive(secret, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(saltHex), iterations, hash: 'SHA-256' }, key, 256);
  return hex(bits);
}

export async function hashSecret(secret, iterations = PBKDF2_ITERATIONS) {
  const salt = randomHex(16);
  return `pbkdf2$${iterations}$${salt}$${await derive(secret, salt, iterations)}`;
}

export async function verifySecret(secret, stored) {
  const [kind, iters, salt, hash] = String(stored ?? '').split('$');
  if (kind !== 'pbkdf2' || !hash) return false;
  return timingSafeEqual(await derive(String(secret), salt, Number(iters)), hash);
}
