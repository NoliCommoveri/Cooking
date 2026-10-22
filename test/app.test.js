// The app's browser files have no build step, so a syntax error would only show
// on a family's device. This catches it in CI instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('public/app.js parses', () => {
  const r = spawnSync(process.execPath, ['--check', 'public/app.js'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('the app shell loads its script and styles', () => {
  const html = readFileSync('public/index.html', 'utf8');
  assert.match(html, /<script type="module" src="app.js">/);
  assert.match(html, /href="app.css"/);
});

test('public/player.js parses', () => {
  const r = spawnSync(process.execPath, ['--check', 'public/player.js'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('every icon the player draws is in public/icons.svg', () => {
  const sprite = readFileSync('public/icons.svg', 'utf8');
  const have = new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
  const player = readFileSync('public/player.js', 'utf8');
  const used = new Set([...player.matchAll(/'((?:i|s|t)-[a-z]+)'/g)].map((m) => m[1]));
  used.add('plate');
  for (const id of used) assert.ok(have.has(id), `icons.svg has no "${id}"`);
});

test('the lesson player can scale and show every lesson at every size', async () => {
  const { scaleLesson, servingOptions } = await import('../public/lib/scale.js');
  const reg = JSON.parse(readFileSync('public/content/registry.json', 'utf8'));
  for (const L of reg.lessons) {
    const lesson = JSON.parse(readFileSync(`public/content/lessons/${L.id}.json`, 'utf8'));
    for (const n of servingOptions(lesson)) {
      const s = scaleLesson(lesson, reg.ingredients, n);
      assert.ok(s.steps.every((st) => typeof st.text === 'string' && !/\{(n|qty):/.test(st.text)), `${L.id} at ${n}`);
    }
  }
});
