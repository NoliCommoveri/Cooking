// Copied from src/content/shop.js by tools/build-library.js. Don't edit here.
// What lessons need, and the shopping list (plan §6.3): lessons each at their
// own serving count with the family's diet swaps, merged by ingredient,
// rounded up to what the store sells, and grouped by store section. Shared by
// the Worker and the demo page's preview.
import { dietView } from './diet.js';
import { feastView, withFeast } from './leaven.js';
import { scaleLesson } from './scale.js';
import { family, toBase, formatVolume, formatWeight, formatButter, mixed } from './units.js';

// Store sections, in the order a list walks them (§6.3).
export const SECTIONS = [
  ['produce', 'Produce'], ['herbs', 'Herbs'], ['meat-fish', 'Meat and fish'], ['dairy-eggs', 'Dairy and eggs'],
  ['bread-tortillas', 'Bread and tortillas'], ['grains-pasta', 'Grains and pasta'], ['canned-jarred', 'Canned and jarred'],
  ['sauces', 'Sauces'], ['oils-vinegars', 'Oils and vinegars'], ['baking', 'Baking'], ['spices', 'Spices'],
  ['specialty', 'Specialty'], ['frozen', 'Frozen'],
];

// How much was used, said the way a cook measures it.
function usedText(ing, base) {
  if (ing.measure === 'butter') return formatButter(base);
  // Bought and measured in its own package, like a can of tomatoes.
  const [pkg] = Object.values(ing.units ?? {});
  if (pkg) {
    const n = Math.max(0.5, Math.round((base / pkg.amount) * 2) / 2);
    return `${mixed(n)} ${n > 1 ? pkg.many : pkg.one}`;
  }
  if (ing.baseUnit === 'ml') return formatVolume(base);
  if (ing.baseUnit === 'g') return formatWeight(base);
  const n = Math.ceil(base - 1e-9);
  return `${mixed(n)} ${ing.countLabel ? (n === 1 ? ing.countLabel.one : ing.countLabel.many) : ing.name.toLowerCase()}`;
}

// What to put in the cart: whole packages, enough for everything.
function buyText(ing, base) {
  const p = ing.purchaseUnit;
  if (!p) return usedText(ing, base);
  const packs = Math.max(1, Math.ceil(base / p.amount - 1e-9));
  if (p.byWeight) return formatWeight(packs * p.amount);
  // "2 × 28-oz can" reads better than "2 28-oz cans".
  if (/^\d/.test(p.label)) return `${packs} × ${p.label}`;
  return `${mixed(packs)} ${packs === 1 ? p.label : p.many}`;
}

// lessons: [{ lesson, servings, leaveOut?, feast? }]. leaveOut: optional ingredient
//   ids someone on the cook rated 1 star (plan §6.21), left out like a diet's.
//   feast: it's cooked on the family's unleavened days (§6.20), so its
//   unleavened swaps are bought instead, by their ratio. leaven: the leaven list.
// registry: ingredients by id. filters: the family's diet filters.
// staples: the family's kitchen staples, grouped first as "May already have"
//   for checking the cupboard (owner, 2026-10-23). A finished list passes none,
//   so each is in its store aisle: staples get shopped for too.
// skip: ingredient ids to leave out (what the parent said they have on hand).
// Returns { sections: [{ id, name, items }], may_have: [items] }.
// An item: { id, name, buy, used, from: [titles], optional, amountless }.
export function shoppingList({ lessons, registry, filters = [], staples = [], skip = [], leaven = null }) {
  const items = new Map();
  const staple = new Set(staples), skipped = new Set(skip);
  for (const { lesson: L, servings, leaveOut = [], feast = false } of lessons) {
    let view = dietView(L, registry, filters);
    const fv = feast && leaven ? feastView(L, registry, filters, leaven) : null;
    if (fv?.ok) view = withFeast(view, fv);
    const ratio = Object.fromEntries((view.feast ?? []).map((x) => [x.for, x.ratio ?? 1]));
    const swap = Object.fromEntries(view.applied.map((x) => [x.for, x.use]));
    const leftOut = new Set([...view.leftOut, ...leaveOut]);
    const scaled = scaleLesson(L, registry, servings);
    const f = servings / L.servings;
    L.ingredients.forEach((line, k) => {
      if (leftOut.has(line.ingredient)) return;
      const id = swap[line.ingredient] ?? line.ingredient;
      const ing = registry[id];
      // Water from the tap is never shopped for.
      if (!ing || skipped.has(id) || ing.section === 'tap') return;
      if (!items.has(id)) items.set(id, { id, ing, base: 0, texts: [], from: [], optional: true });
      const it = items.get(id);
      if (!line.optional) it.optional = false;
      if (!it.from.includes(L.title)) it.from.push(L.title);
      if (line.amount == null) { it.texts.push(scaled.ingredients[k].amount); return; }
      const x = (line.scale === false ? line.amount : line.amount * f) * (ratio[line.ingredient] ?? 1);
      // Counts round the way the recipe does (2.4 eggs is 3 eggs in the bowl).
      const fam = family(line.unit);
      const amount = fam === 'count' || fam === 'package' ? (ratio[line.ingredient] ? Math.ceil(x) : (scaled.ingredients[k].n ?? x)) : x;
      const base = toBase(amount, line.unit, ing) ?? toBase(amount, line.unit, registry[line.ingredient]);
      if (base == null) it.texts.push(scaled.ingredients[k].amount); else it.base += base;
    });
  }
  const all = [...items.values()].map((it) => ({
    id: it.id, name: it.ing.name, section: it.ing.section,
    buy: it.base ? buyText(it.ing, it.base) : null,
    used: it.base ? usedText(it.ing, it.base) : it.texts[0] ?? null,
    from: it.from, optional: it.optional, amountless: !it.base,
  }));
  return {
    sections: SECTIONS.map(([id, name]) => ({ id, name, items: all.filter((x) => x.section === id && !staple.has(x.id)) })).filter((x) => x.items.length),
    may_have: all.filter((x) => staple.has(x.id)),
  };
}
