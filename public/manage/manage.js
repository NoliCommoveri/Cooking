// Clean Plate manager (plan §7.5): the owner keeps the content up to date from
// the browser. Every change is staged here first (the bar at the bottom counts
// them), checked by the same content linter GitHub runs, and saved as one
// commit to the repo, where the publish workflow checks it again and puts it
// live. Routes live in the hash: #/ (the course), #/lesson/<id>, #/try/<id>, #/saves,
// #/list/<file>, #/rules, #/fix/<id>.
import { el, modal } from './dom.js';
import { field, blank } from './form.js';
import { lint } from '/lib/lint.js';
import { contentFromFiles } from '/lib/load.js';
import { numberCourse, seasonalLabels } from '/lib/course.js';
import { SAFETY } from '/lib/recipe.js';
import { lessonPage, previewPage } from './lesson.js';
import { listPage, rulesPage } from './lists.js';
import { fixPage } from './fix.js';

const app = document.getElementById('app');

// ---------- talking to the Worker ----------

export async function api(method, path, body) {
  const write = method !== 'GET';
  const res = await fetch(`/manage/api${path}`, {
    method,
    headers: write ? { 'content-type': 'application/json' } : {},
    body: write ? JSON.stringify(body ?? {}) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong. Try again.');
    Object.assign(err, { code: data.error, problems: data.problems, status: res.status });
    throw err;
  }
  return data;
}

// ---------- the content, and the changes staged on top of it ----------

// S: the content as it is on GitHub. D: the changes not saved yet, kept in this
// browser (so a reload or a phone call doesn't lose them) until Save or Discard.
export const S = { head: null, github: false, files: {}, blobs: {}, images: [], patched: {}, baseline: new Set() };
const DRAFT_KEY = 'cpr-manage-draft';
const emptyDraft = () => ({ files: {}, pictures: {}, was: {}, notes: [], fix: null });
export let D = emptyDraft();
try { D = { ...emptyDraft(), ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') }; } catch { /* storage off: changes live for this page only */ }
const keep = () => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(D)); } catch { /* nothing to do */ } };

const clone = (v) => (v === undefined ? undefined : structuredClone(v));
export const cur = (path) => clone(path in D.files ? D.files[path] : S.files[path]) ?? null;
export const exists = (path) => (path in D.files ? D.files[path] !== null : path in S.files);
export const images = () => [...new Set([...S.images, ...Object.keys(D.pictures)])];
export const changedCount = () => Object.keys(D.files).length + Object.keys(D.pictures).length;

// Stages a file's new value (null removes a lesson file). A file put back the
// way it is on GitHub drops out of the changes.
export function put(path, value, note) {
  if (!(path in D.was)) D.was[path] = S.blobs[path] ?? null;
  D.files[path] = clone(value);
  if (JSON.stringify(D.files[path]) === JSON.stringify(S.files[path] ?? null)) { delete D.files[path]; delete D.was[path]; }
  if (note && D.notes.at(-1) !== note) D.notes.push(note);
  keep();
  saveBar();
}
export function putPicture(path, base64, note) {
  D.pictures[path] = base64;
  if (note) D.notes.push(note);
  keep();
  saveBar();
}
export function discard() {
  D = emptyDraft();
  keep();
}

export async function load() {
  const c = await api('GET', '/content');
  Object.assign(S, { head: c.head, github: c.github, files: c.files, blobs: c.blobs, images: c.images, patched: c.patched ?? {} });
  // What the checks already say about the content as it is: only new problems stop a save.
  try { S.baseline = new Set(lint(contentFromFiles(S.files, S.images)).errors); } catch { S.baseline = new Set(); }
}

// The checks the content linter would make on the content with the staged
// changes, as GitHub will make them. Only problems the changes bring count.
export function problems() {
  const files = { ...S.files };
  for (const [p, v] of Object.entries(D.files)) { if (v === null) delete files[p]; else files[p] = v; }
  const touched = Object.keys(D.files);
  const lessons = touched.filter((p) => p.startsWith('lessons/')).map((p) => p.slice(8, -5));
  const renderOnly = touched.every((p) => p.startsWith('lessons/') || p === 'course.json' || p === 'hidden.json') ? new Set(lessons) : undefined;
  try {
    return lint({ ...contentFromFiles(files, images()), renderOnly }).errors.filter((e) => !S.baseline.has(e));
  } catch (err) {
    return [String(err.message)];
  }
}

// ---------- the course: units and lessons ----------

export const lessonFile = (id) => `lessons/${id}.json`;
const units = () => cur('units.json').units;
const seasonal = (n) => units().find((u) => u.number === n)?.seasonal ?? false;
const hiddenSet = () => new Set(cur('hidden.json')?.lessons ?? []);

