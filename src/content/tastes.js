// Tastes and tags (plan §6.21). Profiles rate proteins, flavors, and key
// ingredients (content/tastes.json); every dish carries tags in the same
// words, so ratings can pick the best dish and show where one is missing.
//
// A dish's tags sit beside its dish card: on its course.json entry, or on the
// lesson itself for a seasonal lesson (§6.19). The owner sets them; protein
// is checked against a written lesson's ingredients, and its key ingredients
// are worked out from them.

export const HEAT = [['mild', 'Mild'], ['some', 'Some heat'], ['spicy', 'Spicy']];
export const BUDGET = [['$', '$ (under $3 a serving)'], ['$$', '$$ ($3–6 a serving)'], ['$$$', '$$$ (over $6 a serving)']];
export const FAMILIAR = [['everyday', 'Everyday'], ['new-ish', 'New-ish'], ['adventurous', 'Adventurous']];
// How much of the meal is vegetables (owner, 2026-10-24), across flavors: a
// smoky chili and a lemony salad can both have lots.
export const VEGGIES = [['light', 'Light'], ['some', 'Some'], ['lots', 'Lots']];
// The one rated item it's matched against: profiles rate it like a flavor.
export const VEGGIE_RATING = { id: 'veggie-heavy', name: 'Meals heavy on vegetables', examples: ['a big chopped salad', 'vegetable stir-fry', 'ratatouille', 'minestrone'] };
// A dish with no main protein: a side, a bread, a dessert.
export const NO_PROTEIN = 'none';
export const TAG_KEYS = ['protein', 'flavors', 'heat', 'budget', 'familiar', 'veggies'];

// The tastes lists, from the content (contentFromFiles puts them on c.tastes).
export const tastesOf = (all) => ({ proteins: all.tasteProteins ?? [], flavors: all.tasteFlavors ?? [], ingredients: all.tasteIngredients ?? [] });

// What's wrong with a dish's tags, as messages. Missing tags are reported
// separately (missingTags), as a warning: a dish isn't refused for them.
export function tagProblems(tags, tastes) {
  if (tags == null) return [];
  const out = [];
  const ids = (list) => new Set(list.map((x) => x.id));
  const proteins = ids(tastes.proteins), flavors = ids(tastes.flavors);
  if (tags.protein != null && tags.protein !== NO_PROTEIN && !proteins.has(tags.protein)) out.push(`protein "${tags.protein}" isn't in tastes.json`);
  if (tags.flavors != null) {
    if (!Array.isArray(tags.flavors) || tags.flavors.length > 3) out.push('flavors lists 1 to 3 flavors');
    else for (const f of tags.flavors) if (!flavors.has(f)) out.push(`flavor "${f}" isn't in tastes.json`);
  }
  for (const [k, list] of [['heat', HEAT], ['budget', BUDGET], ['familiar', FAMILIAR], ['veggies', VEGGIES]]) {
    if (tags[k] != null && !list.some(([v]) => v === tags[k])) out.push(`${k} "${tags[k]}" isn't one of ${list.map(([v]) => v).join(', ')}`);
  }
  for (const k of Object.keys(tags)) if (!TAG_KEYS.includes(k)) out.push(`"${k}" isn't a tag`);
  return out;
}

export const missingTags = (tags) => TAG_KEYS.filter((k) => tags?.[k] == null || (k === 'flavors' && !tags.flavors.length));

// The taste items (proteins or key ingredients) a lesson uses, split into
// required and optional lines.
export function tasteItemsIn(lesson, list) {
  const required = new Set(), optional = new Set();
  for (const line of lesson.ingredients ?? []) {
    for (const item of list) if (item.ingredients.includes(line.ingredient)) (line.optional ? optional : required).add(item.id);
  }
  for (const id of required) optional.delete(id);
  return { required: [...required], optional: [...optional] };
}

// The meat or fish a written lesson is built on, by its ingredients: the
// first required one on a protein's list in tastes.json (broth and sauces
// aren't on them). null when it has none: eggs, beans, and the rest are the
// owner's call.
export function meatProtein(lesson, registry, tastes) {
  for (const line of lesson.ingredients ?? []) {
    if (line.optional || registry[line.ingredient]?.animalPart !== 'meat') continue;
    const item = tastes.proteins.find((p) => p.ingredients.includes(line.ingredient));
    if (item) return item.id;
  }
  return null;
}
