// The manager section's form builder (plan §7.5). It reads a JSON Schema (the
// same files the linter checks against, content/schema/) and builds a form for
// a value, so every field a lesson or a registry entry can have gets a
// control, including fields a session adds to the schema later.
//
// The form edits the value in place: each control writes to its parent object
// or list and calls onChange(structural). Typing is not structural, so the
// form keeps its focus; adding, removing, or moving something, or switching an
// ingredient line from measured to in words, is, and the caller redraws.
import { el } from './dom.js';

const resolve = (s, root) => (s?.$ref ? resolve(s.$ref.replace('#/', '').split('/').reduce((o, k) => o[k], root), root) : s);
const types = (s) => [].concat(s.type ?? []);

// Words a person reads for a field name; anything else is the name split into words.
const LABELS = {
  totalMinutes: 'Total time (minutes)', timerSeconds: 'Timer (seconds)', timerLabel: 'Timer name', prereqs: 'Prerequisites (lessons that come first)',
  why: 'Why cards', wrong: 'If it goes wrong', quiz: 'Quiz', move: 'The move', callback: 'Callback to an earlier lesson', look: 'Should look like',
  tip: 'Tip', picture: 'Step picture (steps/<lesson>/<name>.png)', handles: 'Handles raw', hazard: 'Hazard (what an adult profile sees)', safety: 'Safety level', q: 'Question', explain: 'Explanation',
  sign: 'What you see', fix: 'What to do', baseUnit: 'Base unit', purchaseUnit: 'Store package', animalSource: 'Animal it comes from',
  animalPart: 'Part of the animal', rawHandling: 'Raw handling', countLabel: 'Count words', watch: 'Watch note', idea: 'The idea',
  taughtIn: 'Taught in (lesson)', byWeight: 'Sold by weight', many: 'Plural', one: 'Singular', perishable: 'Perishable', pickOne: 'Pick-one group',
  main: 'Main ingredients', sabbath: 'Beyond the Recipe', swapIns: 'Swap-ins', about: 'About the dish', meal: 'A full meal', use: 'Use instead', for: 'In place of', reason: 'Because of',
};
export const label = (k) => LABELS[k] ?? String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
const LONG = new Set(['body', 'text', 'about', 'idea', 'explain', 'fix', 'sign', 'tip', 'look', 'note', 'caption', 'watch', 'means', 'why']);

// What a variant of a "one of these shapes" field is called.
function variantName(v, i, root) {
  const r = resolve(v, root);
  for (const [k, p] of Object.entries(r.properties ?? {})) if ('const' in p) return label(String(p.const));
  const req = (r.required ?? []).join(',');
  if (/temp/.test(req)) return 'Thermometer temperature';
  if (/look/.test(req)) return 'How it looks';
  if (/,amount,unit/.test(req)) return 'Measured';
  if (/,amount,text/.test(req)) return 'In words';
  return `Shape ${i + 1}`;
}

// A value that fits a schema, with only what it requires.
export function blank(schema, root) {
  const s = resolve(schema, root);
  if (s.oneOf) return blank(s.oneOf[0], root);
  if ('const' in s) return s.const;
  if (s.enum) return s.enum.find((x) => x !== null) ?? null;
  const t = types(s).find((x) => x !== 'null') ?? types(s)[0];
  if (t === 'string') return '';
  if (t === 'integer' || t === 'number') return s.minimum ?? (s.exclusiveMinimum != null ? s.exclusiveMinimum + 1 : 0);
  if (t === 'boolean') return false;
  if (t === 'array') return Array.from({ length: s.minItems ?? 0 }, () => blank(s.items, root));
  if (t === 'object') return Object.fromEntries((s.required ?? []).map((k) => [k, blank(s.properties?.[k] ?? {}, root)]));
  return null;
}

// Which variant a value fits: the first whose const fields match, or whose
// required fields it has.
function variantOf(s, value, root) {
  const vs = s.oneOf.map((v) => resolve(v, root));
  const byConst = vs.findIndex((v) => Object.entries(v.properties ?? {}).some(([k, p]) => 'const' in p && value?.[k] === p.const));
  if (byConst >= 0) return byConst;
  const fit = vs.findIndex((v) => (v.required ?? []).every((k) => value && k in value && (types(resolve(v.properties[k], root)).length === 0 || value[k] !== null || types(resolve(v.properties[k], root)).includes('null'))));
  return Math.max(0, fit);
}

