// The content linter (plan §7.4). lint(content) returns { errors, warnings }.
// `content` is plain data (see tools/lint-content.js for how it's loaded), so the
// same checks run in the command-line tool, in CI, and in tests.
import { validate } from './validate.js';
import { blockedWordsIn, uncleanReasons } from './rules.js';
import { toBase } from './units.js';
import { scaleLesson, servingOptions } from './scale.js';
import { findTerms } from './terms.js';
import { courseEntries } from './course.js';
import { METHODS, safeMin } from './recipe.js';
import { tagProblems, missingTags, meatProtein } from './tastes.js';
import { applyVariation, changesSomething, staleKeys } from './variations.js';

// Fields that hold ids or codes, not words a kid reads.
const CODE_FIELDS = new Set(['id', 'image', 'picture', 'cuisine', 'ingredient', 'use', 'for', 'unit', 'why', 'glyph', 'reason',
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
  // The dish card a parent sees on the queue and course screens: a line about
  // the dish, its main ingredients, and how it cooks.
  const dishCard = (where, d) => {
    if (d.method != null && !METHODS.includes(d.method)) err(where, `method "${d.method}" isn't one of ${METHODS.join(', ')}`);
    if (d.main != null && !(Array.isArray(d.main) && d.main.length && d.main.length <= 6)) err(where, 'main lists 1 to 6 main ingredients');
  };

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
  // A seasonal unit (Appointed Times, plan §6.19) sits beside the numbered
  // course: its lessons aren't in course.json and take no number.
  const SEASONAL = new Set((c.units || []).filter(u => u.seasonal).map(u => u.number));
  for (const u of (c.units || []).filter(u => u.seasonal)) if (!u.prefix || !u.lessons) err(`units.json ${u.number}`, 'a seasonal unit needs a prefix letter and its lessons in order');
  // A Level's own recipes sit in a unit of their own beside the course, in
  // Side quests (owner, 2026-10-24), numbered apart from units.json.
  const LEVEL_UNITS = new Set((c.levels || []).map(({ data }) => data?.sideUnit?.number).filter(n => n != null));
  for (const ing of c.ingredients) {
    for (const r of uncleanReasons(ing, rules)) err(`ingredients.json ${ing.id}`, `unclean: ${r}`);
    for (const [u, pkg] of Object.entries(ing.units || {})) if (!pkg.amount) err(`ingredients.json ${ing.id}`, `unit "${u}" has no amount`);
    // Only water from the tap goes without a package size (§6.3).
    if ((ing.purchaseUnit === null) !== (ing.section === 'tap')) err(`ingredients.json ${ing.id}`, ing.section === 'tap' ? 'a tap ingredient is never bought, so its purchaseUnit is null' : 'needs a purchaseUnit, the package the store sells');
  }
  // kitchen words: each form belongs to one term, and every watched word needs a term before a lesson uses it
  const formOwner = {};
  for (const t of c.terms) for (const f of t.forms) {
    const k = f.toLowerCase();
    if (formOwner[k]) err(`terms.json ${t.id}`, `"${f}" is already a form of ${formOwner[k]}`);
    formOwner[k] = t.id;
  }
  const defined = new Set(Object.keys(formOwner));
  const undefinedWords = (c.watchedWords || []).filter(w => !defined.has(w.toLowerCase()));
  const watch = { blockedWords: undefinedWords, allowedPhrases: [] };
  for (const [file, list] of [['equipment.json', c.equipment], ['skills.json', c.skills], ['cuisines.json', c.cuisines], ['terms.json', c.terms]])
    for (const x of list) for (const [p, s] of strings(x)) for (const w of blockedWordsIn(s, rules)) err(`${file} ${x.id}`, `${p} names a blocked food ("${w}")`);
  for (const cu of c.cuisines) if (!RG[cu.region]) err(`cuisines.json ${cu.id}`, `region "${cu.region}" doesn't exist`);
  const fallbackIcons = c.ingredients.filter(i => !i.icon).length + c.equipment.filter(e => !e.icon).length;
  if (fallbackIcons) warn('icons', `${fallbackIcons} ingredients and tools use their category's fallback icon`);

  // the course outline: every planned dish, in the suggested order (plan §4).
  // Lessons have no number of their own; numbers come from this order (course.js).
  const dishes = c.course?.dishes || [];
  const DISH = {}, pos = {};
  dishes.forEach((d, i) => { if (DISH[d.id]) err(`course.json ${d.id}`, 'is listed twice'); DISH[d.id] = d; pos[d.id] = i; });
  const groups = new Set(dishes.filter(d => d.pickOne).map(d => d.pickOne));
  const prereqOk = p => (p.startsWith('pick:') ? groups.has(p.slice(5)) : !!DISH[p]);
  // The latest a prerequisite can be in the order: a group counts from its first dish.
  const prereqAt = p => (p.startsWith('pick:') ? Math.min(...dishes.filter(d => d.pickOne === p.slice(5)).map(d => pos[d.id])) : pos[p]);

  // lessons
  const byId = {};
  for (const { file, data: L } of c.lessons) {
    const where = `lessons/${file}`;
    const schemaErrs = validate(L, c.schemas.lesson);
    if (schemaErrs.length) { schemaErrs.forEach(e => err(where, e)); continue; }
    if (`${L.id}.json` !== file) err(where, `id "${L.id}" doesn't match the file name`);
    byId[L.id] = L;
  }
  // In course order, so "earlier lesson" means earlier in the course.
  const lessons = Object.values(byId).sort((a, b) => (pos[a.id] ?? 1e9) - (pos[b.id] ?? 1e9));
  const skillUse = {};
  for (const L of lessons) for (const s of L.skills) (skillUse[s] ||= []).push(L.id);

  // Every check a lesson gets. A variation (plan §6.21) is checked the same
  // way, as the whole lesson it makes, so it can't get past a rule its lesson
  // follows; it skips only what it shares with its lesson (unit, skills).
  // base: the lesson, when L is one of its variations.
  const checkLesson = (L, where, base = null) => {
    const e = m => err(where, m), w = m => warn(where, m);
    if (!base && !UNITS.has(L.unit) && !LEVEL_UNITS.has(L.unit)) e(`unit ${L.unit} doesn't exist in units.json`);
    if (!CU[L.cuisine]) e(`cuisine "${L.cuisine}" doesn't exist in cuisines.json`);
    for (const s of L.skills) if (!SK[s]) e(`skill "${s}" doesn't exist in skills.json`);
    for (const q of L.equipment) if (!EQ[q]) e(`equipment "${q}" doesn't exist in equipment.json`);
    if (c.imageExists && !c.imageExists(L.image)) e(`image ${L.image} isn't in content/images/`);
    // Step pictures (14e) live in content/images/steps/<lesson>/.
    for (const s of L.steps) if (s.picture && c.imageExists && !c.imageExists(s.picture)) e(`step ${s.id}: picture ${s.picture} isn't in content/images/`);
    for (const p of L.prereqs) if (!prereqOk(p)) e(`prerequisite "${p}" isn't a dish or pick-one group in course.json`);
    if (L.learn.callback && !byId[L.learn.callback.lesson]) e(`callback points to "${L.learn.callback.lesson}", which isn't a written lesson`);
    if (L.learn.callback && L.learn.callback.lesson === L.id) e('callback points to itself');
    if (!base && !(L.intro && L.intro.slides.length)) w('no intro slides yet');

    // learn stage
    if (L.track === 'core') {
      if (!L.learn.why.length) e('core lesson needs at least one learn.why card');
      if (!L.learn.wrong.length) e('core lesson needs at least one learn.wrong entry');
    }
    const whyIds = new Set(L.learn.why.map(x => x.id));
    if (whyIds.size !== L.learn.why.length) e('learn.why ids aren\'t unique');
    for (const q of L.learn.quiz || []) if (q.answer >= q.choices.length) e(`quiz "${q.q}" has an answer outside its choices`);
    if (!base) for (const s of L.skills) {
      const uses = skillUse[s] || [];
      if (uses.length === 1) w(`skill "${s}" is only used by this lesson, so its "other dishes" card will be empty`);
      // A family cooks one dish from a pick-one group, so the others in it aren't "earlier lessons".
      const sibling = id => DISH[L.id]?.pickOne && DISH[id]?.pickOne === DISH[L.id].pickOne;
      if (uses.some(id => (pos[id] ?? 1e9) < (pos[L.id] ?? 1e9) && !sibling(id)) && !L.learn.callback) w(`reuses skill "${s}" from an earlier lesson but has no learn.callback`);
    }

    // ingredients
    const used = new Set(L.ingredients.map(l => l.ingredient));
    for (const line of L.ingredients) {
      const ing = ING[line.ingredient];
      if (!ing) { e(`ingredient "${line.ingredient}" isn't in the registry`); continue; }
      if (uncleanReasons(ing, rules).length) e(`uses unclean ingredient "${ing.id}"`);
      // A variation repeats its lesson's label notes only for what it adds.
      if (ing.watch && !base?.ingredients.some(l => l.ingredient === ing.id)) w(`uses ${ing.id}: ${ing.watch}`);
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
      for (const f of ['text', 'tip', 'look']) for (const word of blockedWordsIn(st[f], watch)) e(`${at}: uses "${word}", which isn't in the kitchen words list (terms.json) yet`);
    }

    // food safety (plan §3)
    const raw = [...used].filter(id => ING[id] && ING[id].rawHandling);
    if (raw.length) {
      const done = L.steps.filter(s => s.type === 'doneness');
      if (!done.length) e(`uses raw ${raw.join(', ')} but has no doneness check step`);
      if (raw.some(id => RAW_NEEDS_TEMP.includes(ING[id].rawHandling)) && !done.some(s => s.target && s.target.temp))
        e('raw meat, poultry, or fish needs a doneness step with a thermometer temperature');
      for (const id of raw) if (!L.steps.some(s => (s.handles || []).includes(id))) e(`uses raw ${id} but no step marks where it's handled`);
      // The thermometer target reaches the safe minimum for the meat, poultry,
      // or fish in it (§3): chicken 165°F, ground meat 160°F, whole cuts and fish 145°F.
      const need = Math.max(0, ...raw.map(id => safeMin(id, ING[id].rawHandling) ?? 0));
      const top = Math.max(0, ...done.map(s => s.target?.temp ?? 0));
      if (need && top && top < need) e(`the thermometer target is ${top}°F, below the safe minimum of ${need}°F for ${raw.filter(id => (safeMin(id, ING[id].rawHandling) ?? 0) === need).join(', ')}`);
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
    // c.renderOnly (a set of lesson ids) limits this, the slow check, to the
    // lessons a save in the manager section changed (§7.5).
    if (!errors.some(x => x.startsWith(where)) && (!c.renderOnly || c.renderOnly.has(L.id))) {
      for (const n of servingOptions(L)) {
        try {
          const r = scaleLesson(L, ING, n);
          const out = JSON.stringify(r);
          if (/NaN|undefined|Infinity|\{(n|qty):/.test(out)) e(`renders badly at ${n} servings`);
        } catch (x) { e(`can't render at ${n} servings: ${x.message}`); }
      }
    }
  };
  // Each Level's writing standard (14e, owner 2026-10-26), as warnings:
  // Level 2 keeps a step to one action, in plain words for a beginner of any
  // age, with a tip or a "should look like" on most steps; Level 4 keeps
  // tips few. Level 3 is full steps in real terms, with no limit here.
  const LEVEL_IDS = new Set((c.levels || []).map(({ data: V }) => V?.id));
  const wordsIn = (t) => (String(t).match(/\S+/g) || []).length;
  const writing = (L, level, where) => {
    if (level === 'sp-2') {
      for (const s of L.steps) {
        const n = wordsIn(s.text);
        if (n > 25) warn(where, `step ${s.id} runs ${n} words; Level 2 keeps a step to one action, 25 words or fewer`);
        if (/!/.test(s.text)) warn(where, `step ${s.id} has "!"; Level 2 is plain words for a beginner of any age`);
      }
      const helped = L.steps.filter((s) => s.tip || s.look).length;
      if (helped * 2 < L.steps.length) warn(where, `${helped} of ${L.steps.length} steps have a tip or a "should look like"; Level 2 has one on most steps`);
    }
    if (level === 'sp-4') {
      const tips = L.steps.filter((s) => s.tip).length;
      if (tips * 3 > L.steps.length) warn(where, `${tips} of ${L.steps.length} steps have a tip; Level 4 keeps tips few`);
    }
  };
  for (const L of lessons) {
    const where = `lessons/${L.id}.json`;
    checkLesson(L, where);
    const vids = new Set(), levels = new Set();
    for (const v of L.variations || []) {
      const vw = `${where} variation "${v.id}"`;
      if (vids.has(v.id)) err(vw, 'variation ids must be unique');
      vids.add(v.id);
      // A Level's version (14e) may keep the lesson's title: it's that Level's recipe.
      if (v.level) {
        if (!LEVEL_IDS.has(v.level)) err(vw, `level "${v.level}" isn't a Level`);
        if (levels.has(v.level)) err(vw, `there's already a ${v.level} version of this lesson`);
        levels.add(v.level);
      } else if (v.title === L.title) err(vw, 'needs a title of its own, like "Chimichurri chicken"');
      if (!changesSomething(v)) warn(vw, 'changes nothing but its title');
      for (const m of staleKeys(L, v)) warn(vw, m);
      let V;
      try { V = applyVariation(L, v); } catch (x) { err(vw, `can't be put together: ${x.message}`); continue; }
      const schemaErrs = validate(V, c.schemas.lesson);
      if (schemaErrs.length) { schemaErrs.forEach(x => err(vw, x)); continue; }
      checkLesson(V, vw, L);
      if (v.level) writing(V, v.level, vw);
    }
  }
  // a seasonal lesson isn't in course.json, so it carries its own dish card
  for (const L of lessons) if (SEASONAL.has(L.unit)) {
    for (const f of ['about', 'main', 'method']) if (L[f] == null) err(`lessons/${L.id}.json`, `a lesson in a seasonal unit needs ${f} for its dish card`);
    dishCard(`lessons/${L.id}.json`, L);
  }
  // a seasonal unit lists its lessons in order, for their labels (A1, A2)
  for (const u of (c.units || []).filter(u => u.seasonal)) {
    for (const id of u.lessons || []) if (byId[id]?.unit !== u.number) err(`units.json ${u.number}`, `lists "${id}", which isn't a written lesson in this unit`);
    for (const L of lessons) if (L.unit === u.number && !(u.lessons || []).includes(L.id)) err(`units.json ${u.number}`, `lessons doesn't list "${L.id}", so it has no label`);
  }
  // prerequisite loops, across every planned dish
  const seen = {}, visit = (id, stack) => {
    if (stack.includes(id)) { err(`course.json ${id}`, `prerequisites form a loop: ${[...stack, id].join(' → ')}`); return; }
    if (seen[id] || !DISH[id]) return;
    seen[id] = 1;
    for (const p of DISH[id].prereqs || []) for (const q of p.startsWith('pick:') ? dishes.filter(d => d.pickOne === p.slice(5)).map(d => d.id) : [p]) visit(q, [...stack, id]);
  };
  for (const d of dishes) visit(d.id, []);

  // the course outline (plan §4, §6.16)
  if (c.course) {
    for (const d of dishes) {
      const where = `course.json ${d.id}`;
      for (const f of ['id', 'title', 'unit', 'cuisine', 'skills', 'skill', 'image', 'safety', 'minutes', 'about', 'main', 'method']) if (d[f] == null) err(where, `has no ${f}`);
      dishCard(where, d);
      if (d.image !== `dishes/${d.id}.png`) err(where, `image should be dishes/${d.id}.png`);
      if (!UNITS.has(d.unit)) err(where, `unit ${d.unit} doesn't exist in units.json`);
      if (SEASONAL.has(d.unit)) err(where, `unit ${d.unit} is seasonal, so its lessons aren't in the numbered course`);
      if (!CU[d.cuisine]) err(where, `cuisine "${d.cuisine}" doesn't exist in cuisines.json`);
      for (const s of d.skills || []) if (!SK[s]) err(where, `skill "${s}" doesn't exist in skills.json`);
      if (!(d.skills || []).length) err(where, 'has no skills');
      if (!['solo', 'adult-nearby', 'adult-hands-on'].includes(d.safety)) err(where, `safety "${d.safety}" isn't a safety level`);
      if (c.imageExists && d.image && !c.imageExists(d.image)) err(where, `image ${d.image} isn't in content/images/`);
      for (const [p, t] of [['title', d.title], ['skill', d.skill], ['about', d.about], ['main', (d.main || []).join(', ')]]) for (const w of blockedWordsIn(t || '', rules)) err(where, `${p} names a blocked food ("${w}")`);
      if (d.pickOne && !SK[d.pickOne]) err(where, `pickOne "${d.pickOne}" isn't a skill in skills.json`);
      // A side, bread, or dessert is marked meal: false (Chef Ruth's first lesson, §6.9).
      if (d.meal !== undefined && d.meal !== false) err(where, 'meal is false for a side, bread, or dessert, or left out');
      for (const p of d.prereqs || []) {
        if (!prereqOk(p)) err(where, `prerequisite "${p}" isn't a dish or pick-one group`);
        // The suggested order is the default for every family, so it keeps prerequisites first.
        else if (prereqAt(p) >= pos[d.id]) err(where, `comes before its prerequisite "${p}"`);
      }
    }
    // A pick-one group's dishes sit together, so they share one number.
    const keys = courseEntries(dishes).map(e => e.key);
    for (const g of groups) {
      const members = dishes.filter(d => d.pickOne === g);
      if (members.length < 2) err(`course.json pick-one "${g}"`, 'has only one dish');
      // A family picks one of at most three (owner, 2026-10-24, plan §4.0).
      if (members.length > 3) err(`course.json pick-one "${g}"`, `has ${members.length} dishes; a group has 3 at most`);
      if (keys.filter(k => k === `pick:${g}`).length > 1) err(`course.json pick-one "${g}"`, "its dishes aren't next to each other");
    }
    for (const { file, data: L } of c.lessons) {
      if (SEASONAL.has(L.unit)) continue;
      const d = DISH[L.id];
      if (!d) { err(`lessons/${file}`, `"${L.id}" isn't in course.json`); continue; }
      const where = `course.json ${L.id}`;
      for (const f of ['title', 'unit', 'cuisine', 'image']) if (d[f] !== L[f]) err(where, `${f} is "${d[f]}" but the lesson says "${L[f]}"`);
      if (JSON.stringify(d.skills) !== JSON.stringify(L.skills)) err(where, `skills don't match the lesson's (${L.skills.join(', ')})`);
      if (JSON.stringify(d.prereqs || []) !== JSON.stringify(L.prereqs)) err(where, `prereqs don't match the lesson's (${L.prereqs.join(', ') || 'none'})`);
      if (d.minutes !== L.totalMinutes || d.estimated) err(where, `minutes should be the lesson's ${L.totalMinutes}, not an estimate`);
    }
    for (const t of c.terms) if (t.taughtIn && !DISH[t.taughtIn]) err(`terms.json ${t.id}`, `taughtIn "${t.taughtIn}" isn't a dish in course.json`);
  }

  // tastes and tags (plan §6.21): what profiles rate, and the same words on
  // every dish's card
  const T = c.tastes;
  if (T) {
    const lists = [['proteins', T.proteins], ['flavors', T.flavors], ['ingredients', T.ingredients]];
    for (const [name, list] of lists) {
      const where = `tastes.json ${name}`;
      index(list, where);
      for (const x of list) {
        for (const id of x.ingredients ?? []) if (!ING[id]) err(`${where} ${x.id}`, `ingredient "${id}" isn't in the registry`);
        for (const [p, s] of strings({ name: x.name, hint: x.hint, examples: x.examples })) for (const w of blockedWordsIn(s, rules)) err(`${where} ${x.id}`, `${p} names a blocked food ("${w}")`);
      }
    }
    const untagged = [];
    const checkTags = (where, id, tags) => {
      for (const p of tagProblems(tags, T)) err(where, `tags: ${p}`);
      if (missingTags(tags).length) untagged.push(id);
      // A written lesson's meat or fish is in its ingredients. The tag usually
      // agrees; when it doesn't (eggs Benedict is eggs, with turkey on top),
      // it's the owner's call, so it's a warning.
      const L = byId[id];
      if (L && tags?.protein) {
        const meat = meatProtein(L, ING, T);
        if (meat && tags.protein !== meat) warn(where, `tags: protein is "${tags.protein}", but the first meat or fish in the lesson is ${meat}`);
      }
    };
    for (const d of dishes) checkTags(`course.json ${d.id}`, d.id, d.tags);
    for (const L of lessons) if (SEASONAL.has(L.unit)) checkTags(`lessons/${L.id}.json`, L.id, L.tags);
    // Each variation is tagged and scored like a dish (§6.21).
    for (const L of lessons) for (const v of L.variations || []) {
      const vw = `lessons/${L.id}.json variation "${v.id}"`;
      for (const p of tagProblems(v.tags, T)) err(vw, `tags: ${p}`);
      if (missingTags(v.tags).length) untagged.push(`${L.id} (${v.id})`);
      if (v.tags?.protein) {
        let meat = null;
        try { meat = meatProtein(applyVariation(L, v), ING, T); } catch { /* reported above */ }
        if (meat && v.tags.protein !== meat) warn(vw, `tags: protein is "${v.tags.protein}", but the first meat or fish in it is ${meat}`);
      }
    }
    if (untagged.length) warn('tags', `${untagged.length} dish${untagged.length === 1 ? ' has' : 'es have'} tags missing: ${untagged.join(', ')}`);
  }

  // the Levels (plan §12): units of four weeks, each week's four parts, and
  // the Level's own recipes, checked by the same food rules as everything else
  const levelLessons = {};
  for (const { file, data: L } of c.levelLessons || []) {
    const where = `levels/recipes/${file}`;
    const schemaErrs = validate(L, c.schemas.lesson);
    if (schemaErrs.length) { schemaErrs.forEach(e => err(where, e)); continue; }
    if (`${L.id}.json` !== file) err(where, `id "${L.id}" doesn't match the file name`);
    if (byId[L.id]) err(where, `"${L.id}" is a lesson in lessons/ too`);
    levelLessons[L.id] = L;
    checkLesson(L, where);
  }
  const placedLessons = new Set();
  // Every Level's own recipe cards, by id: a week may cook another Level's
  // card or recipe, so one dish serves two Levels (§12.0).
  const CARDS = {};
  for (const { file, data: V } of c.levels || []) for (const r of Array.isArray(V?.recipes) ? V.recipes : []) {
    if (CARDS[r.id]) err(`levels/${file} recipe ${r.id}`, 'is already a recipe card in another Level');
    CARDS[r.id] = r;
  }
  // The units every re-planned Level shares, in order, with their lengths.
  const SHARED = c.levelUnits?.units ?? [];
  for (const { file, data: V } of c.levels || []) {
    const where = `levels/${file}`;
    const schemaErrs = validate(V, c.schemas.level);
    if (schemaErrs.length) { schemaErrs.forEach(e => err(where, e)); continue; }
    if (`${V.id}.json` !== file) err(where, `id "${V.id}" doesn't match the file name`);
    if (UNITS.has(V.sideUnit.number)) err(`${where} sideUnit`, `unit ${V.sideUnit.number} is already a unit in units.json`);
    const REC = index(V.recipes, `${where} recipes`);
    // a planned recipe's card, like a planned dish's in course.json
    for (const r of V.recipes) {
      const rw = `${where} recipe ${r.id}`;
      if (DISH[r.id] || byId[r.id]) err(rw, 'has the same id as a Cook Around the World dish');
      if (!CU[r.cuisine]) err(rw, `cuisine "${r.cuisine}" doesn't exist in cuisines.json`);
      for (const sk of r.skills) if (!SK[sk]) err(rw, `skill "${sk}" doesn't exist in skills.json`);
      dishCard(rw, r);
      // A card for a variation still to be written names the dish it varies (§6.21).
      if (r.variationOf && !DISH[r.variationOf] && !byId[r.variationOf]) err(rw, `variationOf "${r.variationOf}" isn't a dish in course.json or a lesson`);
      if (c.imageExists && !c.imageExists(`meals/${r.art}.svg`)) err(rw, `art meals/${r.art}.svg isn't in content/images/`);
      // Its picture, once a sheet is cropped: the written lesson uses it too.
      if (r.image && r.image !== `dishes/${r.id}.png`) err(rw, `image should be dishes/${r.id}.png`);
      if (r.image && c.imageExists && !c.imageExists(r.image)) err(rw, `image ${r.image} isn't in content/images/`);
      if (r.image && levelLessons[r.id] && levelLessons[r.id].image !== r.image) err(rw, `the lesson's image should be the card's picture, ${r.image}`);
      for (const [p, t] of [['title', r.title], ['skill', r.skill], ['about', r.about], ['main', r.main.join(', ')]]) for (const w of blockedWordsIn(t, rules)) err(rw, `${p} names a blocked food ("${w}")`);
      if (c.tastes) for (const p of tagProblems(r.tags, c.tastes)) err(rw, `tags: ${p}`);
      if (c.tastes && missingTags(r.tags).length) warn(rw, `tags missing: ${missingTags(r.tags).join(', ')}`);
      const L = levelLessons[r.id];
      if (L) {
        placedLessons.add(r.id);
        if (L.unit !== V.sideUnit.number) err(rw, `the lesson's unit is ${L.unit}, not the Level's own unit ${V.sideUnit.number}`);
        for (const f of ['title', 'cuisine']) if (r[f] !== L[f]) err(rw, `${f} is "${r[f]}" but the lesson says "${L[f]}"`);
        if (JSON.stringify(r.skills) !== JSON.stringify(L.skills)) err(rw, `skills don't match the lesson's (${L.skills.join(', ')})`);
        if (r.minutes !== L.totalMinutes || r.estimated) err(rw, `minutes should be the lesson's ${L.totalMinutes}, not an estimate`);
        writing(L, V.id, `levels/recipes/${r.id}.json`);
      }
    }
    // A week's recipe is a Cook Around the World dish, an Appointed Times
    // lesson, or one of the Level's own recipes.
    const known = id => DISH[id] || byId[id] || REC[id] || CARDS[id] || levelLessons[id];
    const minutesOf = id => levelLessons[id]?.totalMinutes ?? (REC[id] ?? CARDS[id] ?? DISH[id])?.minutes ?? byId[id]?.totalMinutes ?? 0;
    // A dish's familiar tag (§6.21), which decides its Familiar or Explore slot (§12.0).
    const familiarOf = id => (CARDS[id] ?? DISH[id])?.tags?.familiar ?? byId[id]?.tags?.familiar ?? levelLessons[id]?.tags?.familiar;
    // Every Level runs on the shared units, with a Familiar and an Explore
    // dish each recipe week (§12.0).
    if (V.units.length !== SHARED.length) err(`${where} units`, `has ${V.units.length} units; the shared plan has ${SHARED.length}`);
    SHARED.forEach((u, i) => { if (V.units[i] && V.units[i].name !== u.name) err(`${where} unit ${u.number}`, `should be "${u.name}", as in level-units.json`); });
    V.units.forEach((u, i) => { if (u.number !== i + 1) err(`${where} units`, `unit ${u.number} should be unit ${i + 1}: units are numbered in order`); });
    const used = new Set();
    let minutes = 0, unwritten = 0, parts = 0;
    // A writing box's id (14f) is its row in level_writing, so one id per Level.
    const boxes = new Set();
    V.weeks.forEach((w, i) => {
      const ww = `${where} week ${w.week}`;
      if (w.week !== i + 1) err(ww, `should be week ${i + 1}: weeks are numbered in order`);
      if (!V.units.some(u => u.number === w.unit)) err(ww, `unit ${w.unit} isn't one of the Level's units`);
      if (i && w.unit < V.weeks[i - 1].unit) err(ww, 'comes after a week of a later unit');
      const unitWeeks = V.weeks.filter(x => x.unit === w.unit);
      const last = unitWeeks.at(-1) === w;
      if (w.cuisine && !CU[w.cuisine]) err(ww, `cuisine "${w.cuisine}" doesn't exist in cuisines.json`);
      if (w.kind) {
        for (const f of ['skill', 'familiar', 'explore', 'mastery', 'swapIns', 'adultAtHome']) if (f in w) err(ww, `a ${w.kind} week has no ${f}: it's cooked from earlier weeks' recipes`);
        if (!w.minutes) err(ww, `a ${w.kind} week needs its minutes`);
        if (w.kind === 'capstone' && !last) err(ww, 'the capstone is the last week of its unit');
        minutes += w.minutes ?? 0;
      } else {
        if (!w.skill || !w.familiar || !w.explore) err(ww, 'needs a skill, a Familiar dish, and an Explore dish');
        if ('recipe' in w) err(ww, "has a Familiar and an Explore dish, so it doesn't set recipe");
        if ('minutes' in w) err(ww, "takes its minutes from its recipes, so it doesn't set its own");
        if (w.skill && !SK[w.skill]) err(ww, `skill "${w.skill}" doesn't exist in skills.json`);
        if (w.familiar && w.familiar === w.explore) err(ww, 'its Familiar and Explore dishes are the same');
        for (const [slot, id] of [['Familiar', w.familiar], ['Explore', w.explore]]) {
          if (!id) continue;
          if (!known(id)) err(ww, `${slot} dish "${id}" isn't a dish in course.json, a lesson, or a Level's recipe`);
          if (used.has(id)) err(ww, `${slot} dish "${id}" is already an earlier week's dish`);
          if (c.hidden?.includes(id)) warn(ww, `${slot} dish "${id}" is hidden from every family`);
          used.add(id);
          // Everyday dishes are Familiar; new-ish and adventurous ones are Explore (§12.0).
          const f = familiarOf(id);
          if (f && (slot === 'Familiar') !== (f === 'everyday')) warn(ww, `${slot} dish "${id}" is tagged ${f}`);
        }
        for (const x of w.swapIns || []) if (!known(x)) err(ww, `swap-in "${x}" isn't a dish in course.json, a lesson, or a Level's recipe`);
        // The hours count the Familiar dish, every family's starting default.
        minutes += minutesOf(w.familiar);
      }
      // Only Level 4 says "Have an adult at home" (§12.8): the other Levels' banners already ask for one.
      if (w.adultAtHome && V.id !== 'sp-4') err(ww, 'has adultAtHome, which only Level 4 uses: its learners cook on their own');
      // Units of four weeks: the last is the mastery check (§12.2), or the capstone.
      if (w.mastery && !last) err(ww, 'a mastery week is the last week of its unit');
      if (last && !w.mastery && w.kind !== 'capstone') err(ww, 'the last week of a unit is its mastery week');
      for (const k of ['drill', 'knowledge', 'sabbath']) {
        parts += 1;
        minutes += w[k].minutes;
        if (!w[k].body?.length) unwritten += 1;
        for (const q of w[k].quiz || []) if (q.answer >= q.choices.length) err(`${ww} ${k}`, `quiz "${q.q}" has an answer outside its choices`);
        for (const x of w[k].write || []) {
          if (boxes.has(x.id)) err(`${ww} ${k}`, `writing box "${x.id}" is already used on another page of this Level`);
          boxes.add(x.id);
        }
      }
    });
    for (const u of V.units) {
      const n = V.weeks.filter(w => w.unit === u.number).length, want = SHARED.find(x => x.number === u.number)?.weeks;
      if (want && n !== want) err(`${where} unit ${u.number}`, `has ${n} weeks; the shared plan gives it ${want}`);
    }
    // A Cook Around the World lesson a week cooks gets this Level's own
    // version (14e, owner 2026-10-26); until it's written, the week plays the
    // lesson as it is.
    const unversioned = [...new Set(V.weeks.flatMap(w => [w.familiar, w.explore, ...(w.swapIns || [])]).filter(id => byId[id] && !(byId[id].variations || []).some(v => v.level === V.id)))];
    if (unversioned.length) warn(where, `${unversioned.length} written lessons its weeks cook have no ${V.name} version yet: ${unversioned.join(', ')}`);
    // A card can be cooked by any Level's week (§12.0).
    const cooks = (id) => (c.levels || []).some(({ data: X }) => Array.isArray(X?.weeks) && X.weeks.some(w => [w.familiar, w.explore, ...(w.swapIns || [])].includes(id)));
    for (const r of V.recipes) if (!cooks(r.id)) warn(`${where} recipe ${r.id}`, "isn't any week's recipe or swap-in");
    // The words a learner reads: unit names and goals, notes, and the part pages.
    for (const [p, t] of strings({ name: V.name, sideUnit: V.sideUnit.name, units: V.units, weeks: V.weeks })) for (const w of blockedWordsIn(t, rules)) err(where, `${p} names a blocked food ("${w}")`);
    // The planned hours (§6.15) add up to about the Level's hours.
    const hours = minutes / 60, off = Math.abs(hours - V.hours) / V.hours;
    if (off > 0.1) err(where, `the weeks add up to ${hours.toFixed(1)} hours, not about ${V.hours}`);
    else if (off > 0.05) warn(where, `the weeks add up to ${hours.toFixed(1)} hours, a little off ${V.hours}`);
    if (unwritten) warn(where, `${unwritten} of ${parts} part pages aren't written yet`);
  }
  for (const id of Object.keys(levelLessons)) if (!placedLessons.has(id)) err(`levels/recipes/${id}.json`, "isn't one of a Level's recipes");

  // hidden lessons (§7.5) name a written lesson or a planned dish
  for (const id of c.hidden || []) if (!byId[id] && !DISH[id]) err('hidden.json', `"${id}" isn't a lesson or a dish in course.json`);
  if (new Set(c.hidden || []).size !== (c.hidden || []).length) err('hidden.json', 'a lesson is listed twice');

  return { errors, warnings };
}
