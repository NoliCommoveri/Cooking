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

// A line on each program in the owner's words (2026-10-27): Chef Ruth's
// Which program?. Help me choose has its own lines (BEST_FOR), then a short
// quiz that suggests one. It goes by what a cook is ready to learn, never by
// what they've done or their age (§12).
export const READY_FOR = {
  caw: "Cook Around the World: a self-paced course where each dish is chosen to practice the skills you'd like to grow in, all while experiencing food from many cultures and cuisines.",
  levels: "Structured Progression Level Courses: a weekly full culinary arts course teaching kitchen science, health rules, and Scriptural truths about food along with one recipe per week for practice. Levels are based on a learner's development and previous experience in the kitchen.",
};

// Help me choose's own lines, in the owner's words (2026-10-27): who each
// program is best for, then a line on every Level course.
export const BEST_FOR = {
  caw: 'Cook Around the World: best for learners with some prior kitchen experience who want to cook real meals at their own pace, with no extra reading or drills.',
  'sp-2': 'Level 2: best for learners who are just beginning or now ready to work with cutting instruments like paring knives, but still need adult assistance with the stove and oven.',
  'sp-3': "Level 3: best for learners who are ready for a real chef's knife and to operate the stove and oven. We'll still recommend an adult be present for assistance when needed.",
  'sp-4': 'Level 4: best for experienced cooks looking to hone and practice the full range of cooking techniques, and who are familiar with knives, heat sources, and oil.',
  levels: 'All Level courses come with additional reading, quizzes, and drills outside the weekly recipe. These can be turned off by a parent.',
};
// The lines in order, for the Levels a family can pick.
export const bestForLines = (levelIds) => [BEST_FOR.caw, ...levelIds.filter((x) => BEST_FOR[x]).map((x) => BEST_FOR[x]), BEST_FOR.levels];

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