// ctx: { root, onChange(structural), options(key, path) → [[value, label]] | null,
//        readOnly(path) → bool, hide(path) → bool, hint(path) → text }
export function field(ctx, holder, key, schema, path) {
  const s = resolve(schema, ctx.root);
  const value = holder[key];
  const set = (v, structural = false) => { holder[key] = v; ctx.onChange(structural); };
  const p = [...path, key];
  const name = typeof key === 'number' ? null : (s.title ?? label(key));
  const hint = ctx.hint?.(p);

  if (s.oneOf) {
    const i = variantOf(s, value, ctx.root);
    const pick = el('select', {
      'aria-label': `${name ?? 'Item'}: kind`,
      onchange: (e) => {
        const v = resolve(s.oneOf[Number(e.target.value)], ctx.root);
        const next = blank(v, ctx.root);
        if (next && typeof next === 'object' && value && typeof value === 'object') {
          for (const k of Object.keys(v.properties ?? {})) if (k in value && !('const' in v.properties[k]) && (types(resolve(v.properties[k], ctx.root)).length === 0 || value[k] !== null)) next[k] = value[k];
        }
        set(next, true);
      },
    }, s.oneOf.map((v, n) => el('option', { value: n, selected: n === i }, variantName(v, n, ctx.root))));
    return el('div', { class: 'mf-variant' }, name && el('div', { class: 'mf-name' }, name), pick,
      field(ctx, holder, key, { ...resolve(s.oneOf[i], ctx.root), title: undefined }, path));
  }

  if ('const' in s) return null;
  if (ctx.hide?.(p)) return null;
  const ro = ctx.readOnly?.(p);
  const t = types(s);
  const nullable = t.includes('null') || (s.enum ?? []).includes(null);

  // A list
  if (t.includes('array') && (Array.isArray(value) || !nullable)) {
    const list = Array.isArray(value) ? value : [];
    if (!Array.isArray(value)) holder[key] = list;
    const itemSchema = resolve(s.items ?? {}, ctx.root);
    const simple = !itemSchema.oneOf && ['string', 'integer', 'number'].some((x) => types(itemSchema).includes(x)) && !types(itemSchema).includes('object');
    const body = (n) => {
      const f = field(ctx, list, n, itemSchema, p);
      const item = list[n];
      if (simple || !item || typeof item !== 'object') return f;
      // A step, an ingredient line, a card: folded to one line until opened.
      const det = el('details', { class: 'mf-fold', open: opened.has(item), ontoggle: (e) => { if (e.target.open) opened.add(item); else opened.delete(item); } },
        el('summary', {}, summaryOf(item, n)), f);
      return det;
    };
    const rows = list.map((_, n) => el('div', { class: `mf-item${simple ? ' simple' : ''}` },
      el('div', { class: 'mf-item-body' }, body(n)),
      ro ? null : el('div', { class: 'mf-item-acts' },
        el('button', { type: 'button', class: 'mf-icon', 'aria-label': 'Move up', disabled: n === 0, onclick: () => { [list[n - 1], list[n]] = [list[n], list[n - 1]]; ctx.onChange(true); } }, '↑'),
        el('button', { type: 'button', class: 'mf-icon', 'aria-label': 'Move down', disabled: n === list.length - 1, onclick: () => { [list[n + 1], list[n]] = [list[n], list[n + 1]]; ctx.onChange(true); } }, '↓'),
        el('button', { type: 'button', class: 'mf-icon bad', 'aria-label': 'Remove', onclick: () => { list.splice(n, 1); ctx.onChange(true); } }, '✕'))));
    return el('fieldset', { class: 'mf-list' }, name && el('legend', {}, name), hint && el('p', { class: 'mut small' }, hint), rows,
      ro ? null : el('button', { type: 'button', class: 'hbtn small-btn', onclick: () => { const v = blank(itemSchema, ctx.root); if (v && typeof v === 'object') opened.add(v); list.push(v); ctx.onChange(true); } }, `+ Add ${name ? singular(name) : 'one'}`));
  }

  // An object: its fields, with the optional ones it doesn't have offered as "+ Add"
  if (t.includes('object') && (value && typeof value === 'object' || !nullable)) {
    const obj = value && typeof value === 'object' ? value : blank(s, ctx.root);
    if (obj !== value) holder[key] = obj;
    if (!s.properties && s.additionalProperties) return mapField(ctx, obj, s, p, name, ro);
    const req = new Set(s.required ?? []);
    const props = Object.entries(s.properties ?? {});
    const present = props.filter(([k]) => k in obj && !ctx.hide?.([...p, k]));
    const absent = props.filter(([k, ps]) => !(k in obj) && !ctx.hide?.([...p, k]) && !('const' in resolve(ps, ctx.root)));
    const kids = present.map(([k, ps]) => {
      const f = field(ctx, obj, k, ps, p);
      if (!f) return null;
      return el('div', { class: 'mf-field' }, f, !req.has(k) && !ro && !ctx.readOnly?.([...p, k])
        ? el('button', { type: 'button', class: 'hbtn link small', onclick: () => { delete obj[k]; ctx.onChange(true); } }, `Remove ${label(k).toLowerCase()}`) : null);
    });
    const adds = ro ? [] : absent.map(([k, ps]) => el('button', { type: 'button', class: 'hbtn small-btn', onclick: () => { obj[k] = blank(ps, ctx.root); ctx.onChange(true); } }, `+ ${label(k)}`));
    const body = [kids, adds.length ? el('div', { class: 'mf-adds' }, adds) : null];
    return typeof key === 'number' ? el('div', { class: 'mf-obj' }, body) : el('fieldset', { class: 'mf-obj' }, name && el('legend', {}, name), hint && el('p', { class: 'mut small' }, hint), body);
  }

  // A single value
  const opts = s.enum ? s.enum.map((x) => [x, x === null ? '(none)' : String(x)]) : ctx.options?.(key, p, value);
  let input;
  if (t.includes('boolean')) {
    input = el('input', { type: 'checkbox', checked: Boolean(value), disabled: ro, onchange: (e) => set(e.target.checked) });
    return el('label', { class: 'choice mf-check' }, input, name ?? '');
  }
  if (opts) {
    const list = [...opts];
    if (value != null && !list.some(([v]) => v === value)) list.unshift([value, `${value} (not in the list)`]);
    if (value == null && !list.some(([v]) => v === null)) list.unshift([null, nullable ? '(none)' : 'Pick one…']);
    input = el('select', { disabled: ro, onchange: (e) => { const v = list[Number(e.target.value)][0]; set(v); } },
      list.map(([v, l], n) => el('option', { value: n, selected: v === value }, l)));
  } else if (t.includes('integer') || t.includes('number')) {
    input = el('input', {
      type: 'number', inputmode: t.includes('integer') ? 'numeric' : 'decimal', step: t.includes('integer') ? '1' : 'any',
      value: value ?? '', readonly: ro, min: s.minimum,
      oninput: (e) => { const raw = e.target.value; set(raw === '' ? (nullable ? null : raw) : Number(raw)); },
    });
  } else {
    const long = LONG.has(typeof key === 'number' ? path.at(-1) : key) || String(value ?? '').length > 70;
    input = el(long ? 'textarea' : 'input', { value: value ?? '', readonly: ro, rows: long ? 3 : undefined, oninput: (e) => set(nullable && e.target.value === '' ? null : e.target.value) });
    if (long) input.value = value ?? '';
  }
  if (name == null) return input;
  return el('label', { class: 'f' }, el('span', {}, name, ro ? el('span', { class: 'hint' }, ' (set for you)') : null), hint && el('span', { class: 'hint' }, hint), input);
}

