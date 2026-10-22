// Copied from src/content/patch.js by tools/build-library.js. Don't edit here.
// Lesson patches (plan §6.11): small fixes the owner applies from the browser,
// on top of the lesson files, for every family at once. A patch changes one
// field that can't change the dish's makeup: an amount, a unit, a time, a
// timer, a step's words, a tip or "should look like" note, or a doneness
// target. Adding or swapping an ingredient, or a step, is a content change.
//
// A field path names the field by stable ids, never by position:
//   totalMinutes
//   ingredients.<ingredient id>.amount | unit | text | prep
//   steps.<step id>.text | tip | look | timerSeconds | timerLabel | target.temp | target.look

// kind: how the value is entered and checked. optional: it can be cleared.
export const STEP_FIELDS = {
  text: { label: 'Step words', kind: 'text' },
  tip: { label: 'Tip', kind: 'text', optional: true },
  look: { label: 'Should look like', kind: 'text', optional: true },
  timerSeconds: { label: 'Timer length', kind: 'minutes' },
  timerLabel: { label: 'Timer name', kind: 'text' },
  'target.temp': { label: 'Thermometer target (°F)', kind: 'temp' },
  'target.look': { label: 'Done when', kind: 'text' },
};
export const INGREDIENT_FIELDS = {
  amount: { label: 'Amount', kind: 'amount' },
  unit: { label: 'Unit', kind: 'unit' },
  text: { label: 'Amount in words', kind: 'text' },
  prep: { label: 'How it is prepped', kind: 'text', optional: true },
};
const TEXT_MAX = 600;

function parse(path) {
  const m = /^(?:(totalMinutes)|ingredients\.([a-z0-9-]+)\.(amount|unit|text|prep)|steps\.([a-z0-9-]+)\.(text|tip|look|timerSeconds|timerLabel|target\.temp|target\.look))$/.exec(String(path));
  if (!m) return null;
  if (m[1]) return { area: 'lesson', field: 'totalMinutes', spec: { label: 'Total time (minutes)', kind: 'int' } };
  if (m[2]) return { area: 'ingredients', id: m[2], field: m[3], spec: INGREDIENT_FIELDS[m[3]] };
  return { area: 'steps', id: m[4], field: m[5], spec: STEP_FIELDS[m[5]] };
}

const holder = (lesson, p) => (p.area === 'lesson' ? lesson
  : p.area === 'ingredients' ? lesson.ingredients.find((x) => x.ingredient === p.id)
    : lesson.steps.find((x) => x.id === p.id));

export function patchSpec(path) {
  return parse(path)?.spec ?? null;
}

// The field's value in this lesson, or undefined when the path doesn't fit it.
export function getAt(lesson, path) {
  const p = parse(path);
  const h = p && holder(lesson, p);
  if (!h) return undefined;
  if (p.field.startsWith('target.')) return h.target ? h.target[p.field.slice(7)] ?? null : undefined;
  return h[p.field] ?? null;
}

// A copy of the lesson with the field set. null clears an optional field.
export function setAt(lesson, path, value) {
  const out = structuredClone(lesson);
  const p = parse(path);
  const h = p && holder(out, p);
  if (!h) throw new Error(`${path} isn't in this lesson`);
  const [obj, key] = p.field.startsWith('target.') ? [h.target, p.field.slice(7)] : [h, p.field];
  if (!obj) throw new Error(`${path} isn't in this lesson`);
  if (value === null) delete obj[key]; else obj[key] = value;
  return out;
}

// Checks a value's shape for its field, and returns it cleaned up, or throws
// with a message the owner can read.
export function cleanValue(path, value) {
  const spec = patchSpec(path);
  if (!spec) throw new Error("That part of a lesson can't be changed with a fix. It needs a content change.");
  if (value === null || value === '') {
    if (spec.optional) return null;
    throw new Error(`${spec.label} can't be left empty.`);
  }
  if (spec.kind === 'text') {
    const s = String(value).trim().replace(/\s+/g, ' ');
    if (!s) throw new Error(`${spec.label} can't be left empty.`);
    if (s.length > TEXT_MAX) throw new Error(`${spec.label} is too long (${TEXT_MAX} characters at most).`);
    return s;
  }
  if (spec.kind === 'unit') {
    const s = String(value).trim();
    if (!/^[a-z0-9-]{1,30}$/.test(s)) throw new Error('A unit is a unit id, like "cup" or "tbsp".');
    return s;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${spec.label} must be a number above zero.`);
  if (spec.kind === 'amount') return Math.round(n * 1000) / 1000;
  if (!Number.isInteger(n)) throw new Error(`${spec.label} must be a whole number.`);
  return n;
}

// The fields a fix can change, for "which part" in Suggest a fix. With a step
// id, that step's fields; without, the lesson's time and its ingredient lines.
export function patchTargets(lesson, stepId = null) {
  const out = [];
  const add = (path) => {
    const v = getAt(lesson, path);
    if (v === undefined) return;
    const spec = patchSpec(path);
    if (v === null && !spec.optional) return;
    out.push({ path, label: spec.label, kind: spec.kind, value: v });
  };
  if (stepId) {
    const st = lesson.steps.find((s) => s.id === stepId);
    if (!st) return out;
    for (const f of Object.keys(STEP_FIELDS)) add(`steps.${stepId}.${f}`);
  } else {
    add('totalMinutes');
    for (const line of lesson.ingredients) {
      for (const f of line.amount == null ? ['text', 'prep'] : ['amount', 'unit', 'prep']) {
        const t = getAt(lesson, `ingredients.${line.ingredient}.${f}`);
        if (t === undefined) continue;
        out.push({ path: `ingredients.${line.ingredient}.${f}`, label: INGREDIENT_FIELDS[f].label, kind: INGREDIENT_FIELDS[f].kind, value: t, ingredient: line.ingredient });
      }
    }
  }
  return out;
}

// The lesson as it is live: the file with its patches applied in order, and
// the version they bring it to. live: { version, patches: [{ path, value }] }.
export function applyPatches(lesson, live) {
  if (!live) return lesson;
  let out = lesson;
  for (const p of live.patches) {
    try { out = setAt(out, p.path, p.value); } catch { /* a patch for a field this file no longer has */ }
  }
  return out === lesson ? { ...lesson, version: live.version } : { ...out, version: live.version };
}

// How a value reads to a person: minutes for timers, words otherwise.
export function showValue(kind, v) {
  if (v === null || v === undefined || v === '') return '(nothing)';
  if (kind === 'minutes') return `${Math.round((v / 60) * 100) / 100} min`;
  if (kind === 'temp') return `${v}°F`;
  return String(v);
}
