import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/lint-content.js';
import { lint } from '../src/content/lint.js';
import { blockedWordsIn, uncleanReasons } from '../src/content/rules.js';

const base = loadContent();
// A fresh copy of the real content, changed by `fn`, then linted.
function broken(fn) {
  const c = structuredClone({ ...base, imageExists: undefined });
  c.imageExists = base.imageExists;
  c.lessons = c.lessons.map(l => ({ ...l }));
  fn(c, n => c.lessons.find(l => l.data.id === n).data);
  return lint(c).errors.join('\n');
}

test('the real content passes', () => {
  assert.deepEqual(lint(base).errors, []);
});

test('blocked words, with exact allowed phrases', () => {
  const r = base.rules;
  assert.deepEqual(blockedWordsIn('Add the shrimp', r), ['shrimp']);
  assert.deepEqual(blockedWordsIn('Fry the turkey bacon', r), []);
  assert.deepEqual(blockedWordsIn('A hamburger with graham crackers', r), []);
  assert.deepEqual(blockedWordsIn('Use mushroom stir-fry sauce, not oyster sauce', r), []);
  assert.deepEqual(blockedWordsIn('A splash of oyster sauce', r), ['oyster']);
});

test('unclean ingredients are caught by species, part, and name', () => {
  const r = base.rules, ing = x => ({ id: 'x', name: 'Thing', contains: [], animalSource: null, animalPart: null, ...x });
  assert.match(uncleanReasons(ing({ animalSource: 'pig', animalPart: 'meat', contains: ['meat'] }), r).join(), /clean-species/);
  assert.match(uncleanReasons(ing({ animalSource: 'cattle', animalPart: 'fat', contains: ['meat'] }), r).join(), /fat of cattle/);
  assert.match(uncleanReasons(ing({ animalSource: 'chicken', animalPart: 'blood', contains: ['meat'] }), r).join(), /blood/);
  assert.match(uncleanReasons(ing({ contains: ['dairy'] }), r).join(), /no animalSource/);
  assert.match(uncleanReasons(ing({ name: 'Pork shoulder' }), r).join(), /pork/);
  assert.deepEqual(uncleanReasons(ing({ animalSource: 'chicken', animalPart: 'fat', contains: ['meat'] }), r), []);
});

test('a lesson using an unclean ingredient fails', () => {
  const out = broken((c, L) => {
    c.ingredients.push({ id: 'shrimp', name: 'Shrimp', section: 'fish', baseUnit: 'g', contains: ['fish'], animalSource: 'shrimp', animalPart: 'meat', rawHandling: 'fish', icon: null, watch: null });
    L('shakshuka').ingredients.push({ ingredient: 'shrimp', amount: 8, unit: 'oz' });
  });
  assert.match(out, /unclean/);
});

test('blocked words in step text fail', () => {
  assert.match(broken((c, L) => { L('shakshuka').steps[0].tip = 'Bacon would be good here.'; }), /blocked food \("bacon"\)/);
});

test('a missing wash step after raw food fails', () => {
  assert.match(broken((c, L) => { L('shakshuka').steps = L('shakshuka').steps.filter(s => s.id !== 'wash-egg'); }), /next step must be a wash step/);
});

test('raw meat without a thermometer target fails', () => {
  assert.match(broken((c, L) => { L('beef-bulgogi').steps.find(s => s.id === 'check-beef').target = { look: 'Brown' }; }), /thermometer temperature/);
});

test('a raw-food lesson with no doneness step fails', () => {
  assert.match(broken((c, L) => { L('shakshuka').steps = L('shakshuka').steps.filter(s => s.type !== 'doneness'); }), /no doneness check/);
});

test('a unit without a conversion fails', () => {
  assert.match(broken((c, L) => { L('shakshuka').ingredients.find(l => l.ingredient === 'feta').unit = 'tbsp'; }), /no conversion/);
});

