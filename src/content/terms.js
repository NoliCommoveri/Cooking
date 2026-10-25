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

// Text as HTML with each kitchen word a button (data-term), for pages that
// build HTML strings. esc escapes the plain text between the words.
export function markTerms(text, terms, esc) {
  let out = '', at = 0;
  for (const h of findTerms(text, terms)) {
    out += esc(text.slice(at, h.start)) + `<button type="button" class="kw" data-term="${esc(h.id)}">${esc(text.slice(h.start, h.end))}</button>`;
    at = h.end;
  }
  return out + esc(text.slice(at));
}

// The card a tapped kitchen word opens, as HTML.
export function termCardHtml(t, esc) {
  return `<div class="kwcard" role="note"><b>${esc(t.word)}</b><p>${esc(t.means)}</p><button type="button" class="kwclose" data-term="">Got it</button></div>`;
}

// Browser only: a tap on a kitchen word (or a card's Got it) opens its card
// under the paragraph or list item it's in, closing any other; a second tap
// on the same word closes it.
export function toggleTermCard(btn, scope, terms, esc) {
  const id = btn.dataset.term, holder = btn.closest('li, p') ?? btn.parentElement;
  const old = scope.querySelector('.kwcard');
  const same = old && old.dataset.for === id && (old.previousElementSibling === holder || old.parentElement === holder);
  old?.remove();
  const t = terms.find((x) => x.id === id);
  if (!t || same) return;
  const tpl = document.createElement('template');
  tpl.innerHTML = termCardHtml(t, esc);
  const card = tpl.content.firstElementChild;
  card.dataset.for = id;
  if (holder.tagName === 'LI') holder.append(card); else holder.after(card);
}
