// Units and kitchen-measurable display (plan §6.6–6.7).
// Amounts are stored per line in the unit the recipe author used. Scaling stays in
// that unit's family (volume, weight, count, or a package unit from the registry),
// and display turns the result into what a US measuring set can actually measure.

export const VOLUME = { tsp: 4.92892, tbsp: 14.7868, cup: 236.588, floz: 29.5735, ml: 1, l: 1000 };
export const WEIGHT = { oz: 28.3495, lb: 453.592, g: 1, kg: 1000 };
export const BASE_UNITS = ['g', 'ml', 'count'];

export function family(unit) {
  if (unit in VOLUME) return 'volume';
  if (unit in WEIGHT) return 'weight';
  if (unit === 'count') return 'count';
  return 'package';
}

// Amount of `unit` expressed in the ingredient's base unit, or null when there's no conversion.
export function toBase(amount, unit, ing) {
  const conv = ing.conversions || {};
  const pkg = (ing.units || {})[unit];
  if (pkg) return amount * pkg.amount;
  const fam = family(unit);
  if (fam === 'volume') return ing.baseUnit === 'ml' ? amount * VOLUME[unit] : unit in conv ? amount * conv[unit] : null;
  if (fam === 'weight') return ing.baseUnit === 'g' ? amount * WEIGHT[unit] : unit in conv ? amount * conv[unit] : null;
  if (fam === 'count') return ing.baseUnit === 'count' ? amount : 'count' in conv ? amount * conv.count : null;
  return unit in conv ? amount * conv[unit] : null;
}

const FRAC = [[0, ''], [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']];
const glyph = f => (FRAC.find(([v]) => Math.abs(v - f) < 1e-6) || [0, ''])[1];

// "2 ¼", "¾", "3"
export function mixed(x) {
  const w = Math.floor(x + 1e-9), f = x - w, g = glyph(f);
  if (!w) return g || '0';
  return g ? `${w} ${g}` : String(w);
}

// Round to the nearest value on a grid of allowed fractions.
function snap(x, fracs) {
  const w = Math.floor(x);
  let best = w, err = Infinity;
  for (const f of [...fracs, 1]) {
    const v = w + f, e = Math.abs(v - x);
    if (e < err) { best = v; err = e; }
  }
  return best;
}

function tspText(tsp) {
  const v = snap(tsp, tsp < 0.5 ? [0, 1 / 8, 1 / 4, 3 / 8] : [0, 1 / 4, 1 / 2, 3 / 4]);
  if (v === 3 / 8) return '¼ tsp + ⅛ tsp';
  return `${mixed(v)} tsp`;
}

function tbspText(tsp) {
  let tb = Math.floor((tsp + 0.125) / 3), rest = tsp - tb * 3;
  let r = snap(rest, [0, 1 / 4, 1 / 2, 3 / 4]);
  if (r >= 3) { tb += 1; r = 0; }
  if (!tb) return tspText(rest);
  return r ? `${tb} tbsp + ${mixed(r)} tsp` : `${tb} tbsp`;
}

// Volume in ml → "2 ¼ cups", "1 tbsp + ½ tsp", "¾ tsp", "pinch"
export function formatVolume(ml) {
  const tsp = ml / VOLUME.tsp;
  if (tsp < 0.09) return 'a pinch';
  if (tsp < 3 - 0.125) return tspText(tsp);
  if (tsp < 12 - 0.5) return tbspText(tsp);
  const cups = tsp / 48, w = Math.floor(cups + 1e-9), f = cups - w;
  // a measuring-cup fraction that doesn't overshoot by more than a teaspoon, preferring one
  // that leaves nothing over, then one whose leftover is whole tablespoons, then the largest
  let pick = 0, best = Infinity;
  for (const v of [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4]) {
    if (v > f + 1 / 48) continue;
    const rest = (f - v) * 48, off = Math.abs(rest / 3 - Math.round(rest / 3));
    const score = rest < 0.875 ? 0 : off < 0.1 ? 1 : 2;
    if (score <= best) { best = score; pick = v; }
  }
  if (f > 1 - 1 / 48) return `${w + 1} ${w + 1 === 1 ? 'cup' : 'cups'}`;
  const total = w + pick, restTsp = (f - pick) * 48;
  const word = total > 1 ? 'cups' : 'cup';
  if (restTsp < 0.875) return `${mixed(total)} ${word}`;
  return `${mixed(total)} ${word} + ${tbspText(restTsp)}`;
}

// Weight in g → "12 oz", "2 ½ lb"
export function formatWeight(g) {
  const oz = g / WEIGHT.oz;
  if (oz < 15.75) {
    const v = oz < 4 ? snap(oz, [0, 1 / 2]) : Math.round(oz);
    return `${mixed(Math.max(v, 0.5))} oz`;
  }
  return `${mixed(snap(oz / 16, [0, 1 / 4, 1 / 2, 3 / 4]))} lb`;
}

// Butter in g → "1 stick + 2 tbsp", "2 sticks (16 tbsp)", "6 tbsp"
export function formatButter(g) {
  const tbsp = Math.round(g / 14.2);
  const sticks = Math.floor(tbsp / 8), rest = tbsp - sticks * 8;
  if (!sticks) return `${Math.max(tbsp, 1)} tbsp`;
  const s = `${sticks} ${sticks === 1 ? 'stick' : 'sticks'}`;
  return rest ? `${s} + ${rest} tbsp` : `${s} (${tbsp} tbsp)`;
}

export function roundCount(x, mode = 'nearest', min = 1) {
  const v = mode === 'up' ? Math.ceil(x - 1e-9) : mode === 'down' ? Math.floor(x + 1e-9) : Math.round(x);
  return Math.max(min, v);
}
