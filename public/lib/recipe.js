// Copied from src/content/recipe.js by tools/build-library.js. Don't edit here.
// Family recipes (plan §6.10): a parent's own recipe, entered one thing at a
// time, checked like the library, and cooked in the same lesson player. Shared
// by the Worker (the checks) and the app (the player and the entry flow).
//
// A recipe is plain data:
//   { title, servings, totalMinutes, mealType, why: { title, body } | null,
//     ingredients: [{ ingredient: registry id | name: typed in, amount, unit, prep, optional }],
//     equipment: [registry ids],
//     steps: [{ id, text, safety, hazard, timerSeconds, timerLabel, raw, type, target }] }
// A line with `amount: null` has a `text` ("to taste") instead. A step marked
// `raw` handles raw meat, poultry, fish, or eggs; a wash-hands step is put
// after it (§3). A doneness step has a `target`: { temp } or { look }.
import { blockedWordsIn, uncleanReasons } from './rules.js';
import { VOLUME, WEIGHT, family, toBase } from './units.js';

export const MEAL_TYPES = [
  ['meat', 'Meat'], ['poultry', 'Poultry'], ['fish', 'Fish'], ['bread', 'Bread or flatbread'], ['soup', 'Soup'],
  ['salad', 'Salad or vegetables'], ['side', 'Side dish'], ['dessert', 'Dessert'], ['drink', 'Drink'],
];
export const SAFETY = ['solo', 'adult-nearby', 'adult-hands-on'];
// Units a parent can pick. A registry ingredient can also use its own package units.
export const UNITS = [...Object.keys(VOLUME), ...Object.keys(WEIGHT), 'count'];
export const LIMITS = { title: 80, text: 400, short: 60, lines: 40, steps: 40, tools: 30, servings: 12, minutes: 24 * 60, timer: 24 * 3600 };
// Safe minimum temperatures (§3): poultry 165°F, ground meat 160°F, whole cuts and fish 145°F.
const SAFE_MIN = { poultry: 165, meat: 145, fish: 145 };
const safeMin = (id, kind) => (kind === 'meat' && /ground/.test(id) ? 160 : SAFE_MIN[kind] ?? null);

const WASH_TEXT = 'Wash your hands, and wash the board and anything else the raw food touched, with hot, soapy water.';

const str = (v, max) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

// Tidies what the browser sent into the stored shape: trims text, numbers the
// steps, and puts a wash-hands step after each step that handles raw food.
// Problems are left for recipeProblems to name.
export function normalizeRecipe(body) {
  const b = body && typeof body === 'object' ? body : {};
  const lines = (Array.isArray(b.ingredients) ? b.ingredients : []).slice(0, LIMITS.lines).map((l) => {
    const line = l && typeof l === 'object' ? l : {};
    const out = line.ingredient ? { ingredient: String(line.ingredient) } : { name: str(line.name, LIMITS.short) };
    const amount = num(line.amount);
    if (amount === null) out.amount = null, out.text = str(line.text, LIMITS.short) || 'to taste';
    else out.amount = amount, out.unit = String(line.unit ?? '');
    const prep = str(line.prep, LIMITS.short);
    if (prep) out.prep = prep;
    if (line.optional) out.optional = true;
    return out;
  });
  const steps = [];
  let n = 0;
  const src = (Array.isArray(b.steps) ? b.steps : []).filter((s) => s && s.type !== 'wash').slice(0, LIMITS.steps);
  for (const s of src) {
    const st = { id: `s${++n}`, text: str(s.text, LIMITS.text), safety: SAFETY.includes(s.safety) ? s.safety : String(s.safety ?? '') };
    const hazard = str(s.hazard, LIMITS.short);
    if (hazard && st.safety !== 'solo') st.hazard = hazard;
    const tip = str(s.tip, LIMITS.text);
    if (tip) st.tip = tip;
    const secs = num(s.timerSeconds);
    if (secs) { st.timerSeconds = Math.round(secs); st.timerLabel = str(s.timerLabel, LIMITS.short); }
    if (s.target && (s.target.temp != null || s.target.look)) {
      st.type = 'doneness';
      st.target = s.target.temp != null ? { temp: Math.round(Number(s.target.temp)), unit: 'F' } : { look: str(s.target.look, LIMITS.text) };
    }
    if (s.raw) st.raw = true;
    steps.push(st);
    if (st.raw) steps.push({ id: `s${++n}`, type: 'wash', text: WASH_TEXT, safety: 'solo' });
  }
  const why = b.why && (b.why.title || b.why.body) ? { title: str(b.why.title, LIMITS.short), body: str(b.why.body, LIMITS.text) } : null;
  return {
    title: str(b.title, LIMITS.title),
    servings: num(b.servings),
    totalMinutes: num(b.totalMinutes),
    mealType: String(b.mealType ?? ''),
    why,
    ingredients: lines,
    equipment: [...new Set((Array.isArray(b.equipment) ? b.equipment : []).map(String))].slice(0, LIMITS.tools),
    steps,
  };
}

