// Scoring (plan §6.21, slice 11d1): how well a dish, or a version of one,
// fits the people cooking it, from their star ratings and the family's limits.
//
// On the main track nothing is ruled out; dishes are only ranked (owner,
// 2026-10-24). A 1 star on a version's main protein or a required key
// ingredient makes it "Doesn't fit": it goes below every version that fits,
// but it stays. Family limits (time, budget, tools) only take points off, with
// a note, so a dish over them loses to one within them and is kept when it's
// the only dish for its skill.
//
// A dish here is a lesson summary from the library (tags, tasteItems,
// totalMinutes, tools) or a planned dish from the course outline (tags and
// minutes only). Only dishes that pass the unclean-food block and the family's
// diet filters are ever scored; that's the caller's job.

// Draft weights (Claude, 2026-10-24), kept here to tune.
export const WEIGHTS = {
  stars: { 5: 3, 4: 2, 3: 1, 2: 0, 1: -3 },
  // Haven't tried, by how adventurous the family is. An item never rated is 0.
  untried: { adventurous: 0.5, 'a-bit': 0, familiar: -0.5 },
  veggies: { lots: 1, some: 0.5, light: 0 },
  // A familiar family, on a dish tagged adventurous.
  adventurousDish: -1,
  minutesStep: 15, perStepOver: -1,
  perBudgetOver: -1,
  perMissingTool: -2,
  // Learning from Reflect (11d3): each cook counts its own rating (1 to 5 as
  // -2 to +2) plus half the eaters', capped at ±2, times this; an item's sum
  // is capped at ±2.
  learnedPerCook: 0.5, learnedCap: 2,
};
// The fit words, from the score (the average over the profiles on the cook).
export const FITS = [['great', 2, 'Great fit'], ['good', 0.5, 'Good fit'], ['poor', -Infinity, 'Not a great fit']];
export const NO_FIT = "Doesn't fit";
const BUDGETS = ['$', '$$', '$$$'];
const HATE = 1, LOVE = 4;

const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const andList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// One rating as points. undefined: never rated; null: Haven't tried.
function points(stars, adventurous) {
  if (stars === undefined) return { pts: 0, known: false };
  if (stars === null) return { pts: WEIGHTS.untried[adventurous] ?? 0, known: true };
  return { pts: WEIGHTS.stars[stars] ?? 0, known: true };
}

// Scores one dish or version for the cook.
//   dish: { tags, tasteItems?, totalMinutes? | minutes?, tools? }
//   dish.cuisine, when it has one, is matched against what's been learned.
//   ctx: { profiles: [{ id, name, ratings: { protein, flavor, ingredient },
//                      learned?: { protein, flavor, cuisine } }],
//          limits: { max_minutes, budget, missing_tools, adventurous },
//          names: { protein: { id: name }, flavor, ingredient, tool } }
// Returns { fits, score, low, fit, label, why: [..], notes: [..], known,
// hated: ['protein:beef', ..], over: ['time', 'budget', 'tool:<id>'] }:
// fits is false for a 1 star on its protein or a required key ingredient
// (notes say whose); score is the average over the profiles, plus the family's
// adjustments; low is the least-happy profile's, for ties; known is whether
// any rating or limit was used, so a family that hasn't rated anything gets no
// fit word. hated and over are the reasons with no names in them.
export function scoreDish(dish, ctx) {
  const tags = dish.tags ?? {};
  const limits = ctx.limits ?? {};
  const adv = limits.adventurous ?? null;
  const names = ctx.names ?? {};
  const name = (kind, id) => lower(names[kind]?.[id] ?? id);
  const required = dish.tasteItems?.required ?? [];
  const flavors = tags.flavors ?? [];
  const protein = tags.protein && tags.protein !== 'none' ? tags.protein : null;
  const hates = [], loves = {}, notes = [], liked = {};
  // The same reasons with no names, for counts (Recipe gaps, 11e).
  const hated = new Set(), over = [];
  let known = false;
  const per = [];
  for (const p of ctx.profiles ?? []) {
    const r = p.ratings ?? {};
    const rate = (kind, id) => {
      const stars = r[kind]?.[id];
      const x = points(stars, adv);
      if (x.known) known = true;
      if (stars >= LOVE) (loves[`${kind}:${id}`] ??= []).push(p.name);
      return { ...x, stars };
    };
    let s = 0;
    if (protein) {
      const x = rate('protein', protein);
      if (x.stars === HATE) { hates.push(`${p.name}: 1 star on ${name('protein', protein)}`); hated.add(`protein:${protein}`); }
      s += x.pts;
    }
    s += avg(flavors.map((f) => rate('flavor', f).pts));
    s += avg(required.map((i) => {
      const x = rate('ingredient', i);
      if (x.stars === HATE) { hates.push(`${p.name}: 1 star on ${name('ingredient', i)}`); hated.add(`ingredient:${i}`); }
      return x.pts;
    }));
    if (WEIGHTS.veggies[tags.veggies]) s += rate('flavor', 'veggie-heavy').pts * WEIGHTS.veggies[tags.veggies];
    // What Reflect ratings have taught (11d3): its protein, its flavors on
    // average, and its cuisine. Cuisines are never asked, only learned.
    const l = p.learned ?? {};
    const learnt = (kind, id) => {
      const v = l[kind]?.[id];
      if (v) known = true;
      return v ?? 0;
    };
    if (protein) s += learnt('protein', protein);
    s += avg(flavors.map((f) => learnt('flavor', f)));
    if (dish.cuisine) {
      const c = learnt('cuisine', dish.cuisine);
      if (c >= 1) (liked[dish.cuisine] ??= []).push(p.name);
      s += c;
    }
    per.push(s);
  }
  let adjust = 0;
  if (adv === 'familiar' && tags.familiar === 'adventurous') { adjust += WEIGHTS.adventurousDish; known = true; }
  const minutes = dish.totalMinutes ?? dish.minutes ?? null;
  if (limits.max_minutes && minutes > limits.max_minutes) {
    adjust += WEIGHTS.perStepOver * Math.ceil((minutes - limits.max_minutes) / WEIGHTS.minutesStep);
    notes.push(`Takes ${minutes} minutes; your nights are ${limits.max_minutes}`);
    over.push('time');
    known = true;
  }
  const pricier = limits.budget && tags.budget ? BUDGETS.indexOf(tags.budget) - BUDGETS.indexOf(limits.budget) : 0;
  if (pricier > 0) {
    adjust += WEIGHTS.perBudgetOver * pricier;
    over.push('budget');
    notes.push(`${tags.budget} a serving; your budget is ${limits.budget}`);
    known = true;
  }
  const missing = (dish.tools ?? []).filter((t) => (limits.missing_tools ?? []).includes(t));
  if (missing.length) {
    adjust += WEIGHTS.perMissingTool * missing.length;
    notes.push(`Needs ${andList(missing.map((t) => names.tool?.[t] ?? t).map(lower))}`);
    over.push(...missing.map((t) => `tool:${t}`));
    known = true;
  }
  const score = avg(per) + adjust;
  const fits = hates.length === 0;
  const fit = !fits ? 'none' : !known ? null : FITS.find(([, min]) => score >= min)[0];
  // Why it scores well: who loves its protein, then its flavors, two at most.
  const why = Object.entries(loves)
    .sort(([a], [b]) => (a.startsWith('protein:') ? -1 : 0) - (b.startsWith('protein:') ? -1 : 0))
    .slice(0, 2)
    .map(([key, who]) => {
      const [kind, id] = key.split(':');
      return `${andList(who)} love${who.length === 1 ? 's' : ''} ${name(kind, id)}`;
    });
  for (const [c, who] of Object.entries(liked)) if (why.length < 2) why.push(`${andList(who)} enjoyed cooking ${names.cuisine?.[c] ?? c}`);
  return {
    fits, score: Math.round(score * 100) / 100, low: per.length ? Math.min(...per) + adjust : adjust,
    fit, label: fit === 'none' ? NO_FIT : FITS.find(([k]) => k === fit)?.[2] ?? null,
    why: fits ? why : [], notes: [...hates, ...notes], known,
    hated: [...hated], over,
  };
}

