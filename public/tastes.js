// Star ratings (plan §6.21): one row per thing a profile rates, used by the
// Our tastes page and by Chef Ruth. 5 stars is the absolute favorite, one per
// list; tapping a rating again takes it off. Part of the next release (§8.6).

export const STAR_WORDS = { 5: 'Absolute favorite', 4: 'Love', 3: 'Like', 2: 'Okay', 1: 'Hate' };

// Saves one rating, asking first when it would take another item's place as
// the absolute favorite. Resolves with the profile's ratings, or null when the
// parent kept the old favorite.
export function ratingSaver({ api, modal, el }, pid) {
  return async (kind, item, change, name) => {
    const body = { kind, item, ...change };
    try {
      return (await api('PUT', `/api/profiles/${pid}/ratings`, body)).ratings;
    } catch (err) {
      if (err.code !== 'favorite_taken') throw err;
      const move = await new Promise((resolve) => {
        const close = modal('Absolute favorite', el('p', {}, err.message),
          el('div', { class: 'acts' },
            el('button', { type: 'button', class: 'hbtn', onclick: () => { close(); resolve(false); } }, 'Keep it'),
            el('button', { type: 'button', class: 'hbtn pri', onclick: () => { close(); resolve(true); } }, `Make ${name} the favorite`)));
      });
      return move ? (await api('PUT', `/api/profiles/${pid}/ratings`, { ...body, replace: true })).ratings : null;
    }
  };
}

// One row: the item's name (a flavor's hint and example dishes under it), five
// stars, and Haven't tried. rated: the profile's ratings for this list, as
// { item: stars | null }; save(change) resolves with the list's new ratings.
export function starRow({ el }, item, rated, save) {
  const row = el('div', { class: 'rate-row' });
  const draw = (list) => {
    const has = item.id in list, v = list[item.id] ?? null;
    const pick = async (change) => {
      for (const b of row.querySelectorAll('button')) b.disabled = true;
      try {
        const next = await save(change);
        draw(next ?? list);
      } catch (err) {
        draw(list);
        row.append(el('p', { class: 'err small', role: 'alert' }, err.message));
      }
    };
    row.replaceChildren(
      el('div', { class: 'rate-name' }, el('b', {}, item.name),
        item.hint ? el('small', {}, item.hint) : null,
        item.examples ? el('small', { class: 'mut' }, `Like ${item.examples.join(', ')}`) : null),
      el('div', { class: 'rate-stars', role: 'group', 'aria-label': `${item.name}: rating` },
        [1, 2, 3, 4, 5].map((n) => el('button', {
          type: 'button', class: `rate-star${v != null && n <= v ? ' on' : ''}`, 'aria-pressed': String(v === n),
          'aria-label': `${n} star${n === 1 ? '' : 's'}: ${STAR_WORDS[n]}`, title: STAR_WORDS[n],
          onclick: () => pick(v === n ? { clear: true } : { stars: n }),
        }, v != null && n <= v ? '★' : '☆')),
        el('button', {
          type: 'button', class: `hbtn small rate-untried${has && v == null ? ' on' : ''}`, 'aria-pressed': String(has && v == null),
          onclick: () => pick(has && v == null ? { clear: true } : { stars: null }),
        }, "Haven't tried")),
      el('small', { class: 'rate-word' }, v != null ? STAR_WORDS[v] : has ? "Haven't tried" : 'Not rated yet'));
  };
  draw(rated);
  return row;
}

// How many items in a list a profile has rated (Haven't tried counts).
export const ratedCount = (list, rated) => list.filter((x) => x.id in rated).length;
