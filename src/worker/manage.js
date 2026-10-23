// The manager section's API (plan §7.5), under /manage/api/. Its own sign-in,
// separate from the family app's, and only the owner's login opens it.
//
// The content files live in the repo. Reading one reads it from GitHub (the
// content-edits branch while a save is on its way to main); saving one runs the
// content linter's checks here, then writes a commit to content-edits. The
// publish workflow builds, checks again, and moves it to main, and Cloudflare
// deploys it. Every save is a row in content_saves, with its status and Undo.
import { ApiError, fail, json, now, readCookie, setCookie, clearCookie } from './lib/http.js';
import { randomHex, sha256Hex, verifySecret } from './lib/crypto.js';
import { lint } from '../content/lint.js';
import { contentFromFiles } from '../content/load.js';
import { formatJson } from '../content/format.js';
import { SHAS } from './content-data.js';
import { livePatches } from './lessons.js';
import { applyPatches } from '../content/patch.js';
import {
  GitHubError, githubReady, workingHead, snapshot, commitFiles, publishRun, fileHistory, fileAt, MAIN_BRANCH,
} from './github.js';

export const MANAGE_COOKIE = 'cpr_manage';
const COOKIE_PATH = '/manage';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const id = () => randomHex(8);

// A content file the editor may write: JSON anywhere in content/ except the
// schemas (those change with the app's code, in a session). A lesson file can
// be removed (an Undo of a new lesson); nothing else can.
const JSON_PATH = /^(?!schema\/)([a-z0-9-]+\/)*[a-z0-9-]+\.json$/;
const LESSON_PATH = /^lessons\/[a-z0-9]+(-[a-z0-9]+)*\.json$/;
// A dish picture (§7.5): a PNG the browser made, named for its lesson.
const PICTURE_PATH = /^dishes\/[a-z0-9]+(-[a-z0-9]+)*\.png$/;
const PICTURE_MAX = 4 * 1024 * 1024;
const FILES_MAX = 40;

// ---------- sign-in ----------

