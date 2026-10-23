// Writes every content file (except the schemas) in the one layout the manager
// section writes (src/content/format.js, plan §7.5). Run after editing content
// by hand; a test fails if a file isn't in this layout.
// Usage: node tools/format-content.js
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatJson } from '../src/content/format.js';
import { walk } from './lint-content.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
export const formatted = (f) => f.endsWith('.json') && !f.startsWith('schema/') && !f.startsWith('images/');

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let n = 0;
  for (const f of walk(ROOT).filter(formatted)) {
    const text = readFileSync(join(ROOT, f), 'utf8');
    const out = formatJson(JSON.parse(text));
    if (out !== text) { writeFileSync(join(ROOT, f), out); n++; }
  }
  console.log(`${n} file(s) reformatted`);
}
