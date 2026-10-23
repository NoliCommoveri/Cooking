// Copied from src/content/leaven.js by tools/build-library.js. Don't edit here.
// Leaven (plan §6.19). Not the hard block: leaven only decides where a recipe
// shows (the Unleavened badge and the spring swap picker). The list is
// content/rules/leaven.json; it's checked against ingredient names and step
// text, the same way the blocked-word scan is (owner, 2026-10-22).
import { blockedWordsIn } from './rules.js';

const STEP_TEXT = ['text', 'tip', 'look'];

// What in a recipe looks like leaven. `recipe` is a lesson, or a family recipe
// in the same shape, where a typed-in ingredient line has `name` and no
// `ingredient`. `ingredients` maps registry ids to entries with a name.
// Returns { found: ['baking powder', …], typedIn: n }.
export function leavenIn(recipe, ingredients, leaven) {
  const words = { blockedWords: leaven.words, allowedPhrases: leaven.allowedPhrases };
  const found = new Set();
  let typedIn = 0;
  for (const line of recipe.ingredients || []) {
    const ing = line.ingredient ? ingredients[line.ingredient] : null;
    if (!ing) typedIn++;
    const name = ing ? `${ing.name} ${line.ingredient.replace(/-/g, ' ')}` : line.name;
    for (const w of blockedWordsIn(name, words)) found.add(w);
  }
  for (const st of recipe.steps || []) for (const f of STEP_TEXT) for (const w of blockedWordsIn(st[f], words)) found.add(w);
  return { found: [...found], typedIn };
}

// The Unleavened badge: every ingredient in the registry, and nothing leaven.
// A recipe with a typed-in ingredient doesn't get it until a review clears it.
export const unleavened = (recipe, ingredients, leaven) => {
  const r = leavenIn(recipe, ingredients, leaven);
  return !r.found.length && !r.typedIn;
};
