// Copied from src/content/amounts.js by tools/build-library.js. Don't edit here.
// How much? in cook mode: the ingredients a step names, so the player can
// show their amounts without going back to the list.

// Words that can't stand for an ingredient on their own: colors and other
// describing words ("brown" in "until brown"), and words too general to point
// at one ingredient ("the sauce" is usually the one being made).
const NOT_ALONE = new Set([
  'red', 'green', 'yellow', 'white', 'black', 'brown', 'fresh', 'ground', 'dried', 'smoked', 'sweet', 'sliced',
  'shredded', 'crushed', 'jarred', 'canned', 'plain', 'whole', 'small', 'large', 'baby', 'mild', 'extra-firm',
  'gluten-free', 'sea', 'creamy', 'bulk', 'toasted', 'minced', 'pure', 'semisweet', 'thin', 'unsalted', 'active',
  'dry', 'all-purpose', 'lean', 'bell', 'leaf', 'rolled', 'sauce', 'paste', 'powder', 'seeds', 'seed', 'leaves',
  'juice', 'mix', 'flakes', 'sour', 'broth', 'stock', 'chunks', 'fillets', 'breakfast', 'size', 'curd', 'wine',
]);
// Words in a name that say how it's sold, not what it is.
const DROP = new Set(['boneless', 'skinless', 'about', 'inch', 'thick', 'finely', 'grated', 'in', 'the', 'shell', 'no', 'casing', 'fully', 'cooked', 'or', 'and']);

// Words that are some ingredient's own name: the last word of a name, and
// the first word of a meat's or fish's ("chicken", "beef").
const takenCache = new WeakMap();
function takenWords(ING) {
  if (!takenCache.has(ING)) {
    const t = new Set();
    for (const ing of Object.values(ING)) {
      const w = ing.name.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[,%]/g, ' ').split(/\s+/).filter((x) => x && !DROP.has(x) && !/\d/.test(x));
      if (!w.length) continue;
      withSingular(w.at(-1)).forEach((x) => t.add(x));
      if (ing.rawHandling) withSingular(w[0]).forEach((x) => t.add(x));
    }
    takenCache.set(ING, t);
  }
  return takenCache.get(ING);
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const withSingular = (p) => (/[^s]s$/.test(p) && p.length > 3 ? [p, p.slice(0, -1)] : [p]);

// The words a step might use for an ingredient: its name, and each run of
// words in it ("chicken breasts", "chicken"), leaving out describing words
// on their own. Longer phrases come first.
export function phrasesFor(ing, taken = null) {
  const words = ing.name.toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[,%]/g, ' ').split(/\s+/)
    .filter((w) => w && !DROP.has(w) && !/\d/.test(w));
  const out = new Set();
  for (let len = words.length; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) {
      const run = words.slice(i, i + len);
      if (len === 1 && (NOT_ALONE.has(run[0]) || run[0].length < 3)) continue;
      // A word before the last stands alone only if it isn't what another
      // ingredient is called ("rice" isn't rice vinegar, "chicken" isn't
      // chicken broth); meat and fish keep theirs ("chicken" breasts).
      if (len === 1 && i !== words.length - 1 && !(i === 0 && ing.rawHandling) && taken?.has(run[0])) continue;
      withSingular(run.join(' ')).forEach((p) => out.add(p));
    }
  }
  // Any fish can be "the fish" in a step.
  if (ing.rawHandling === 'fish') out.add('fish');
  for (const l of Object.values(ing.countLabel ?? {})) out.add(l.toLowerCase().replace(/^(large|small|medium) /, ''));
  return [...out];
}

// Ids of the lesson's ingredients a step names, in the lesson's order.
// step: the step as the cook reads it; raw: its text as written, whose
// {qty:id} placeholders name an ingredient outright. A wash step names none.
// Where one ingredient's longer name covers the words ("vegetable oil",
// "garlic powder"), a shorter match for another ("oil", "garlic") there
// doesn't count.
export function ingredientsInStep(step, raw, lines, ING) {
  if (step.type === 'wash') return [];
  const text = step.text.toLowerCase();
  const ids = [...new Set(lines.map((l) => l.id ?? l.ingredient))];
  const found = [];
  const taken = takenWords(ING);
  for (const id of ids) {
    if (!ING[id]) continue;
    for (const p of phrasesFor(ING[id], taken)) {
      const re = new RegExp(`(?<![\\p{L}-])${reEsc(p).replace(/ /g, '\\s+')}(?:s|es)?(?![\\p{L}-])`, 'giu');
      for (const m of text.matchAll(re)) found.push({ id, start: m.index, end: m.index + m[0].length });
    }
  }
  found.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  const claimed = [], hit = new Set([...(raw ?? '').matchAll(/\{qty:([a-z0-9-]+)\}/g)].map((m) => m[1]));
  // A spice that shares one word with something else in the lesson ("pepper",
  // black or bell) counts only by its full name, or after "salt and".
  const afterSalt = (f) => /salt,? and\s+$/.test(text.slice(0, f.start));
  const fits = (f) => {
    // "salt and pepper" is the spice, not the bell pepper.
    if (ING[f.id].section !== 'spices') return !(afterSalt(f) && found.some((g) => g.id !== f.id && ING[g.id].section === 'spices' && g.start === f.start && g.end === f.end));
    const word = text.slice(f.start, f.end);
    if (phrasesFor(ING[f.id], taken)[0] === word.replace(/\s+/g, ' ')) return true;
    const shared = found.some((g) => g.id !== f.id && ING[g.id].section !== 'spices' && g.start === f.start && g.end === f.end);
    return !shared || afterSalt(f);
  };
  for (const f of found) {
    if (!fits(f)) continue;
    if (claimed.some((c) => c.id !== f.id && c.end - c.start > f.end - f.start && f.start < c.end && f.end > c.start)) continue;
    claimed.push(f);
    hit.add(f.id);
  }
  return ids.filter((id) => hit.has(id));
}
