// The migration runner, /ops, and the backups (plan §8.5): every destructive
// control has its restore, and each restore is proven here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, client, family, opsClient } from './helpers/worker.js';
import { migrationStatus, applyPending, schemaVersion } from '../src/worker/migrate.js';
import { MIGRATIONS } from '../src/worker/migrations/index.js';
import { exportAll, importAll, clearEverything, exportFamily, removeFamily, restoreFamily, tableNames, Refused } from '../src/worker/backup.js';
import { makeDb } from './helpers/d1.js';

test('migrations apply in order, once, and report their state', async () => {
  const db = makeDb();
  assert.ok((await migrationStatus(db)).every((m) => m.state === 'pending'));
  const first = await applyPending(db);
  assert.equal(first.halted, false);
  assert.equal(first.log.length, MIGRATIONS.length);
  assert.ok((await migrationStatus(db)).every((m) => m.state === 'applied'));
  assert.equal((await applyPending(db)).log.length, 0);
  assert.equal(await schemaVersion(db), MIGRATIONS.at(-1).id);
});

test('an edited migration reads as drifted', async () => {
  const db = makeDb();
  await applyPending(db);
  const edited = MIGRATIONS.map((m, i) => (i === 0 ? { ...m, sql: `${m.sql}\n-- edited` } : m));
  assert.equal((await migrationStatus(db, edited))[0].state, 'drifted');
});

test('a failing migration lands nothing and stops the run', async () => {
  const db = makeDb();
  const list = [
    { id: '0001', name: 'good', sql: 'CREATE TABLE a (x INTEGER);' },
    { id: '0002', name: 'bad', sql: 'CREATE TABLE b (x INTEGER); INSERT INTO nowhere VALUES (1);' },
    { id: '0003', name: 'later', sql: 'CREATE TABLE c (x INTEGER);' },
  ];
  const run = await applyPending(db, list);
  assert.equal(run.halted, true);
  assert.equal(run.log.at(-1).ok, false);
  const tables = await tableNames(db);
  assert.ok(tables.includes('a'));
  assert.ok(!tables.includes('b'), 'the failed migration rolled back');
  assert.ok(!tables.includes('c'), 'later migrations were not tried');
});

test('every family table carries family_id', async () => {
  const db = makeDb();
  await applyPending(db);
  const ownerLevel = new Set(['_migrations', 'families', 'signup_verifications', 'settings', 'lesson_patches']);
  for (const t of await tableNames(db)) {
    if (ownerLevel.has(t)) continue;
    const cols = (await db.prepare(`PRAGMA table_info("${t}")`).all()).results.map((c) => c.name);
    assert.ok(cols.includes('family_id'), `${t} has no family_id`);
  }
});

test('a backup export restores cleanly into an empty database', async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }, { name: 'Leo', color: 'sky' }] });
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('beta_word', 'basil')").run();
  const backup = JSON.parse(JSON.stringify(await exportAll(env.DB)));

  const fresh = makeDb();
  await applyPending(fresh);
  await importAll(fresh, backup);
  const again = JSON.parse(JSON.stringify(await exportAll(fresh)));
  for (const t of Object.keys(backup.tables)) {
    if (t === '_migrations') continue;
    assert.deepEqual(again.tables[t], backup.tables[t], t);
  }
  // And the restored database works: the parent logs in on it.
  const c = client({ ...env, DB: fresh });
  assert.equal((await c.post('/api/login', { email: 'jen@example.com', password: 'password123' })).status, 200);
  assert.equal((await c.get('/api/profiles')).body.profiles[0].name, 'Ava & Leo');
});

test('restore refuses a database that has rows, and a wrong schema version', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  const backup = await exportAll(env.DB);
  await assert.rejects(importAll(env.DB, backup), Refused);
  const fresh = makeDb();
  await applyPending(fresh);
  await assert.rejects(importAll(fresh, { ...backup, schema_version: '9999' }), Refused);
  await assert.rejects(importAll(makeDb(), backup), Refused, 'no schema yet');
});

test('clear everything, apply pending, restore', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  const backup = await exportAll(env.DB);
  await clearEverything(env.DB);
  assert.deepEqual(await tableNames(env.DB), []);
  await applyPending(env.DB);
  await importAll(env.DB, backup);
  assert.equal((await client(env).post('/api/login', { email: 'jen@example.com', password: 'password123' })).status, 200);
});