// A lesson's safety level is its highest step's (§3); the course card shows it.
export const lessonSafety = (L) => SAFETY[Math.max(0, ...L.steps.map((s) => SAFETY.indexOf(s.safety)))];

// The course entry carries copies of the lesson's title, unit, cuisine, skills,
// picture, time, safety, and prerequisites (the linter checks most match), so a
// lesson change is copied onto it. Its skill line is its own wording.
export function syncDish(L, dish) {
  Object.assign(dish, {
    title: L.title, unit: L.unit, cuisine: L.cuisine, skills: [...L.skills], image: L.image,
    safety: lessonSafety(L), minutes: L.totalMinutes,
  });
  dish.skill ??= L.skill;
  delete dish.estimated;
  if (L.prereqs.length) dish.prereqs = [...L.prereqs]; else delete dish.prereqs;
  return dish;
}

// Stages a lesson and its course entry together.
export function stageLesson(L, note) {
  put(lessonFile(L.id), L, note);
  const c = cur('course.json');
  const d = c.dishes.find((x) => x.id === L.id);
  if (d) { syncDish(L, d); put('course.json', c, note); }
}

// Unit numbers run 1, 2, 3… in course order, with seasonal units after them.
// Renumbering rewrites every place a number is: units.json, course.json, and
// every lesson file.
function renumber(map, note) {
  if (!Object.keys(map).length) return;
  const to = (n) => map[n] ?? n;
  const u = cur('units.json');
  u.units = u.units.map((x) => ({ ...x, number: to(x.number) })).sort((a, b) => a.number - b.number);
  put('units.json', u, note);
  const c = cur('course.json');
  c.dishes.forEach((d) => { d.unit = to(d.unit); });
  c.dishes = sortCourse(c.dishes);
  put('course.json', c, note);
  for (const p of Object.keys({ ...S.files, ...D.files })) {
    if (!p.startsWith('lessons/') || !exists(p)) continue;
    const L = cur(p);
    if (map[L.unit] != null) { L.unit = to(L.unit); put(p, L, note); }
  }
}

// The course stays in unit order; within a unit, the order is the owner's.
const sortCourse = (dishes) => dishes.map((d, i) => [d, i]).sort((a, b) => a[0].unit - b[0].unit || a[1] - b[1]).map(([d]) => d);

function addUnit(name) {
  const all = units();
  const numbered = all.filter((x) => !x.seasonal);
  const n = (numbered.at(-1)?.number ?? 0) + 1;
  // A seasonal unit in the way moves up one.
  const bump = {};
  for (const x of all.filter((y) => y.seasonal && y.number >= n)) bump[x.number] = x.number + 1;
  renumber(bump, `Added unit ${n}: ${name}`);
  const u = cur('units.json');
  u.units.push({ number: n, name });
  u.units.sort((a, b) => a.number - b.number);
  put('units.json', u, `Added unit ${n}: ${name}`);
}

function swapUnits(a, b) {
  renumber({ [a]: b, [b]: a }, `Swapped units ${a} and ${b}`);
}

function removeUnit(n) {
  const all = units();
  const name = all.find((x) => x.number === n).name;
  const u = cur('units.json');
  u.units = u.units.filter((x) => x.number !== n);
  put('units.json', u, `Removed unit ${n}: ${name}`);
  const down = {};
  for (const x of all) if (x.number > n) down[x.number] = x.number - 1;
  renumber(down, `Removed unit ${n}: ${name}`);
}

function renameUnit(n, name) {
  const u = cur('units.json');
  u.units.find((x) => x.number === n).name = name;
  put('units.json', u, `Renamed unit ${n} to ${name}`);
}

