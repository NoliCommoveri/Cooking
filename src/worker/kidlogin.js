// Kid logins (plan §8.3a, owner 2026-10-23). A parent gives a kid profile a
// login: the kid's first name and last initial ("Ava C"), one of 30 cooking
// pictures, and a password. The name and picture together are unique across
// the app, so the login screen needs nothing else. A device logged in this way
// opens only that kid's kitchen; auth.js holds the session, and api.js refuses
// a kid session every route not on its list.
import { fail, json, now } from './lib/http.js';
import { hashSecret, verifySecret } from './lib/crypto.js';
import { requireParent, startKidSession, endKidSessions } from './auth.js';
import { LOGIN_PICTURES, isLoginPicture, loginName, loginKey } from '../content/login-pictures.js';

export const KID_PASSWORD_MIN = 6;

const kidPassword = (v) => {
  const s = String(v ?? '');
  if (s.length < KID_PASSWORD_MIN) fail(400, 'invalid', `Kid passwords need at least ${KID_PASSWORD_MIN} characters.`);
  if (s.length > 200) fail(400, 'invalid', 'That password is too long.');
  return s;
};

const loginRow = (env, fid, pid) => env.DB.prepare('SELECT * FROM kid_logins WHERE profile_id = ? AND family_id = ?').bind(pid, fid).first();

async function kidProfile(env, fid, pid) {
  const p = await env.DB.prepare('SELECT id, name, audience FROM profiles WHERE id = ? AND family_id = ?').bind(pid, fid).first() ?? fail(404, 'not_found', 'No such profile.');
  if (p.audience !== 'kid') fail(400, 'invalid', 'Only a kid profile can have its own login.');
  return p;
}

// The pictures another login with this name already has. A profile's own
// login doesn't count against it.
async function takenPictures(env, key, pid = '') {
  const { results } = await env.DB.prepare('SELECT picture FROM kid_logins WHERE login_key = ? AND profile_id != ?').bind(key, pid).all();
  return new Set(results.map((r) => r.picture));
}

async function loginOut(env, row) {
  if (!row) return null;
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM kid_sessions WHERE profile_id = ? AND family_id = ?').bind(row.profile_id, row.family_id).first()).n;
  const [first, initial] = [row.login_name.slice(0, -2), row.login_name.slice(-1)];
  return { login_name: row.login_name, first, initial, picture: row.picture, devices: n, updated_at: row.updated_at };
}

export function register(on) {
  const KID = { kid: true };

  // The kid's side of the Log in screen. Wrong details get one answer, whatever
  // was wrong.
  on('POST', '/api/kid-login', async (req, env, body) => {
    const wrong = () => fail(401, 'login_failed', "That name, picture, and password don't match. Ask an adult if you're stuck.");
    const key = loginKey(body.name);
    const picture = String(body.picture ?? '');
    if (!key || !isLoginPicture(picture)) wrong();
    // A deleted family's logins wait out its grace period, unusable (§6.14).
    const row = await env.DB.prepare(`SELECT kl.* FROM kid_logins kl JOIN profiles p ON p.id = kl.profile_id AND p.family_id = kl.family_id
        JOIN families f ON f.id = kl.family_id WHERE kl.login_key = ? AND kl.picture = ? AND p.audience = 'kid' AND f.deleted_at IS NULL`).bind(key, picture).first();
    if (!row || !(await verifySecret(String(body.password ?? ''), row.password_hash))) wrong();
    return json({ ok: true, profile_id: row.profile_id }, 200, { 'set-cookie': await startKidSession(env, row, req) });
  }, KID);

  // ---------- the parent's controls, on the profile editor (behind the PIN) ----------

  // The 30 pictures, and which are taken for a name (?first=&initial=&profile=).
  on('GET', '/api/login-pictures', async (req, env) => {
    const s = await requireParent(env, req);
    const url = new URL(req.url);
    const n = loginName(url.searchParams.get('first'), url.searchParams.get('initial'));
    const pid = url.searchParams.get('profile') ?? '';
    // Another family's profile id never narrows the list.
    const own = pid && (await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first()) ? pid : '';
    const taken = n.key ? await takenPictures(env, n.key, own) : new Set();
    return { name: n.name ?? null, error: n.error ?? null, pictures: LOGIN_PICTURES.map((p) => ({ ...p, taken: taken.has(p.id) })) };
  });

  on('GET', '/api/profiles/([0-9a-f]{16})/login', async (req, env, body, [pid]) => {
    const s = await requireParent(env, req);
    await env.DB.prepare('SELECT 1 FROM profiles WHERE id = ? AND family_id = ?').bind(pid, s.family_id).first() ?? fail(404, 'not_found', 'No such profile.');
    return { login: await loginOut(env, await loginRow(env, s.family_id, pid)) };
  });

  // Set up a login, or change its name, picture, or password. Any change logs
  // the kid out everywhere, so they log in with the new details.
  on('PUT', '/api/profiles/([0-9a-f]{16})/login', async (req, env, body, [pid]) => {
    const s = await requireParent(env, req);
    await kidProfile(env, s.family_id, pid);
    const had = await loginRow(env, s.family_id, pid);
    const n = loginName(body.first ?? had?.login_name.slice(0, -2), body.initial ?? had?.login_name.slice(-1));
    if (n.error) fail(400, 'invalid', n.error);
    const picture = String(body.picture ?? had?.picture ?? '');
    if (!isLoginPicture(picture)) fail(400, 'invalid', 'Pick a picture.');
    if ((await takenPictures(env, n.key, pid)).has(picture)) fail(409, 'taken', `Someone named ${n.name} already has that picture. Pick another.`);
    const pw = body.password == null || body.password === '' ? null : kidPassword(body.password);
    if (!had && !pw) fail(400, 'invalid', 'Set a password for the login.');
    const t = now();
    const hash = pw ? await hashSecret(pw) : had.password_hash;
    try {
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO kid_logins (profile_id, family_id, login_name, login_key, picture, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(profile_id) DO UPDATE SET login_name = excluded.login_name, login_key = excluded.login_key, picture = excluded.picture,
              password_hash = excluded.password_hash, updated_at = excluded.updated_at`)
          .bind(pid, s.family_id, n.name, n.key, picture, hash, t, t),
        endKidSessions(env, s.family_id, pid),
      ]);
    } catch (err) {
      // Two parents picking the same name and picture at once.
      if (/unique/i.test(String(err?.message))) fail(409, 'taken', `Someone named ${n.name} already has that picture. Pick another.`);
      throw err;
    }
    return { ok: true, login: await loginOut(env, await loginRow(env, s.family_id, pid)) };
  });

  // Log out everywhere: every device this kid is logged in on.
  on('POST', '/api/profiles/([0-9a-f]{16})/login/logout-all', async (req, env, body, [pid]) => {
    const s = await requireParent(env, req);
    await loginRow(env, s.family_id, pid) ?? fail(404, 'not_found', "That profile doesn't have a login.");
    await endKidSessions(env, s.family_id, pid).run();
    return { ok: true };
  });

  // Turn off login: the name, picture, and password go, and the kid is logged
  // out everywhere. Nothing they cooked goes; Give a login sets it up again.
  on('DELETE', '/api/profiles/([0-9a-f]{16})/login', async (req, env, body, [pid]) => {
    const s = await requireParent(env, req);
    await env.DB.batch([
      endKidSessions(env, s.family_id, pid),
      env.DB.prepare('DELETE FROM kid_logins WHERE profile_id = ? AND family_id = ?').bind(pid, s.family_id),
    ]);
    return { ok: true };
  });
}
