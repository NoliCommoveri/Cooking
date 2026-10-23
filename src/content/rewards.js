// Course progress and rewards (plan §5.2, §5.4, §5.4a, Phase 5). Nothing here is
// stored: stamps, skills, and rank all come from a profile's cooks and the
// content files (§8.4). The Worker leaves Sabbath cooks out of the cooks it
// sends (§6.18), so nothing cooked then earns anything.
//
// cooks: { lessonId: { times, first, last } } from /api/profiles/<id>/cooks.
// A family recipe ("recipe:<id>", "shared:<id>") counts as a dish toward rank,
// but earns no stamp or skill (owner, 2026-10-23).

// Dishes cooked for each rank (owner, 2026-10-23). Executive Chef is the whole
// course: 75 dishes (owner, 2026-10-23).
export const RANKS = [
  { name: 'Kitchen Apprentice', at: 0 },
  { name: 'Prep Cook', at: 5 },
  { name: 'Line Cook', at: 15 },
  { name: 'Sous Chef', at: 30 },
  { name: 'Head Chef', at: 50 },
  { name: 'Executive Chef', at: 75 },
];

// The rank for a number of dishes, and the next one (null at the top).
export function rankFor(dishes) {
  let index = 0;
  RANKS.forEach((r, i) => { if (dishes >= r.at) index = i; });
  return { index, ...RANKS[index], next: RANKS[index + 1] ? { index: index + 1, ...RANKS[index + 1] } : null };
}

const isRecipe = (id) => /^(recipe|shared):/.test(id);

// registry: /content/registry.json. course: /content/course.json.
// Returns { dishes, rank, stamps, regions, paths, skills }:
//   stamps   the library lessons cooked, each with its cuisine and first date
//   regions  passport pages: every planned dish (and Appointed Times lesson)
//            whose cuisine is in the region, cooked or not
//   paths    the skill tree: one path per unit, a node per planned dish
//   skills   every skill, with when it was first earned and every dish using it
export function rewards(cooks, registry, course) {
  const lessons = Object.fromEntries(registry.lessons.map((L) => [L.id, L]));
  const seasonal = new Set(registry.seasonal ?? []);
  // Every dish a stamp or node can be for: the planned course, then the
  // seasonal units' written lessons.
  const dishes = [
    ...course.dishes.map((d) => ({ id: d.id, title: d.title, unit: d.unit, cuisine: d.cuisine, skills: lessons[d.id]?.skills ?? d.skills ?? [] })),
    ...registry.lessons.filter((L) => seasonal.has(L.unit)).map((L) => ({ id: L.id, title: L.title, unit: L.unit, cuisine: L.cuisine, skills: L.skills ?? [] })),
  ];
  const known = new Set(dishes.map((d) => d.id));
  const done = (id) => cooks[id]?.first ?? cooks[id]?.last ?? null;

  const ids = Object.keys(cooks).filter((id) => cooks[id]?.times > 0);
  const counted = ids.filter((id) => known.has(id) || lessons[id] || isRecipe(id));
  const rank = rankFor(counted.length);

  const stamps = dishes.filter((d) => done(d.id)).map((d) => ({
    id: d.id, title: d.title, cuisine: d.cuisine, region: registry.cuisines[d.cuisine]?.region ?? null, date: done(d.id),
  })).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const regions = Object.values(registry.regions).map((r) => {
    const slots = dishes.filter((d) => registry.cuisines[d.cuisine]?.region === r.id).map((d) => ({ id: d.id, title: d.title, cuisine: d.cuisine, date: done(d.id) }));
    return { id: r.id, name: r.name, slots, done: slots.filter((s) => s.date).length };
  }).filter((r) => r.slots.length);

  const units = [...new Set(dishes.map((d) => d.unit))].sort((a, b) => a - b);
  const paths = units.map((u) => {
    const nodes = dishes.filter((d) => d.unit === u).map((d) => ({ id: d.id, title: d.title, date: done(d.id) }));
    return { unit: u, name: registry.units[u], seasonal: seasonal.has(u), nodes, done: nodes.filter((n) => n.date).length };
  });

  const skills = Object.values(registry.skills).map((s) => {
    const using = dishes.filter((d) => d.skills.includes(s.id)).map((d) => ({ id: d.id, title: d.title, date: done(d.id) }));
    const dates = using.map((d) => d.date).filter(Boolean).sort();
    return { id: s.id, name: s.name, idea: s.idea, pin: s.pin, earned: dates[0] ?? null, dishes: using };
  }).filter((s) => s.dishes.length);

  return { dishes: counted.length, rank, stamps, regions, paths, skills };
}

// What's new since a profile last saw its rewards on this device:
// seen = { stamps: [ids], skills: [ids], rank: index }, or null the first time,
// when nothing is celebrated (so rewards earned before Phase 5 don't all pop at once).
export function newSince(seen, r) {
  const now = { stamps: r.stamps.map((s) => s.id), skills: r.skills.filter((s) => s.earned).map((s) => s.id), rank: r.rank.index };
  if (!seen) return { now, stamps: [], skills: [], rankUp: false };
  const had = new Set(seen.stamps ?? []), hadSkills = new Set(seen.skills ?? []);
  return {
    now,
    stamps: r.stamps.filter((s) => !had.has(s.id)),
    skills: r.skills.filter((s) => s.earned && !hadSkills.has(s.id)),
    rankUp: r.rank.index > (seen.rank ?? 0),
  };
}