// Moves a lesson (or a planned dish) to a unit, after `after` (an id in that
// unit) or first in it. Moving into or out of a seasonal unit moves the dish
// card between course.json and the lesson file, where each kind keeps it.
export function moveLesson(id, unit, after = null) {
  const c = cur('course.json');
  const u = cur('units.json');
  const L = exists(lessonFile(id)) ? cur(lessonFile(id)) : null;
  const title = L?.title ?? c.dishes.find((d) => d.id === id)?.title ?? id;
  const note = `Moved ${title} to unit ${unit}`;
  let dish = c.dishes.find((d) => d.id === id) ?? null;
  const from = u.units.find((x) => (x.lessons ?? []).includes(id));
  if (from) from.lessons = from.lessons.filter((x) => x !== id);
  c.dishes = c.dishes.filter((d) => d.id !== id);
  const target = u.units.find((x) => x.number === unit);
  if (target.seasonal) {
    if (!L) throw new Error('Write the lesson before it can go in a seasonal unit.');
    // A seasonal lesson carries its own dish card.
    if (dish) for (const k of ['about', 'main', 'method']) if (dish[k] != null) L[k] = clone(dish[k]);
    const list = target.lessons ?? (target.lessons = []);
    list.splice(after ? list.indexOf(after) + 1 : 0, 0, id);
  } else {
    if (!dish) {
      dish = { id, title: L.title, unit, cuisine: L.cuisine, skills: [], skill: L.skill, image: L.image, safety: 'solo', minutes: L.totalMinutes, about: L.about, main: L.main, method: L.method };
      for (const k of ['about', 'main', 'method']) delete L[k];
    }
    // A pick-one group's dishes sit together in one unit, so a dish that
    // leaves its unit leaves its group.
    if (dish.unit !== unit) delete dish.pickOne;
    dish.unit = unit;
    if (L) { L.unit = unit; syncDish(L, dish); }
    const at = after ? c.dishes.findIndex((d) => d.id === after) + 1 : c.dishes.findIndex((d) => d.unit >= unit);
    c.dishes.splice(at < 0 ? c.dishes.length : at, 0, dish);
    c.dishes = sortCourse(c.dishes);
  }
  if (L) { L.unit = unit; put(lessonFile(id), L, note); }
  put('course.json', c, note);
  put('units.json', u, note);
}

function nudge(id, dir) {
  const c = cur('course.json');
  const i = c.dishes.findIndex((d) => d.id === id);
  if (i >= 0) {
    const j = i + dir;
    if (j < 0 || j >= c.dishes.length || c.dishes[j].unit !== c.dishes[i].unit) return;
    [c.dishes[i], c.dishes[j]] = [c.dishes[j], c.dishes[i]];
    put('course.json', c, `Moved ${c.dishes[j].title} ${dir < 0 ? 'up' : 'down'}`);
    return;
  }
  const u = cur('units.json');
  const s = u.units.find((x) => (x.lessons ?? []).includes(id));
  const k = s.lessons.indexOf(id), m = k + dir;
  if (m < 0 || m >= s.lessons.length) return;
  [s.lessons[k], s.lessons[m]] = [s.lessons[m], s.lessons[k]];
  put('units.json', u, `Moved ${cur(lessonFile(id))?.title ?? id} ${dir < 0 ? 'up' : 'down'}`);
}

function setHidden(id, hide, title) {
  const h = cur('hidden.json') ?? { note: '', lessons: [] };
  h.lessons = hide ? [...new Set([...h.lessons, id])] : h.lessons.filter((x) => x !== id);
  put('hidden.json', h, `${hide ? 'Hid' : 'Unhid'} ${title}`);
}

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// A new lesson: a lesson file to fill in (blank, or a copy of another) and, in
// a numbered unit, its place in the course.
export function newLesson({ title, unit, after, copyOf }) {
  const id = slug(title);
  if (!id) throw new Error('Give it a title.');
  if (exists(lessonFile(id)) || cur('course.json').dishes.some((d) => d.id === id)) throw new Error(`There's already a lesson called "${id}". Pick another title.`);
  const schema = S.files['schema/lesson.schema.json'];
  const L = copyOf ? cur(lessonFile(copyOf)) : blank(schema, schema);
  Object.assign(L, { id, version: 1, title, unit, image: `dishes/${id}.png` });
  if (!copyOf) Object.assign(L, { track: 'core', servings: 4, totalMinutes: 60, scaling: { mode: 'free' }, steps: [{ id: 'step-1', text: '', safety: 'solo' }] });
  if (!seasonal(unit)) for (const k of ['about', 'main', 'method']) delete L[k];
  const c = cur('course.json');
  if (!seasonal(unit)) {
    const base = copyOf ? c.dishes.find((d) => d.id === copyOf) : null;
    const dish = syncDish(L, { id, about: base?.about ?? '', main: clone(base?.main) ?? [], method: base?.method ?? 'stove' });
    const at = after ? c.dishes.findIndex((d) => d.id === after) + 1 : c.dishes.findIndex((d) => d.unit > unit);
    c.dishes.splice(at < 0 ? c.dishes.length : at, 0, dish);
    c.dishes = sortCourse(c.dishes);
    put('course.json', c, `Added ${title}`);
  } else {
    const u = cur('units.json');
    const s = u.units.find((x) => x.number === unit);
    (s.lessons ??= []).splice(after ? s.lessons.indexOf(after) + 1 : s.lessons.length, 0, id);
    put('units.json', u, `Added ${title}`);
  }
  put(lessonFile(id), L, `Added ${title}`);
  return id;
}

