// Turns the content files into the shape lint() and the builders read (plan
// §7). `files` maps a path inside content/ ("ingredients.json",
// "lessons/shakshuka.json", "rules/blocked-words.json") to its parsed JSON;
// `images` lists the pictures under content/images/ ("dishes/shakshuka.png").
// The command-line tools read the folder from disk, and the Worker reads the
// same files from its bundle and from GitHub (§7.5), so both check one way.
import { tastesOf } from './tastes.js';

export const REGISTRY_FILES = ['ingredients.json', 'equipment.json', 'skills.json', 'cuisines.json', 'units.json', 'terms.json', 'tastes.json'];

export function contentFromFiles(files, images = null) {
  const r = (f) => {
    if (!(f in files)) throw new Error(`content/${f} is missing`);
    return files[f];
  };
  const registryFiles = {};
  for (const f of REGISTRY_FILES) registryFiles[f] = r(f);
  const all = Object.assign({}, ...Object.values(registryFiles));
  const lessons = Object.keys(files).filter((f) => /^lessons\/[^/]+\.json$/.test(f)).sort()
    .map((f) => ({ file: f.slice('lessons/'.length), data: files[f] }));
  const species = r('rules/clean-species.json');
  const pictures = images && new Set(images);
  return {
    registryFiles, lessons,
    ingredients: all.ingredients, equipment: all.equipment, terms: all.terms, watchedWords: r('rules/kitchen-words.json').words,
    skills: all.skills, cuisines: all.cuisines, regions: all.regions, units: all.units, course: r('course.json'),
    // What profiles rate, and the words dishes are tagged in (§6.21).
    tastes: tastesOf(all),
    // Lessons the owner hid from every family (§7.5). Their files stay, so unhiding brings them back.
    hidden: files['hidden.json']?.lessons ?? [],
    rules: {
      cleanSpecies: species.species, fatBlocked: species.fatBlocked, allowedProducts: species.allowedProducts || [],
      blockedWords: r('rules/blocked-words.json').words, allowedPhrases: r('rules/allowed-phrases.json').phrases, leaven: r('rules/leaven.json'),
    },
    schemas: { registries: r('schema/registries.schema.json'), lesson: r('schema/lesson.schema.json') },
    imageExists: pictures ? (p) => pictures.has(p) : undefined,
  };
}
