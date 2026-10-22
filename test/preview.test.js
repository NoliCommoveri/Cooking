import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPreview } from '../tools/build-preview.js';

test('preview/lesson-preview.html is up to date with the content (run: node tools/build-preview.js)', () => {
  assert.equal(readFileSync(new URL('../preview/lesson-preview.html', import.meta.url), 'utf8'), buildPreview());
});
