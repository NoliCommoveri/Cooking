// The lesson editor (plan §7.5): every part of one lesson, built from the lesson
// schema, with its dish card, its picture, the checks as you go, and its
// history. Changes are staged (manage.js) until Review and save.
import { el, modal } from './dom.js';
import { field } from './form.js';
import { S, D, api, cur, exists, put, putPicture, page, problems, syncDish, stageLesson, pickers, lessonFile, redraw } from './manage.js';
import { showValue, patchSpec } from '/lib/patch.js';

// The editor's sections, in the order a lesson is written. Anything the schema
// has that isn't named here lands in "Everything else", so a new field shows up.
const SECTIONS = [
  ['The basics', ['title', 'track', 'cuisine', 'skill', 'skills', 'servings', 'totalMinutes', 'prereqs'], true],
  ['Learn: the move and the why', ['learn'], false],
  ['Ingredients', ['ingredients'], false],
  ['Substitutions', ['substitutions'], false],
  ['Tools', ['equipment'], false],
  ['Steps', ['steps'], true],
  ['Scaling', ['scaling'], false],
  ['Intro slides', ['intro'], false],
];
const SET_FOR_YOU = { id: 'Its name in the files; fixed once made.', version: 'Goes up on its own when steps or ingredients change.', image: 'The picture below.', unit: 'Move it on the Course page.' };
const DISH_KEYS = ['about', 'main', 'method'];

const slug = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Steps and why cards need ids other parts point at; a new one gets one from its words.
function giveIds(L) {
  const unique = (list, base, i) => {
    let id = slug(base) || `item-${i + 1}`;
    for (let n = 2; list.some((x, j) => j !== i && x.id === id); n++) id = `${slug(base) || 'item'}-${n}`;
    return id;
  };
  L.steps.forEach((s, i) => { if (!s.id) s.id = unique(L.steps, `step-${i + 1}`, i); });
  (L.learn?.why ?? []).forEach((w, i) => { if (!w.id && w.title) w.id = unique(L.learn.why, w.title, i); });
}

