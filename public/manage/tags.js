// Tags (plan §6.21): the words every dish is described in, so profiles'
// ratings can pick dishes and the gaps page can say what to write next. The
// Tags page sets them for every dish at once; the dish card in the lesson
// editor and the planned-dish dialog use the same fields.
import { el } from './dom.js';
import { cur, put, page, problems, lessonFile } from './manage.js';
import { HEAT, BUDGET, FAMILIAR, VEGGIES, NO_PROTEIN, missingTags, meatProtein, tastesOf } from '/lib/tastes.js';

const MAX_FLAVORS = 3;
export const tastes = () => tastesOf(cur('tastes.json') ?? {});

// The tag fields for one dish card. holder.tags is edited in place, made on
// the first change and removed when the last tag is cleared; onChange runs
// after every change.
export function tagFields(holder, onChange) {
  const T = tastes();
  const tags = holder.tags ?? {};
  const set = (k, v) => {
    if (v == null || v === '') delete tags[k]; else tags[k] = v;
    if (Object.keys(tags).length) holder.tags = tags; else delete holder.tags;
    onChange();
  };
  const select = (k, label, options) => el('label', { class: 'f' }, label,
    el('select', { onchange: (e) => set(k, e.target.value) },
      el('option', { value: '', selected: tags[k] == null }, 'Not set'),
      options.map(([v, l]) => el('option', { value: v, selected: tags[k] === v }, l))));
  const flavors = el('div', { class: 'mtag-flavors' });
  const drawFlavors = () => {
    const on = tags.flavors ?? [];
    flavors.replaceChildren(...T.flavors.map((f) => el('label', { class: 'choice mtag-chip' },
      el('input', {
        type: 'checkbox', checked: on.includes(f.id), disabled: !on.includes(f.id) && on.length >= MAX_FLAVORS,
        onchange: (e) => {
          const next = e.target.checked ? [...on, f.id] : on.filter((x) => x !== f.id);
          set('flavors', next.length ? next : null);
          drawFlavors();
        },
      }), el('span', {}, f.name))));
  };
  drawFlavors();
  return el('div', { class: 'mtag-fields' },
    el('div', { class: 'mtag-grid' },
      select('protein', 'Main protein', [...T.proteins.map((p) => [p.id, p.name]), [NO_PROTEIN, 'None (a side, bread, or dessert)']]),
      select('heat', 'Heat', HEAT), select('budget', 'Budget', BUDGET), select('familiar', 'How familiar', FAMILIAR), select('veggies', 'Vegetables', VEGGIES)),
    el('fieldset', { class: 'mf-list' }, el('legend', {}, `Flavors (up to ${MAX_FLAVORS})`), flavors));
}

// A written lesson's meat or fish, when its protein tag says something else.
function proteinNote(id, tags) {
  const L = cur(lessonFile(id));
  if (!L || !tags?.protein) return null;
  const registry = Object.fromEntries((cur('ingredients.json')?.ingredients ?? []).map((i) => [i.id, i]));
  const meat = meatProtein(L, registry, tastes());
  return meat && meat !== tags.protein ? el('p', { class: 'mut small' }, `The lesson's first meat or fish is ${meat}. Fine if that's on purpose.`) : null;
}

export function tagsPage() {
  const course = cur('course.json');
  const units = cur('units.json').units;
  const hidden = new Set(cur('hidden.json')?.lessons ?? []);
  // Every dish in course order, then the seasonal units' lessons, which carry
  // their own dish card (§6.19).
  const rows = [
    ...course.dishes.filter((d) => !hidden.has(d.id)).map((d) => ({ id: d.id, title: d.title, holder: d, save: (note) => put('course.json', course, note) })),
    ...units.filter((u) => u.seasonal).flatMap((u) => (u.lessons ?? []).filter((id) => !hidden.has(id)).map((id) => {
      const L = cur(lessonFile(id));
      return L && { id, title: L.title, holder: L, save: (note) => put(lessonFile(id), L, note) };
    })).filter(Boolean),
  ];
  const checks = el('div', {});
  const showChecks = () => {
    const found = problems();
    checks.replaceChildren(...(found.length ? [el('div', { class: 'card mchecks' }, el('b', { class: 'err' }, `${found.length} thing${found.length === 1 ? '' : 's'} to fix before this can be saved`), el('ul', { class: 'mprob' }, found.map((p) => el('li', {}, p))))] : []));
  };
  const count = el('p', { class: 'mut' });
  const showCount = () => {
    const left = rows.filter((r) => missingTags(r.holder.tags).length).length;
    count.textContent = left ? `${left} of ${rows.length} dishes still have tags to set.` : `All ${rows.length} dishes are tagged.`;
  };
  const list = el('div', { class: 'mtag-list' });
  const onlyMissing = el('input', { type: 'checkbox' });
  const draw = () => list.replaceChildren(...rows.filter((r) => !onlyMissing.checked || missingTags(r.holder.tags).length).map((r) => {
    const note = el('div', {}, proteinNote(r.id, r.holder.tags));
    let typing = null;
    return el('section', { class: 'card mtag-dish' },
      el('h2', {}, r.title),
      tagFields(r.holder, () => {
        clearTimeout(typing);
        typing = setTimeout(() => { r.save(`Tagged ${r.title}`); showChecks(); showCount(); }, 250);
        note.replaceChildren(...[proteinNote(r.id, r.holder.tags)].filter(Boolean));
      }), note);
  }));
  onlyMissing.addEventListener('change', draw);
  draw();
  showCount();
  showChecks();
  page(el('h1', {}, 'Tags'),
    el('p', { class: 'mut' }, 'The words each dish is described in, the same ones families rate (Tastes). They decide which dish or version is picked for a family, and show where a new recipe is needed. Families don\'t see them.'),
    count, el('label', { class: 'choice' }, onlyMissing, el('span', {}, 'Only dishes with tags still to set')),
    checks, list);
}