async function readManager(env, request) {
  const token = readCookie(request, MANAGE_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await env.DB.prepare(
    `SELECT m.id, m.parent_id, m.last_seen, p.email, p.is_owner FROM manage_sessions m JOIN parents p ON p.id = m.parent_id WHERE m.id = ?`,
  ).bind(await sha256Hex(token)).first();
  if (!s || !s.is_owner || Date.now() - Date.parse(s.last_seen) > SESSION_SECONDS * 1000) return null;
  if (Date.now() - Date.parse(s.last_seen) > 60 * 60 * 1000) await env.DB.prepare('UPDATE manage_sessions SET last_seen = ? WHERE id = ?').bind(now(), s.id).run();
  return s;
}

const requireManager = async (env, request) => (await readManager(env, request)) ?? fail(401, 'signed_out', 'Sign in first.');

// ---------- reading the content ----------

const parse = (texts) => Object.fromEntries(Object.entries(texts).map(([f, t]) => [f, JSON.parse(t)]));

// Where the content is now, for the editor: on GitHub when it's connected, or
// the Worker's own copy (read-only) when it isn't. A lesson the owner patched
// from a fix request before the editor existed (§6.11) comes with its patches
// on it, so saving it writes them into the file.
async function current(env) {
  if (!githubReady(env)) {
    const { FILES, IMAGES } = await import('./content-data.js');
    return { head: null, blobs: { ...SHAS }, texts: { ...FILES }, images: [...IMAGES] };
  }
  const head = await workingHead(env);
  const snap = await snapshot(env, head.sha);
  return { head: head.sha, ...snap };
}

async function withPatches(env, files, blobs) {
  const patched = {};
  let live = {};
  try { live = await livePatches(env.DB); } catch { /* before migration 0004 */ }
  for (const [lid, entry] of Object.entries(live)) {
    const p = `lessons/${lid}.json`;
    // Only on the file the patches were made against; a newer file already has them.
    if (!files[p] || blobs[p] !== SHAS[p] || !entry.patches.length) continue;
    files[p] = applyPatches(files[p], entry);
    patched[lid] = entry.version;
  }
  return patched;
}

// ---------- saving ----------

// A lesson's version goes up when its steps or ingredients change (§7.3), and
// past any version its patches gave it, so a cook always records what it was.
function nextVersion(before, after, patchedVersion) {
  if (!before) return 1;
  const floor = Math.max(before.version, patchedVersion ?? 0);
  const changed = JSON.stringify(before.steps) !== JSON.stringify(after.steps) || JSON.stringify(before.ingredients) !== JSON.stringify(after.ingredients);
  return changed || patchedVersion ? floor + 1 : before.version;
}

// What the checks say about the content as a save would leave it. Only new
// problems refuse a save: one already on GitHub isn't the owner's to fix first.
export function saveProblems(beforeFiles, beforeImages, afterFiles, afterImages, touched) {
  const lessons = [...touched].filter((p) => LESSON_PATH.test(p)).map((p) => p.slice(8, -5));
  // A registry, unit, or rule change can change how every lesson renders.
  const renderOnly = [...touched].every((p) => LESSON_PATH.test(p) || p === 'course.json' || p === 'hidden.json') ? new Set(lessons) : undefined;
  let after;
  try {
    after = lint({ ...contentFromFiles(afterFiles, afterImages), renderOnly }).errors;
  } catch (err) {
    return [String(err.message)];
  }
  if (!after.length) return [];
  const before = new Set(lint({ ...contentFromFiles(beforeFiles, beforeImages), renderOnly }).errors);
  return after.filter((e) => !before.has(e));
}

function readSave(body) {
  const files = body.files && typeof body.files === 'object' && !Array.isArray(body.files) ? body.files : {};
  const pictures = body.pictures && typeof body.pictures === 'object' && !Array.isArray(body.pictures) ? body.pictures : {};
  const was = body.was && typeof body.was === 'object' ? body.was : {};
  const paths = Object.keys(files);
  if (!paths.length && !Object.keys(pictures).length) fail(400, 'invalid', 'Nothing to save.');
  if (paths.length + Object.keys(pictures).length > FILES_MAX) fail(400, 'invalid', 'Too many files in one save.');
  for (const p of paths) {
    if (!JSON_PATH.test(p)) fail(400, 'invalid', `"${p}" isn't a content file the editor can change.`);
    const v = files[p];
    if (v === null && !LESSON_PATH.test(p)) fail(400, 'invalid', `"${p}" can't be removed.`);
    if (v !== null && (typeof v !== 'object' || Array.isArray(v))) fail(400, 'invalid', `"${p}" should be a JSON object.`);
  }
  for (const [p, b64] of Object.entries(pictures)) {
    if (!PICTURE_PATH.test(p)) fail(400, 'invalid', `"${p}" isn't a dish picture name.`);
    if (typeof b64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length * 0.75 > PICTURE_MAX) fail(400, 'invalid', `The picture ${p} is too big or not a picture.`);
    if (!atob(b64.slice(0, 12)).startsWith('\x89PNG')) fail(400, 'invalid', `The picture ${p} isn't a PNG.`);
  }
  const summary = String(body.summary ?? '').trim().slice(0, 200) || `Updated ${[...paths, ...Object.keys(pictures)].join(', ')}`;
  return { files, pictures, was, summary };
}

async function save(env, input, { undoOf = null, fixId = null } = {}) {
  const { files, pictures, was, summary } = input;
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = await current(env);
    if (!cur.head) fail(503, 'github', 'GitHub is not connected yet, so nothing can be saved. See docs/setup.md.');
    // A file someone else changed since the editor opened it is never overwritten.
    for (const p of [...Object.keys(files), ...Object.keys(pictures).map((x) => `images/${x}`)]) {
      if (p.startsWith('images/')) continue;
      if (p in was && (was[p] ?? null) !== (cur.blobs[p] ?? null)) {
        fail(409, 'changed', `${p} changed since you opened it. Reload to see the latest, then make your change again.`);
      }
    }
    const before = parse(cur.texts);
    const patched = await withPatches(env, { ...before }, cur.blobs);
    const after = { ...before };
    for (const [p, v] of Object.entries(files)) {
      if (v === null) { delete after[p]; continue; }
      const out = structuredClone(v);
      if (LESSON_PATH.test(p)) out.version = nextVersion(before[p], out, patched[out.id]);
      after[p] = out;
    }
    const afterImages = [...new Set([...cur.images, ...Object.keys(pictures)])].sort();
    const problems = saveProblems(before, cur.images, after, afterImages, new Set(Object.keys(files)));
    if (problems.length) throw Object.assign(new ApiError(422, 'checks', "This can't be saved yet:"), { problems });

    const write = {};
    for (const p of Object.keys(files)) {
      const text = p in after ? formatJson(after[p]) : null;
      if (text !== (cur.texts[p] ?? null)) write[`content/${p}`] = text;
    }
    for (const [p, b64] of Object.entries(pictures)) write[`content/images/${p}`] = { base64: b64 };
    if (!Object.keys(write).length) return { saved: false, message: 'Nothing changed.' };

    let commit;
    try {
      commit = await commitFiles(env, { parent: cur.head, files: write, message: `${summary}\n\nSaved from the manager section (/manage).` });
    } catch (err) {
      // Another save moved the branch first: start again from where it is now.
      if (err instanceof GitHubError && err.status === 422 && attempt < 2) continue;
      throw err;
    }
    const sid = id();
    const blobs = Object.fromEntries(Object.entries(commit.blobs).map(([k, v]) => [k.slice('content/'.length), v]));
    await env.DB.prepare(`INSERT INTO content_saves (id, commit_sha, parent_sha, summary, paths, blobs, undo_of, fix_request_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(sid, commit.sha, cur.head, summary, JSON.stringify(Object.keys(blobs)), JSON.stringify(blobs), undoOf, fixId, now()).run();
    // The new git ids, so the editor can save the same file again without reloading.
    return { saved: true, id: sid, commit: commit.sha, blobs, versions: Object.fromEntries(Object.keys(files).filter((p) => LESSON_PATH.test(p) && after[p]).map((p) => [p, after[p].version])) };
  }
  fail(409, 'busy', 'Another save was going on at the same time. Try again.');
}

// ---------- status ----------

// Checking (the workflow is running), Failed (with what it said), Publishing
// (on main, waiting on Cloudflare's deploy), or Live (this Worker has it). A
// save whose files a later save changed again is Replaced. `runs` holds the
// workflow run for each newer save's commit, for a run GitHub cancelled
// because a newer one carried it.
const pictureOnly = (blobs) => Object.keys(blobs).every((p) => p.startsWith('images/'));

function saveStatus(row, run, later, laterRuns) {
  const blobs = JSON.parse(row.blobs);
  const live = Object.entries(blobs).every(([p, b]) => p.startsWith('images/') || (SHAS[p] ?? null) === b);
  if (live && !pictureOnly(blobs)) return { state: 'live' };
  const replaced = later.some((l) => Object.keys(JSON.parse(l.blobs)).some((p) => p in blobs));
  if (run?.conclusion === 'failure') return { state: replaced ? 'replaced' : 'failed', detail: run.detail, url: run.url };
  if (replaced) return { state: 'replaced' };
  const carried = run?.status === 'completed' && run.conclusion !== 'success' && laterRuns.some((r) => r?.conclusion === 'success');
  if (run?.conclusion === 'success' || carried) return { state: pictureOnly(blobs) ? 'published' : 'publishing', url: run.url };
  return { state: 'checking', url: run?.url ?? null };
}

// ---------- routes ----------

const routes = [];
const on = (method, pattern, handler, { open = false } = {}) => routes.push({ method, re: new RegExp(`^/manage/api${pattern}$`), handler, open });

on('POST', '/login', async (req, env, body) => {
  const row = await env.DB.prepare('SELECT * FROM parents WHERE email = ?').bind(String(body.email ?? '').trim().toLowerCase()).first();
  if (!row || !(await verifySecret(String(body.password ?? ''), row.password_hash))) fail(401, 'login_failed', "That email and password don't match.");
  if (!row.is_owner) fail(403, 'not_owner', 'Only the owner can open the manager section.');
  const token = randomHex(32);
  const t = now();
  await env.DB.prepare('INSERT INTO manage_sessions (id, parent_id, family_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), row.id, row.family_id, t, t).run();
  return json({ ok: true }, 200, { 'set-cookie': setCookie(MANAGE_COOKIE, token, SESSION_SECONDS, COOKIE_PATH) });
}, { open: true });

on('POST', '/logout', async (req, env) => {
  const token = readCookie(req, MANAGE_COOKIE);
  if (token) await env.DB.prepare('DELETE FROM manage_sessions WHERE id = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': clearCookie(MANAGE_COOKIE, COOKIE_PATH) });
}, { open: true });

on('GET', '/me', async (req, env) => {
  const s = await readManager(env, req);
  return s ? { signed_in: true, email: s.email, github: githubReady(env) } : { signed_in: false };
}, { open: true });

// Every content file and picture as they are now, for the editor.
on('GET', '/content', async (req, env) => {
  const cur = await current(env);
  const files = parse(cur.texts);
  const patched = await withPatches(env, files, cur.blobs);
  return { head: cur.head, files, blobs: cur.blobs, images: cur.images, patched, github: githubReady(env), main: MAIN_BRANCH };
});

on('POST', '/save', async (req, env, body) => {
  const input = readSave(body);
  const fixId = body.fix_id ? String(body.fix_id) : null;
  const out = await save(env, input, { fixId });
  // A fix request answered from the editor (§6.11) is closed as applied.
  if (out.saved && fixId) {
    const reply = String(body.reply ?? '').trim().slice(0, 500) || null;
    await env.DB.prepare("UPDATE fix_requests SET status = 'fixed', owner_reply = ?, closed_at = ? WHERE id = ? AND status = 'open'").bind(reply, now(), fixId).run();
  }
  return out;
});

on('GET', '/saves', async (req, env) => {
  const { results } = await env.DB.prepare('SELECT * FROM content_saves ORDER BY created_at DESC, rowid DESC LIMIT 30').all();
  // Only the newest few are asked about on GitHub; older ones are long settled.
  const runs = await Promise.all(results.slice(0, 8).map((r) => publishRun(env, r.commit_sha).catch(() => null)));
  const saves = results.map((r, i) => ({
    id: r.id, summary: r.summary, created_at: r.created_at, commit: r.commit_sha, paths: JSON.parse(r.paths), undo_of: r.undo_of,
    ...(i < 8 ? saveStatus(r, runs[i], results.slice(0, i), runs.slice(0, i)) : { state: 'done' }),
  }));
  return { saves, repo: env.GITHUB_REPO ?? null };
});

// Undo a save: every file it changed goes back to what it was just before it,
// as a new save, checked like any other.
on('POST', '/saves/([0-9a-f]{16})/undo', async (req, env, body, [sid]) => {
  const row = (await env.DB.prepare('SELECT * FROM content_saves WHERE id = ?').bind(sid).first()) ?? fail(404, 'not_found', 'No such save.');
  const blobs = JSON.parse(row.blobs);
  const files = {}, was = {};
  for (const [p, b] of Object.entries(blobs)) {
    if (p.startsWith('images/')) continue;
    const text = await fileAt(env, `content/${p}`, row.parent_sha);
    files[p] = text === null ? null : JSON.parse(text);
    was[p] = b;
  }
  if (!Object.keys(files).length) fail(400, 'invalid', 'A picture is undone by uploading the one you want instead.');
  return save(env, { files, pictures: {}, was, summary: `Undo: ${row.summary}`.slice(0, 200) }, { undoOf: row.id });
});

// The commits that changed one file, and that file at one of them.
on('GET', '/history', async (req, env) => {
  const path = new URL(req.url).searchParams.get('path') ?? '';
  if (!JSON_PATH.test(path)) fail(400, 'invalid', 'No such content file.');
  const head = await workingHead(env);
  return { path, versions: await fileHistory(env, `content/${path}`, head.sha) };
});

on('GET', '/version', async (req, env) => {
  const q = new URL(req.url).searchParams;
  const path = q.get('path') ?? '', ref = q.get('ref') ?? '';
  if (!JSON_PATH.test(path) || !/^[0-9a-f]{40}$/.test(ref)) fail(400, 'invalid', 'No such version.');
  const text = await fileAt(env, `content/${path}`, ref);
  if (text === null) fail(404, 'not_found', 'That file wasn\'t there in that version.');
  return { path, ref, value: JSON.parse(text) };
});

// The fix request a link from the owner screens opens the editor on (§6.11).
on('GET', '/fixes/([0-9a-f]{16})', async (req, env, body, [fid]) => {
  const r = (await env.DB.prepare('SELECT id, lesson_id, step, kind, field, current_value, suggested_value, note, status FROM fix_requests WHERE id = ?').bind(fid).first())
    ?? fail(404, 'not_found', 'No such fix request.');
  return { fix: r };
});

export async function handleManage(request, env) {
  const url = new URL(request.url);
  // The page itself: one app, whatever the address under /manage.
  if (!url.pathname.startsWith('/manage/api/')) {
    if (url.pathname === '/manage') return Response.redirect(new URL('/manage/', url), 302);
    if (/\.[a-z0-9]+$/.test(url.pathname)) return env.ASSETS.fetch(request);
    // The folder, not /manage/index.html: Cloudflare's assets answer that with
    // a redirect back to /manage/, which would come here again, in a loop.
    return env.ASSETS.fetch(new Request(new URL('/manage/', url), request));
  }
  try {
    if (!env.DB) fail(503, 'not_ready', 'The database is not connected yet.');
    const route = routes.find((r) => r.method === request.method && r.re.test(url.pathname)) ?? fail(404, 'not_found', 'No such route.');
    let body = {};
    if (request.method !== 'GET') {
      if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) fail(415, 'json_only', 'Send JSON.');
      try { body = JSON.parse((await request.text()) || '{}'); } catch { fail(400, 'invalid', 'That body is not JSON.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'invalid', 'Send a JSON object.');
    }
    if (!route.open) await requireManager(env, request);
    const out = await route.handler(request, env, body, url.pathname.match(route.re).slice(1));
    return out instanceof Response ? out : json(out);
  } catch (err) {
    if (err instanceof ApiError) return json({ error: err.code, message: err.message, ...(err.problems ? { problems: err.problems } : {}) }, err.status);
    if (err instanceof GitHubError) return json({ error: 'github', message: err.message }, 502);
    if (/no such table/i.test(String(err?.message))) return json({ error: 'not_ready', message: 'The database needs its migrations. Press Apply pending on /ops.' }, 503);
    console.log(`Manage error on ${request.method} ${url.pathname}: ${err?.stack ?? err}`);
    return json({ error: 'internal', message: 'Something went wrong.' }, 500);
  }
}
