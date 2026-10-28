// The registries (ingredients, tools, skills, kitchen words, cuisines) and the
// food rules, in the manager section (plan §7.5). Each entry's form is built
// from content/schema/registries.schema.json; the rules files have their own
// small shapes, below. Changes are staged until Review and save.
import { el, modal } from './dom.js';
import { field, blank } from './form.js';
import { S, cur, put, page, pickers, problems, redraw } from './manage.js';
import { isDay } from '/lib/calendars.js';

const LISTS = {
  'ingredients.json': [['ingredients', 'Ingredients', 'name']],
  'equipment.json': [['equipment', 'Tools', 'name']],
  'skills.json': [['skills', 'Skills', 'name']],
  'terms.json': [['terms', 'Kitchen words', 'word']],
  'cuisines.json': [['cuisines', 'Cuisines', 'name'], ['regions', 'Regions', 'name']],
  'tastes.json': [['tasteProteins', 'Proteins', 'name'], ['tasteFlavors', 'Flavors', 'name'], ['tasteIngredients', 'Key ingredients', 'name']],
};
const TITLES = { 'tastes.json': 'Tastes' };
const INTRO = {
  'ingredients.json': 'Every ingredient a lesson can use. Where it comes from decides whether it\'s clean: an animal has to be on the clean list (Food rules), and the checks refuse anything that isn\'t. An ingredient in use by a lesson can\'t be removed.',
  'equipment.json': 'The tools lessons list.',
  'skills.json': 'The skill pins kids earn. A lesson names the skills it teaches.',
  'terms.json': 'Kitchen words: the cooking words kids tap to learn. A word in a step that\'s on the watch list (Food rules) needs an entry here.',
  'cuisines.json': 'Cuisines, and the passport regions they belong to.',
  'tastes.json': 'What families rate, 1 to 5 stars per person (§6.21): proteins, flavors (each with example dishes, which don\'t need a recipe here), and key ingredients. A protein or ingredient lists the registry ingredients it covers, so the app can tell which dishes use it. Dishes are tagged in the same words on the Tags page.',
};
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Choices for an ingredient's animal: the clean list and the allowed products.
function options(key, path) {
  // A taste's ingredients (tastes.json) are registry ingredients.
  if (typeof key === 'number' && path?.at(-2) === 'ingredients') return pickers()('ingredient');
  if (key === 'animalSource') {
    const r = cur('rules/clean-species.json');
    return [[null, '(none: not from an animal)'], ...[...new Set([...r.species, ...r.allowedProducts.map((p) => p.source)])].map((x) => [x, x])];
  }
  return pickers()(key);
}

function checksLine() {
  const found = problems();
  return found.length
    ? el('div', { class: 'card mchecks' }, el('b', { class: 'err' }, `${found.length} thing${found.length === 1 ? '' : 's'} to fix before this can be saved`), el('ul', { class: 'mprob' }, found.map((p) => el('li', {}, p))))
    : null;
}

