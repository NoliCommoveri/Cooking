// The hard block on unclean foods (plan §2.1). Used by the content linter and,
// later, by the app's checks on lesson patches (§6.11). There is deliberately no
// way to switch any of this off.

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The word list's patterns, built once per list rather than once per line of text.
const compiled = new WeakMap();
const patterns = (list, make) => {
  if (!compiled.has(list)) compiled.set(list, list.map(make));
  return compiled.get(list);
};

// Blocked words found in `text`. Exact allowed phrases ("turkey bacon") are removed first.
export function blockedWordsIn(text, rules) {
  if (!text) return [];
  let t = ` ${String(text)} `;
  for (const re of patterns(rules.allowedPhrases, (p) => new RegExp(esc(p).replace(/\s+/g, '\\s+'), 'gi'))) t = t.replace(re, ' ');
  const hits = [];
  for (const re of patterns(rules.blockedWords, (w) => new RegExp(`\\b${esc(w).replace(/\s+/g, '\\s+')}(s|es)?\\b`, 'i'))) {
    const m = t.match(re);
    if (m) hits.push(m[0].trim().toLowerCase());
  }
  return hits;
}

const ANIMAL_TAGS = ['meat', 'fish', 'dairy', 'egg'];

// Reasons an ingredient breaks the hard block; empty when it's clean.
export function uncleanReasons(ing, rules) {
  const out = [];
  const src = ing.animalSource, part = ing.animalPart;
  const tagged = (ing.contains || []).some(t => ANIMAL_TAGS.includes(t));
  if (tagged && !src) out.push(`comes from an animal (tags: ${ing.contains.join(', ')}) but has no animalSource`);
  const product = (rules.allowedProducts || []).some(p => p.source === src && p.part === part);
  if (src && product) return out.concat(blockedWordsIn(`${ing.name} ${ing.id}`, rules).map(w => `its name contains the blocked word "${w}"`));
  if (src) {
    if (!rules.cleanSpecies.includes(src)) out.push(`animalSource "${src}" is not on the clean-species list`);
    if (!part) out.push('has an animalSource but no animalPart');
    if (part === 'blood') out.push('blood is blocked from every animal');
    if (part === 'fat' && rules.fatBlocked.includes(src)) out.push(`the fat of ${src} is blocked (suet, tallow)`);
  }
  for (const w of blockedWordsIn(`${ing.name} ${ing.id}`, rules)) out.push(`its name contains the blocked word "${w}"`);
  return out;
}