// What a profile's cooks have taught (11d3), from its reflections. cooks:
// [{ rating, eater, tags, cuisine }], one for each finished cook it was on.
// Returns { protein: { id: adjust }, flavor: {..}, cuisine: {..} } with cook
// counts beside: { adjust, cooks } per item.
export function learnedFrom(cooks) {
  const out = { protein: {}, flavor: {}, cuisine: {} };
  const clamp = (v) => Math.max(-WEIGHTS.learnedCap, Math.min(WEIGHTS.learnedCap, v));
  for (const c of cooks) {
    if (c.rating == null && c.eater == null) continue;
    const v = clamp((c.rating == null ? 0 : c.rating - 3) + (c.eater == null ? 0 : (c.eater - 3) / 2));
    const add = (kind, id) => {
      const x = (out[kind][id] ??= { sum: 0, cooks: 0 });
      x.sum += v; x.cooks += 1;
    };
    if (c.tags?.protein && c.tags.protein !== 'none') add('protein', c.tags.protein);
    for (const f of c.tags?.flavors ?? []) add('flavor', f);
    if (c.cuisine) add('cuisine', c.cuisine);
  }
  for (const kind of Object.keys(out)) {
    for (const [id, x] of Object.entries(out[kind])) out[kind][id] = { adjust: Math.round(clamp(x.sum * WEIGHTS.learnedPerCook) * 100) / 100, cooks: x.cooks };
  }
  return out;
}

// Best first: versions that fit before ones that don't, then by score, then
// the least-happy profile's score, then the order they were given in.
export const better = (a, b) => (Number(b.fits) - Number(a.fits)) || (b.score - a.score) || (b.low - a.low);

export function rank(items, scoreOf) {
  return items.map((x, i) => ({ x, s: scoreOf(x), i }))
    .sort((a, b) => better(a.s, b.s) || a.i - b.i)
    .map(({ x, s }) => ({ ...x, ...s }));
}

// A lesson's versions, best first: the lesson itself (id '') and each
// variation. A variation with no tags of its own uses the lesson's.
export function rankVersions(lesson, ctx) {
  const versions = [
    { ...lesson, id: '', title: lesson.title },
    ...(lesson.variations ?? []).map((v) => ({ ...v, tags: v.tags ?? lesson.tags })),
  ];
  return rank(versions, (v) => scoreDish(v, ctx)).map(({ id, title, fits, score, low, fit, label, why, notes, known }) => ({ id, title, fits, score, low, fit, label, why, notes, known }));
}