// ---------- screens ----------

let route = () => {};
export const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

function bar() {
  const here = location.hash || '#/';
  const tab = (href, text) => el('a', { href, class: 'mtab', 'aria-current': here === href || (href !== '#/' && here.startsWith(href)) || (href === '#/' && (here.startsWith('#/lesson/') || here.startsWith('#/try/'))) ? 'page' : null }, text);
  return el('header', { class: 'mbar' },
    el('div', { class: 'bar' }, el('img', { src: '/img/logo.webp', alt: '' }),
      el('div', { class: 'grow' }, el('b', {}, 'Clean Plate manager'), el('small', {}, 'The lessons and everything they use')),
      el('div', { class: 'bar-acts' }, el('a', { class: 'hbtn', href: '/' }, 'Open the app'),
        el('button', { class: 'hbtn', onclick: async () => { await api('POST', '/logout'); go('#/login'); } }, 'Sign out'))),
    el('nav', { class: 'mnav', 'aria-label': 'Sections' },
      tab('#/', 'Course'), tab('#/saves', 'Saves'), tab('#/list/ingredients.json', 'Ingredients'), tab('#/list/equipment.json', 'Tools'),
      tab('#/list/skills.json', 'Skills'), tab('#/list/terms.json', 'Kitchen words'), tab('#/list/cuisines.json', 'Cuisines'), tab('#/rules', 'Food rules')),
    S.github ? null : el('p', { class: 'mwarn' }, "GitHub isn't connected yet, so you can look but not save. ", el('a', { href: 'https://github.com/NoliCommoveri/Cooking/blob/main/docs/setup.md#the-manager-section', target: '_blank', rel: 'noopener' }, 'How to connect it')));
}

export function page(...kids) {
  app.replaceChildren(bar(), el('main', { class: 'mmain' }, kids));
  saveBar();
}

// The bar at the bottom: how many files have changes, and Save or Discard.
function saveBar() {
  document.querySelector('.msave')?.remove();
  const n = changedCount();
  if (!n) return;
  document.body.append(el('div', { class: 'msave', role: 'region', 'aria-label': 'Changes not saved yet' },
    el('span', {}, el('b', {}, `${n} file${n === 1 ? '' : 's'} changed`), ' · not live until you save'),
    el('div', { class: 'acts' },
      el('button', { class: 'hbtn', onclick: () => confirmDiscard() }, 'Discard'),
      el('button', { class: 'hbtn pri', onclick: () => saveDialog() }, 'Review and save'))));
}

function confirmDiscard() {
  const close = modal('Discard the changes?',
    el('p', {}, `This throws away the ${changedCount()} changed file(s) here. Nothing on GitHub changes.`),
    el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Keep them'),
      el('button', { class: 'hbtn bad', onclick: () => { discard(); close(); route(); } }, 'Discard')));
}

