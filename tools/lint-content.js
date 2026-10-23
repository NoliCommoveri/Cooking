// Checks every content file (plan §7.4). Exits with an error if any check fails.
// Usage: node tools/lint-content.js
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint } from '../src/content/lint.js';
import { contentFromFiles } from '../src/content/load.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

// Every file under a folder, as paths relative to it with forward slashes.
export function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, base) : [relative(base, p).split('\\').join('/')];
  });
}

// The content folder's JSON files as { path inside content/: text }, and its pictures.
export function readContentFiles(root = ROOT) {
  const texts = {};
  for (const f of walk(root)) if (f.endsWith('.json') && !f.startsWith('images/')) texts[f] = readFileSync(join(root, f), 'utf8');
  return { texts, images: walk(join(root, 'images')).filter((f) => !f.endsWith('.md')) };
}

export function loadContent(root = ROOT) {
  const { texts, images } = readContentFiles(root);
  const files = Object.fromEntries(Object.entries(texts).map(([f, t]) => [f, JSON.parse(t)]));
  return contentFromFiles(files, images);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, warnings } = lint(loadContent());
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`ERROR    ${e}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}
