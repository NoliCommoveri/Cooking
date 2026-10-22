// Scales a lesson to a serving count (plan §6.6) and fills the step text.
// Step text can say {n:egg} (just the scaled count) or {qty:egg} (amount and label).
import { VOLUME, WEIGHT, family, toBase, mixed, formatVolume, formatWeight, formatButter, roundCount } from './units.js';

export const FREE_MAX = 12;

// "Olive oil" → "olive oil", but leaves names like "Asian pear" alone
const lowerFirst = s => /^[A-Z][a-z]/.test(s) && !/^(Asian|Bosc|Greek|Italian|French)\b/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

export function servingOptions(lesson) {
  const s = lesson.scaling;
  if (s.mode === 'fixed') return s.multipliers.map(m => m * lesson.servings);
  const out = [];
  for (let n = s.min ?? 1; n <= (s.max ?? FREE_MAX); n++) out.push(n);
  return out;
}

function scaleLine(line, ing, f) {
  const k = line.scale === false ? 1 : f;
  if (line.amount == null) return { amount: line.text || 'to taste', label: ing.name, n: null };
  const x = line.amount * k, fam = family(line.unit);
  if (fam === 'count') {
    const n = roundCount(x, line.round, line.min ?? 1);
    const lab = ing.countLabel ? (n === 1 ? ing.countLabel.one : ing.countLabel.many) : ing.name;
    return { amount: String(n), label: lab, n };
  }
  if (fam === 'package') {
    const pkg = ing.units[line.unit];
    const v = line.round ? roundCount(x, line.round, line.min ?? 1) : Math.max(0.5, Math.round(x * 2) / 2);
    return { amount: `${mixed(v)} ${v > 1 ? pkg.many : pkg.one}`, label: ing.name, n: v };
  }
  if (ing.measure === 'butter') return { amount: formatButter(toBase(x, line.unit, ing)), label: ing.name, n: null };
  if (fam === 'volume') return { amount: formatVolume(x * VOLUME[line.unit]), label: ing.name, n: null };
  return { amount: formatWeight(x * WEIGHT[line.unit]), label: ing.name, n: null };
}

export function fill(text, lines) {
  if (text == null) return text;
  return text.replace(/\{(n|qty):([a-z0-9-]+)\}/g, (m, kind, id) => {
    const l = lines[id];
    if (!l) throw new Error(`Placeholder ${m} names an ingredient the lesson doesn't use`);
    if (kind === 'n') return l.n == null ? l.amount : mixed(l.n);
    return l.n != null && l.label ? `${l.amount} ${l.label}` : l.amount;
  });
}

export function scaleLesson(lesson, registry, servings) {
  const f = servings / lesson.servings, s = lesson.scaling;
  let note = null;
  if (s.mode === 'fixed') {
    const m = s.multipliers.find(v => Math.abs(v - f) < 1e-9);
    if (m === undefined) throw new Error(`${lesson.id} can't be made for ${servings}; sizes are ${servingOptions(lesson).join(', ')}`);
    note = (s.notes || {})[String(m)] || null;
  } else {
    for (const n of s.notes || []) if (servings >= n.from) note = n.text;
  }
  const byId = {}, ingredients = lesson.ingredients.map(line => {
    const ing = registry[line.ingredient];
    const r = scaleLine(line, ing, f);
    if (!byId[line.ingredient]) byId[line.ingredient] = r;
    // one readable line: "3 tbsp olive oil", "2 large eggs", "Black pepper, a few grinds"
    const said = line.amount == null ? `${ing.name}, ${r.amount}` : r.n != null && ing.countLabel ? `${r.amount} ${r.label}` : `${r.amount} ${lowerFirst(ing.name)}`;
    return { id: line.ingredient, amount: r.amount, name: r.label, line: said, prep: line.prep || null, group: line.group || null, optional: !!line.optional };
  });
  const steps = lesson.steps.map(st => ({
    ...st,
    text: fill(st.text, byId), tip: fill(st.tip, byId), look: fill(st.look, byId), check: fill(st.check, byId)
  }));
  return { servings, multiplier: f, note: fill(note, byId), ingredients, steps };
}
