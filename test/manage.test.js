// The manager section (plan §7.5): its owner-only sign-in, reading the content
// from GitHub, saves checked by the content linter and written as commits on
// content-edits, conflicts, Undo, history, save status, and hidden lessons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, family, client, opsClient } from './helpers/worker.js';
import { FakeGitHub } from './helpers/github.js';
import { formatJson } from '../src/content/format.js';
import { SHAS } from '../src/worker/content-data.js';
import { loadContent } from '../tools/lint-content.js';
import { visibleContent } from '../tools/build-library.js';
import { numberCourse } from '../src/content/course.js';
import { lint } from '../src/content/lint.js';
import { readFileSync } from 'node:fs';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex').toString('base64');

async function setup({ github = true } = {}) {
  const gh = github ? new FakeGitHub().install() : null;
  const env = await makeEnv(github ? { GITHUB_TOKEN: 'gh-test', GITHUB_REPO: 'NoliCommoveri/Cooking' } : {});
  const owner = await family(env, 'Carsons', 'jen@example.com');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();
  const m = client(env);
  const login = await m.post('/manage/api/login', { email: 'jen@example.com', password: 'password123' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  return { gh, env, owner, m };
}

const content = async (m) => (await m.get('/manage/api/content')).body;
const lessonPath = 'lessons/shakshuka.json';

test('only the owner signs in, and the cookie is the manager section\'s own', async () => {
  const env = await makeEnv();
  await family(env, 'Carsons', 'jen@example.com');
  await family(env, 'Smiths', 'pat@example.com');
  await env.DB.prepare("UPDATE parents SET is_owner = 1 WHERE email = 'jen@example.com'").run();
  const pat = client(env);
  assert.equal((await pat.post('/manage/api/login', { email: 'pat@example.com', password: 'password123' })).status, 403);
  assert.equal((await pat.post('/manage/api/login', { email: 'jen@example.com', password: 'wrong-one' })).status, 401);
  assert.equal((await pat.get('/manage/api/content')).status, 401);

  const jen = client(env);
  const res = await jen.post('/manage/api/login', { email: 'jen@example.com', password: 'password123' });
  assert.match(res.headers.get('set-cookie'), /cpr_manage=[0-9a-f]{64}; Path=\/manage; HttpOnly/);
  assert.deepEqual((await jen.get('/manage/api/me')).body, { signed_in: true, email: 'jen@example.com', github: false });
  // The family app's session isn't the manager's, and the manager's isn't the family app's.
  assert.equal((await jen.get('/api/me')).body.signed_in, false);
  const fam = await family(env, 'Third', 'third@example.com');
  assert.equal((await fam.get('/manage/api/content')).status, 401);

  // Losing the owner flag closes it.
  await env.DB.prepare("UPDATE parents SET is_owner = 0 WHERE email = 'jen@example.com'").run();
  assert.equal((await jen.get('/manage/api/content')).status, 401);
  await jen.post('/manage/api/logout');
  assert.equal((await jen.get('/manage/api/me')).body.signed_in, false);
});

test('the page is served at /manage/, whatever the address under it', async () => {
  const env = await makeEnv();
  const seen = [];
  env.ASSETS = { fetch: async (req) => { seen.push(new URL(req.url).pathname); return new Response('page'); } };
  const c = client(env);
  assert.equal((await c.get('/manage')).status, 302);
  await c.get('/manage/');
  await c.get('/manage/lessons/shakshuka');
  await c.get('/manage/manage.js');
  // The folder, never /manage/index.html, which Cloudflare redirects back to /manage/.
  assert.deepEqual(seen, ['/manage/', '/manage/', '/manage/manage.js']);
});

test('without GitHub the content shows from the Worker\'s copy, and nothing saves', async () => {
  const { m } = await setup({ github: false });
  const c = await content(m);
  assert.equal(c.head, null);
  assert.equal(c.github, false);
  assert.equal(c.files[lessonPath].id, 'shakshuka');
  assert.equal(c.blobs[lessonPath], SHAS[lessonPath]);
  const res = await m.post('/manage/api/save', { files: { [lessonPath]: c.files[lessonPath] }, was: { [lessonPath]: c.blobs[lessonPath] } });
  assert.equal(res.status, 503);
});

test('a save is checked, formatted, and committed to content-edits; main is untouched', async () => {
  const { gh, env, m } = await setup();
  const c = await content(m);
  assert.equal(c.head, gh.refs.get('main'));
  const mainBefore = gh.refs.get('main');

  // A title change touches the lesson and its course entry together.
  const L = { ...c.files[lessonPath], title: 'Shakshuka with herbs' };
  const course = structuredClone(c.files['course.json']);
  course.dishes.find((d) => d.id === 'shakshuka').title = 'Shakshuka with herbs';
  const res = await m.post('/manage/api/save', {
    summary: 'Renamed Shakshuka',
    files: { [lessonPath]: L, 'course.json': course },
    was: { [lessonPath]: c.blobs[lessonPath], 'course.json': c.blobs['course.json'] },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.saved, true);
  assert.equal(gh.refs.get('main'), mainBefore);
  const edits = gh.refs.get('content-edits');
  assert.equal(gh.commits.get(edits).parents[0], mainBefore);
  assert.match(gh.commits.get(edits).message, /^Renamed Shakshuka\n/);
  const saved = gh.text('content-edits', `content/${lessonPath}`);
  assert.equal(saved, formatJson({ ...L, version: c.files[lessonPath].version }));
  // A title isn't steps or ingredients, so the version stays.
  assert.equal(JSON.parse(saved).version, c.files[lessonPath].version);
  const row = await env.DB.prepare('SELECT * FROM content_saves').first();
  assert.equal(row.commit_sha, edits);
  assert.deepEqual(JSON.parse(row.paths).sort(), ['course.json', lessonPath]);

  // The editor reads from content-edits now, and the next save builds on it.
  const c2 = await content(m);
  assert.equal(c2.head, edits);
  assert.equal(c2.files[lessonPath].title, 'Shakshuka with herbs');
  assert.equal(c2.blobs[lessonPath], res.body.blobs[lessonPath]);

  // Changing a step raises the version.
  const L2 = structuredClone(c2.files[lessonPath]);
  L2.steps[0].text += ' Take your time.';
  const res2 = await m.post('/manage/api/save', { files: { [lessonPath]: L2 }, was: { [lessonPath]: c2.blobs[lessonPath] } });
  assert.equal(res2.status, 200, JSON.stringify(res2.body));
  assert.equal(res2.body.versions[lessonPath], c.files[lessonPath].version + 1);
  assert.equal(gh.commits.get(gh.refs.get('content-edits')).parents[0], edits);

  // Saving what's already there writes nothing.
  const c3 = await content(m);
  const same = await m.post('/manage/api/save', { files: { [lessonPath]: c3.files[lessonPath] }, was: { [lessonPath]: c3.blobs[lessonPath] } });
  assert.equal(same.body.saved, false);
});

test('a save that breaks a rule is refused with the reason, and the hard block has no way around it', async () => {
  const { gh, m } = await setup();
  const c = await content(m);
  // An unclean ingredient in the registry.
  const reg = structuredClone(c.files['ingredients.json']);
  reg.ingredients.push({ ...reg.ingredients.find((i) => i.id === 'chicken-breast'), id: 'pork-chop', name: 'Pork chop', animalSource: 'pig' });
  const res = await m.post('/manage/api/save', { files: { 'ingredients.json': reg }, was: { 'ingredients.json': c.blobs['ingredients.json'] } });
  assert.equal(res.status, 422);
  assert.ok(res.body.problems.some((p) => /unclean/.test(p)), res.body.problems.join('\n'));
  assert.equal(gh.refs.has('content-edits'), false);

  // A blocked word in a step.
  const L = structuredClone(c.files[lessonPath]);
  L.steps[0].text = 'Fry the bacon first.';
  const res2 = await m.post('/manage/api/save', { files: { [lessonPath]: L }, was: { [lessonPath]: c.blobs[lessonPath] } });
  assert.equal(res2.status, 422);
  assert.ok(res2.body.problems.some((p) => /blocked food \("bacon"\)/.test(p)));

  // A food-safety rule: raw chicken with no thermometer step.
  const F = structuredClone(c.files['lessons/chicken-fajitas.json']);
  F.steps = F.steps.filter((s) => s.type !== 'doneness');
  const res3 = await m.post('/manage/api/save', { files: { 'lessons/chicken-fajitas.json': F }, was: { 'lessons/chicken-fajitas.json': c.blobs['lessons/chicken-fajitas.json'] } });
  assert.equal(res3.status, 422);
  assert.ok(res3.body.problems.some((p) => /doneness/.test(p)));

  // A Level's pages are held to the same rule (§12.4).
  const levelPath = 'levels/sp-3.json';
  const V = structuredClone(c.files[levelPath]);
  V.weeks[24].knowledge.body = ['Shrimp and clams have no fins or scales.'];
  const res4 = await m.post('/manage/api/save', { files: { [levelPath]: V }, was: { [levelPath]: c.blobs[levelPath] } });
  assert.equal(res4.status, 422);
  assert.ok(res4.body.problems.some((p) => /levels\/sp-3\.json: .*blocked food \("shrimp"\)/.test(p)), res4.body.problems.join('\n'));
  // A week written properly saves.
  V.weeks[24].knowledge.body = ['A clean fish has both fins and scales (Leviticus 11:9).'];
  const ok = await m.post('/manage/api/save', { files: { [levelPath]: V }, was: { [levelPath]: c.blobs[levelPath] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));

  // Schemas and paths outside content/ can't be written.
  for (const p of ['schema/lesson.schema.json', '../wrangler.json', 'lessons/../x.json']) {
    assert.equal((await m.post('/manage/api/save', { files: { [p]: {} }, was: {} })).status, 400, p);
  }
  // Only a lesson file can be removed.
  assert.equal((await m.post('/manage/api/save', { files: { 'units.json': null }, was: {} })).status, 400);
});

test('a file changed since the editor opened it is never overwritten', async () => {
  const { gh, m } = await setup();
  const c = await content(m);
  // A session pushes to main meanwhile.
  const other = structuredClone(c.files[lessonPath]);
  other.title = 'Shakshuka (session)';
  gh.push('main', { [`content/${lessonPath}`]: formatJson(other) });
  const L = { ...c.files[lessonPath], skill: 'Sauce, then eggs' };
  const res = await m.post('/manage/api/save', { files: { [lessonPath]: L }, was: { [lessonPath]: c.blobs[lessonPath] } });
  assert.equal(res.status, 409);
  assert.match(res.body.message, /changed since you opened it/);
  // A different file saves fine, on top of the session's commit.
  const units = structuredClone(c.files['units.json']);
  units.units[0].name = 'Knife skills and assembly';
  const ok = await m.post('/manage/api/save', { files: { 'units.json': units }, was: { 'units.json': c.blobs['units.json'] } });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(gh.commits.get(gh.refs.get('content-edits')).parents[0], gh.refs.get('main'));
});

test('a new lesson with its picture, a new unit, then Undo takes it back out', async () => {
  const { gh, env, m } = await setup();
  const c = await content(m);
  const units = structuredClone(c.files['units.json']);
  units.units.push({ number: 9, name: 'Soups and stews' });
  const L = { ...structuredClone(c.files[lessonPath]), id: 'green-shakshuka', title: 'Green shakshuka', image: 'dishes/green-shakshuka.png', unit: 9 };
  const course = structuredClone(c.files['course.json']);
  const base = course.dishes.find((d) => d.id === 'shakshuka');
  course.dishes.push({ ...base, id: 'green-shakshuka', title: 'Green shakshuka', image: 'dishes/green-shakshuka.png', unit: 9, prereqs: L.prereqs });
  delete course.dishes.at(-1).pickOne;
  const res = await m.post('/manage/api/save', {
    summary: 'Added Green shakshuka',
    files: { 'units.json': units, 'lessons/green-shakshuka.json': L, 'course.json': course },
    pictures: { 'dishes/green-shakshuka.png': PNG },
    was: { 'units.json': c.blobs['units.json'], 'lessons/green-shakshuka.json': null, 'course.json': c.blobs['course.json'] },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.versions['lessons/green-shakshuka.json'], 1);
  assert.ok(gh.filesAt(gh.refs.get('content-edits'))['content/images/dishes/green-shakshuka.png']);

  // Without its picture, a new lesson is refused.
  const L2 = { ...L, id: 'red-shakshuka', title: 'Red shakshuka', image: 'dishes/red-shakshuka.png' };
  const c2 = await content(m);
  const course2 = structuredClone(c2.files['course.json']);
  course2.dishes.push({ ...course2.dishes.at(-1), id: 'red-shakshuka', title: 'Red shakshuka', image: 'dishes/red-shakshuka.png' });
  const bad = await m.post('/manage/api/save', { files: { 'lessons/red-shakshuka.json': L2, 'course.json': course2 }, was: { 'lessons/red-shakshuka.json': null, 'course.json': c2.blobs['course.json'] } });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.problems.some((p) => /red-shakshuka\.png isn't in content\/images/.test(p)));

  // Undo the first save: the lesson file goes, and the unit and course go back.
  const sid = (await env.DB.prepare('SELECT id FROM content_saves').first()).id;
  const undo = await m.post(`/manage/api/saves/${sid}/undo`);
  assert.equal(undo.status, 200, JSON.stringify(undo.body));
  assert.equal(gh.text('content-edits', 'content/lessons/green-shakshuka.json'), null);
  assert.equal(gh.text('content-edits', 'content/units.json'), gh.text('main', 'content/units.json'));
  assert.equal(gh.text('content-edits', 'content/course.json'), gh.text('main', 'content/course.json'));
  const rows = (await env.DB.prepare('SELECT undo_of, summary FROM content_saves ORDER BY created_at, rowid').all()).results;
  assert.equal(rows[1].undo_of, sid);
  assert.match(rows[1].summary, /^Undo: Added Green shakshuka/);
});

test('history lists a file\'s versions, and an older one can be read back', async () => {
  const { m } = await setup();
  const c = await content(m);
  const L = { ...c.files[lessonPath], skill: 'First change' };
  await m.post('/manage/api/save', { summary: 'First', files: { [lessonPath]: L }, was: { [lessonPath]: c.blobs[lessonPath] } });
  const c2 = await content(m);
  await m.post('/manage/api/save', { summary: 'Second', files: { [lessonPath]: { ...c2.files[lessonPath], skill: 'Second change' } }, was: { [lessonPath]: c2.blobs[lessonPath] } });
  const h = (await m.get(`/manage/api/history?path=${lessonPath}`)).body;
  assert.deepEqual(h.versions.slice(0, 2).map((v) => v.message), ['Second', 'First']);
  const older = (await m.get(`/manage/api/version?path=${lessonPath}&ref=${h.versions[1].sha}`)).body;
  assert.equal(older.value.skill, 'First change');
  assert.equal((await m.get('/manage/api/history?path=../secrets')).status, 400);
});

test('each save shows whether it is checking, failed, publishing, or replaced', async () => {
  const { gh, m } = await setup();
  const c = await content(m);
  await m.post('/manage/api/save', { summary: 'One', files: { [lessonPath]: { ...c.files[lessonPath], skill: 'One' } }, was: { [lessonPath]: c.blobs[lessonPath] } });
  let saves = (await m.get('/manage/api/saves')).body.saves;
  assert.equal(saves[0].state, 'checking');

  gh.runs.set(saves[0].commit, { status: 'completed', conclusion: 'failure', html_url: 'https://github.com/run/1' });
  gh.comments.set(saves[0].commit, [{ body: "**This save didn't pass the checks**\nERROR lessons/shakshuka.json: something" }]);
  saves = (await m.get('/manage/api/saves')).body.saves;
  assert.equal(saves[0].state, 'failed');
  assert.match(saves[0].detail, /ERROR lessons\/shakshuka.json/);

  const c2 = await content(m);
  await m.post('/manage/api/save', { summary: 'Two', files: { [lessonPath]: { ...c2.files[lessonPath], skill: 'Two' } }, was: { [lessonPath]: c2.blobs[lessonPath] } });
  saves = (await m.get('/manage/api/saves')).body.saves;
  assert.equal(saves[1].state, 'replaced');
  gh.runs.set(saves[0].commit, { status: 'completed', conclusion: 'success', html_url: 'https://github.com/run/2' });
  saves = (await m.get('/manage/api/saves')).body.saves;
  assert.equal(saves[0].state, 'publishing');
});

test('a lesson patched from a fix request comes into the editor with its patch, and saving folds it in', async () => {
  const { env, m } = await setup();
  const t = new Date().toISOString();
  const L0 = (await content(m)).files[lessonPath];
  await env.DB.prepare(`INSERT INTO lesson_patches (id, lesson_id, base_version, field_path, old_value, new_value, applied_by, applied_at)
    VALUES ('aaaaaaaaaaaaaaaa', 'shakshuka', ?, 'totalMinutes', ?, '45', 'x', ?)`).bind(L0.version, String(L0.totalMinutes), t).run();
  const c = await content(m);
  assert.equal(c.files[lessonPath].totalMinutes, 45);
  assert.equal(c.patched.shakshuka, L0.version + 1);
  const course = structuredClone(c.files['course.json']);
  course.dishes.find((d) => d.id === 'shakshuka').minutes = 45;
  const res = await m.post('/manage/api/save', { files: { [lessonPath]: c.files[lessonPath], 'course.json': course }, was: { [lessonPath]: c.blobs[lessonPath], 'course.json': c.blobs['course.json'] } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  // Past the patched version, so cooks keep counting up.
  assert.equal(res.body.versions[lessonPath], L0.version + 2);
});

test('a hidden lesson leaves the library, the course, and its numbers, and its file stays', () => {
  const all = loadContent();
  const shown = visibleContent({ ...all, hidden: ['shakshuka'] });
  assert.ok(!shown.lessons.some((x) => x.data.id === 'shakshuka'));
  assert.ok(!shown.course.dishes.some((d) => d.id === 'shakshuka'));
  assert.equal(numberCourse(shown.course.dishes).labels.shakshuka, undefined);
  assert.ok(numberCourse(all.course.dishes).labels.shakshuka);
  assert.ok(all.lessons.some((x) => x.data.id === 'shakshuka'));
  // A hidden seasonal lesson leaves its unit's list.
  const s = visibleContent({ ...all, hidden: ['unleavened-flatbread'] });
  assert.ok(!s.units.find((u) => u.seasonal).lessons.includes('unleavened-flatbread'));
  // hidden.json names real lessons only.
  assert.ok(lint({ ...all, hidden: ['no-such-dish'] }).errors.some((e) => /hidden.json: "no-such-dish"/.test(e)));
});

test('/ops says whether GitHub is connected', async () => {
  const env = await makeEnv();
  const ops = await opsClient(env);
  assert.match((await ops.get('/ops')).body, /GitHub: GITHUB_TOKEN is not set/);
  new FakeGitHub().install();
  const env2 = await makeEnv({ GITHUB_TOKEN: 'gh-test', GITHUB_REPO: 'NoliCommoveri/Cooking' });
  const ops2 = await opsClient(env2);
  assert.match((await ops2.get('/ops')).body, /GitHub: Connected to NoliCommoveri\/Cooking/);
});

test('every content file is in the editor\'s layout (run: node tools/format-content.js)', () => {
  for (const f of Object.keys(SHAS)) {
    if (f.startsWith('schema/')) continue;
    const text = readFileSync(new URL(`../content/${f}`, import.meta.url), 'utf8');
    assert.equal(text, formatJson(JSON.parse(text)), f);
  }
});

test('a fix request answered from the manager is marked fixed, with the reply', async () => {
  const { env, m } = await setup();
  const pat = await family(env, 'Smiths', 'pat@example.com');
  await pat.post('/api/profiles', { people: [{ name: 'Mom', color: 'plum' }], audience: 'adult' });
  const adult = (await pat.get('/api/profiles')).body.profiles[0].id;
  await pat.post('/api/fix-requests', { lesson_id: 'shakshuka', kind: 'amount', note: 'Too many eggs.', profile_id: adult, field: 'ingredients.egg.amount', suggested_value: 5 });
  const fid = (await env.DB.prepare('SELECT id FROM fix_requests').first()).id;
  const { fix } = (await m.get(`/manage/api/fixes/${fid}`)).body;
  assert.equal(fix.lesson_id, 'shakshuka');
  assert.equal(fix.field, 'ingredients.egg.amount');

  const c = await content(m);
  const L = structuredClone(c.files[lessonPath]);
  L.ingredients.find((x) => x.ingredient === 'egg').amount = 5;
  const res = await m.post('/manage/api/save', { files: { [lessonPath]: L }, was: { [lessonPath]: c.blobs[lessonPath] }, fix_id: fid, reply: 'Thanks!' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const mine = (await pat.get('/api/lessons/shakshuka/fixes')).body.fixes[0];
  assert.equal(mine.status, 'fixed');
  assert.equal(mine.owner_reply, 'Thanks!');
  assert.equal(mine.applied, 5);
  assert.equal(mine.patched, false);
});
