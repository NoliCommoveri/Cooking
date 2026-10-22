// The shopping list (plan §6.3): a trip's lessons, each at its own serving
// count with the family's diet swaps, merged by ingredient, pantry staples set
// aside, rounded up to what the store sells, and grouped by store section.
// Shared by the Worker (trips), and the demo page's preview.
import { dietView } from './diet.js';
import { scaleLesson } from './scale.js';
import { family, toBase, formatVolume, formatWeight, formatButter, mixed } from './units.js';

// Store sections, in the order a list walks them (§6.3).
export const SECTIONS = [
  ['produce', 'Produce'], ['herbs', 'Herbs'], ['meat-fish', 'Meat and fish'], ['dairy-eggs', 'Dairy and eggs'],
  ['bread-tortillas', 'Bread and tortillas'], ['grains-pasta', 'Grains and pasta'], ['canned-jarred', 'Canned and jarred'],
  ['sauces', 'Sauces'], ['oils-vinegars', 'Oils and vinegars'], ['baking', 'Baking'], ['spices', 'Spices'],
  ['specialty', 'Specialty'], ['frozen', 'Frozen'],
];

const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);

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

// lessons: [{ lesson, servings, date }] where date is the day it's planned
//   for ('YYYY-MM-DD') or null.
// registry: ingredients by id. filters: the family's diet filters.
// pantry: ingredient ids always on hand. today and perishDays: perishables
//   show only for lessons within this many days (§6.3 step 8).
// Returns { sections: [{ id, name, items }], have: [items], later: [items] }.
// An item: { id, name, buy, used, from: [titles], perishable, no_date, optional, amountless }.
export function shoppingList({ lessons, registry, filters = [], pantry = [], today = null, perishDays = 7 }) {
  const items = new Map(), later = new Map();
  const staple = new Set(pantry);
  for (const { lesson: L, servings, date } of lessons) {
    const view = dietView(L, registry, filters);
    const swap = Object.fromEntries(view.applied.map((x) => [x.for, x.use]));
    const leftOut = new Set(view.leftOut);
    const scaled = scaleLesson(L, registry, servings);
    const f = servings / L.servings;
    L.ingredients.forEach((line, k) => {
      if (leftOut.has(line.ingredient)) return;
      const id = swap[line.ingredient] ?? line.ingredient;
      const ing = registry[id];
      if (!ing) return;
      // A perishable for a lesson planned past the window waits for a later trip.
      const far = ing.perishable && date && today && daysBetween(today, date) > perishDays;
      const into = far ? later : items;
      if (!into.has(id)) into.set(id, { id, ing, base: 0, texts: [], from: [], optional: true, noDate: false });
      const it = into.get(id);
      if (!line.optional) it.optional = false;
      if (!it.from.includes(L.title)) it.from.push(L.title);
      if (ing.perishable && !date) it.noDate = true;
      if (line.amount == null) { it.texts.push(scaled.ingredients[k].amount); return; }
      const x = line.scale === false ? line.amount : line.amount * f;
      // Counts round the way the recipe does (2.4 eggs is 3 eggs in the bowl).
      const fam = family(line.unit);
      const amount = fam === 'count' || fam === 'package' ? (scaled.ingredients[k].n ?? x) : x;
      const base = toBase(amount, line.unit, ing) ?? toBase(amount, line.unit, registry[line.ingredient]);
      if (base == null) it.texts.push(scaled.ingredients[k].amount); else it.base += base;
    });
  }
  const out = (it) => ({
    id: it.id, name: it.ing.name, section: it.ing.section,
    buy: it.base ? buyText(it.ing, it.base) : null,
    used: it.base ? usedText(it.ing, it.base) : it.texts[0] ?? null,
    from: it.from, perishable: Boolean(it.ing.perishable), no_date: it.noDate, optional: it.optional, amountless: !it.base,
  });
  const all = [...items.values()].map(out);
  const sections = SECTIONS.map(([id, name]) => ({ id, name, items: all.filter((x) => x.section === id && !staple.has(x.id)) }))
    .filter((s) => s.items.length);
  return {
    sections,
    have: all.filter((x) => staple.has(x.id)),
    later: [...later.values()].filter((x) => !items.has(x.id)).map(out),
  };
}