// Every string a person reads in a recipe, with where it is.
function* texts(r) {
  yield ['the title', r.title];
  if (r.why) yield ['the "why we make this" card', `${r.why.title} ${r.why.body}`];
  for (const [i, l] of r.ingredients.entries()) {
    if (l.name) yield [`ingredient ${i + 1}`, l.name];
    if (l.prep) yield [`ingredient ${i + 1}`, l.prep];
    if (l.text) yield [`ingredient ${i + 1}`, l.text];
  }
  for (const [i, s] of r.steps.entries()) for (const f of ['text', 'tip', 'hazard', 'timerLabel']) if (s[f]) yield [`step ${i + 1}`, s[f]];
  for (const [i, s] of r.steps.entries()) if (s.target?.look) yield [`step ${i + 1}`, s.target.look];
}

// What's wrong with a recipe, as sentences a parent can act on. Empty means it
// can be saved. ctx: { ingredients, equipment (registry maps), rules }.
// The hard block (CLAUDE.md, §2.1) has no exception: a registry ingredient is
// checked by species, and every word goes through the blocked-word scan.
export function recipeProblems(r, ctx) {
  const out = [];
  const add = (m) => { if (!out.includes(m)) out.push(m); };
  if (!r.title) add('Give the recipe a title.');
  if (!Number.isInteger(r.servings) || r.servings < 1 || r.servings > LIMITS.servings) add(`Servings is a whole number from 1 to ${LIMITS.servings}.`);
  if (!Number.isInteger(r.totalMinutes) || r.totalMinutes < 1 || r.totalMinutes > LIMITS.minutes) add('Total time is a number of minutes.');
  if (!MEAL_TYPES.some(([k]) => k === r.mealType)) add('Pick a meal type.');
  if (!r.ingredients.length) add('Add at least one ingredient.');
  if (!r.steps.length) add('Add at least one step.');

  // the hard block
  for (const [where, t] of texts(r)) for (const w of blockedWordsIn(t, ctx.rules)) add(`${where[0].toUpperCase()}${where.slice(1)} names "${w}", which is an unclean food. It can't be in any recipe.`);
  for (const [i, l] of r.ingredients.entries()) {
    const at = `Ingredient ${i + 1}`;
    if (l.ingredient) {
      const ing = ctx.ingredients[l.ingredient];
      if (!ing) { add(`${at} isn't in the ingredient list. Pick it again, or type it in.`); continue; }
      if (uncleanReasons(ing, ctx.rules).length) add(`${at}, ${ing.name}, is an unclean food. It can't be in any recipe.`);
      if (l.amount !== null && (!(l.amount > 0) || toBase(1, l.unit, ing) == null)) add(`${at}, ${ing.name}: pick an amount and a unit it can be measured in.`);
    } else {
      if (!l.name) add(`${at} needs a name.`);
      if (l.amount !== null && (!(l.amount > 0) || !UNITS.includes(l.unit))) add(`${at}${l.name ? `, ${l.name}` : ''}: pick an amount and a unit.`);
    }
  }
  for (const q of r.equipment) if (!ctx.equipment[q]) add('A tool on the list isn\'t in the tool list. Pick it again.');

  // steps and food safety (§3)
  for (const [i, s] of r.steps.entries()) {
    const at = `Step ${i + 1}`;
    if (!s.text) add(`${at} needs some words.`);
    if (!SAFETY.includes(s.safety)) add(`${at} needs a safety level.`);
    else if (s.safety !== 'solo' && !s.hazard) add(`${at} needs the hazard, like "Hot oven" or "Sharp knife", for adult profiles.`);
    if (s.timerSeconds && (s.timerSeconds < 1 || s.timerSeconds > LIMITS.timer || !s.timerLabel)) add(`${at}: a timer needs a length and a short name.`);
    if (s.target?.temp != null && !(s.target.temp >= 100 && s.target.temp <= 400)) add(`${at}: the thermometer temperature should be between 100°F and 400°F.`);
    if (s.type === 'doneness' && s.target?.look === '') add(`${at}: say what it looks like when it's done.`);
  }
  const raw = r.ingredients.map((l) => l.ingredient && ctx.ingredients[l.ingredient]).filter((ing) => ing?.rawHandling);
  if (raw.length) {
    if (!r.steps.some((s) => s.raw)) add(`Mark the step where the raw ${raw.map((x) => x.name.toLowerCase()).join(', ')} ${raw.length > 1 ? 'are' : 'is'} handled, so a wash-hands step follows it.`);
    const done = r.steps.filter((s) => s.type === 'doneness');
    if (!done.length) add('Add a doneness check: a step that says how to tell it\'s cooked through.');
    for (const ing of raw) {
      const min = safeMin(ing.id, ing.rawHandling);
      if (min == null) continue;
      const best = Math.max(0, ...done.map((s) => s.target?.temp ?? 0));
      if (best < min) add(`${ing.name} needs a doneness check with a thermometer target of at least ${min}°F.`);
    }
  }
  return out;
}

