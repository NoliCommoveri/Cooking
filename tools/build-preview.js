// Builds preview/lesson-preview.html: one self-contained page that shows every lesson,
// read-only, at every serving size it allows. It bundles the content, the scaling code,
// the linter's results, and web-sized dish images.
// Usage: node tools/build-preview.js   (a test fails if the committed page is out of date)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './lint-content.js';
import { lint } from '../src/content/lint.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'preview', 'lesson-preview.html');

// The browser gets units.js and scale.js as plain script: imports and exports removed.
const moduleCode = f => readFileSync(join(ROOT, 'src/content', f), 'utf8')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '');

export function buildPreview() {
  const c = loadContent();
  const { errors, warnings } = lint(c);
  const images = {};
  for (const { data: L } of c.lessons) {
    const web = join(ROOT, 'mockups/quest-showcase/img', L.image.replace(/^dishes\//, '').replace(/\.png$/, '.webp'));
    if (existsSync(web)) images[L.id] = 'data:image/webp;base64,' + readFileSync(web).toString('base64');
  }
  const data = {
    lessons: c.lessons.map(l => l.data).sort((a, b) => a.number - b.number),
    ingredients: Object.fromEntries(c.ingredients.map(i => [i.id, i])),
    equipment: Object.fromEntries(c.equipment.map(e => [e.id, e])),
    skills: Object.fromEntries(c.skills.map(s => [s.id, s])),
    cuisines: Object.fromEntries(c.cuisines.map(x => [x.id, x])),
    regions: Object.fromEntries(c.regions.map(x => [x.id, x])),
    units: Object.fromEntries(c.units.map(u => [u.number, u.name])),
    terms: c.terms,
    lint: { errors, warnings }, images
  };
  const page = readFileSync(join(ROOT, 'tools/preview-template.html'), 'utf8')
    .replace('/*__CODE__*/', () => ['units.js', 'scale.js', 'terms.js'].map(moduleCode).join('\n'))
    .replace('/*__DATA__*/', () => 'const DATA = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';');
  return page;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, buildPreview());
  console.log(`Wrote ${OUT}`);
}