function saveDialog() {
  const found = problems();
  const summary = el('textarea', { rows: 2, maxlength: 200 });
  summary.value = D.notes.slice(-6).join('; ').slice(0, 200);
  const status = el('div', { 'aria-live': 'polite' });
  const list = el('ul', { class: 'small' }, [...Object.keys(D.files).map((p) => el('li', {}, p, D.files[p] === null ? ' (removed)' : '')), ...Object.keys(D.pictures).map((p) => el('li', {}, `images/${p}`))]);
  const go_ = el('button', {
    class: 'hbtn pri', disabled: found.length > 0 || !S.github,
    onclick: async () => {
      go_.disabled = true;
      status.replaceChildren(el('p', { class: 'mut' }, 'Saving to GitHub…'));
      try {
        const out = await api('POST', '/save', { summary: summary.value, files: D.files, pictures: D.pictures, was: D.was, fix_id: D.fix?.id ?? null, reply: D.fix?.reply ?? null });
        discard();
        close();
        await load();
        go(out.saved ? '#/saves' : location.hash);
      } catch (err) {
        status.replaceChildren(el('p', { class: 'err' }, err.message), err.problems ? el('ul', { class: 'mprob' }, err.problems.map((p) => el('li', {}, p))) : null);
        go_.disabled = false;
      }
    },
  }, 'Save');
  const close = modal('Save these changes',
    el('p', { class: 'mut' }, 'They go to GitHub, which checks them again and then puts them live for every family, usually within a few minutes. Saves shows how each one is doing.'),
    list,
    found.length ? el('div', {}, el('p', { class: 'err' }, `${found.length} thing${found.length === 1 ? '' : 's'} to fix before this can be saved:`), el('ul', { class: 'mprob' }, found.map((p) => el('li', {}, p)))) : el('p', { class: 'ok' }, 'The checks pass.'),
    el('label', { class: 'f' }, 'What changed', el('span', { class: 'hint' }, 'Shown in the list of saves and on GitHub.'), summary),
    status,
    el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Not yet'), go_));
}

function coursePage() {
  const hidden = hiddenSet();
  const all = units();
  const dishes = cur('course.json').dishes;
  const shownDishes = dishes.filter((d) => !hidden.has(d.id));
  const labels = { ...numberCourse(shownDishes).labels, ...seasonalLabels(all.map((u) => (u.lessons ? { ...u, lessons: u.lessons.filter((x) => !hidden.has(x)) } : u))) };
  const numbered = all.filter((u) => !u.seasonal);

  const row = (id, unit) => {
    const written = exists(lessonFile(id));
    const L = written ? cur(lessonFile(id)) : null;
    const d = dishes.find((x) => x.id === id);
    const title = L?.title ?? d?.title ?? id;
    const isHidden = hidden.has(id);
    const changed = lessonFile(id) in D.files;
    return el('li', { class: `mrow${isHidden ? ' hidden' : ''}` },
      el('span', { class: 'mnum' }, isHidden ? '—' : labels[id] ?? ''),
      el('div', { class: 'grow' },
        written ? el('a', { href: `#/lesson/${id}`, class: 'mtitle' }, title) : el('span', { class: 'mtitle' }, title),
        el('small', { class: 'mut' }, [
          !written && 'Planned, not written yet', isHidden && 'Hidden from families', d?.pickOne && `Pick one: ${d.pickOne}`, changed && 'Changed, not saved',
        ].filter(Boolean).join(' · '))),
      el('div', { class: 'acts mrow-acts' },
        el('button', { class: 'mf-icon', 'aria-label': `Move ${title} up`, onclick: () => { nudge(id, -1); route(); } }, '↑'),
        el('button', { class: 'mf-icon', 'aria-label': `Move ${title} down`, onclick: () => { nudge(id, 1); route(); } }, '↓'),
        el('details', { class: 'more' }, el('summary', { 'aria-label': `More for ${title}` }, '⋯'),
          el('div', { class: 'more-menu' },
            written ? el('a', { class: 'hbtn link', href: `#/lesson/${id}` }, 'Edit the lesson') : el('button', { class: 'hbtn link', onclick: () => writePlanned(d) }, 'Write this lesson'),
            written ? el('a', { class: 'hbtn link', href: `#/try/${id}` }, 'Preview as a learner') : null,
            el('button', { class: 'hbtn link', onclick: () => moveDialog(id, title, unit) }, 'Move to another unit…'),
            el('button', { class: 'hbtn link', onclick: () => { setHidden(id, !isHidden, title); route(); } }, isHidden ? 'Unhide (back for every family)' : 'Hide from every family'),
            !written ? el('button', { class: 'hbtn link', onclick: () => dishDialog(d) }, 'Edit the dish card…') : null))));
  };

  const unitBlock = (u, i) => {
    const ids = u.seasonal ? (u.lessons ?? []) : dishes.filter((d) => d.unit === u.number).map((d) => d.id);
    const ni = numbered.indexOf(u);
    return el('section', { class: 'card munit' },
      el('div', { class: 'munit-head' },
        el('h2', {}, u.seasonal ? u.name : `Unit ${u.number}: ${u.name}`),
        el('div', { class: 'acts' },
          !u.seasonal ? el('button', { class: 'mf-icon', 'aria-label': `Move unit ${u.number} earlier`, disabled: ni === 0, onclick: () => { swapUnits(u.number, numbered[ni - 1].number); route(); } }, '↑') : null,
          !u.seasonal ? el('button', { class: 'mf-icon', 'aria-label': `Move unit ${u.number} later`, disabled: ni === numbered.length - 1, onclick: () => { swapUnits(u.number, numbered[ni + 1].number); route(); } }, '↓') : null,
          el('button', { class: 'hbtn small-btn', onclick: () => unitDialog(u) }, 'Rename'),
          !ids.length ? el('button', { class: 'hbtn small-btn bad', onclick: () => { removeUnit(u.number); route(); } }, 'Remove') : null)),
      u.seasonal ? el('p', { class: 'mut small' }, `Seasonal: its lessons are labeled ${u.prefix}1, ${u.prefix}2… and sit beside the numbered course.`) : null,
      ids.length ? el('ol', { class: 'mlist' }, ids.map((id) => row(id, u.number))) : el('p', { class: 'mut' }, 'No lessons yet.'),
      el('button', { class: 'hbtn small-btn', onclick: () => lessonDialog(u.number) }, `+ Add a lesson to ${u.seasonal ? u.name : `unit ${u.number}`}`));
  };

  page(el('div', { class: 'mhead' }, el('h1', {}, 'The course'),
    el('div', { class: 'acts' }, el('button', { class: 'hbtn pri', onclick: () => lessonDialog(null) }, '+ Add a lesson'), el('button', { class: 'hbtn', onclick: () => unitDialog(null) }, '+ Add a unit'))),
  el('p', { class: 'mut' }, 'Numbers follow the order here. Hidden lessons take no number and leave every family\'s course plan; a new lesson joins every plan at its place.'),
  all.map(unitBlock));
}

function unitDialog(u) {
  const name = el('input', { value: u?.name ?? '', maxlength: 60, required: true });
  const err = el('p', { class: 'err', hidden: true });
  const close = modal(u ? `Rename ${u.seasonal ? u.name : `unit ${u.number}`}` : 'Add a unit',
    el('form', {
      class: 'stack wide', onsubmit: (e) => {
        e.preventDefault();
        const v = name.value.trim();
        if (!v) { err.hidden = false; err.textContent = 'Give it a name.'; return; }
        if (u) renameUnit(u.number, v); else addUnit(v);
        close();
        route();
      },
    }, el('label', { class: 'f' }, 'Name', name), u ? null : el('p', { class: 'mut small' }, 'It goes after the last numbered unit. Move it with the arrows.'), err,
    el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), el('button', { class: 'hbtn pri' }, u ? 'Rename' : 'Add'))));
}