export function listPage(file) {
  const kinds = LISTS[file];
  if (!kinds) return page(el('h1', {}, 'No such list'));
  const schema = S.files['schema/registries.schema.json'];
  const data = cur(file);
  let typing = null;
  const stage = (note, structural, again) => {
    clearTimeout(typing);
    const go = () => { put(file, data, note); checks.replaceChildren(...[checksLine()].filter(Boolean)); };
    if (structural) { go(); again(); } else typing = setTimeout(go, 300);
  };
  const checks = el('div', {}, checksLine());

  const block = ([key, title, nameKey]) => {
    const items = data[key];
    const ref = schema.properties[key].items;
    // No heading of its own: the entry's name is already on the line above it.
    const itemSchema = { ...(ref.$ref ? schema.$defs[ref.$ref.split('/').pop()] : ref), title: '' };
    const search = el('input', { type: 'search', placeholder: `Find in ${title.toLowerCase()}`, 'aria-label': `Find in ${title.toLowerCase()}` });
    const list = el('ol', { class: 'mitems' });
    const entry = (item) => {
      const det = el('details', { class: 'mitem' }, el('summary', {}, el('b', {}, item[nameKey] ?? item.id), el('small', { class: 'mut' }, ` ${item.id}`)));
      const body = el('div', { class: 'mitem-body' });
      const draw = () => {
        const holder = { item };
        body.replaceChildren(
          field({
            root: schema, options,
            onChange: (structural) => stage(`Edited ${item[nameKey] ?? item.id}`, structural, draw),
            readOnly: (p) => p.join('.') === 'item.id',
            hint: (p) => (p.join('.') === 'item.id' ? 'Lessons point at it by this, so it stays.' : p.join('.') === 'item.animalSource' ? 'An animal not on the clean list can\'t be picked; the clean list is on Food rules.' : null),
          }, holder, 'item', itemSchema, []),
          el('button', {
            type: 'button', class: 'hbtn small-btn bad', onclick: () => {
              const close = modal(`Remove ${item[nameKey] ?? item.id}?`, el('p', {}, 'It comes out of the list when you save. If a lesson uses it, the checks will say so and it can\'t be saved until that lesson stops using it.'),
                el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Keep it'),
                  el('button', { class: 'hbtn bad', onclick: () => { items.splice(items.indexOf(item), 1); put(file, data, `Removed ${item[nameKey] ?? item.id}`); close(); redraw(); } }, 'Remove')));
            },
          }, 'Remove…'));
      };
      det.addEventListener('toggle', () => { if (det.open && !body.childElementCount) draw(); });
      det.append(body);
      return el('li', { 'data-find': `${item.id} ${item[nameKey] ?? ''}`.toLowerCase() }, det);
    };
    list.append(...items.map(entry));
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      for (const li of list.children) li.hidden = q && !li.dataset.find.includes(q);
    });
    const add = () => {
      const name = el('input', { required: true, maxlength: 80 });
      const err = el('p', { class: 'err', hidden: true });
      const close = modal(`Add to ${title.toLowerCase()}`, el('form', {
        class: 'stack wide', onsubmit: (e) => {
          e.preventDefault();
          const id = slug(name.value);
          if (!id) { err.hidden = false; err.textContent = 'Give it a name.'; return; }
          if (items.some((x) => x.id === id)) { err.hidden = false; err.textContent = `There's already one called "${id}".`; return; }
          const item = blank(itemSchema, schema);
          Object.assign(item, { id, [nameKey]: name.value.trim() });
          items.push(item);
          put(file, data, `Added ${name.value.trim()}`);
          close();
          redraw();
          setTimeout(() => { const d = [...document.querySelectorAll('.mitem')].find((x) => x.querySelector('small')?.textContent.trim() === id); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }, 0);
        },
      }, el('label', { class: 'f' }, 'Name', name), err, el('p', { class: 'mut small' }, 'Fill in the rest once it\'s added.'),
      el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), el('button', { class: 'hbtn pri' }, 'Add'))));
    };
    return el('section', { class: 'card' }, el('div', { class: 'mhead' }, el('h2', {}, `${title} (${items.length})`), el('button', { class: 'hbtn small-btn', onclick: add }, '+ Add')), search, list);
  };

  page(el('h1', {}, TITLES[file] ?? kinds[0][1]), el('p', { class: 'mut' }, INTRO[file]), checks, kinds.map(block));
}

// ---------- the food rules ----------

const words = (title, hint) => ({ type: 'array', title, hint, items: { type: 'string' } });
const RULES = [
  ['rules/clean-species.json', 'Clean animals', 'The animals whose meat, milk, or eggs a lesson may use (Leviticus 11, Deuteronomy 14). An ingredient from any other animal is refused.', {
    species: words('Clean animals'),
    fatBlocked: words('Animals whose fat is blocked (suet, tallow)'),
    allowedProducts: { type: 'array', items: { type: 'object', required: ['source', 'part', 'why'], properties: { source: { type: 'string' }, part: { type: 'string' }, why: { type: 'string' } } } },
  }],
  ['rules/blocked-words.json', 'Blocked words', 'Words for unclean foods. Any lesson text, name, or card that uses one is refused.', { words: words('Blocked words') }],
  ['rules/allowed-phrases.json', 'Allowed phrases', 'Exact phrases where a blocked word is fine ("turkey bacon"). Only the whole phrase is let through; the word on its own is still refused.', { phrases: words('Allowed phrases') }],
  ['rules/leaven.json', 'Leaven', 'Leaven words for the Unleavened badge and the spring filter (§6.19). Leaven is a badge, not the hard block.', { words: words('Leaven words'), allowedPhrases: words('Phrases that aren\'t leaven') }],
  ['rules/kitchen-words.json', 'Kitchen-word watch list', 'Cooking words a step can\'t use until Kitchen words explains them.', { words: words('Watched words') }],
];

export function rulesPage() {
  const checks = el('div', {}, checksLine());
  let typing = null;
  const card = ([file, title, intro, props]) => {
    const data = cur(file);
    const schema = { type: 'object', properties: props };
    const body = el('div', {});
    const draw = () => body.replaceChildren(...Object.keys(props).map((k) => el('div', { class: 'mf-field' }, field({
      root: schema,
      onChange: (structural) => {
        clearTimeout(typing);
        const go = () => { put(file, data, `Changed ${title.toLowerCase()}`); checks.replaceChildren(...[checksLine()].filter(Boolean)); };
        if (structural) { go(); draw(); } else typing = setTimeout(go, 300);
      },
    }, data, k, props[k], []))));
    draw();
    return el('details', { class: 'card msec' }, el('summary', {}, el('h2', {}, title)), el('p', { class: 'mut small' }, intro), body);
  };
  page(el('h1', {}, 'Food rules'),
    el('p', {}, 'These lists are how the app keeps unclean foods out of every lesson, swap, and family recipe. There is no switch that turns the check off; what it checks against is set here.'),
    checks, RULES.map(card));
}

// ---------- the feast dates ----------

// The standard calendars' first day of Unleavened Bread by year (§6.20). A
// family picks one and confirms its dates or changes them; the first calendar
// is the one a family uses until it picks. Add next years' dates here.
const FEAST_FILE = 'calendars.json';
const weekday = (d) => (isDay(d) ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '');

