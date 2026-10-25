// What the public pages say about each Level beyond its content (plan §12.0):
// its weekly time, its credit, and where it starts, for the demo page and
// the Structured Progression syllabus. Levels 2 to 4 take their units, weeks,
// and hours from content/levels/; Level 1 is planned later, on the same units.
export const LEVEL_INFO = {
  'Level 1 Helper': { week: 'About 1 hour a week', credit: 'Hours tracked for your records', ready: 'New cooks, working beside an adult the whole time', later: true },
  'Level 2 Apprentice': { week: 'About 2 hours a week', credit: 'A middle-grades elective', ready: 'Cooks ready for short recipes, with an adult in the kitchen for all stove, oven, and knife work' },
  'Level 3 Cook': { week: 'About 3½ hours a week', credit: 'One high-school elective credit in most states', ready: "Cooks ready for a chef's knife and the stove, with an adult nearby for heat and sharp knives" },
  'Level 4 Chef': { week: 'About 3¾ hours a week', credit: 'One high-school elective credit in most states', ready: 'Cooks who can plan and cook on their own; an adult only needs to be home for deep frying and grilling', note: 'Learners work independently, with adult-style safety notes.' },
};

// Every Level in order, Level 1 from its outline and the rest from their
// content: { name, hours, units, weeks, ...LEVEL_INFO }.
export const allLevels = (levels) => [
  { name: 'Level 1 Helper', units: levels[0]?.units.map(({ number, name }) => ({ number, name })) ?? [], weeks: [] },
  ...[...levels].sort((a, b) => a.name.localeCompare(b.name)),
].map((L) => ({ ...L, ...LEVEL_INFO[L.name] }));