// A recipe in the shape of a lesson file, for the player, scaling, diet
// filters, and the shopping list. A typed-in ingredient gets an id of its own
// (`typed-<recipe>-<n>`) and an entry in `extra`, which goes beside the
// registry: it scales as a plain number and isn't merged with anything.
export function recipeLesson(id, r) {
  const extra = {};
  const short = id.replace(/^recipe:/, '');
  const ingredients = r.ingredients.map((l, i) => {
    const { name, ...line } = l;
    if (l.ingredient) return line;
    const tid = `typed-${short}-${i + 1}`;
    extra[tid] = {
      id: tid, name, section: 'specialty', contains: [], typed: true,
      baseUnit: l.amount == null ? 'count' : { volume: 'ml', weight: 'g', count: 'count' }[family(l.unit)] ?? 'count',
    };
    return { ...line, ingredient: tid };
  });
  const lesson = {
    id, version: r.version ?? 1, track: 'family', recipe: true,
    title: r.title, image: `meals/${r.mealType}.svg`, cuisine: 'Our family', skill: MEAL_TYPES.find(([k]) => k === r.mealType)?.[1] ?? '',
    skills: [], prereqs: [], servings: r.servings, totalMinutes: r.totalMinutes, scaling: { mode: 'free', min: 1, max: LIMITS.servings },
    learn: { move: r.why ? { title: r.why.title, body: r.why.body } : null, why: [], wrong: [] },
    ingredients, substitutions: [], equipment: r.equipment,
    steps: r.steps.map(({ raw, ...s }) => s),
    mealType: r.mealType,
  };
  return { lesson, extra };
}
