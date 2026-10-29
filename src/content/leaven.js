// Leaven (plan §6.19). Not the hard block: leaven only decides where a recipe
// shows (the Unleavened badge and the spring swap picker). The list is
// content/rules/leaven.json; it's checked against ingredient names and step
// text, the same way the blocked-word scan is (owner, 2026-10-22).
import { blockedWordsIn } from './rules.js';
import { dietView } from './diet.js';

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

// A raising agent named in a step (yeast, baking soda…), as opposed to a
// bread: a step can name the bread an unleavened swap replaces, but a method
// that needs an agent can't be swapped.
const AGENT = /yeast|sourdough|levain|powder|soda|bicarbonate|ammonia|ammonium|hartshorn|self-ris|self-rais/i;

// The unleavened days (plan §6.20): a lesson's `unleavened` substitutions,
// applied on their own the way diet swaps are. After the family's diet swaps,
// each ingredient that's still leaven takes the lesson's first unleavened
// swap for it whose replacement fits the family's diet and isn't leaven; an
// optional one with none is left out. ok: nothing leaven is left, so the
// lesson can be cooked and be due on those days. ratio: how many of the
// replacement for one of what it replaces, for the shopping list.
// Returns { ok, applied: [{ for, use, ratio }], leftOut: [ids] }.
export function feastView(lesson, ingredients, filters, leaven) {
  const words = { blockedWords: leaven.words, allowedPhrases: leaven.allowedPhrases };
  const diet = dietView(lesson, ingredients, filters);
  const tags = new Set(filters || []);
  const leavenId = (id) => blockedWordsIn(`${ingredients[id]?.name ?? ''} ${id.replace(/-/g, ' ')}`, words).length > 0;
  const fits = (id) => ingredients[id] && !(ingredients[id].contains || []).some((t) => tags.has(t)) && !leavenId(id);
  const dietSwap = Object.fromEntries(diet.applied.map((x) => [x.for, x.use]));
  const out = { ok: diet.visible, applied: [], leftOut: [] };
  for (const line of lesson.ingredients || []) {
    // A typed-in ingredient (a family recipe) isn't known, so it isn't swapped.
    if (!line.ingredient || !ingredients[line.ingredient]) { out.ok = false; continue; }
    if (diet.leftOut.includes(line.ingredient)) continue;
    const id = dietSwap[line.ingredient] ?? line.ingredient;
    if (!leavenId(id)) continue;
    const sub = (lesson.substitutions || []).find((x) => x.reason === 'unleavened' && (x.for === line.ingredient || x.for === id) && fits(x.use));
    if (sub) { if (!out.applied.some((x) => x.for === id)) out.applied.push({ for: id, use: sub.use, ratio: sub.ratio ?? 1 }); }
    else if (line.optional) { if (!out.leftOut.includes(id)) out.leftOut.push(id); }
    else out.ok = false;
  }
  for (const st of lesson.steps || []) for (const f of STEP_TEXT) if (blockedWordsIn(st[f], words).some((w) => AGENT.test(w))) out.ok = false;
  return out;
}

// Whether a lesson can be cooked on the unleavened days: it's unleavened, or
// its unleavened swaps make it so for this family's diet.
export const feastOk = (lesson, ingredients, filters, leaven) => unleavened(lesson, ingredients, leaven) || feastView(lesson, ingredients, filters, leaven).ok;

// The diet swaps with the unleavened days' on top, by the lesson's own
// ingredients: a diet swap's replacement that an unleavened swap replaces
// again ends at the unleavened one. Returns { applied: [{ for, use }],
// leftOut: [ids], feast: [{ for, use }] (the unleavened ones alone) }.
export function withFeast(diet, feast) {
  const from = Object.fromEntries(diet.applied.map((x) => [x.use, x.for]));
  const applied = diet.applied.map((x) => ({ ...x }));
  const out = [];
  for (const f of feast.applied) {
    const orig = from[f.for] ?? f.for;
    const hit = applied.find((x) => x.for === orig);
    if (hit) hit.use = f.use; else applied.push({ for: orig, use: f.use });
    out.push({ for: orig, use: f.use, ratio: f.ratio });
  }
  const leftOut = [...diet.leftOut, ...feast.leftOut.map((id) => from[id] ?? id)];
  return { applied: applied.filter((x) => !leftOut.includes(x.for)), leftOut, feast: out };
}
