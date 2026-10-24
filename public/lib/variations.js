// Copied from src/content/variations.js by tools/build-library.js. Don't edit here.
// Variations (plan §6.21): a complete version of a lesson with a preference
// built in, like Chimichurri chicken for Chimichurri steak. Its protein,
// amounts, timing, doneness target, steps, tools, title, and shopping list all
// change together. It teaches the same skill and counts as the same lesson.
//
// Each one is stored in its lesson file, under `variations`, as changes on the
// lesson, so a fix to a step they share reaches every variation:
//   { id, title, tags, ...changes }
// What can change:
//   image, servings, totalMinutes, scaling, substitutions, intro: the whole
//     value (null takes out an optional one)
//   learn.move, learn.callback, learn.wrong, learn.quiz: the whole value
//   ingredients, equipment, steps, learn.why: a list change,
//     { change: { key: item }, drop: [key], add: [item], order: [key or "+n"] }
//     where "+n" is the nth item in add. order is only there when the list
//     isn't the lesson's own order with the added ones at the end.
// A list item's key: a step's or a why card's id; a tool's id; an ingredient
// line's ingredient id, with "@group" when it has a group, and "#2", "#3" for
// the same line again.
// Everything else (id, version, unit, cuisine, skill, skills, prereqs) is the
// lesson's, so a variation always teaches the same thing.

export const WHOLE = ['image', 'servings', 'totalMinutes', 'scaling', 'substitutions', 'intro'];
export const LEARN_WHOLE = ['move', 'callback', 'wrong', 'quiz'];
// Optional parts a variation can take out with null.
const OPTIONAL = new Set(['substitutions', 'intro', 'callback', 'quiz']);
// The lists, and how each item is keyed.
const LISTS = {
  ingredients: { get: (L) => L.ingredients, set: (L, v) => { L.ingredients = v; }, key: (x) => (x.group ? `${x.ingredient}@${x.group}` : x.ingredient) },
  equipment: { get: (L) => L.equipment, set: (L, v) => { L.equipment = v; }, key: (x) => x },
  steps: { get: (L) => L.steps, set: (L, v) => { L.steps = v; }, key: (x) => x.id },
  why: { get: (L) => L.learn.why, set: (L, v) => { L.learn.why = v; }, key: (x) => x.id },
};
// Where each list change sits in a variation.
const listAt = (v, name) => (name === 'why' ? v.learn?.why : v[name]);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Each item's key, numbered when the same key comes again.
export function keysOf(list, key) {
  const seen = {};
  return list.map((x) => {
    const k = key(x);
    seen[k] = (seen[k] ?? 0) + 1;
    return seen[k] === 1 ? k : `${k}#${seen[k]}`;
  });
}

// The list with a change on it. A key the lesson no longer has is skipped, and
// a lesson item that order doesn't mention (one added to the lesson later) goes
// in after the item before it, so it reaches the variation too.
export function applyList(base, ch, key) {
  if (!ch) return base.map((x) => structuredClone(x));
  const keys = keysOf(base, key);
  const item = Object.fromEntries(keys.map((k, i) => [k, ch.change?.[k] ?? base[i]]));
  const drop = new Set(ch.drop ?? []);
  const add = ch.add ?? [];
  let seq;
  if (ch.order) {
    seq = ch.order.filter((k) => (k.startsWith('+') ? add[Number(k.slice(1))] !== undefined : k in item && !drop.has(k)));
    keys.forEach((k, i) => {
      if (drop.has(k) || seq.includes(k)) return;
      const before = keys.slice(0, i).reverse().find((p) => seq.includes(p));
      seq.splice(before ? seq.indexOf(before) + 1 : 0, 0, k);
    });
    add.forEach((_, i) => { if (!seq.includes(`+${i}`)) seq.push(`+${i}`); });
  } else {
    seq = [...keys.filter((k) => !drop.has(k)), ...add.map((_, i) => `+${i}`)];
  }
  return seq.map((k) => structuredClone(k.startsWith('+') ? add[Number(k.slice(1))] : item[k]));
}