export function lessonPage(id) {
  const path = lessonFile(id);
  if (!exists(path)) return page(el('p', {}, el('a', { href: '#/' }, '← The course')), el('h1', {}, 'No such lesson'), el('p', {}, `There's no lesson called "${id}".`));
  const schema = S.files['schema/lesson.schema.json'];
  const L = cur(path);
  const units = cur('units.json').units;
  const seasonalUnit = units.find((u) => u.number === L.unit)?.seasonal ?? false;
  const course = cur('course.json');
  const dish = course.dishes.find((d) => d.id === id) ?? null;
  const fix = D.fix?.lesson === id ? D.fix : null;

  let typing = null;
  const commit = (structural) => {
    giveIds(L);
    put(path, L, `Edited ${L.title}`);
    if (dish) { syncDish(L, dish); put('course.json', course, `Edited ${L.title}`); }
    checkSoon();
    if (structural) { const y = scrollY; draw(); scrollTo(0, y); }
  };
  const onChange = (structural) => {
    clearTimeout(typing);
    if (structural) commit(true); else typing = setTimeout(() => commit(false), 300);
  };
  const ctx = {
    root: schema, onChange, options: (key) => pickers(L)(key),
    readOnly: (p) => p.length === 1 && p[0] in SET_FOR_YOU,
    hint: (p) => (p.length === 1 ? SET_FOR_YOU[p[0]] : null),
    hide: (p) => p.length === 1 && !seasonalUnit && DISH_KEYS.includes(p[0]),
  };

  const checks = el('div', { class: 'card mchecks', 'aria-live': 'polite' });
  let checking = null;
  const checkSoon = () => { clearTimeout(checking); checking = setTimeout(showChecks, 500); };
  function showChecks() {
    const found = problems();
    checks.replaceChildren(found.length
      ? el('div', {}, el('b', { class: 'err' }, `${found.length} thing${found.length === 1 ? '' : 's'} to fix before this can be saved`), el('ul', { class: 'mprob' }, found.map((p) => el('li', {}, p))))
      : el('p', { class: 'ok' }, path in D.files ? 'The checks pass. Review and save when you\'re ready.' : 'The checks pass.'));
  }

  const sections = el('div', { class: 'msections' });
  const named = new Set([...SECTIONS.flatMap(([, keys]) => keys), ...Object.keys(SET_FOR_YOU), ...DISH_KEYS]);
  function draw() {
    const open = new Set([...sections.querySelectorAll('details[open]')].map((d) => d.dataset.k));
    const first = !sections.childElementCount;
    const extra = Object.keys(schema.properties).filter((k) => !named.has(k));
    const sec = (title, keys, startOpen, k = title) => el('details', { class: 'card msec', 'data-k': k, open: first ? startOpen : open.has(k) },
      el('summary', {}, el('h2', {}, title)),
      keys.map((key) => {
        if (!(key in L) && !(schema.required ?? []).includes(key)) {
          return ctx.hide([key]) ? null : el('button', { type: 'button', class: 'hbtn small-btn', onclick: () => { L[key] = blankOf(key); onChange(true); } }, `+ Add ${key}`);
        }
        return el('div', { class: 'mf-field' }, field(ctx, L, key, schema.properties[key], []));
      }));
    sections.replaceChildren(
      sec('The basics', [...SECTIONS[0][1], 'id', 'version', 'unit'], first ? true : open.has('The basics')),
      dishCard(),
      ...SECTIONS.slice(1).map(([t, keys, o]) => sec(t, keys, o)),
      extra.length ? sec('Everything else', extra, false) : null,
    );
  }
  const blankOf = (key) => {
    const s = schema.properties[key];
    return s.type === 'array' ? [] : s.type === 'object' ? {} : '';
  };

  // The card families see on the queue and course screens: in course.json for
  // a numbered lesson, on the lesson itself for a seasonal one.
  function dishCard() {
    const holder = seasonalUnit ? L : dish;
    if (!holder) return null;
    const cardSchema = {
      type: 'object', properties: {
        ...(seasonalUnit ? {} : { skill: { type: 'string', title: 'Skill line in the course outline' } }),
        about: { type: 'string' }, main: { type: 'array', items: { type: 'string' } }, method: { enum: ['stove', 'oven', 'stove-oven', 'no-cook'] },
        ...(seasonalUnit ? {} : { pickOne: { type: 'string' } }),
      },
    };
    const c = { root: cardSchema, onChange: (s) => onChange(s), options: (key) => pickers(L)(key) };
    const kids = Object.keys(cardSchema.properties).map((k) => (k in holder
      ? el('div', { class: 'mf-field' }, field(c, holder, k, cardSchema.properties[k], []), k === 'pickOne' ? el('button', { type: 'button', class: 'hbtn link small', onclick: () => { delete holder.pickOne; onChange(true); } }, 'Not in a pick-one group') : null)
      : el('button', { type: 'button', class: 'hbtn small-btn', onclick: () => { holder[k] = k === 'main' ? [] : k === 'method' ? 'stove' : ''; onChange(true); } }, `+ ${k === 'pickOne' ? 'Put in a pick-one group' : k}`)));
    return el('details', { class: 'card msec', 'data-k': 'dish' },
      el('summary', {}, el('h2', {}, 'The dish card')),
      el('p', { class: 'mut small' }, 'What families see on the course and queue screens. A pick-one group is a set of dishes next to each other that share one number; a family cooks one of them.'),
      kids,
      seasonalUnit ? null : el('label', { class: 'choice' },
        el('input', { type: 'checkbox', checked: dish.meal === false, onchange: (e) => { if (e.target.checked) dish.meal = false; else delete dish.meal; onChange(false); } }),
        'A side, bread, or dessert (not a full meal)'));
  }

  // The picture: a new one is made a PNG in this browser and saved with the lesson.
  const picPath = L.image.replace(/^dishes\//, 'dishes/');
  const staged = D.pictures[picPath];
  const img = el('img', { class: 'mpic', alt: `${L.title}`, src: staged ? `data:image/png;base64,${staged}` : `/img/${L.image.replace(/\.png$/, '.webp')}` });
  img.onerror = () => { img.replaceWith(el('p', { class: 'mut' }, 'No picture yet.')); };
  const file = el('input', {
    type: 'file', accept: 'image/*', onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        putPicture(picPath, await toPng(f), `New picture for ${L.title}`);
        redraw();
      } catch (err) { alert(`That picture couldn't be read: ${err.message}`); }
    },
  });

  const patched = S.patched[id];
  page(
    el('p', {}, el('a', { href: '#/' }, '← The course')),
    el('div', { class: 'mhead' }, el('h1', {}, L.title),
      el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => historyDialog(path, L.title) }, 'History…'),
        path in D.files && path in S.files ? el('button', { class: 'hbtn', onclick: () => { stageLesson(structuredClone(S.files[path])); redraw(); } }, 'Undo my changes here') : null)),
    el('p', { class: 'mut' }, `${seasonalUnit ? units.find((u) => u.number === L.unit).name : `Unit ${L.unit}`} · version ${L.version}${!exists('hidden.json') || !(cur('hidden.json').lessons ?? []).includes(id) ? '' : ' · hidden from families'}`),
    patched ? el('p', { class: 'mwarn' }, 'Fixes applied from fix requests are shown here. Saving this lesson writes them into its file for good.') : null,
    fix ? fixBanner(fix) : null,
    checks,
    el('section', { class: 'card mpicture' }, el('h2', {}, 'Picture'), img, el('label', { class: 'f' }, 'Upload a new picture', el('span', { class: 'hint' }, 'A square picture of the dish looks best. Every lesson needs one before it can be saved. It goes up with your next save.'), file)),
    sections,
  );
  draw();
  showChecks();
}