const unitOptions = (selected) => units().map((u) => el('option', { value: u.number, selected: u.number === selected }, u.seasonal ? u.name : `Unit ${u.number}: ${u.name}`));
function placeOptions(unit, except) {
  const u = units().find((x) => x.number === unit);
  const ids = (u?.seasonal ? (u.lessons ?? []) : cur('course.json').dishes.filter((d) => d.unit === unit).map((d) => d.id)).filter((x) => x !== except);
  const title = (id) => cur(lessonFile(id))?.title ?? cur('course.json').dishes.find((d) => d.id === id)?.title ?? id;
  return [el('option', { value: '' }, 'First in the unit'), ...ids.map((id, i) => el('option', { value: id, selected: i === ids.length - 1 }, `After ${title(id)}`))];
}

function lessonDialog(unit) {
  const first = unit ?? units().find((u) => !u.seasonal)?.number;
  const title = el('input', { maxlength: 80, required: true });
  const where = el('select', {}, placeOptions(first));
  const unitSel = el('select', { onchange: () => where.replaceChildren(...placeOptions(Number(unitSel.value))) }, unitOptions(first));
  const written = Object.keys({ ...S.files, ...D.files }).filter((p) => p.startsWith('lessons/') && exists(p)).map((p) => cur(p)).sort((a, b) => a.title.localeCompare(b.title));
  const copy = el('select', {}, el('option', { value: '' }, 'Start blank'), written.map((L) => el('option', { value: L.id }, `A copy of ${L.title}`)));
  const err = el('p', { class: 'err', hidden: true });
  const close = modal('Add a lesson',
    el('form', {
      class: 'stack wide', onsubmit: (e) => {
        e.preventDefault();
        try {
          const id = newLesson({ title: title.value.trim(), unit: Number(unitSel.value), after: where.value || null, copyOf: copy.value || null });
          close();
          go(`#/lesson/${id}`);
        } catch (x) { err.hidden = false; err.textContent = x.message; }
      },
    },
    el('label', { class: 'f' }, 'Title', title),
    el('label', { class: 'f' }, 'Unit', unitSel),
    el('label', { class: 'f' }, 'Where in the unit', where),
    el('label', { class: 'f' }, 'Start from', el('span', { class: 'hint' }, 'A copy brings its steps, ingredients, and cards to change.'), copy),
    err,
    el('p', { class: 'mut small' }, 'It opens in the editor. It joins every family\'s course plan once it\'s saved and live.'),
    el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), el('button', { class: 'hbtn pri' }, 'Add and edit'))));
}

function moveDialog(id, title, unit) {
  const where = el('select', {}, placeOptions(unit, id));
  const unitSel = el('select', { onchange: () => where.replaceChildren(...placeOptions(Number(unitSel.value), id)) }, unitOptions(unit));
  const err = el('p', { class: 'err', hidden: true });
  const close = modal(`Move ${title}`,
    el('form', {
      class: 'stack wide', onsubmit: (e) => {
        e.preventDefault();
        try { moveLesson(id, Number(unitSel.value), where.value || null); close(); route(); } catch (x) { err.hidden = false; err.textContent = x.message; }
      },
    }, el('label', { class: 'f' }, 'Unit', unitSel), el('label', { class: 'f' }, 'Where in the unit', where), err,
    el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), el('button', { class: 'hbtn pri' }, 'Move'))));
}

