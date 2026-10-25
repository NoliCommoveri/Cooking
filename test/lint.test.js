import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../tools/lint-content.js';
import { lint } from '../src/content/lint.js';
import { blockedWordsIn, uncleanReasons } from '../src/content/rules.js';
import { tasteItemsIn, meatProtein, tagProblems, missingTags } from '../src/content/tastes.js';

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
  // A fourth dish in a group (owner, 2026-10-24).
  assert.match(broken((c) => { dish(c, 'french-omelet').pickOne = 'building-a-sauce'; }), /"building-a-sauce"[^\n]*has 4 dishes; a group has 3 at most/);
  assert.match(broken((c) => { c.terms[0].taughtIn = 'nope'; }), /taughtIn "nope" isn't a dish/);
});


// ---------- tastes and tags (plan §6.21) ----------

test('every dish is tagged in the real content', () => {
  assert.ok(!lint(base).warnings.some((w) => w.startsWith('tags:')), 'no dish is missing tags');
});

test('tags must use the tastes lists and the fixed levels', () => {
  const dish = (c, id) => c.course.dishes.find((d) => d.id === id);
  assert.match(broken((c) => { dish(c, 'shakshuka').tags.flavors = ['bitter']; }), /flavor "bitter" isn't in tastes.json/);
  assert.match(broken((c) => { dish(c, 'shakshuka').tags.heat = 'volcanic'; }), /heat "volcanic"/);
  assert.match(broken((c) => { dish(c, 'shakshuka').tags.protein = 'pork'; }), /protein "pork" isn't in tastes.json/);
  assert.match(broken((c) => { dish(c, 'shakshuka').tags.flavors = ['rich-tomato', 'tangy', 'warm-spices', 'smoky-bbq']; }), /1 to 3 flavors/);
  assert.match(broken((c) => { dish(c, 'shakshuka').tags.colour = 'red'; }), /"colour" isn't a tag/);
  assert.match(broken((c) => { dish(c, 'shakshuka').tags.veggies = 'heaps'; }), /veggies "heaps"/);
});

test('the tastes lists name real ingredients and no unclean food', () => {
  assert.match(broken((c) => { c.tastes.ingredients[0].ingredients.push('dragonfruit'); }), /ingredient "dragonfruit" isn't in the registry/);
  assert.match(broken((c) => { c.tastes.flavors[0].examples.push('sweet and sour pork'); }), /names a blocked food \("pork"\)/);
  assert.match(broken((c) => { c.tastes.proteins.push({ ...c.tastes.proteins[0] }); }), /used twice/);
});

test('a written lesson\'s meat is checked against its protein tag', () => {
  const c = structuredClone({ ...base, imageExists: undefined });
  c.course.dishes.find((d) => d.id === 'beef-bulgogi').tags.protein = 'chicken';
  assert.ok(lint(c).warnings.some((w) => /beef-bulgogi: tags: protein is "chicken", but the first meat or fish in the lesson is beef/.test(w)));
});

test('taste items and meat are worked out from the ingredients', () => {
  const registry = Object.fromEntries(base.ingredients.map((i) => [i.id, i]));
  const L = { ingredients: [{ ingredient: 'broth-chicken' }, { ingredient: 'beef-ground' }, { ingredient: 'cilantro', optional: true }, { ingredient: 'onion-yellow' }] };
  assert.equal(meatProtein(L, registry, base.tastes), 'beef', 'broth is not the protein');
  assert.deepEqual(tasteItemsIn(L, base.tastes.ingredients), { required: ['onions'], optional: ['cilantro'] });
  assert.equal(meatProtein({ ingredients: [{ ingredient: 'egg' }] }, registry, base.tastes), null);
  assert.deepEqual(missingTags({ protein: 'none', flavors: [] }), ['flavors', 'heat', 'budget', 'familiar', 'veggies']);
  assert.deepEqual(tagProblems(undefined, base.tastes), []);
});

// ---------- the Levels (plan §12) ----------

const level = (c) => c.levels.find((l) => l.data.id === 'level-3').data;

test('Level 3: 9 units of 4 weeks, about 125 hours, every recipe known', () => {
  const L = level(base);
  assert.equal(L.units.length, 9);
  assert.equal(L.weeks.length, 36);
  assert.deepEqual(L.weeks.filter((w) => w.mastery).map((w) => w.week), [4, 8, 12, 16, 20, 24, 28, 32]);
  assert.equal(L.weeks.at(-1).kind, 'capstone');
  const dishes = new Set(base.course.dishes.map((d) => d.id));
  // The recipes checked against the main course (§12.4) are pick-one dishes there.
  for (const id of ['vegetable-stir-fry', 'chopped-salad-vinaigrette', 'beef-stew', 'shish-taouk', 'beef-ragu', 'pita-bread', 'mujaddara', 'red-lentil-soup']) {
    assert.ok(dishes.has(id), id);
    assert.ok(L.weeks.some((w) => w.recipe === id), `${id} is a week's recipe`);
    assert.ok(!L.recipes.some((r) => r.id === id), `${id} isn't Level only`);
  }
  assert.equal(L.recipes.length, 21);
  assert.ok(!lint(base).errors.some((e) => e.startsWith('levels/')));
});

test('a Level week is checked: skill, recipe, mastery, units of four, the hours', () => {
  const bad = (fn) => broken((c) => fn(level(c)));
  assert.match(bad((L) => { L.weeks[0].skill = 'no-such-skill'; }), /week 1: skill "no-such-skill" doesn't exist/);
  assert.match(bad((L) => { L.weeks[0].recipe = 'pork-buns'; }), /week 1: recipe "pork-buns" isn't a dish/);
  assert.match(bad((L) => { L.weeks[1].recipe = 'shakshuka'; }), /week 2: recipe "shakshuka" is already an earlier week's recipe/);
  assert.match(bad((L) => { delete L.weeks[3].mastery; }), /week 4: the last week of a unit is its mastery week/);
  assert.match(bad((L) => { L.weeks[2].mastery = true; }), /week 3: a mastery week is the last week of its unit/);
  assert.match(bad((L) => { L.weeks[4].unit = 1; }), /unit 1: has 5 weeks; a unit has 4/);
  assert.match(bad((L) => { L.weeks[34].recipe = 'shakshuka'; }), /week 35: a practice week has no recipe/);
  assert.match(bad((L) => { L.weeks[0].swapIns = ['no-such-dish']; }), /week 1: swap-in "no-such-dish" isn't a dish/);
  assert.match(bad((L) => { for (const w of L.weeks) w.drill.minutes = 200; }), /the weeks add up to [\d.]+ hours, not about 125/);
});

test('a re-planned Level runs on the shared units, with a Familiar and an Explore dish each week (§12.0)', () => {
  const bad = (fn) => broken((c) => fn(level(c)));
  // A Level on release 2 must use the shared unit plan and its lengths.
  const two = bad((L) => { L.release = 2; });
  assert.match(two, /unit 1: should be "Kitchen basics", as in level-units.json/);
  assert.match(two, /unit 2: has 4 weeks; the shared plan gives it 2/);
  assert.match(two, /week 1: needs a skill, a Familiar dish, and an Explore dish/);
  // A pair is checked on any Level that uses one.
  const pair = (w) => bad((L) => { delete L.weeks[0].recipe; Object.assign(L.weeks[0], w); });
  assert.match(pair({ familiar: 'shakshuka', explore: 'shakshuka' }), /week 1: its Familiar and Explore dishes are the same/);
  assert.match(pair({ familiar: 'shakshuka', explore: 'pork-buns' }), /week 1: Explore dish "pork-buns" isn't a dish/);
  assert.match(pair({ familiar: 'shakshuka', explore: 'thick-burgers' }), /week 2: recipe "thick-burgers" is already an earlier week's recipe/);
  assert.match(bad((L) => { L.weeks[0].familiar = 'oyakodon'; L.weeks[0].explore = 'huevos-rancheros'; }), /week 1: has a Familiar and an Explore dish, so it doesn't set recipe/);
  assert.match(bad((L) => { L.weeks[0].cuisine = 'atlantis'; }), /week 1: cuisine "atlantis" doesn't exist/);
  // The familiar tag decides the slot: a warning, since tags can change.
  const c = structuredClone({ ...base, imageExists: undefined });
  const L = level(c);
  delete L.weeks[0].recipe;
  Object.assign(L.weeks[0], { familiar: 'oyakodon', explore: 'french-omelet' });
  const { warnings } = lint(c);
  assert.ok(warnings.some((w) => /week 1: Familiar dish "oyakodon" is tagged new-ish/.test(w)), warnings.join('\n'));
  assert.ok(warnings.some((w) => /week 1: Explore dish "french-omelet" is tagged everyday/.test(w)));
});

test('a recipe card is in one Level only, and another Level can cook it', () => {
  const two = (fn) => broken((c) => {
    const V = structuredClone(level(c));
    V.id = 'level-x'; V.sideUnit = { ...V.sideUnit, number: 101, prefix: 'X' };
    fn(V);
    c.levels.push({ file: 'level-x.json', data: V });
  });
  assert.match(two(() => {}), /recipe thick-burgers: is already a recipe card in another Level/);
  // Without its own copies, level-x's weeks still know level-3's cards.
  assert.doesNotMatch(two((V) => { V.recipes = []; }), /isn't a dish in course.json, a lesson, or (one of this|a) Level's recipe/);
});

test('the hard rule holds on Level pages and recipes', () => {
  const bad = (fn) => broken((c) => fn(level(c)));
  assert.match(bad((L) => { L.weeks[0].knowledge.body = ['Shrimp is safe at 145°F.']; }), /names a blocked food \("shrimp"\)/);
  assert.match(bad((L) => { L.recipes[0].about = 'Burgers with bacon on top.'; }), /recipe thick-burgers: about names a blocked food \("bacon"\)/);
  assert.match(bad((L) => { L.units[6].goal = 'Cooks shellfish gently'; }), /names a blocked food \("shellfish"\)/);
  assert.match(bad((L) => { L.recipes[0].id = 'shakshuka'; }), /has the same id as a Cook Around the World dish/);
});

test('a Level recipe written as a lesson is checked like a lesson and matches its card', () => {
  const shak = base.lessons.find((l) => l.data.id === 'shakshuka').data;
  const errs = broken((c) => {
    const L = { ...structuredClone(shak), id: 'thick-burgers', title: 'Thick beef burgers', unit: 100, cuisine: 'american', totalMinutes: 41 };
    L.steps[0].text = 'Add the ham.';
    c.levelLessons = [{ file: 'thick-burgers.json', data: L }];
  });
  assert.match(errs, /levels\/recipes\/thick-burgers.json: .*names a blocked food \("ham"\)/);
  assert.match(errs, /recipe thick-burgers: skills don't match the lesson's/);
  assert.match(errs, /recipe thick-burgers: minutes should be the lesson's/);
});
