// Kitchen words (plan §6.1): cooking terms a kid can tap to see what they mean.
// findTerms marks where each defined word appears in a piece of step text.

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// [{ id, start, end }] in text order, longest phrase first where two overlap
export function findTerms(text, terms) {
  if (!text) return [];
  const forms = terms.flatMap(t => t.forms.map(f => ({ id: t.id, f }))).sort((a, b) => b.f.length - a.f.length);
  const hits = [];
  for (const { id, f } of forms) {
    const re = new RegExp(`(?<![\\p{L}])${esc(f).replace(/\s+/g, '\\s+')}(?![\\p{L}])`, 'giu');
    for (const m of text.matchAll(re)) {
      const start = m.index, end = start + m[0].length;
      if (!hits.some(h => start < h.end && end > h.start)) hits.push({ id, start, end });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}
