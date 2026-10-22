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
