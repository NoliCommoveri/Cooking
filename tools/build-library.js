// Builds what the Worker and the browser need from content/, which neither can
// read at run time:
//   src/worker/library-data.js     the library list and diet tags, for the API
//   src/worker/content-data.js     every content file as text, its git blob id, and the picture list, for the
//                                  manager section's checks (§7.5) and the Worker's registries and rules
//   public/content/registry.json   ingredients, tools, skills, kitchen words, cuisines, units, and every lesson's summary
//   public/content/lessons/*.json  each lesson file, for the lesson player
//   public/content/course.json     all planned dishes, for the demo and syllabus pages
//   public/content/levels.json     the Levels' units, weeks, and part pages, for the demo and syllabus pages
//   public/img/meals/*.svg         the meal-type pictures, copied from content/images/meals
//   public/lib/*.js                the shared scaling, unit, kitchen-word, diet, and patch code
// The lesson files are served as plain files so the app can keep them for cooking offline.
// Usage: node tools/build-library.js   (a test fails if any of these is out of date)
import { writeFileSync, readFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadContent, readContentFiles } from './lint-content.js';
import { numberCourse, seasonalLabels } from '../src/content/course.js';
import { unleavened } from '../src/content/leaven.js';
import { tasteItemsIn } from '../src/content/tastes.js';
import { mainProtein } from '../src/content/getting-started.js';
import { applyVariation } from '../src/content/variations.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/worker/library-data.js');
const CONTENT_OUT = join(ROOT, 'src/worker/content-data.js');
// lint, validate, load, and format are for the manager section's checks (§7.5).
export const BROWSER_LIB = ['units.js', 'scale.js', 'terms.js', 'amounts.js', 'diet.js', 'patch.js', 'course.js', 'shop.js', 'rules.js', 'recipe.js', 'leaven.js', 'rewards.js', 'login-pictures.js', 'getting-started.js', 'tastes.js', 'variations.js', 'levels.js', 'lint.js', 'validate.js', 'load.js', 'format.js', 'grades.js'];
// Lessons in course order (content/course.json), the order their numbers follow.
// Lessons in a seasonal unit (Appointed Times, §6.19) aren't in the course and come after it.
const inCourse = (c) => {
  const at = Object.fromEntries([...c.course.dishes.map((d) => d.id), ...c.units.flatMap((u) => u.lessons ?? [])].map((id, i) => [id, i]));
  return (a, b) => (at[a.id] ?? 1e9) - (at[b.id] ?? 1e9);
};
const seasonalUnits = (c) => c.units.filter((u) => u.seasonal).map((u) => u.number);
// The Unleavened badge (§6.19), worked out from the lesson file.
// Good for Feast Days (§6.19): an Appointed Times lesson, or one the owner marked.
const isFeast = (c, L) => Boolean(L.feast) || seasonalUnits(c).includes(L.unit);
// A dish's tags (§6.21): on its course.json entry, or on a seasonal lesson.
const tagsOf = (c, L) => c.course.dishes.find((d) => d.id === L.id)?.tags ?? L.tags ?? null;
const isUnleavened = (c, L) => unleavened(L, Object.fromEntries(c.ingredients.map((i) => [i.id, i])), c.rules.leaven);
// The Levels' own written recipes (§12.4), with the Levels' release: each with its
// Level's id and its label in the Level's unit (L1, L2, … in the order of the
// Level's recipe cards).
export const levelRecipes = (c) => (c.levels ?? []).flatMap(({ data: V }) => {
  const at = Object.fromEntries(V.recipes.map((r, i) => [r.id, `${V.sideUnit.prefix}${i + 1}`]));
  return (c.levelLessons ?? []).filter(({ data: L }) => at[L.id]).map(({ data: L }) => ({ L, level: V.id, label: at[L.id] }));
});
// Every Level's recipe cards, by id: a week may cook another Level's card (§12.0).
const allCards = (c) => Object.fromEntries((c.levels ?? []).flatMap(({ data: V }) => V.recipes.map((r) => [r.id, r])));
// A week's dishes: its recipe, or its Familiar and Explore pair (§12.0), then its options.
const weekDishes = (w) => [w.familiar, w.explore, ...(w.swapIns ?? [])].filter(Boolean);

// What families see: hidden lessons (§7.5) are out of the course, the
// library, and the seasonal units' lists, so they take no number and leave
// every course plan. Their lesson files are still built, so a cook already
// started on one still opens.
export function visibleContent(c) {
  const hidden = new Set(c.hidden);
  return {
    ...c,
    lessons: c.lessons.filter(({ data }) => !hidden.has(data.id)),
    levelLessons: (c.levelLessons ?? []).filter(({ data }) => !hidden.has(data.id)),
    course: { ...c.course, dishes: c.course.dishes.filter((d) => !hidden.has(d.id)) },
    units: c.units.map((u) => (u.lessons ? { ...u, lessons: u.lessons.filter((id) => !hidden.has(id)) } : u)),
  };
}