test('remove a family, then restore it from its own export', async () => {
  const env = await makeEnv();
  const a = await family(env, 'Carsons', 'jen@example.com');
  const b = await family(env, 'Smiths', 'pat@example.com');
  await a.post('/api/profiles', { people: [{ name: 'Ava', color: 'tomato' }] });
  await b.post('/api/profiles', { people: [{ name: 'Bea', color: 'sky' }] });
  const aId = (await env.DB.prepare("SELECT family_id FROM parents WHERE email = 'jen@example.com'").first()).family_id;
  const ava = (await a.get('/api/profiles')).body.profiles[0].id;
  const t = new Date().toISOString();
  await a.put('/api/attempts/00000000000000aa', { lesson_id: 'shakshuka', servings: 6, profile_ids: [ava], started_at: t, finished_at: t });

  const out = JSON.parse(JSON.stringify(await exportFamily(env.DB, aId)));
  assert.deepEqual(Object.keys(out.tables).sort(), ['attempt_profiles', 'attempts', 'families', 'parents', 'profiles']);
  assert.doesNotMatch(JSON.stringify(out), /Smiths|Bea|pat@example/, 'only this family is in its export');

  await removeFamily(env.DB, aId);
  for (const t of ['families', 'parents', 'profiles', 'sessions']) {
    const n = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE ${t === 'families' ? 'id' : 'family_id'} = ?`).bind(aId).first()).n;
    assert.equal(n, 0, t);
  }
  assert.equal((await a.get('/api/me')).body.signed_in, false);
  assert.equal((await b.get('/api/profiles')).body.profiles[0].name, 'Bea', 'the other family is untouched');

  await restoreFamily(env.DB, out);
  const c = client(env);
  assert.equal((await c.post('/api/login', { email: 'jen@example.com', password: 'password123' })).status, 200);
  assert.equal((await c.get('/api/profiles')).body.profiles[0].name, 'Ava');
  assert.equal((await c.get(`/api/profiles/${ava}/cooks`)).body.cooks['shakshuka'].times, 1, 'the cook came back too');
  await assert.rejects(restoreFamily(env.DB, out), Refused, 'already back');
});

test("a family restore refuses rows from another family, or a taken email", async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  const aId = (await env.DB.prepare('SELECT family_id FROM parents').first()).family_id;
  const out = JSON.parse(JSON.stringify(await exportFamily(env.DB, aId)));
  await removeFamily(env.DB, aId);
  const tampered = structuredClone(out);
  tampered.tables.parents[0].family_id = 'ffffffffffffffff';
  await assert.rejects(restoreFamily(env.DB, tampered), /another family/);
  await family(env, 'New', 'jen@example.com');
  await assert.rejects(restoreFamily(env.DB, out), /already has an account/);
  await assert.rejects(restoreFamily(env.DB, await exportAll(env.DB)), /whole-database/);
});

test('/ops needs the token', async () => {
  const env = await makeEnv();
  const c = client(env);
  assert.match((await c.get('/ops')).body, /Ops token/);
  assert.match((await c.form('/ops/login', { token: 'wrong' })).body, /didn&#39;t match/);
  assert.match((await c.get('/ops/export.json')).body, /Ops token/);
  const noToken = client({ ...env, OPS_TOKEN: undefined });
  assert.match((await noToken.get('/ops')).body, /OPS_TOKEN is not set/);
});

test('/ops says when no database is bound', async () => {
  const env = await makeEnv();
  const c = await opsClient({ ...env, DB: undefined });
  assert.match((await c.get('/ops')).body, /No database is connected/);
});

test('/ops: apply pending, the owner, and a download', async () => {
  const env = await makeEnv({ migrate: false });
  const ops = await opsClient(env);
  assert.match((await ops.get('/ops')).body, /Apply pending \(5\)/);
  assert.match((await ops.form('/ops/migrate', {})).body, /Applied <code>0001<\/code>/);

  const jen = await family(env, 'Carsons', 'jen@example.com');
  assert.match((await ops.form('/ops/owner', { email: 'nobody@example.com' })).body, /Nothing was changed/);
  assert.match((await ops.form('/ops/owner', { email: 'jen@example.com' })).body, /is now the owner/);
  assert.equal((await jen.get('/api/me')).body.parent.is_owner, true);

  const dl = await ops.get('/ops/export.json');
  assert.match(dl.headers.get('content-disposition'), /attachment/);
  assert.equal(dl.body.kind, 'clean-plate-backup');
});

test('/ops clear and remove ask for their phrase', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  const ops = await opsClient(env);
  const fid = (await env.DB.prepare('SELECT id FROM families').first()).id;

  assert.match((await ops.form(`/ops/remove/${fid}`, { phrase: 'yes' })).body, /Nothing was deleted/);
  assert.match((await ops.get(`/ops/remove/${fid}`)).body, /Download this family first/);
  assert.match((await ops.form(`/ops/remove/${fid}`, { phrase: 'REMOVE' })).body, /Removed Carsons/);

  assert.match((await ops.form('/ops/clear', { phrase: 'delete' })).body, /Nothing was deleted/);
  assert.match((await ops.get('/ops/clear')).body, /Download export.json first/);
  assert.match((await ops.form('/ops/clear', { phrase: 'DELETE EVERYTHING' })).body, /Cleared \d+ tables/);
  assert.match((await ops.get('/ops')).body, /Apply pending \(5\)/);
});

test('/ops restores from an uploaded file', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  const ops = await opsClient(env);
  const backup = JSON.stringify((await ops.get('/ops/export.json')).body);
  await ops.form('/ops/clear', { phrase: 'DELETE EVERYTHING' });
  await ops.form('/ops/migrate', {});
  const res = await ops.form('/ops/import', { file: new File([backup], 'export.json', { type: 'application/json' }) });
  assert.match(res.body, /Restored \d+ rows/);
  assert.match((await ops.form('/ops/import', { file: new File(['not json'], 'x.json') })).body, /not valid JSON/);
});

test('the API says the database is not ready before migrations', async () => {
  const env = await makeEnv({ migrate: false });
  const login = { email: 'a@example.com', password: 'password123' };
  assert.equal((await client(env).post('/api/login', login)).status, 503);
  assert.equal((await client({ ...env, DB: undefined }).post('/api/login', login)).status, 503);
});
