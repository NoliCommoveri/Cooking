// Copied from src/content/getting-started.js by tools/build-library.js. Don't edit here.
// Chef Ruth's Getting started (plan §6.9): its parts in order, and the first
// lesson she offers a family that doesn't set up a course. Pure, so the Worker,
// the build, and tests share one copy.

// The parts, in the order she asks them. A family's progress is the last part
// it finished (families.setup_step); she picks up at the one after.
export const SETUP_STEPS = ['family', 'servings', 'diet', 'learners', 'logins', 'mode', 'course'];

// The part after the one finished; null finished = start at the top. After the
// last part there's none left, so Getting started is done.
export function nextStep(finished) {
  if (finished == null) return SETUP_STEPS[0];
  const i = SETUP_STEPS.indexOf(finished);
  return i < 0 ? SETUP_STEPS[0] : SETUP_STEPS[i + 1] ?? null;
}

// What a family can start with when there's no course (owner, 2026-10-23).
export const STARTERS = { chicken: 'Chicken', beef: 'Beef', fish: 'Fish', vegetarian: 'Vegetarian' };

// A lesson's main protein, from its required ingredients (an optional one never
// counts): the first meat that isn't a sauce (fish sauce and Worcestershire are
// made from fish, but they're seasoning). Vegetarian means nothing required
// carries meat or fish. Anything else, a lamb stew or a lesson that only uses
// beef broth, is "other".
// ingredients: the registry by id, with section, animalSource, animalPart, contains.
export function mainProtein(lesson, ingredients) {
  const required = lesson.ingredients.filter((l) => !l.optional).map((l) => ingredients[l.ingredient]).filter(Boolean);
  const main = required.find((i) => i.animalPart === 'meat' && i.section !== 'sauces');
  if (main) {
    if (main.animalSource === 'chicken') return 'chicken';
    if (main.animalSource === 'cattle') return 'beef';
    return main.contains.includes('fish') ? 'fish' : 'other';
  }
  return required.some((i) => i.contains.includes('meat') || i.contains.includes('fish')) ? 'other' : 'vegetarian';
}

// The lessons she offers for a starter, best first. lessons: the ones the
// family can cook (its diet filters applied), in course order, each with its
// protein and its dish's meal flag. Sides, breads, and desserts (meal: false)
// aren't offered: a first cook should be a meal.
export function starterLessons(kind, lessons) {
  return lessons.filter((L) => L.protein === kind && L.meal !== false);
}