// A planned dish's card (course.json), before its lesson is written.
const DISH_SCHEMA = {
  type: 'object', required: ['title', 'cuisine', 'skills', 'skill', 'safety', 'minutes', 'about', 'main', 'method'],
  properties: {
    title: { type: 'string' }, cuisine: { type: 'string' }, skills: { type: 'array', items: { type: 'string' } }, skill: { type: 'string' },
    safety: { enum: SAFETY }, minutes: { type: 'integer', minimum: 1 }, about: { type: 'string' }, main: { type: 'array', items: { type: 'string' } },
    method: { enum: ['stove', 'oven', 'stove-oven', 'no-cook'] }, pickOne: { type: 'string' }, prereqs: { type: 'array', items: { type: 'string' } }, meal: { const: false },
  },
};
export const pickers = (L = null) => (key) => {
  const reg = (f, k) => (cur(f)?.[k] ?? []).map((x) => [x.id, `${x.name ?? x.word ?? x.id} (${x.id})`]);
  if (['ingredient', 'use', 'for', 'handles'].includes(key)) return reg('ingredients.json', 'ingredients').filter(([id]) => !L || key !== 'handles' || L.ingredients.some((x) => x.ingredient === id));
  if (key === 'equipment') return reg('equipment.json', 'equipment');
  if (key === 'skills' || key === 'pickOne') return reg('skills.json', 'skills');
  if (key === 'cuisine') return reg('cuisines.json', 'cuisines');
  if (key === 'region') return reg('cuisines.json', 'regions');
  if (key === 'why' && L) return L.learn.why.map((w) => [w.id, `${w.title} (${w.id})`]);
  if (key === 'prereqs') {
    const ds = cur('course.json').dishes;
    return [...ds.map((d) => [d.id, d.title]), ...[...new Set(ds.filter((d) => d.pickOne).map((d) => d.pickOne))].map((g) => [`pick:${g}`, `Any dish in the "${g}" pick-one group`])];
  }
  if (key === 'lesson' || key === 'taughtIn') return cur('course.json').dishes.map((d) => [d.id, d.title]);
  return null;
};

function dishDialog(d) {
  const c = cur('course.json');
  const dish = c.dishes.find((x) => x.id === d.id);
  const holder = { dish };
  const body = el('div', {});
  const draw = () => body.replaceChildren(field({ root: DISH_SCHEMA, onChange: (s) => { if (s) draw(); }, options: pickers() }, holder, 'dish', DISH_SCHEMA, []));
  draw();
  const close = modal(`${d.title}: the dish card`, el('p', { class: 'mut small' }, 'What families see for this dish before its lesson is written.'), body,
    el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Cancel'),
      el('button', { class: 'hbtn pri', onclick: () => { put('course.json', c, `Changed the dish card for ${dish.title}`); close(); route(); } }, 'Keep these changes')));
}

// Writing a planned dish: a lesson file started from its dish card.
function writePlanned(d) {
  const schema = S.files['schema/lesson.schema.json'];
  const L = blank(schema, schema);
  Object.assign(L, {
    id: d.id, version: 1, track: 'core', unit: d.unit, title: d.title, image: d.image, cuisine: d.cuisine, skill: d.skill, skills: [...d.skills],
    prereqs: [...(d.prereqs ?? [])], servings: 4, totalMinutes: d.minutes, scaling: { mode: 'free' }, steps: [{ id: 'step-1', text: '', safety: 'solo' }],
  });
  put(lessonFile(d.id), L, `Started writing ${d.title}`);
  go(`#/lesson/${d.id}`);
}

const STATE = {
  live: ['Live', 'Every family has it.'], publishing: ['Publishing', 'Passed the checks; Cloudflare is putting it live.'],
  published: ['Published', 'Passed the checks and is on main.'], checking: ['Checking', 'GitHub is checking it.'],
  failed: ['Failed', "It didn't pass GitHub's checks, so it isn't live. Undo it, or fix the problem and save again."],
  replaced: ['Replaced', 'A later save changed the same files.'], done: ['Saved', ''],
};

