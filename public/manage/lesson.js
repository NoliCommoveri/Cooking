// The lesson editor (plan §7.5): every part of one lesson, built from the lesson
// schema, with its dish card, its picture, the checks as you go, and its
// history. Changes are staged (manage.js) until Review and save.
import { el, modal } from './dom.js';
import { field } from './form.js';
import { S, D, api, cur, exists, put, putPicture, page, problems, syncDish, stageLesson, pickers, lessonFile, redraw, go } from './manage.js';
import { showValue, patchSpec } from '/lib/patch.js';
import { tagFields } from './tags.js';
import { applyVariation, diffVariation, lessonVersion } from '/lib/variations.js';

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
const DISH_KEYS = ['about', 'main', 'method', 'tags'];
// Set by the checkbox on the dish card, not as its own field. Variations have
// their own section.
const OWN_CONTROL = ['feast', 'variations'];
// A variation (plan §6.21) teaches what its lesson teaches, so these stay the lesson's.
const SAME = ['track', 'cuisine', 'skill', 'skills', 'prereqs', 'image'];

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

// vid: edit that variation of the lesson instead (§6.21). It's edited as a
// whole copy of the lesson, and saved into the lesson file as what differs.
export function lessonPage(id, vid = null) {
  const path = lessonFile(id);
  if (!exists(path)) return page(el('p', {}, el('a', { href: '#/' }, '← The course')), el('h1', {}, 'No such lesson'), el('p', {}, `There's no lesson called "${id}".`));
  const schema = S.files['schema/lesson.schema.json'];
  const L = cur(path);
  const v = vid ? (L.variations ?? []).find((x) => x.id === vid) : null;
  if (vid && !v) return page(el('p', {}, el('a', { href: `#/lesson/${id}` }, `← ${L.title}`)), el('h1', {}, 'No such version'), el('p', {}, `${L.title} has no version called "${vid}".`));
  // What the fields edit: the lesson, or the whole variation.
  const W = v ? applyVariation(L, v) : L;
  const units = cur('units.json').units;
  const seasonalUnit = units.find((u) => u.number === L.unit)?.seasonal ?? false;
  const course = cur('course.json');
  const dish = course.dishes.find((d) => d.id === id) ?? null;
  const fix = D.fix?.lesson === id ? D.fix : null;

  let typing = null;
  const commit = (structural) => {
    giveIds(W);
    if (v) {
      const now = diffVariation(L, W, { id: v.id, tags: v.tags });
      for (const k of Object.keys(v)) delete v[k];
      Object.assign(v, now);
      put(path, L, `Edited ${W.title} (a version of ${L.title})`);
    } else {
      put(path, L, `Edited ${L.title}`);
      if (dish) { syncDish(L, dish); put('course.json', course, `Edited ${L.title}`); }
    }
    checkSoon();
    if (structural) { const y = scrollY; draw(); scrollTo(0, y); }
  };
  const onChange = (structural) => {
    clearTimeout(typing);
    if (structural) commit(true); else typing = setTimeout(() => commit(false), 300);
  };
  const ctx = {
    root: schema, onChange, options: (key) => pickers(W)(key),
    readOnly: (p) => p.length === 1 && (p[0] in SET_FOR_YOU || (v && SAME.includes(p[0]))),
    hint: (p) => (p.length !== 1 ? null : v && SAME.includes(p[0]) ? 'The same as the lesson: every version teaches the same thing.' : SET_FOR_YOU[p[0]]),
    hide: (p) => p.length === 1 && (v || !seasonalUnit) && DISH_KEYS.includes(p[0]),
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
  const named = new Set([...SECTIONS.flatMap(([, keys]) => keys), ...Object.keys(SET_FOR_YOU), ...DISH_KEYS, ...OWN_CONTROL]);
  function draw() {
    const open = new Set([...sections.querySelectorAll('details[open]')].map((d) => d.dataset.k));
    const first = !sections.childElementCount;
    const extra = Object.keys(schema.properties).filter((k) => !named.has(k));
    const sec = (title, keys, startOpen, k = title) => el('details', { class: 'card msec', 'data-k': k, open: first ? startOpen : open.has(k) },
      el('summary', {}, el('h2', {}, title)),
      keys.map((key) => {
        if (!(key in W) && !(schema.required ?? []).includes(key)) {
          return ctx.hide([key]) || (v && SAME.includes(key)) ? null : el('button', { type: 'button', class: 'hbtn small-btn', onclick: () => { W[key] = blankOf(key); onChange(true); } }, `+ Add ${key}`);
        }
        return el('div', { class: 'mf-field' }, field(ctx, W, key, schema.properties[key], []));
      }));
    sections.replaceChildren(...[
      sec('The basics', [...SECTIONS[0][1], 'id', 'version', 'unit'], first ? true : open.has('The basics')),
      v ? versionCard() : dishCard(),
      v ? null : variationsCard(),
      ...SECTIONS.slice(1).map(([t, keys, o]) => sec(t, keys, o)),
      extra.length ? sec('Everything else', extra, false) : null,
    ].filter(Boolean));
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
        'A side, bread, or dessert (not a full meal)'),
      // Good for Feast Days (§6.19): the badge, and offered in Swap all year
      // round. An Appointed Times lesson always has it.
      el('fieldset', { class: 'mf-obj' }, el('legend', {}, 'Tags'),
        el('p', { class: 'mut small' }, 'The words families rate dishes by. All dishes are on the Tags page too.'),
        tagFields(holder, () => onChange(false))),
      seasonalUnit ? null : el('label', { class: 'choice' },
        el('input', { type: 'checkbox', checked: L.feast === true, onchange: (e) => { if (e.target.checked) L.feast = true; else delete L.feast; onChange(false); } }),
        'Good for Feast Days'));
  }

  // Variations (§6.21): complete versions of this lesson with a preference built in.
  function variationsCard() {
    const list = L.variations ?? [];
    return el('details', { class: 'card msec', 'data-k': 'variations' },
      el('summary', {}, el('h2', {}, `Variations (${list.length})`)),
      el('p', { class: 'mut small' }, "Complete versions of this lesson with a preference built in, like Chimichurri chicken for Chimichurri steak. Each one teaches the same skill and counts as this lesson. Whatever a variation doesn't change stays shared with the lesson, so a fix here reaches it too. Each one is checked like a whole lesson."),
      list.length ? el('ul', { class: 'mvars' }, list.map((x) => el('li', {}, el('a', { href: `#/lesson/${id}/v/${x.id}` }, x.title)))) : null,
      el('button', { type: 'button', class: 'hbtn small-btn', onclick: () => addVariation(L, dish) }, '+ Add a variation'));
  }
  // A variation's own card: its tags, and taking it out.
  function versionCard() {
    return el('section', { class: 'card msec' },
      el('h2', {}, 'This version'),
      el('p', { class: 'mut small' }, `Its name in the files is "${v.id}". Change anything below that differs from ${L.title}: the protein, amounts, times, doneness target, steps, tools, or Learn cards.`),
      el('fieldset', { class: 'mf-obj' }, el('legend', {}, 'Tags'),
        el('p', { class: 'mut small' }, 'Tagged like a dish, so families can be offered the version that suits them.'),
        tagFields(v, () => onChange(false))),
      el('button', { type: 'button', class: 'hbtn small-btn', onclick: () => {
        if (!confirm(`Take ${v.title} out of ${L.title}? Families who picked it go back to ${L.title}. Undo my changes here brings it back until you save.`)) return;
        L.variations = L.variations.filter((x) => x.id !== v.id);
        if (!L.variations.length) delete L.variations;
        put(path, L, `Took ${v.title} out of ${L.title}`);
        go(`#/lesson/${id}`);
      } }, 'Take this version out'));
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
  if (v) {
    page(
      el('p', {}, el('a', { href: `#/lesson/${id}` }, `← ${L.title}`)),
      el('div', { class: 'mhead' }, el('h1', {}, W.title),
        el('div', { class: 'acts' }, el('a', { class: 'hbtn pri', href: `#/try/${id}/${v.id}` }, 'Preview as a learner'),
          path in D.files && path in S.files ? el('button', { class: 'hbtn', onclick: () => { stageLesson(structuredClone(S.files[path])); redraw(); } }, 'Undo my changes here') : null)),
      el('p', { class: 'mut' }, `A version of ${L.title} · counts as that lesson`),
      checks,
      sections,
    );
    draw();
    showChecks();
    return;
  }
  page(
    el('p', {}, el('a', { href: '#/' }, '← The course')),
    el('div', { class: 'mhead' }, el('h1', {}, L.title),
      el('div', { class: 'acts' }, el('a', { class: 'hbtn pri', href: `#/try/${id}` }, 'Preview as a learner'),
        el('button', { class: 'hbtn', onclick: () => historyDialog(path, L.title) }, 'History…'),
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

// + Add a variation (§6.21): it starts as a copy of the lesson, with the
// dish's tags, and opens in its own editor to change. gap: from Recipe gaps
// (11e), { tags, note }: the tags it's for, and what it should be.
function addVariation(L, dish, gap = null) {
  const title = el('input', { maxlength: 80, placeholder: 'Like "Chimichurri chicken" for Chimichurri steak' });
  const msg = el('p', { class: 'err', role: 'alert' });
  const close = modal('Add a variation', el('form', { onsubmit: (e) => {
    e.preventDefault();
    const t = title.value.trim().replace(/\s+/g, ' ');
    if (!t) { msg.textContent = 'Give it a name.'; return; }
    if (t === L.title || (L.variations ?? []).some((x) => x.title === t)) { msg.textContent = 'That name is taken. Give this version its own.'; return; }
    // "Chimichurri chicken" is "chicken" in the files: the first word of the lesson's title is left off.
    const first = `${L.title.split(' ')[0]} `.toLowerCase();
    const base = slug(t.toLowerCase().startsWith(first) ? t.slice(first.length) : t) || 'version';
    let vid = base;
    for (let n = 2; (L.variations ?? []).some((x) => x.id === vid); n++) vid = `${base}-${n}`;
    const tags = gap?.tags ?? dish?.tags ?? L.tags;
    L.variations = [...(L.variations ?? []), { id: vid, title: t, ...(tags ? { tags: structuredClone(tags) } : {}) }];
    put(lessonFile(L.id), L, `Added ${t}, a version of ${L.title}`);
    close();
    go(`#/lesson/${L.id}/v/${vid}`);
  } },
  el('p', { class: 'mut small' }, `A complete version of ${L.title} with a preference built in. It starts as a copy of the lesson; change what differs on the next page.`),
  gap ? el('p', { class: 'card notice small' }, el('b', {}, 'From Recipe gaps: '), gap.note, '. Its tags are filled in for it; change them on the next page.') : null,
  el('label', { class: 'f' }, 'Its name, as families see it', title),
  msg,
  el('div', { class: 'acts' }, el('button', { type: 'submit', class: 'hbtn pri' }, 'Add and edit it'), el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'))));
}

// Write next, from Recipe gaps (§6.21, 11e): the lesson, with Add a
// variation open and the gap's tags ready.
export function gapVariation(id, gap) {
  lessonPage(id);
  const L = cur(lessonFile(id));
  if (L) addVariation(L, cur('course.json').dishes.find((d) => d.id === id) ?? null, gap);
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

// Preview as a learner (plan §7.5): the lesson in the real player, as it stands
// here with any unsaved changes, in either theme, as a kid or an adult. Prep
// doesn't need checking off, any stage is a tap away, and nothing is saved
// to any family or counted anywhere.
const PREVIEW_KEY = 'cpr-manage-preview';
export async function previewPage(id, vid = null) {
  const path = lessonFile(id);
  if (!exists(path)) return page(el('p', {}, el('a', { href: '#/' }, '← The course')), el('h1', {}, 'No such lesson'), el('p', {}, `There's no lesson called "${id}".`));
  let V = { theme: 'quest', audience: 'kid' };
  try { V = { ...V, ...JSON.parse(localStorage.getItem(PREVIEW_KEY)) }; } catch { /* first time */ }
  // A variation previews as the whole lesson it makes (§6.21).
  const L = lessonVersion(cur(path), vid);
  const back = vid ? `#/lesson/${id}/v/${vid}` : `#/lesson/${id}`;
  const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
  const seg = (k, opts) => el('div', { class: 'seg', role: 'group' }, opts.map(([v, label]) => el('button', {
    type: 'button', 'aria-pressed': String(V[k] === v),
    onclick: () => { V[k] = v; try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(V)); } catch { /* not kept */ } previewPage(id, vid); },
  }, label)));
  const mount = el('div');
  page(
    el('p', {}, el('a', { href: back }, `← ${L.title}`)),
    el('div', { class: 'mhead' }, el('h1', {}, 'Preview as a learner')),
    el('p', { class: 'mut' }, 'As a family sees it, with your unsaved changes. Nothing is saved or counted.'),
    el('div', { class: 'acts pv-pick' }, seg('theme', [['quest', 'Kitchen Quest'], ['passport', "Chef's Passport"]]), seg('audience', [['kid', 'A kid'], ['adult', 'An adult']])),
    mount,
  );
  const { openLesson } = await import('/player.js');
  await openLesson(mount, {
    // Its own place on this device for where the preview is up to, apart from any real cook.
    profile: { id: `preview-${V.theme}-${V.audience}`, name: 'Preview', theme: V.theme, audience: V.audience },
    family: { diet_filters: [], default_servings: L.servings, voice_enabled: true },
    lesson: L,
    preview: true,
    registry: {
      ingredients: byId(cur('ingredients.json').ingredients), equipment: byId(cur('equipment.json').equipment),
      skills: byId(cur('skills.json').skills), terms: cur('terms.json').terms, cuisines: byId(cur('cuisines.json').cuisines),
    },
    onExit: () => go(back),
  });
}