test('missing registry entries fail', () => {
  assert.match(broken((c, L) => { L('shakshuka').equipment.push('wok'); }), /equipment "wok"/);
  assert.match(broken((c, L) => { L('shakshuka').skills.push('juggling'); }), /skill "juggling"/);
  assert.match(broken((c, L) => { L('shakshuka').cuisine = 'martian'; }), /cuisine "martian"/);
  assert.match(broken((c, L) => { L('shakshuka').ingredients[0].ingredient = 'unicorn-oil'; }), /isn't in the registry/);
});

test('prerequisites: missing ones, loops, and an order that puts one first fail', () => {
  assert.match(broken((c, L) => { L('shakshuka').prereqs = ['nope']; }), /prerequisite "nope" isn't a dish or pick-one group/);
  assert.match(broken((c) => {
    c.course.dishes.find((d) => d.id === 'fattoush').prereqs = ['oyakodon'];
    c.course.dishes.find((d) => d.id === 'oyakodon').prereqs = ['fattoush'];
  }), /loop/);
  // The suggested order keeps every prerequisite first.
  assert.match(broken((c) => { c.course.dishes.find((d) => d.id === 'fattoush').prereqs = ['oyakodon']; }), /fattoush: comes before its prerequisite "oyakodon"/);
  assert.match(broken((c) => { c.course.dishes.find((d) => d.id === 'oyakodon').prereqs = ['pick:nothing']; }), /"pick:nothing" isn't a dish or pick-one group/);
  // A lesson's prerequisites match its line in course.json.
  assert.match(broken((c, L) => { L('beef-bulgogi').prereqs = ['pick:julienne']; }), /prereqs don't match/);
});

test('a callback points at a written lesson', () => {
  assert.match(broken((c, L) => { L('brown-butter-cookies').learn.callback.lesson = 'apple-pie'; }), /isn't a written lesson/);
});

test('a dish in the same pick-one group needs no callback, but a later dish does', () => {
  assert.doesNotMatch(lint(base).warnings.join('\n'), /chicken-fajitas\.json: reuses skill "julienne"/);
  const c = structuredClone({ ...base, imageExists: undefined });
  c.lessons.find(l => l.data.id === 'shakshuka').data.skills.push('julienne');
  assert.match(lint(c).warnings.join('\n'), /shakshuka\.json: reuses skill "julienne"/);
});

test('a diet substitution that keeps the tag fails', () => {
  assert.match(broken((c, L) => { L('beef-bulgogi').substitutions[1].use = 'soy-sauce'; }), /still contains gluten/);
});

test('steps need safety, unique ids, and labelled timers', () => {
  assert.match(broken((c, L) => { delete L('shakshuka').steps[0].safety; }), /safety: is required/);
  assert.match(broken((c, L) => { L('shakshuka').steps[1].id = 'chop'; }), /must be unique/);
  assert.match(broken((c, L) => { delete L('shakshuka').steps[1].timerLabel; }), /no timerLabel/);
  assert.match(broken((c, L) => { L('shakshuka').steps[2].why = 'nope'; }), /isn't a learn.why card/);
});

test('core lessons need the learn stage', () => {
  assert.match(broken((c, L) => { L('shakshuka').learn.why = []; }), /learn.why card/);
  assert.match(broken((c, L) => { delete L('shakshuka').learn.move; }), /move: is required/);
});

test('fixed scaling needs multipliers including 1x', () => {
  assert.match(broken((c, L) => { L('buttermilk-biscuits').scaling.multipliers = []; }), /at least 1/);
  assert.match(broken((c, L) => { L('buttermilk-biscuits').scaling.multipliers = [2]; }), /include the 1× size/);
});

test('an animal species off the allowlist fails', () => {
  assert.match(broken(c => { c.ingredients.find(i => i.id === 'feta').animalSource = 'camel'; }), /"camel" is not on the clean-species list/);
});

test('a cooking word with no kitchen-words entry fails', () => {
  assert.match(broken((c, L) => { L('buttermilk-biscuits').steps[2].text = 'Sift the flour into the bowl.'; }), /"sift", which isn't in the kitchen words list/);
});

test('a form can belong to only one kitchen word', () => {
  assert.match(broken(c => { c.terms[1].forms.push('dice'); }), /already a form of dice/);
});

test('honey is allowed as a product, but the bee is not a clean species', () => {
  const r = base.rules, ing = x => ({ id: 'x', name: 'Thing', contains: [], ...x });
  assert.deepEqual(uncleanReasons(ing({ animalSource: 'honeybee', animalPart: 'honey' }), r), []);
  assert.match(uncleanReasons(ing({ animalSource: 'honeybee', animalPart: 'meat' }), r).join(), /clean-species/);
});

test('the course outline is checked against the registries and the lessons', () => {
  const dish = (c, id) => c.course.dishes.find((d) => d.id === id);
  assert.match(broken((c) => { dish(c, 'oyakodon').skills = ['juggling']; }), /oyakodon: skill "juggling" doesn't exist/);
  assert.match(broken((c) => { dish(c, 'oyakodon').cuisine = 'martian'; }), /oyakodon: cuisine "martian"/);
  assert.match(broken((c) => { dish(c, 'chicken-fried-rice').title = 'Shrimp fried rice'; }), /chicken-fried-rice: title names a blocked food/);
  assert.match(broken((c) => { dish(c, 'shakshuka').skills = ['dicing']; }), /shakshuka: skills don't match the lesson's/);
  assert.match(broken((c) => { dish(c, 'beef-bulgogi').minutes = 10; }), /beef-bulgogi: minutes should be the lesson's/);
  assert.match(broken((c) => { dish(c, 'oyakodon').image = 'dishes/06-oyakodon.png'; }), /image should be dishes\/oyakodon.png/);
  assert.match(broken((c) => { c.course.dishes = c.course.dishes.filter((d) => d.id !== 'buttermilk-biscuits'); }), /"buttermilk-biscuits" isn't in course.json/);
  assert.match(broken((c) => { c.course.dishes.push({ ...dish(c, 'oyakodon') }); }), /oyakodon: is listed twice/);
  // A pick-one group's dishes sit together, and a group has at least two.
  assert.match(broken((c) => { const d = c.course.dishes; d.push(d.splice(d.findIndex((x) => x.id === 'fattoush'), 1)[0]); }), /"fine-chopping"[^\n]*aren't next to each other/);
  assert.match(broken((c) => { dish(c, 'oyakodon').pickOne = 'simmering'; }), /"simmering"[^\n]*has only one dish/);
  assert.match(broken((c) => { c.terms[0].taughtIn = 'nope'; }), /taughtIn "nope" isn't a dish/);
});

