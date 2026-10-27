// Copied from src/content/levels.js by tools/build-library.js. Don't edit here.
// A Level week's parts (plan §12.4) and the hours a Level course plans for.
// Shared by the Worker and the course editor, so the hours a parent sees at
// setup are the ones the learner's progress counts toward.

// A Level week's three part pages. Learners and parents see a week in this
// order (owner, 2026-10-24): Knowledge, Drill, the Recipe, then Beyond the
// Recipe. Beyond the Recipe was the Sabbath task, so it's still stored as
// "sabbath".
export const PARTS = ['knowledge', 'drill', 'sabbath'];
export const PART_NAMES = { knowledge: 'Knowledge', drill: 'Drill', sabbath: 'Beyond the Recipe' };

// The parts a course keeps on (a parent can turn any off at setup). A
// practice run or capstone week keeps all three: its parts are the week.
export const coursePartsOf = (raw) => {
  let on = null;
  try { on = raw == null ? null : JSON.parse(raw); } catch { /* all on */ }
  return Array.isArray(on) ? PARTS.filter((p) => on.includes(p)) : [...PARTS];
};
export const weekParts = (w, on) => (w.kind ? PARTS : PARTS.filter((p) => on.includes(p)));

// The minutes a course plans for: each week's recipe (minutesOf its id) or,
// for a practice run or capstone, its own time, plus the parts it keeps on.
// weeks: the Level's weeks, each with id, the recipe the course keeps for it.
export function plannedMinutes(weeks, minutesOf, on = PARTS) {
  let m = 0;
  for (const w of weeks) {
    m += w.kind ? w.minutes ?? 0 : w.id ? minutesOf(w.id) ?? 0 : 0;
    for (const p of weekParts(w, on)) m += w[p]?.minutes ?? 0;
  }
  return m;
}
export const hoursOf = (minutes) => Math.round(minutes / 60);

// A Level's labels for its dishes (owner, 2026-10-26): its letter (A for
// Level 1, B, C, D), the week, then a for the week's Familiar dish and b for
// its Explore one: C4a, C4b. A lesson shared with Cook Around the World has
// one in each Level that cooks it. prefix: the Level's letter.
export const weekLabels = (weeks, prefix) => Object.fromEntries(weeks.flatMap((w) => [[w.familiar, 'a'], [w.explore, 'b']]
  .filter(([id]) => id).map(([id, x]) => [id, `${prefix}${w.week}${x}`])));

// What a parent reads before assigning a Level, where one needs it: under
// Which program? at setup and with Chef Ruth, and in the syllabus. The
// owner's words (2026-10-26), word for word.
export const ASSIGN_NOTES = {
  'sp-4': 'Note: While lessons do review some fundamentals in culinary technique, Level 4 is intended for somewhat experienced cooks and pre-supposes learners that are ready to be in the kitchen independently. Please do not assign until your learner is able to operate the stove-top and oven themselves, and is able to drain, work with oils, and perform cutting unassisted.',
};

// Help me choose (owner, 2026-10-27): under Which program?, with Chef Ruth
// and in the course editor, what each program expects a cook to be ready
// for, and a short quiz that suggests one. It goes by what a cook is ready
// to learn, never by what they've done or their age (§12). The Cook Around
// the World line is the owner's (2026-10-27); the rest is Claude's draft.
export const READY_FOR = {
  caw: "Cook Around the World: Dishes from a wide variety of cuisines, each teaching one skill, with no readings or drills. It fits teen cooks who can follow a recipe with an adult nearby, adults, and families who'd like to cook together for fun.",
  'sp-1': 'Level 1 Helper: For brand-new cooks, ready to wash, stir, pour, and spread beside an adult the whole time, following pictures more than words.',
  'sp-2': 'Level 2 Apprentice: For beginners of any age, ready to follow short steps one at a time, measure, and stir, with an adult in the kitchen for all stove, oven, and knife work.',
  'sp-3': "Level 3 Cook: For cooks ready to follow full steps in real cooking words and learn a chef's knife and the stove, with an adult nearby for heat and sharp knives.",
  'sp-4': 'Level 4 Chef: For cooks ready to work on their own: the stove and oven, draining, hot oil, cutting without help, and planning a meal.',
};

// The quiz. Each readiness answer is the Level it points to (1 to 4); the
// last question is whether they want the reading pages and drills. Siblings
// share a course, so it's answered for the cook with the least experience.
export const PLACE_QUIZ = [
  { q: 'What knife work are they ready to learn?', answers: [
    ["Not yet. They'd watch, wash, and tear", 1],
    ['A table knife on soft foods, with an adult right beside them', 2],
    ["A chef's knife, with an adult nearby", 3],
    ['Any knife work on their own', 4],
  ] },
  { q: 'What are they ready to do at the stove and oven?', answers: [
    ['Stay back while an adult cooks', 1],
    ['Stir and flip, with an adult right there', 2],
    ['Cook at the stove and use the oven, with an adult nearby', 3],
    ['The stove, oven, and hot oil on their own', 4],
  ] },
  { q: 'What kind of recipe are they ready to follow?', answers: [
    ['Pictures, read aloud to them', 1],
    ['Short steps, one thing at a time', 2],
    ['Full steps in real cooking words, like simmer and fold', 3],
    ['A recipe with few tips, changed to taste', 4],
  ] },
];
// The owner's words (2026-10-27).
export const PLACE_PARTS = { q: 'Do you want reading pages and drills for supplemental learning, or are you only here for the actual recipe?', answers: [['parts', 'Reading pages and drills too'], ['recipes', 'Just the recipes']] };

// What the quiz suggests. levels: the readiness answers; parts: 'parts' or
// 'recipes'; offered: the Level ids ('sp-2', …). The Level is the lowest
// answer (owner, 2026-10-27), so they're ready for it on every count, or
// the highest offered Level under it; if none is (Level 1 isn't offered
// yet), the lowest offered, marked under. Cook Around the World is offered
// beside a Level 3 or 4 for just the recipes, and never with the reading
// pages and drills. Just the recipes on a Level turns its parts off.
export function suggestProgram(levels, parts, offered) {
  const n = Math.min(...levels);
  const at = offered.filter((id) => Number(id.slice(3)) <= n).sort().at(-1);
  const id = at ?? [...offered].sort()[0] ?? null;
  const recipes = parts === 'recipes';
  return { id, under: !at, caw: recipes && Number(id?.slice(3)) >= 3, partsOff: recipes };
}
