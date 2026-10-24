// A Level in the manager section (plan §12, §12.4): its units, its weeks with
// their four parts, and the Level's own recipes. The forms are built from
// content/schema/level.schema.json. Only preview families see a Level until
// the next release launches (§8.6). Changes are staged until Review and save.
import { el, modal } from './dom.js';
import { field, blank } from './form.js';
import { S, cur, put, page, pickers, problems, redraw } from './manage.js';
import { tagFields } from './tags.js';

const PARTS = [['knowledge', 'Knowledge'], ['drill', 'Drill'], ['sabbath', 'Beyond the Recipe']];
const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function checksLine() {
  const found = problems();
  return found.length
    ? el('div', { class: 'card mchecks' }, el('b', { class: 'err' }, `${found.length} thing${found.length === 1 ? '' : 's'} to fix before this can be saved`), el('ul', { class: 'mprob' }, found.map((p) => el('li', {}, p))))
    : null;
}

export function levelPage(id) {
  const file = `levels/${id}.json`;
  const V = cur(file);
  if (!V) return page(el('h1', {}, 'No such Level'));
  const schema = S.files['schema/level.schema.json'];
  const dishes = cur('course.json').dishes;
  const titleOf = (rid) => V.recipes.find((r) => r.id === rid)?.title ?? dishes.find((d) => d.id === rid)?.title ?? rid;
  const minutesOf = (rid) => V.recipes.find((r) => r.id === rid)?.minutes ?? dishes.find((d) => d.id === rid)?.minutes ?? 0;
  const weekMinutes = (w) => (w.kind ? w.minutes ?? 0 : minutesOf(w.recipe)) + PARTS.reduce((n, [k]) => n + (w[k]?.minutes ?? 0), 0);

  // A week's recipe and swap-ins: a dish in the course, or one of the Level's own.
  const recipeChoices = () => [
    ...V.recipes.map((r) => [r.id, `${r.title} (Level only)`]),
    ...dishes.map((d) => [d.id, d.title]),
  ];
  const options = (key, path) => {
    if (key === 'recipe' || (typeof key === 'number' && path?.at(-2) === 'swapIns')) return recipeChoices();
    if (key === 'skill') return pickers()('skills');
    return pickers()(key);
  };

  let typing = null;
  const totals = el('p', { class: 'mut' });
  const drawTotals = () => {
    const minutes = V.weeks.reduce((n, w) => n + weekMinutes(w), 0);
    const parts = V.weeks.length * PARTS.length;
    const written = V.weeks.reduce((n, w) => n + PARTS.filter(([k]) => w[k]?.body?.length).length, 0);
    totals.textContent = `${V.weeks.length} weeks, ${(minutes / 60).toFixed(1)} of about ${V.hours} hours planned. ${written} of ${parts} part pages written.`;
  };
  const checks = el('div', {}, checksLine());
  const stage = (note, structural, again) => {
    clearTimeout(typing);
    const go = () => { put(file, V, note); checks.replaceChildren(...[checksLine()].filter(Boolean)); drawTotals(); };
    if (structural) { go(); again(); } else typing = setTimeout(go, 300);
  };
  drawTotals();

  // One week: its recipe and skill, then each part's page.
  const weekSummary = (w) => [
    el('b', {}, `Week ${w.week}`), ' ',
    w.kind === 'practice' ? 'Practice run' : w.kind === 'capstone' ? 'Capstone' : titleOf(w.recipe),
    w.mastery ? el('b', { class: 'mlevel-tag' }, ' · Mastery') : null,
    el('small', { class: 'mut' }, ` ${Math.round(weekMinutes(w))} min`),
  ];
  const week = (w) => {
    const det = el('details', { class: 'mitem' }, el('summary', {}, weekSummary(w)));
    const body = el('div', { class: 'mitem-body' });
    const draw = () => {
      const holder = { w };
      body.replaceChildren(field({
        root: schema, options,
        onChange: (structural) => stage(`Edited Level week ${w.week}`, structural, () => { draw(); det.querySelector('summary').replaceChildren(...weekSummary(w)); }),
        readOnly: (p) => ['w.week', 'w.unit'].includes(p.join('.')),
        // A practice or capstone week sets its own minutes; any other takes its recipe's.
        hide: (p) => (w.kind ? ['w.skill', 'w.recipe', 'w.swapIns'] : ['w.kind', 'w.minutes']).includes(p.join('.')),
        hint: (p) => {
          const k = p.join('.');
          if (k === 'w.skill') return 'A recipe with this skill can be swapped in, and the best fit for the family is picked when the course is set up.';
          if (k === 'w.swapIns') return 'Dishes that fit the week without carrying its skill.';
          if (/^w\.(drill|knowledge|sabbath)\.body$/.test(k)) return 'The page a learner reads, one paragraph each.';
          return null;
        },
      }, holder, 'w', { ...schema.$defs.week, title: '' }, []));
    };
    det.addEventListener('toggle', () => { if (det.open && !body.childElementCount) draw(); });
    det.append(body);
    return el('li', {}, det);
  };

  const unit = (u) => {
    const holder = { u };
    const head = el('div', {});
    const drawHead = () => head.replaceChildren(field({
      root: schema, onChange: (structural) => stage(`Edited Level unit ${u.number}`, structural, drawHead), readOnly: (p) => p.join('.') === 'u.number',
    }, holder, 'u', { ...schema.properties.units.items, title: '' }, []));
    drawHead();
    return el('details', { class: 'card msec' }, el('summary', {}, el('h2', {}, `Unit ${u.number}: ${u.name}`)), head,
      el('ol', { class: 'mitems' }, V.weeks.filter((w) => w.unit === u.number).map(week)));
  };

  // The Level's own recipes: planned dish cards, in Side quests in their own unit.
  const recipe = (r) => {
    const det = el('details', { class: 'mitem' }, el('summary', {}, el('b', {}, r.title), el('small', { class: 'mut' }, ` ${r.id}`)));
    const body = el('div', { class: 'mitem-body' });
    const recipeSchema = { ...schema.$defs.recipe, title: '', properties: Object.fromEntries(Object.entries(schema.$defs.recipe.properties).filter(([k]) => k !== 'tags')) };
    const draw = () => {
      const holder = { r };
      body.replaceChildren(
        field({ root: schema, options, onChange: (structural) => stage(`Edited ${r.title}`, structural, draw), readOnly: (p) => p.join('.') === 'r.id' }, holder, 'r', recipeSchema, []),
        el('fieldset', { class: 'mf-obj' }, el('legend', {}, 'Tags'), tagFields(r, () => stage(`Tagged ${r.title}`, false))),
        el('button', {
          type: 'button', class: 'hbtn small-btn bad', onclick: () => {
            const close = modal(`Remove ${r.title}?`, el('p', {}, 'It comes out of the Level when you save. A week that uses it needs another recipe first; the checks will say so.'),
              el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Keep it'),
                el('button', { class: 'hbtn bad', onclick: () => { V.recipes.splice(V.recipes.indexOf(r), 1); put(file, V, `Removed ${r.title}`); close(); redraw(); } }, 'Remove')));
          },
        }, 'Remove…'));
    };
    det.addEventListener('toggle', () => { if (det.open && !body.childElementCount) draw(); });
    det.append(body);
    return el('li', {}, det);
  };
  const addRecipe = () => {
    const name = el('input', { required: true, maxlength: 80 });
    const err = el('p', { class: 'err', hidden: true });
    const close = modal('Add a Level recipe', el('form', {
      class: 'stack wide', onsubmit: (e) => {
        e.preventDefault();
        const rid = slug(name.value);
        if (!rid) { err.hidden = false; err.textContent = 'Give it a name.'; return; }
        if (V.recipes.some((x) => x.id === rid) || dishes.some((d) => d.id === rid)) { err.hidden = false; err.textContent = `There's already a recipe called "${rid}".`; return; }
        const r = blank(schema.$defs.recipe, schema);
        Object.assign(r, { id: rid, title: name.value.trim(), art: 'side', estimated: true });
        V.recipes.push(r);
        put(file, V, `Added ${r.title} to ${V.name}`);
        close();
        redraw();
      },
    }, el('label', { class: 'f' }, 'Name', name), err,
    el('p', { class: 'mut small' }, 'First check it against Cook Around the World: if a pick-one group there has room for it, or it can be a version of a planned dish, it goes there instead (§12.4).'),
    el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), el('button', { class: 'hbtn pri' }, 'Add'))));
  };

  page(el('h1', {}, V.name),
    el('p', { class: 'mut' }, `Only preview families see this until the next release launches. A week is done when its recipe is cooked. The Level's own recipes are in Side quests, in the "${V.sideUnit.name}" unit.`),
    totals, checks,
    V.units.map(unit),
    el('section', { class: 'card' }, el('div', { class: 'mhead' }, el('h2', {}, `${V.sideUnit.name} (${V.recipes.length})`), el('button', { class: 'hbtn small-btn', onclick: addRecipe }, '+ Add')),
      el('p', { class: 'mut small' }, 'Recipes only this Level uses. Each is a planned dish until its lesson is written.'),
      el('ol', { class: 'mitems' }, V.recipes.map(recipe))));
}