// The change that turns base into full, or null when they're the same.
export function diffList(base, full, key) {
  const bk = keysOf(base, key), fk = keysOf(full, key);
  const at = Object.fromEntries(bk.map((k, i) => [k, i]));
  const ch = { change: {}, drop: bk.filter((k) => !fk.includes(k)), add: [] };
  const seq = fk.map((k, i) => {
    if (k in at) {
      if (!same(base[at[k]], full[i])) ch.change[k] = structuredClone(full[i]);
      return k;
    }
    ch.add.push(structuredClone(full[i]));
    return `+${ch.add.length - 1}`;
  });
  const plain = [...bk.filter((k) => !ch.drop.includes(k)), ...ch.add.map((_, i) => `+${i}`)];
  if (!same(plain, seq)) ch.order = seq;
  if (!Object.keys(ch.change).length) delete ch.change;
  if (!ch.drop.length) delete ch.drop;
  if (!ch.add.length) delete ch.add;
  return Object.keys(ch).length ? ch : null;
}

export const variationById = (L, id) => (L.variations ?? []).find((v) => v.id === id) ?? null;

// The variation as a whole lesson, in the shape of a lesson file (no
// `variations`), so every check a lesson gets can run on it.
export function applyVariation(L, v) {
  const { variations, ...base } = L;
  const out = structuredClone(base);
  out.title = v.title;
  for (const k of WHOLE) {
    if (!(k in v)) continue;
    if (v[k] === null) delete out[k]; else out[k] = structuredClone(v[k]);
  }
  for (const k of LEARN_WHOLE) {
    if (!(k in (v.learn ?? {}))) continue;
    if (v.learn[k] === null) delete out.learn[k]; else out.learn[k] = structuredClone(v.learn[k]);
  }
  for (const [name, spec] of Object.entries(LISTS)) {
    const ch = listAt(v, name);
    if (ch) spec.set(out, applyList(spec.get(base), ch, spec.key));
  }
  return out;
}

// What a family cooks: the lesson, or the variation by that id, marked with
// which one it is and what it's a version of. An id the lesson doesn't have
// (taken out since) gives the lesson itself.
export function lessonVersion(L, id) {
  const v = id ? variationById(L, id) : null;
  if (!v) return L;
  return { ...applyVariation(L, v), variation: v.id, versionOf: L.title, tags: v.tags };
}

// The variation that turns lesson L into full: what the content editor stores
// when the owner edits a copy of the lesson (§7.5). head: { id, tags }.
export function diffVariation(L, full, head) {
  const { variations, ...base } = L;
  const v = { id: head.id, title: full.title };
  if (head.tags) v.tags = structuredClone(head.tags);
  for (const k of WHOLE) {
    if (same(base[k], full[k])) continue;
    if (full[k] === undefined) { if (OPTIONAL.has(k)) v[k] = null; } else v[k] = structuredClone(full[k]);
  }
  const learn = {};
  for (const k of LEARN_WHOLE) {
    if (same(base.learn[k], full.learn?.[k])) continue;
    if (full.learn?.[k] === undefined) { if (OPTIONAL.has(k)) learn[k] = null; } else learn[k] = structuredClone(full.learn[k]);
  }
  for (const [name, spec] of Object.entries(LISTS)) {
    const ch = diffList(spec.get(base), spec.get(full) ?? [], spec.key);
    if (!ch) continue;
    if (name === 'why') learn.why = ch; else v[name] = ch;
  }
  if (Object.keys(learn).length) v.learn = learn;
  return v;
}

// Changes naming a part the lesson no longer has (a step since taken out of
// it), which do nothing now. One message each, for the linter's warnings.
export function staleKeys(L, v) {
  const out = [];
  const names = { ingredients: 'ingredient line', equipment: 'tool', steps: 'step', why: 'why card' };
  for (const [name, spec] of Object.entries(LISTS)) {
    const ch = listAt(v, name);
    if (!ch) continue;
    const keys = new Set(keysOf(spec.get(L), spec.key));
    const named = [...Object.keys(ch.change ?? {}), ...(ch.drop ?? []), ...(ch.order ?? []).filter((k) => !k.startsWith('+'))];
    for (const k of new Set(named)) if (!keys.has(k)) out.push(`changes ${names[name]} "${k}", which the lesson doesn't have any more`);
  }
  return out;
}

// Whether a variation changes anything but its title and tags.
export const changesSomething = (v) => Object.keys(v).some((k) => !['id', 'title', 'tags'].includes(k));

// How a variation is named beside its lesson (§6.21).
export const versionName = (title, of) => `${title} (a version of ${of})`;