async function savesPage() {
  page(el('h1', {}, 'Saves'), el('p', { class: 'mut' }, 'Loading…'));
  const { saves, repo } = await api('GET', '/saves');
  const item = (s) => {
    const [name, words] = STATE[s.state] ?? [s.state, ''];
    return el('li', { class: `card msaveitem st-${s.state}` },
      el('div', { class: 'grow' }, el('b', {}, s.summary), el('small', { class: 'mut' }, ` ${new Date(s.created_at).toLocaleString()}`),
        el('p', { class: `mstate st-${s.state}` }, el('b', {}, name), words ? ` · ${words}` : ''),
        s.detail ? el('pre', { class: 'mdetail' }, s.detail) : null,
        el('small', { class: 'mut' }, s.paths.join(', '))),
      el('div', { class: 'acts' },
        s.url ? el('a', { class: 'hbtn small-btn', href: s.url, target: '_blank', rel: 'noopener' }, 'On GitHub') : null,
        repo ? el('a', { class: 'hbtn small-btn', href: `https://github.com/${repo}/commit/${s.commit}`, target: '_blank', rel: 'noopener' }, 'What changed') : null,
        el('button', { class: 'hbtn small-btn', onclick: () => undoDialog(s) }, 'Undo…')));
  };
  page(el('div', { class: 'mhead' }, el('h1', {}, 'Saves'), el('button', { class: 'hbtn', onclick: () => route() }, 'Refresh')),
    el('p', { class: 'mut' }, 'Newest first. Undo puts the files a save changed back the way they were before it, as a new save.'),
    saves.length ? el('ol', { class: 'msaves' }, saves.map(item)) : el('p', {}, 'Nothing saved from here yet.'));
}

function undoDialog(s) {
  const status = el('div', { 'aria-live': 'polite' });
  const btn = el('button', {
    class: 'hbtn bad', onclick: async () => {
      btn.disabled = true;
      try {
        await api('POST', `/saves/${s.id}/undo`);
        close();
        await load();
        route();
      } catch (err) {
        status.replaceChildren(el('p', { class: 'err' }, err.message), err.problems ? el('ul', { class: 'mprob' }, err.problems.map((p) => el('li', {}, p))) : null);
        btn.disabled = false;
      }
    },
  }, 'Undo it');
  const close = modal(`Undo "${s.summary}"?`,
    el('p', {}, 'These files go back to how they were just before this save: ', s.paths.join(', '), '. It\'s checked and saved like any other change, and it can be undone too.'),
    status, el('div', { class: 'acts' }, el('button', { class: 'hbtn', onclick: () => close() }, 'Cancel'), btn));
}

function loginPage(message = '') {
  const email = el('input', { type: 'email', autocomplete: 'username', required: true });
  const pw = el('input', { type: 'password', autocomplete: 'current-password', required: true });
  const err = el('p', { class: 'err', hidden: !message }, message);
  app.replaceChildren(el('main', { class: 'hero' }, el('img', { src: '/img/logo.webp', alt: '' }), el('h1', {}, 'Clean Plate manager'),
    el('p', {}, 'For the owner: the lessons, the course, and the food rules.'),
    el('form', {
      class: 'card stack', onsubmit: async (e) => {
        e.preventDefault();
        try { await api('POST', '/login', { email: email.value, password: pw.value }); await start(); } catch (x) { err.hidden = false; err.textContent = x.message; }
      },
    }, el('label', { class: 'f' }, 'Email', email), el('label', { class: 'f' }, 'Password', pw), err, el('button', { class: 'hbtn pri' }, 'Sign in'))));
}

route = async () => {
  const h = location.hash || '#/';
  try {
    if (h === '#/login') return loginPage();
    let m;
    if ((m = h.match(/^#\/lesson\/([a-z0-9-]+)$/))) return lessonPage(m[1]);
    if ((m = h.match(/^#\/try\/([a-z0-9-]+)$/))) return await previewPage(m[1]);
    if (h === '#/saves') return await savesPage();
    if ((m = h.match(/^#\/list\/([a-z]+\.json)$/))) return listPage(m[1]);
    if (h === '#/rules') return rulesPage();
    if ((m = h.match(/^#\/fix\/([0-9a-f]{16})$/))) return await fixPage(m[1]);
    return coursePage();
  } catch (err) {
    if (err.status === 401) return loginPage();
    page(el('h1', {}, 'Something went wrong'), el('p', { class: 'err' }, err.message), el('button', { class: 'hbtn', onclick: () => route() }, 'Try again'));
  }
};
export const redraw = () => route();

async function start() {
  const me = await api('GET', '/me');
  if (!me.signed_in) return loginPage();
  page(el('p', { class: 'mut' }, 'Loading the content…'));
  try { await load(); } catch (err) { return page(el('h1', {}, "Couldn't load the content"), el('p', { class: 'err' }, err.message), el('button', { class: 'hbtn', onclick: () => start() }, 'Try again')); }
  if (location.hash === '#/login') location.hash = '#/';
  window.onhashchange = () => { scrollTo(0, 0); route(); };
  route();
}

start();