// The git id GitHub gives a file with this text, so the Worker can tell which
// files on GitHub differ from the ones it was built with (§7.5).
export const blobSha = (text) => {
  const bytes = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
};

// Every content file, as the manager section's checks need them (§7.5): the
// files as text (keyed by their path inside content/), each one's git id, and
// the pictures. CONTENT is the same files in the shape lint() reads.
export function buildContent() {
  const { texts, images } = readContentFiles();
  const shas = Object.fromEntries(Object.entries(texts).map(([f, t]) => [f, blobSha(t)]));
  return `// Generated by tools/build-library.js from content/. Don't edit by hand.
import { contentFromFiles } from '../content/load.js';
export const FILES = ${JSON.stringify(texts)};
export const SHAS = ${JSON.stringify(shas)};
export const IMAGES = ${JSON.stringify(images.sort())};
export const CONTENT = contentFromFiles(Object.fromEntries(Object.entries(FILES).map(([f, t]) => [f, JSON.parse(t)])), IMAGES);
`;
}

// Every generated file except library-data.js, as { path relative to the repo: text }.
export function buildPublic() {
  const all = loadContent();
  const c = visibleContent(all);
  const files = {};
  const dishes = Object.fromEntries(c.course.dishes.map((d) => [d.id, d]));
  const labels = { ...numberCourse(c.course.dishes).labels, ...seasonalLabels(c.units) };
  // label: the lesson's number in the suggested order. The app shows each
  // family's own numbers from its course plan instead.
  const card = (L, label) => ({
    id: L.id, label, title: L.title, unit: L.unit, cuisine: L.cuisine, skill: L.skill, skills: L.skills,
    image: `img/${L.image.replace(/\.png$/, '.webp')}`, unleavened: isUnleavened(c, L), feast: isFeast(c, L),
    // The dish card (queue and course screens): from course.json, or the lesson itself for Appointed Times.
    about: L.about ?? dishes[L.id]?.about, main: L.main ?? dishes[L.id]?.main, method: L.method ?? dishes[L.id]?.method, minutes: L.totalMinutes,
    // Its variations (§6.21), by id and title.
    ...(L.variations?.length ? { variations: L.variations.map((v) => ({ id: v.id, title: v.title, ...(v.level ? { level: v.level } : {}) })) } : {}),
  });
  const summary = c.lessons.map(({ data: L }) => card(L, labels[L.id])).sort(inCourse(c));
  files['public/content/registry.json'] = JSON.stringify({
    ingredients: Object.fromEntries(c.ingredients.map((i) => [i.id, i])),
    equipment: Object.fromEntries(c.equipment.map((e) => [e.id, e])),
    skills: Object.fromEntries(c.skills.map((x) => [x.id, x])),
    terms: c.terms,
    cuisines: Object.fromEntries(c.cuisines.map((x) => [x.id, x])),
    regions: Object.fromEntries(c.regions.map((x) => [x.id, x])),
    units: Object.fromEntries(c.units.map((u) => [u.number, u.name])),
    seasonal: seasonalUnits(c),
    lessons: summary,
    // The Levels' own recipes (§12.4), apart from the course's lessons: the
    // app shows them only to a family with the Levels' release.
    levelLessons: levelRecipes(c).map(({ L, level, label }) => ({ ...card(L, label), level })),
    // Every planned dish's title, for a kitchen word practiced in a lesson not written yet.
    dishes: Object.fromEntries(all.course.dishes.map((d) => [d.id, d.title])),
  }) + '\n';
  for (const { data: L } of [...all.lessons, ...(all.levelLessons ?? [])]) files[`public/content/lessons/${L.id}.json`] = JSON.stringify(L) + '\n';
  const written = new Set(c.lessons.map(({ data }) => data.id));
  files['public/content/course.json'] = JSON.stringify({
    dishes: c.course.dishes.map((d) => ({ ...d, image: `img/${d.image.replace(/\.png$/, '.webp')}`, ...(written.has(d.id) ? { written: true } : {}) })),
  }) + '\n';
  // The Levels (§12), for the demo's Structured Progression track (§6.16) and
  // its syllabus: each one's units and weeks, with every week's recipe title
  // and planned time, and its part pages.
  // A recipe's planned time, as the Worker counts it (plannedRecipeMinutes in src/worker/plan.js).
  const cards = allCards(c);
  const minutesOf = (V, id) => [...c.lessons, ...(c.levelLessons ?? [])].find(({ data }) => data.id === id)?.data.totalMinutes
    ?? c.course.dishes.find((d) => d.id === id)?.minutes ?? cards[id]?.minutes ?? 0;
  const titleOf = (V, id) => cards[id]?.title ?? c.course.dishes.find((d) => d.id === id)?.title
    ?? [...c.lessons, ...(c.levelLessons ?? [])].find(({ data }) => data.id === id)?.data.title ?? id;
  // The Worker serves this only once the Levels' release is launched, so the
  // public pages follow the release switch (§8.6).
  files['public/content/levels.json'] = JSON.stringify({
    levels: (c.levels ?? []).map(({ data: V }) => ({
      id: V.id, name: V.name, hours: V.hours, units: V.units.map(({ number, name, goal }) => ({ number, name, goal })),
      weeks: V.weeks.map(({ week, unit, familiar, explore, cuisine, mastery, kind, minutes, note, drill, knowledge, sabbath }) => ({
        week, unit,
        ...(familiar ? { familiar, explore, title: titleOf(V, familiar), exploreTitle: titleOf(V, explore), recipeMinutes: minutesOf(V, familiar) } : {}),
        ...(cuisine ? { cuisine } : {}), ...(mastery ? { mastery } : {}), ...(kind ? { kind, minutes, note } : {}), drill, knowledge, sabbath,
      })),
    })),
  }) + '\n';
  // Meal-type pictures (§6.19): shared recipes without art, and lessons waiting on theirs.
  for (const f of readdirSync(join(ROOT, 'content/images/meals'))) files[`public/img/meals/${f}`] = readFileSync(join(ROOT, 'content/images/meals', f), 'utf8');
  for (const f of BROWSER_LIB) {
    files[`public/lib/${f}`] = `// Copied from src/content/${f} by tools/build-library.js. Don't edit here.\n` + readFileSync(join(ROOT, 'src/content', f), 'utf8');
  }
  return files;
}

