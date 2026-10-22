// The content linter (plan §7.4). lint(content) returns { errors, warnings }.
// `content` is plain data (see tools/lint-content.js for how it's loaded), so the
// same checks run in the command-line tool, in CI, and in tests.
import { validate } from './validate.js';
import { blockedWordsIn, uncleanReasons } from './rules.js';
import { toBase } from './units.js';
import { scaleLesson, servingOptions } from './scale.js';

// Fields that hold ids or codes, not words a kid reads.
const CODE_FIELDS = new Set(['id', 'image', 'cuisine', 'ingredient', 'use', 'for', 'unit', 'why', 'glyph', 'reason',
  'handles', 'skills', 'equipment', 'track', 'safety', 'type', 'mode', 'music', 'round', 'section', 'baseUnit', 'region', 'category']);
const RAW_NEEDS_TEMP = ['poultry', 'meat', 'fish'];
const PLACEHOLDER = /\{(n|qty):([a-z0-9-]+)\}/g;

function* strings(v, path = '') {
  if (typeof v === 'string') yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* strings(v[i], `${path}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!CODE_FIELDS.has(k)) yield* strings(x, path ? `${path}.${k}` : k);
}

export function lint(c) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  const rules = c.rules;

  // registries
  for (const [file, data] of Object.entries(c.registryFiles)) for (const e of validate(data, c.schemas.registries)) err(file, e);
  const index = (list, file) => {
    const m = {};
    for (const x of list || []) { if (m[x.id]) err(file, `id "${x.id}" is used twice`); m[x.id] = x; }
    return m;
  };
  const ING = index(c.ingredients, 'ingredients.json'), EQ = index(c.equipment, 'equipment.json');
  const SK = index(c.skills, 'skills.json'), CU = index(c.cuisines, 'cuisines.json'), RG = index(c.regions, 'cuisines.json');
  const UNITS = new Set((c.units || []).map(u => u.number));
  for (const ing of c.ingredients) {
    for (const r of uncleanReasons(ing, rules)) err(`ingredients.json ${ing.id}`, `unclean: ${r}`);
    for (const [u, pkg] of Object.entries(ing.units || {})) if (!pkg.amount) err(`ingredients.json ${ing.id}`, `unit "${u}" has no amount`);
  }
  for (const [file, list] of [['equipment.json', c.equipment], ['skills.json', c.skills], ['cuisines.json', c.cuisines]])
    for (const x of list) for (const [p, s] of strings(x)) for (const w of blockedWordsIn(s, rules)) err(`${file} ${x.id}`, `${p} names a blocked food ("${w}")`);
  for (const cu of c.cuisines) if (!RG[cu.region]) err(`cuisines.json ${cu.id}`, `region "${cu.region}" doesn't exist`);
  const fallbackIcons = c.ingredients.filter(i => !i.icon).length + c.equipment.filter(e => !e.icon).length;
  if (fallbackIcons) warn('icons', `${fallbackIcons} ingredients and tools use their category's fallback icon`);

  // lessons
  const byNum = {};
  for (const { file, data: L } of c.lessons) {
    const where = `lessons/${file}`;
    const schemaErrs = validate(L, c.schemas.lesson);
    if (schemaErrs.length) {
      schemaErrs.forEach(e => err(where, e));
      if (Number.isInteger(L.number) && !byNum[L.number]) byNum[L.number] = { ...L, malformed: true };
      continue;
    }
    if (`${L.id}.json` !== file) err(where, `id "${L.id}" doesn't match the file name`);
    if (!L.id.startsWith(String(L.number).padStart(2, '0') + '-')) err(where, `id "${L.id}" doesn't start with its number ${L.number}`);
    if (byNum[L.number]) err(where, `lesson number ${L.number} is also used by ${byNum[L.number].id}`);
    byNum[L.number] = L;
  }
  const lessons = Object.values(byNum).filter(L => !L.malformed).sort((a, b) => a.number - b.number);
  const skillUse = {};
  for (const L of lessons) for (const s of L.skills) (skillUse[s] ||= []).push(L.number);

  for (const L of lessons) {
    const where = `lessons/${L.id}.json`;
    const e = m => err(where, m), w = m => warn(where, m);
    if (!UNITS.has(L.unit)) e(`unit ${L.unit} doesn't exist in units.json`);
    if (!CU[L.cuisine]) e(`cuisine "${L.cuisine}" doesn't exist in cuisines.json`);
    for (const s of L.skills) if (!SK[s]) e(`skill "${s}" doesn't exist in skills.json`);
    for (const q of L.equipment) if (!EQ[q]) e(`equipment "${q}" doesn't exist in equipment.json`);
    if (c.imageExists && !c.imageExists(L.image)) e(`image ${L.image} isn't in content/images/`);
    for (const p of L.prereqs) if (!byNum[p]) e(`prerequisite lesson ${p} doesn't exist`);
    if (L.learn.callback && !byNum[L.learn.callback.lesson]) e(`callback points to lesson ${L.learn.callback.lesson}, which doesn't exist`);
    if (L.learn.callback && L.learn.callback.lesson === L.number) e('callback points to itself');
    if (!(L.intro && L.intro.slides.length)) w('no intro slides yet');

    // learn stage
    if (L.track === 'core') {
      if (!L.learn.why.length) e('core lesson needs at least one learn.why card');
      if (!L.learn.wrong.length) e('core lesson needs at least one learn.wrong entry');
    }
    const whyIds = new Set(L.learn.why.map(x => x.id));
    if (whyIds.size !== L.learn.why.length) e('learn.why ids aren\'t unique');
    for (const q of L.learn.quiz || []) if (q.answer >= q.choices.length) e(`quiz "${q.q}" has an answer outside its choices`);
    for (const s of L.skills) {
      const uses = skillUse[s] || [];
      if (uses.length === 1) w(`skill "${s}" is only used by this lesson, so its "other dishes" card will be empty`);
      if (uses.some(n => n < L.number) && !L.learn.callback) w(`reuses skill "${s}" from an earlier lesson but has no learn.callback`);
    }

    // ingredients
    const used = new Set(L.ingredients.map(l => l.ingredient));
    for (const line of L.ingredients) {
      const ing = ING[line.ingredient];
      if (!ing) { e(`ingredient "${line.ingredient}" isn't in the registry`); continue; }
      if (uncleanReasons(ing, rules).length) e(`uses unclean ingredient "${ing.id}"`);
      if (ing.watch) w(`uses ${ing.id}: ${ing.watch}`);
      if (line.amount != null && toBase(1, line.unit, ing) == null) e(`${ing.id} is measured in "${line.unit}", which has no conversion to ${ing.baseUnit}`);
    }
    for (const s of L.substitutions || []) {
      if (!used.has(s.for)) e(`substitution for "${s.for}", which the lesson doesn't use`);
      const u = ING[s.use];
      if (!u) { e(`substitution uses "${s.use}", which isn't in the registry`); continue; }
      if (uncleanReasons(u, rules).length) e(`substitution uses unclean ingredient "${s.use}"`);
      if (s.reason !== 'availability' && u.contains.includes(s.reason)) e(`substitution for ${s.reason} uses "${s.use}", which still contains ${s.reason}`);
    }

    // words
    for (const [p, s] of strings(L)) for (const word of blockedWordsIn(s, rules)) e(`${p} names a blocked food ("${word}")`);

    // steps
    const stepIds = new Set();
    for (const st of L.steps) {
      const at = `step "${st.id}"`;
      if (stepIds.has(st.id)) e(`${at}: step ids must be unique`);
      stepIds.add(st.id);
      if (st.timerSeconds && !st.timerLabel) e(`${at}: has a timer but no timerLabel`);
      if (st.timerLabel && !st.timerSeconds) e(`${at}: has a timerLabel but no timer`);
      if (st.why && !whyIds.has(st.why)) e(`${at}: why points to "${st.why}", which isn't a learn.why card`);
      if (st.safety !== 'solo' && !st.hazard) e(`${at}: a ${st.safety} step needs a hazard for adult profiles`);
      if ((st.type === 'doneness') !== !!st.target) e(`${at}: doneness steps need a target, and only they can have one`);
      for (const h of st.handles || []) if (!used.has(h)) e(`${at}: handles "${h}", which the lesson doesn't use`);
      for (const f of ['text', 'tip', 'look']) for (const m of (st[f] || '').matchAll(PLACEHOLDER)) if (!used.has(m[2])) e(`${at}: ${m[0]} names an ingredient the lesson doesn't use`);
    }

    // food safety (plan §3)
    const raw = [...used].filter(id => ING[id] && ING[id].rawHandling);
    if (raw.length) {
      const done = L.steps.filter(s => s.type === 'doneness');
      if (!done.length) e(`uses raw ${raw.join(', ')} but has no doneness check step`);
      if (raw.some(id => RAW_NEEDS_TEMP.includes(ING[id].rawHandling)) && !done.some(s => s.target && s.target.temp))
        e('raw meat, poultry, or fish needs a doneness step with a thermometer temperature');
      for (const id of raw) if (!L.steps.some(s => (s.handles || []).includes(id))) e(`uses raw ${id} but no step marks where it's handled`);
    }
    L.steps.forEach((st, i) => {
      if (!(st.handles || []).some(id => ING[id] && ING[id].rawHandling)) return;
      const next = L.steps[i + 1];
      if (!next || next.type !== 'wash') e(`step "${st.id}" handles raw food, so the next step must be a wash step`);
    });

    // scaling and rendering at every allowed size
    const s = L.scaling;
    if (s.mode === 'fixed') {
      if (!s.multipliers.includes(1)) e('fixed scaling must include the 1× size');
      for (const k of Object.keys(s.notes || {})) if (!s.multipliers.includes(Number(k))) e(`scaling note for ${k}× isn't an allowed multiplier`);
    } else if ((s.min ?? 1) > (s.max ?? 12)) e('scaling min is above max');
    if (!errors.some(x => x.startsWith(where))) {
      for (const n of servingOptions(L)) {
        try {
          const r = scaleLesson(L, ING, n);
          const out = JSON.stringify(r);
          if (/NaN|undefined|Infinity|\{(n|qty):/.test(out)) e(`renders badly at ${n} servings`);
        } catch (x) { e(`can't render at ${n} servings: ${x.message}`); }
      }
    }
  }
  // prerequisite loops
  const seen = {}, visit = (n, stack) => {
    if (stack.includes(n)) { err(`lessons/${byNum[n].id}.json`, `prerequisites form a loop: ${[...stack, n].join(' → ')}`); return; }
    if (seen[n] || !byNum[n]) return;
    seen[n] = 1;
    for (const p of byNum[n].prereqs || []) visit(p, [...stack, n]);
  };
  for (const L of lessons) visit(L.number, []);
  return { errors, warnings };
}