// An object keyed by name, like a fixed-size lesson's notes ({ "2": "…" }) or an ingredient's units.
function mapField(ctx, obj, s, path, name, ro) {
  const valSchema = resolve(s.additionalProperties, ctx.root);
  const rows = Object.keys(obj).map((k) => el('div', { class: 'mf-item' },
    el('div', { class: 'mf-item-body' },
      el('label', { class: 'f' }, 'Name', el('input', {
        value: k, readonly: ro,
        onchange: (e) => {
          const nk = e.target.value.trim();
          if (!nk || nk === k || nk in obj) { e.target.value = k; return; }
          const entries = Object.entries(obj).map(([a, b]) => (a === k ? [nk, b] : [a, b]));
          for (const a of Object.keys(obj)) delete obj[a];
          Object.assign(obj, Object.fromEntries(entries));
          ctx.onChange(true);
        },
      })),
      field(ctx, obj, k, valSchema, path)),
    ro ? null : el('div', { class: 'mf-item-acts' }, el('button', { type: 'button', class: 'mf-icon bad', 'aria-label': 'Remove', onclick: () => { delete obj[k]; ctx.onChange(true); } }, '✕'))));
  return el('fieldset', { class: 'mf-list' }, name && el('legend', {}, name), rows,
    ro ? null : el('button', {
      type: 'button', class: 'hbtn small-btn',
      onclick: () => { let n = 1; while (`new-${n}` in obj) n++; obj[`new-${n}`] = blank(valSchema, ctx.root); ctx.onChange(true); },
    }, '+ Add one'));
}

// Which folded items are open. The form edits values in place, so an item
// keeps being the same object across redraws.
const opened = new WeakSet();

function summaryOf(x, n) {
  const words = x.title ?? x.text ?? x.sign ?? x.q ?? x.word ?? x.name ?? x.caption ?? x.body;
  if (x.ingredient) return [x.amount, x.unit === 'count' ? '' : x.unit, x.text, x.ingredient.replace(/-/g, ' '), x.optional ? '(optional)' : ''].filter((v) => v != null && v !== '').join(' ');
  if (x.for && x.use) return `${x.use.replace(/-/g, ' ')} in place of ${x.for.replace(/-/g, ' ')}`;
  const line = String(words ?? x.id ?? `Item ${n + 1}`);
  return `${n + 1}. ${line.length > 90 ? `${line.slice(0, 88)}…` : line || '(empty)'}`;
}

function singular(name) {
  const w = name.toLowerCase().replace(/ \(.*\)$/, '');
  if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (/(ches|shes|sses)$/.test(w)) return w.slice(0, -2);
  return w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
}