export function calendarsPage() {
  const data = cur(FEAST_FILE) ?? { calendars: [] };
  const checks = el('div', {}, checksLine());
  const save = (note) => { put(FEAST_FILE, data, note); checks.replaceChildren(...[checksLine()].filter(Boolean)); };
  let typing = null;
  const later = (note) => { clearTimeout(typing); typing = setTimeout(() => save(note), 300); };

  const card = (cal, i) => {
    const years = Object.keys(cal.firstDays ?? {}).sort();
    const row = (y) => {
      const when = el('small', { class: 'mut' }, weekday(cal.firstDays[y]));
      const input = el('input', { type: 'date', value: cal.firstDays[y], 'aria-label': `${y}'s first day`, oninput: (e) => {
        cal.firstDays[y] = e.target.value;
        when.textContent = weekday(e.target.value);
        later(`Changed ${cal.name}'s ${y} date`);
      } });
      return el('li', { class: 'mitem mfeast' }, el('b', {}, y), input, when,
        el('button', { type: 'button', class: 'hbtn small-btn bad', onclick: () => {
          const close = modal(`Remove ${y}?`, el('p', {}, `${cal.name} won't have a date for ${y} once you save. Families on it would have no unleavened days that year until they set their own.`),
            el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Keep it'),
              el('button', { class: 'hbtn bad', onclick: () => { delete cal.firstDays[y]; save(`Removed ${cal.name}'s ${y} date`); close(); redraw(); } }, 'Remove')));
        } }, 'Remove…'));
    };
    const addYear = () => {
      const next = String(years.length ? Number(years.at(-1)) + 1 : new Date().getFullYear() + 1);
      const year = el('input', { type: 'number', min: 2000, max: 2200, value: next, required: true, inputmode: 'numeric' });
      const day = el('input', { type: 'date', required: true });
      const err = el('p', { class: 'err', hidden: true });
      const close = modal(`Add a year to ${cal.name}`, el('form', { class: 'stack wide', onsubmit: (e) => {
        e.preventDefault();
        const y = String(year.value).trim();
        const bad = !/^\d{4}$/.test(y) ? 'Type a year, like 2037.' : cal.firstDays?.[y] ? `${y} already has a date. Change it in the list.` : !isDay(day.value) ? 'Pick the first day.' : day.value.slice(0, 4) !== y ? `The first day has to be in ${y}.` : null;
        if (bad) { err.hidden = false; err.textContent = bad; return; }
        cal.firstDays = { ...(cal.firstDays ?? {}), [y]: day.value };
        save(`Added ${cal.name}'s ${y} date`);
        close();
        redraw();
      } }, el('label', { class: 'f' }, 'Year', year), el('label', { class: 'f' }, 'First day of Unleavened Bread', day), err,
      el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), el('button', { class: 'hbtn pri' }, 'Add'))));
    };
    const name = el('input', { value: cal.name ?? '', maxlength: 80, oninput: (e) => { cal.name = e.target.value; later(`Renamed a calendar to ${e.target.value}`); } });
    return el('section', { class: 'card' },
      el('div', { class: 'mhead' }, el('h2', {}, cal.name || cal.id), i === 0 ? el('small', { class: 'mut' }, 'Used until a family picks') : null),
      el('label', { class: 'f' }, 'Name families see', name),
      el('div', { class: 'mhead' }, el('h3', {}, `First day of Unleavened Bread (${years.length} years)`), el('button', { type: 'button', class: 'hbtn small-btn', onclick: addYear }, '+ Add a year')),
      el('p', { class: 'mut small' }, 'The feast runs seven days from the first day. A family can change the first day to its own.'),
      el('ol', { class: 'mitems' }, years.map(row)));
  };

  const addCalendar = () => {
    const name = el('input', { required: true, maxlength: 80 });
    const err = el('p', { class: 'err', hidden: true });
    const close = modal('Add a calendar', el('form', { class: 'stack wide', onsubmit: (e) => {
      e.preventDefault();
      const id = slug(name.value);
      if (!id) { err.hidden = false; err.textContent = 'Give it a name.'; return; }
      if (data.calendars.some((c) => c.id === id)) { err.hidden = false; err.textContent = `There's already one called "${id}".`; return; }
      data.calendars.push({ id, name: name.value.trim(), firstDays: {} });
      save(`Added the ${name.value.trim()}`);
      close();
      redraw();
    } }, el('label', { class: 'f' }, 'Name families see', name), err, el('p', { class: 'mut small' }, 'Add its years once it\'s added.'),
    el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), el('button', { class: 'hbtn pri' }, 'Add'))));
  };

  page(el('div', { class: 'mhead' }, el('h1', {}, 'Feast dates'), el('button', { type: 'button', class: 'hbtn small-btn', onclick: addCalendar }, '+ Add a calendar')),
    el('p', { class: 'mut' }, 'The standard calendars families pick from for Unleavened Bread (§6.20), with the first day of the feast each year. A family sees its calendar\'s dates and confirms them or picks its own first day. Add the next years\' dates before they come up.'),
    checks, data.calendars.map(card));
}
