// A Level week's parts (plan §12.4) and the hours a Level course plans for.
// Shared by the Worker and the course editor, so the hours a parent sees at
// setup are the ones the learner's progress counts toward.

// A Level week's three part pages, in order. The fourth part was the Sabbath
// task, so Beyond the Recipe is still stored as "sabbath".
export const PARTS = ['drill', 'knowledge', 'sabbath'];
export const PART_NAMES = { drill: 'Drill', knowledge: 'Knowledge', sabbath: 'Beyond the Recipe' };

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
