// Variations (plan §6.21): stored as changes on their lesson, put together as
// whole lessons, and checked like one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/lint-content.js';
import { lint } from '../src/content/lint.js';
import { applyList, diffList, keysOf, applyVariation, diffVariation, lessonVersion, staleKeys, versionName } from '../src/content/variations.js';

const base = loadContent();
const lesson = (id) => structuredClone(base.lessons.find((l) => l.data.id === id).data);
function lintWith(id, fn) {
  const c = { ...base, lessons: base.lessons.map((l) => (l.data.id === id ? { ...l, data: fn(lesson(id)) } : l)) };
  return lint(c);
}
const at = (L, id) => L.steps.find((s) => s.id === id);

test('list changes: change, drop, add, and order, keyed so repeats stay apart', () => {
  const key = (x) => x.k;
  const b = [{ k: 'a', n: 1 }, { k: 'b', n: 1 }, { k: 'a', n: 2 }, { k: 'c', n: 1 }];
  assert.deepEqual(keysOf(b, key), ['a', 'b', 'a#2', 'c']);
  const f = [{ k: 'c', n: 1 }, { k: 'x', n: 1 }, { k: 'a', n: 1 }, { k: 'a', n: 9 }];
  const ch = diffList(b, f, key);
  assert.deepEqual(ch.drop, ['b']);
  assert.deepEqual(ch.change, { 'a#2': { k: 'a', n: 9 } });
  assert.deepEqual(ch.order, ['c', '+0', 'a', 'a#2']);
  assert.deepEqual(applyList(b, ch, key), f);
  assert.equal(diffList(b, structuredClone(b), key), null, 'no change, nothing stored');
  // Added at the end needs no order.
  assert.equal(diffList(b, [...b, { k: 'z' }], key).order, undefined);
  // An item added to the lesson later reaches the variation after the item before it.
  const later = [b[0], { k: 'new' }, b[1], b[2], b[3]];
  assert.deepEqual(applyList(later, ch, key).map((x) => x.k), ['c', 'x', 'a', 'new', 'a']);
});

test('Chimichurri chicken is a whole lesson: chicken, 165°F, its own title and time', () => {
  const L = lesson('chimichurri-steak');
  const V = lessonVersion(L, 'chicken');
  assert.equal(V.id, 'chimichurri-steak', 'it counts as the lesson');
  assert.equal(V.title, 'Chimichurri chicken');
  assert.equal(V.versionOf, 'Chimichurri steak');
  assert.equal(versionName(V.title, V.versionOf), 'Chimichurri chicken (a version of Chimichurri steak)');
  assert.equal(at(V, 'check-steak').target.temp, 165);
  assert.ok(V.ingredients.some((x) => x.ingredient === 'chicken-thigh'));
  assert.ok(!V.ingredients.some((x) => x.ingredient === 'beef-sirloin'));
  assert.equal(V.tags.protein, 'chicken');
  assert.ok(!('variations' in V));
  // Shared steps are the lesson's own: a fix to one reaches the variation.
  L.steps.find((s) => s.id === 'parsley-prep').tip = 'A new tip.';
  assert.equal(at(lessonVersion(L, 'chicken'), 'parsley-prep').tip, 'A new tip.');
  assert.equal(lessonVersion(L, 'gone'), L, 'an id it no longer has is the lesson itself');
});

test('the content editor stores only what differs, and it puts back the same lesson', () => {
  const L = lesson('shakshuka');
  const F = applyVariation(L, { id: 'x', title: 'Spicy shakshuka' });
  F.totalMinutes += 5;
  F.steps.splice(1, 0, { id: 'new-step', text: 'Stir.', safety: 'solo' });
  delete F.learn.quiz;
  F.equipment = F.equipment.slice(1);
  const v = diffVariation(L, F, { id: 'spicy', tags: { heat: 'spicy' } });
  assert.deepEqual(Object.keys(v).sort(), ['equipment', 'id', 'learn', 'steps', 'tags', 'title', 'totalMinutes']);
  assert.equal(v.learn.quiz, null, 'a part taken out is stored as null');
  assert.deepEqual(applyVariation(L, v), F);
});

test('the linter checks each variation as a whole lesson', () => {
  const low = lintWith('chimichurri-steak', (L) => { L.variations[0].steps.change['check-steak'].target.temp = 145; return L; });
  assert.match(low.errors.join('\n'), /variation "chicken": the thermometer target is 145°F, below the safe minimum of 165°F for chicken-thigh/);
  const noWash = lintWith('chimichurri-steak', (L) => { L.variations[0].steps.drop = ['wash-season']; return L; });
  assert.match(noWash.errors.join('\n'), /variation "chicken": step "season" handles raw food, so the next step must be a wash step/);
  const unclean = lintWith('chimichurri-steak', (L) => { L.variations[0].title = 'Chimichurri pork'; return L; });
  assert.match(unclean.errors.join('\n'), /variation "chicken": title names a blocked food \("pork"\)/);
  const tags = lintWith('chimichurri-steak', (L) => { L.variations[0].tags.flavors = ['nope']; return L; });
  assert.match(tags.errors.join('\n'), /variation "chicken": tags:/);
  const same = lintWith('chimichurri-steak', (L) => { L.variations.push({ id: 'chicken', title: 'Chimichurri steak' }); return L; });
  assert.match(same.errors.join('\n'), /variation ids must be unique/);
  assert.match(same.errors.join('\n'), /needs a title of its own/);
  assert.match(same.warnings.join('\n'), /changes nothing but its title/);
  const meat = lintWith('chimichurri-steak', (L) => { L.variations[0].tags.protein = 'beef'; return L; });
  assert.match(meat.warnings.join('\n'), /variation "chicken": tags: protein is "beef", but the first meat or fish in it is chicken/);
});

test('a change naming a step the lesson no longer has is a warning', () => {
  const L = lesson('chimichurri-steak');
  L.steps = L.steps.filter((s) => s.id !== 'serve');
  assert.deepEqual(staleKeys(L, L.variations[0]), ['changes step "serve", which the lesson doesn\'t have any more']);
});

test('a lesson\'s own doneness target is checked against the safe minimum too', () => {
  const r = lintWith('chicken-adobo', (L) => { L.steps.find((s) => s.target?.temp).target.temp = 150; return L; });
  assert.match(r.errors.join('\n'), /lessons\/chicken-adobo.json: the thermometer target is 150°F, below the safe minimum of 165°F/);
});