function fixBanner(fix) {
  const spec = fix.field ? patchSpec(fix.field) : null;
  const reply = el('textarea', { rows: 2, maxlength: 500, oninput: (e) => { D.fix.reply = e.target.value; } });
  reply.value = fix.reply ?? '';
  return el('section', { class: 'card mfix' },
    el('h2', {}, 'Answering a fix request'),
    el('p', {}, el('b', {}, 'What they said: '), fix.note),
    fix.field ? el('p', {}, el('b', {}, `${spec?.label ?? fix.field}: `), `${showValue(spec?.kind, fix.current)} → ${showValue(spec?.kind, fix.suggested)}`, el('span', { class: 'mut' }, ' (already filled in below)')) : null,
    el('label', { class: 'f' }, 'A note back to them (optional)', reply),
    el('p', { class: 'mut small' }, 'Saving marks the request fixed, and their family sees your note on the lesson.'),
    el('button', { class: 'hbtn link', onclick: () => { D.fix = null; redraw(); } }, 'Stop answering it (the changes stay)'));
}

async function historyDialog(path, title) {
  const body = el('div', {}, el('p', { class: 'mut' }, 'Loading…'));
  const close = modal(`${title}: history`, body, el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Close')));
  if (!S.github) { body.replaceChildren(el('p', {}, 'History comes from GitHub, which isn\'t connected yet.')); return; }
  try {
    const { versions } = await api('GET', `/history?path=${encodeURIComponent(path)}`);
    body.replaceChildren(el('p', { class: 'mut small' }, 'Every saved version, newest first. Loading one stages it as a change; nothing goes live until you save.'),
      el('ol', { class: 'mhist' }, versions.map((v, i) => el('li', {},
        el('div', { class: 'grow' }, el('b', {}, v.message), el('small', { class: 'mut' }, ` ${new Date(v.date).toLocaleString()}`)),
        i === 0 ? el('span', { class: 'mut small' }, 'Now') : el('button', {
          class: 'hbtn small-btn', onclick: async () => {
            const { value } = await api('GET', `/version?path=${encodeURIComponent(path)}&ref=${v.sha}`);
            const L = cur(path);
            // The unit and number stay where the course has it now.
            stageLesson({ ...value, unit: L.unit, version: L.version }, `Put ${title} back to the version from ${new Date(v.date).toLocaleDateString()}`);
            close();
            redraw();
          },
        }, 'Load this version')))));
  } catch (err) { body.replaceChildren(el('p', { class: 'err' }, err.message)); }
}

// A picture from the phone or computer, at most 1024 pixels wide, as PNG data.
async function toPng(file) {
  const bmp = await createImageBitmap(file);
  const w = Math.min(1024, bmp.width), h = Math.round(bmp.height * (w / bmp.width));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  const url = c.toDataURL('image/png');
  return url.slice(url.indexOf(',') + 1);
}
