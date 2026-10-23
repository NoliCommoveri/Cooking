// el() as in the family app: only ever sets text, so nothing typed is parsed as markup.
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (k === 'value' && (tag === 'input' || tag === 'textarea')) n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid instanceof Node ? kid : String(kid));
  return n;
}

// Adding something new opens in a dialog over the page (CLAUDE.md). Returns close().
export function modal(title, ...body) {
  const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    el('div', { class: 'card' }, el('h2', {}, title), body));
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc); window.removeEventListener('hashchange', close); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', esc);
  window.addEventListener('hashchange', close);
  document.body.append(ov);
  ov.querySelector('select, input, textarea, button')?.focus();
  return close;
}