export function buildLibrary() {
  const c = visibleContent(loadContent());
  const cards = allCards(c);
  const registry = Object.fromEntries(c.ingredients.map((i) => [i.id, i]));
  const used = new Set();
  const summary = (L) => {
    const lines = L.ingredients.map((x) => ({ ingredient: x.ingredient, ...(x.optional ? { optional: true } : {}) }));
    const subs = (L.substitutions || []).map(({ for: f, use, reason }) => ({ for: f, use, reason }));
    for (const x of lines) used.add(x.ingredient);
    for (const s of subs) { used.add(s.for); used.add(s.use); }
    return {
      id: L.id, version: L.version, track: L.track, unit: L.unit, title: L.title,
      image: `img/${L.image.replace(/\.png$/, '.webp')}`, cuisine: L.cuisine, skill: L.skill,
      servings: L.servings, scaling: L.scaling, totalMinutes: L.totalMinutes, ingredients: lines, substitutions: subs,
      unleavened: isUnleavened(c, L), feast: isFeast(c, L),
      // What Chef Ruth offers a family with no course (§6.9).
      protein: mainProtein(L, registry),
      // What profiles rate it by (§6.21): its tags, and the key ingredients it uses.
      tags: tagsOf(c, L), tasteItems: tasteItemsIn(L, c.tastes.ingredients),
      // The tools it needs, checked against the family's missing tools (§6.21).
      tools: L.equipment ?? [],
    };
  };
  const withVariations = (L) => {
    const out = summary(L);
    // Each variation (§6.21) as the lesson it makes: its own ingredients,
    // time, badges, tags, and key ingredients, for picks and shopping.
    if (L.variations?.length) {
      out.variations = L.variations.map((v) => {
        const { id: _, version, track, unit, skill, feast, ...rest } = summary(applyVariation(L, v));
        return { ...rest, id: v.id, tags: v.tags ?? null, ...(v.level ? { level: v.level } : {}) };
      });
    }
    return out;
  };
  // The Levels' own recipes come after the course's lessons, each with its
  // Level (§12.4): only a family with the Levels' release sees them.
  const lessons = [...c.lessons.map(({ data: L }) => withVariations(L)).sort(inCourse(c)),
    ...levelRecipes(c).map(({ L, level }) => ({ ...withVariations(L), level }))];
  const ingredients = Object.fromEntries(c.ingredients.filter((i) => used.has(i.id))
    .map((i) => [i.id, { name: i.name, contains: i.contains }]));
  const data = {
    lessons, ingredients,
    cuisines: Object.fromEntries(c.cuisines.map((x) => [x.id, x.name])),
    units: Object.fromEntries(c.units.map((u) => [u.number, u.name])),
    seasonal: seasonalUnits(c),
    seasonalLabels: seasonalLabels(c.units),
    // The Levels' own recipes' labels: A1, K1, C1… (§12.4).
    levelLabels: Object.fromEntries(levelRecipes(c).map(({ L, label }) => [L.id, label])),
    dietTags: c.schemas.registries.$defs.dietTag.enum,
    // Every planned dish, for numbering a family's course plan; its line about
    // the dish and whether it's a meal, for Chef Ruth's first lesson (§6.9).
    // Its tags, minutes, and cuisine too, so a dish not written yet still
    // shows in the gaps and can be scored (§6.21).
    course: c.course.dishes.map(({ id, title, unit, pickOne, prereqs, about, meal, skills, tags, minutes, cuisine }) => ({
      id, title, unit, about, skills, ...(minutes ? { minutes } : {}), ...(cuisine ? { cuisine } : {}), ...(pickOne ? { pickOne } : {}), ...(prereqs ? { prereqs } : {}), ...(meal === false ? { meal } : {}), ...(tags ? { tags } : {}),
    })),
    // The Levels (§12), with their release: each one's units and weeks, for
    // a Level course's plan (12b). A week's recipe is a lesson id when it's
    // written; until then it waits like a planned dish (§6.18).
    levels: Object.fromEntries((c.levels ?? []).map(({ data: V }) => [V.id, {
      id: V.id, name: V.name, hours: V.hours,
      // Its own unit in Side quests (§12.4): "Level 3 Cook recipes", labels K1, K2….
      side: { number: V.sideUnit.number, name: V.sideUnit.name, prefix: V.sideUnit.prefix }, units: V.units.map(({ number, name, goal }) => ({ number, name, goal })),
      // Each week's three part pages (12c): title, planned minutes, and what's written of them.
      // Its swap-ins: the other recipes best fit picks among (12d).
      // A practice or capstone week has no recipe: its own minutes and note instead.
      weeks: V.weeks.map(({ week, unit, skill, familiar, explore, cuisine, swapIns, mastery, kind, minutes, note, drill, knowledge, sabbath }) => ({
        // recipe: the week has one. Which dish a course cooks follows its start setting (14c).
        week, unit, ...(skill ? { skill } : {}), ...(familiar ? { recipe: familiar, familiar, explore } : {}), ...(cuisine ? { cuisine } : {}), ...(swapIns?.length ? { options: swapIns } : {}),
        ...(mastery ? { mastery } : {}), ...(kind ? { kind, minutes, note } : {}), drill, knowledge, sabbath,
      })),
      // The Level's own recipe cards, scored by their tags until they're written (12d).
      // Another Level's cards its weeks cook come along, so they score and wait the same way (§12.0).
      cards: [...V.recipes, ...[...new Set(V.weeks.flatMap(weekDishes))].filter((id) => cards[id] && !V.recipes.some((r) => r.id === id)).map((id) => cards[id])]
        .map(({ id, title, cuisine, skills, minutes, tags, art }) => ({ id, title, cuisine, skills, minutes, tags, art })),
      // Every recipe's title, written or not: the Level's own cards, then the course's dishes.
      titles: Object.fromEntries([...new Set(V.weeks.flatMap(weekDishes))].map((id) => [id,
        cards[id]?.title ?? c.course.dishes.find((d) => d.id === id)?.title ?? [...c.lessons, ...(c.levelLessons ?? [])].find(({ data }) => data.id === id)?.data.title ?? id])),
    }])),
    // What profiles rate (§6.21), by id and name.
    tastes: Object.fromEntries(Object.entries(c.tastes).map(([k, list]) => [k, list.map(({ id, name }) => ({ id, name }))])),
  };
  return `// Generated by tools/build-library.js from content/. Don't edit by hand.\nexport const LIBRARY = ${JSON.stringify(data, null, 1)};\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(OUT, buildLibrary());
  writeFileSync(CONTENT_OUT, buildContent());
  rmSync(join(ROOT, 'public/content'), { recursive: true, force: true });
  rmSync(join(ROOT, 'public/img/meals'), { recursive: true, force: true });
  for (const [path, text] of Object.entries(buildPublic())) {
    mkdirSync(dirname(join(ROOT, path)), { recursive: true });
    writeFileSync(join(ROOT, path), text);
  }
  console.log('wrote src/worker/library-data.js, src/worker/content-data.js, public/content/, and public/lib/');
}
