// Checks every content file (plan §7.4). Exits with an error if any check fails.
// Usage: node tools/lint-content.js
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint } from '../src/content/lint.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');

export function loadContent(root = ROOT) {
  const r = f => JSON.parse(readFileSync(join(root, f), 'utf8'));
  const registryFiles = {};
  for (const f of ['ingredients.json', 'equipment.json', 'skills.json', 'cuisines.json', 'units.json']) registryFiles[f] = r(f);
  const all = Object.assign({}, ...Object.values(registryFiles));
  const lessons = readdirSync(join(root, 'lessons')).filter(f => f.endsWith('.json')).sort().map(file => ({ file, data: r(join('lessons', file)) }));
  const species = r('rules/clean-species.json');
  return {
    registryFiles, lessons,
    ingredients: all.ingredients, equipment: all.equipment, skills: all.skills, cuisines: all.cuisines, regions: all.regions, units: all.units,
    rules: { cleanSpecies: species.species, fatBlocked: species.fatBlocked, blockedWords: r('rules/blocked-words.json').words, allowedPhrases: r('rules/allowed-phrases.json').phrases },
    schemas: { registries: r('schema/registries.schema.json'), lesson: r('schema/lesson.schema.json') },
    imageExists: p => existsSync(join(root, 'images', p))
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errors, warnings } = lint(loadContent());
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`ERROR    ${e}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}
