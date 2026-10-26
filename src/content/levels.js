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

// What a parent reads before assigning a Level, where one needs it: under
// Which program? at setup and with Chef Ruth, and in the syllabus. The
// owner's words (2026-10-26), word for word.
export const ASSIGN_NOTES = {
  'sp-4': 'Note: While lessons do review some fundamentals in culinary technique, Level 4 is intended for somewhat experienced cooks and pre-supposes learners that are ready to be in the kitchen independently. Please do not assign until your learner is able to operate the stove-top and oven themselves, and is able to drain, work with oils, and perform cutting unassisted.',
};
