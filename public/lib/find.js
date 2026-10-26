// Copied from src/content/find.js by tools/build-library.js. Don't edit here.
// Add a lesson's filters (owner, 2026-10-26): the ingredients a family has,
// skills, and the rest. Shared by the Worker's tests and the app.

// A typed ingredient is a protein (one of the taste proteins, "protein:chicken")
// or any other ingredient by id. Proteins narrow: a lesson needs one of the
// typed proteins. Everything else is wide: a lesson needs any one of the
// others. So chicken, tomatoes, and carrots finds chicken with tomatoes or
// chicken with carrots, never fish with carrots (owner, 2026-10-26).
// lesson: { ingredients: [ids], protein }. proteins: { id: [ingredient ids] }.
// Returns the typed items the lesson uses, or null when it doesn't match.
export function ingredientMatch(lesson, items, proteins) {
  if (!items.length) return [];
  const has = new Set(lesson.ingredients);
  const uses = (x) => (x.startsWith('protein:')
    ? lesson.protein === x.slice(8) || (proteins[x.slice(8)] ?? []).some((i) => has.has(i))
    : has.has(x));
  const wanted = items.filter((x) => x.startsWith('protein:')), rest = items.filter((x) => !x.startsWith('protein:'));
  const used = items.filter(uses);
  if (wanted.length && !wanted.some(uses)) return null;
  if (rest.length && !rest.some(uses)) return null;
  return used;
}

// The lessons that pass every filter, each with the typed ingredients it
// uses. f: { text, items, skills, programs (ids a lesson must be in one of,
// or null), protein, cuisine, maxMinutes, method, skip (ids to leave out) }.
// lesson: { id, title, ingredients, skills, protein, cuisine, minutes, method, programs }.
export function findLessons(lessons, f, proteins) {
  const text = (f.text ?? '').trim().toLowerCase();
  const out = [];
  for (const L of lessons) {
    if (text && !L.title.toLowerCase().includes(text)) continue;
    if (f.skills?.length && !f.skills.some((s) => (L.skills ?? []).includes(s))) continue;
    if (f.program && !(L.programs ?? []).includes(f.program)) continue;
    if (f.protein && L.protein !== f.protein) continue;
    if (f.cuisine && L.cuisine !== f.cuisine) continue;
    if (f.maxMinutes && !(L.minutes <= f.maxMinutes)) continue;
    if (f.method && L.method !== f.method && !(L.method === 'stove-oven' && ['stove', 'oven'].includes(f.method))) continue;
    if (f.skip?.has(L.id)) continue;
    const used = ingredientMatch(L, f.items ?? [], proteins);
    if (used) out.push({ L, used });
  }
  // The most of the family's ingredients first; otherwise the order given.
  return f.items?.length ? out.map((x, i) => ({ ...x, i })).sort((a, b) => b.used.length - a.used.length || a.i - b.i) : out;
}

// Typed text to the options it matches, best first: names that start with it,
// then names with a word that does, then the rest that contain it; the
// shortest first, so Tomatoes comes before Tomato paste.
export function suggest(options, typed, n = 8) {
  const t = typed.trim().toLowerCase();
  if (!t) return [];
  const rank = (o) => {
    const name = o.name.toLowerCase();
    return name.startsWith(t) ? 0 : name.split(/[\s,()-]+/).some((w) => w.startsWith(t)) ? 1 : name.includes(t) ? 2 : 3;
  };
  return options.map((o) => [rank(o), o]).filter(([r]) => r < 3).sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length || a[1].name.localeCompare(b[1].name)).slice(0, n).map(([, o]) => o);
}
