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

test("a step picture must be in content/images, and named like steps/<lesson>/<name>.png", () => {
  assert.match(broken((c, L) => { L('shakshuka').steps[0].picture = 'steps/shakshuka/no-such.png'; }), /picture steps\/shakshuka\/no-such\.png isn't in content\/images/);
  assert.match(broken((c, L) => { L('shakshuka').steps[0].picture = 'dishes/shakshuka.png'; }), /doesn't match/);
});

// 14e: a Level's version of a lesson, and each Level's writing standard.
function lintWith(fn) {
  const c = structuredClone({ ...base, imageExists: undefined });
  c.imageExists = base.imageExists;
  c.lessons = c.lessons.map(l => ({ ...l }));
  fn(c, n => c.lessons.find(l => l.data.id === n).data);
  return lint(c);
}
test("a Level's version keeps the lesson's name, one a Level, for a real Level", () => {
  const { errors } = lintWith((c, L) => { L('minestrone').variations = [{ id: 'sp-3', title: 'Minestrone', level: 'sp-3' }]; });
  assert.deepEqual(errors, []);
  const twice = lintWith((c, L) => { L('minestrone').variations = [{ id: 'sp-3', title: 'Minestrone', level: 'sp-3' }, { id: 'again', title: 'Minestrone again', level: 'sp-3' }]; });
  assert.match(twice.errors.join('\n'), /already a sp-3 version/);
  assert.match(lintWith((c, L) => { L('minestrone').variations = [{ id: 'sp-9', title: 'Minestrone', level: 'sp-9' }]; }).errors.join('\n'), /"sp-9" isn't a Level/);
  assert.match(lintWith((c, L) => { L('minestrone').variations = [{ id: 'same', title: 'Minestrone' }]; }).errors.join('\n'), /needs a title of its own/);
});

test("each Level's writing standard warns: Level 2 one action a step in plain words, Level 4 few tips", () => {
  const long = 'Cut the carrots into sticks and then cut the sticks across into small cubes about the size of a pea and put them all in the bowl with the onion';
  const w2 = lintWith((c, L) => {
    const steps = L('minestrone').steps.map(({ tip, look, ...s }) => s);
    steps[0] = { ...steps[0], text: long };
    steps[1] = { ...steps[1], text: 'Peel the onion!' };
    L('minestrone').variations = [{ id: 'sp-2', title: 'Minestrone', level: 'sp-2', steps: { change: Object.fromEntries(steps.map((s) => [s.id, s])) } }];
  }).warnings.join('\n');
  assert.match(w2, /runs 29 words; Level 2 keeps a step to one action/);
  assert.match(w2, /has "!"; Level 2 is plain words/);
  assert.match(w2, /0 of 14 steps have a tip or a "should look like"; Level 2 has one on most steps/);
  const w4 = lintWith((c, L) => {
    L('minestrone').variations = [{ id: 'sp-4', title: 'Minestrone', level: 'sp-4', steps: { change: Object.fromEntries(L('minestrone').steps.map((s) => [s.id, { ...s, tip: 'Taste as you go.' }])) } }];
  }).warnings.join('\n');
  assert.match(w4, /steps have a tip; Level 4 keeps tips few/);
});

test("a Level's weeks list the written lessons with no version for it yet", () => {
  const w = lint(base).warnings.join('\n');
  assert.match(w, /levels\/sp-3\.json: \d+ written lessons its weeks cook have no Level 3 Cook version yet: .*mujaddara/);
  assert.doesNotMatch(w, /no Level 3 Cook version yet: .*(minestrone|challah)/);
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

const level = (c) => c.levels.find((l) => l.data.id === 'sp-3').data;

test('Level 3 Cook: the shared units, 36 weeks, a Familiar and an Explore dish each recipe week', () => {
  const L = level(base);
  assert.equal(L.units.length, 9);
  assert.equal(L.weeks.length, 36);
  // Each unit's last week is its mastery check; the last unit ends on the capstone.
  assert.deepEqual(L.weeks.filter((w) => w.mastery).map((w) => w.week), [4, 6, 10, 15, 20, 26, 30, 33]);
  assert.equal(L.weeks.at(-1).kind, 'capstone');
  assert.ok(L.weeks.filter((w) => !w.kind).every((w) => w.familiar && w.explore && !('recipe' in w)));
  // The recipes salvaged from the first Level 3 are its own cards now.
  for (const id of ['thick-burgers', 'sandwich-loaf', 'dinner-rolls', 'tabbouleh', 'beef-picadillo', 'baked-salmon', 'steamed-fish', 'pan-seared-trout']) {
    assert.ok(L.recipes.some((r) => r.id === id), id);
  }
  assert.ok(!lint(base).errors.some((e) => e.startsWith('levels/')));
});

test("a part page's watch-for list may name a blocked food, and only in its names (§12.2)", () => {
  const page = (fn) => broken((c) => fn(level(c).weeks[0].knowledge));
  assert.doesNotMatch(page((x) => { x.watch = [{ name: 'Lard', hides: 'In some tortillas.' }]; }), /blocked food/);
  assert.match(page((x) => { x.watch = [{ name: 'Lard', hides: 'Lard hides in tortillas.' }]; }), /knowledge\.watch\[0\]\.hides names a blocked food \("lard"\)/);
  assert.match(page((x) => { x.watch = [{ name: 'Lard', hides: 'In some tortillas.' }]; x.body = ['Watch for lard.']; }), /knowledge\.body\[0\] names a blocked food \("lard"\)/);
  assert.deepEqual(blockedWordsIn('the chicken oyster, by the thigh', base.rules), []);
});

test('a Level week is checked: skill, its two dishes, mastery, the shared units, the hours', () => {
  const bad = (fn) => broken((c) => fn(level(c)));
  assert.match(bad((L) => { L.weeks[0].skill = 'no-such-skill'; }), /week 1: skill "no-such-skill" doesn't exist/);
  assert.match(bad((L) => { L.weeks[0].familiar = 'pork-buns'; }), /week 1: Familiar dish "pork-buns" isn't a dish/);
  assert.match(bad((L) => { L.weeks[1].familiar = 'bean-quesadillas'; }), /week 2: Familiar dish "bean-quesadillas" is already an earlier week's dish/);
  assert.match(bad((L) => { L.weeks[0].explore = L.weeks[0].familiar; }), /week 1: its Familiar and Explore dishes are the same/);
  assert.match(bad((L) => { delete L.weeks[0].explore; }), /week 1: needs a skill, a Familiar dish, and an Explore dish/);
  assert.match(bad((L) => { L.weeks[0].cuisine = 'atlantis'; }), /week 1: cuisine "atlantis" doesn't exist/);
  assert.match(bad((L) => { delete L.weeks[3].mastery; }), /week 4: the last week of a unit is its mastery week/);
  assert.match(bad((L) => { L.weeks[2].mastery = true; }), /week 3: a mastery week is the last week of its unit/);
  assert.match(bad((L) => { L.units[0].name = 'Knives'; }), /unit 1: should be "Kitchen basics", as in level-units.json/);
  assert.match(bad((L) => { L.weeks[4].unit = 1; delete L.weeks[3].mastery; }), /unit 1: has 5 weeks; the shared plan gives it 4/);
  assert.match(bad((L) => { L.weeks[34].familiar = 'shakshuka'; }), /week 35: a practice week has no familiar/);
  assert.match(bad((L) => { L.weeks[0].swapIns = ['no-such-dish']; }), /week 1: swap-in "no-such-dish" isn't a dish/);
  assert.match(bad((L) => { for (const w of L.weeks) w.drill.minutes = 200; }), /the weeks add up to [\d.]+ hours, not about 125/);
  // The familiar tag decides the slot: a warning, since tags can change.
  const c = structuredClone({ ...base, imageExists: undefined });
  Object.assign(level(c).weeks[0], { familiar: 'rajma', explore: 'bean-quesadillas' });
  const { warnings } = lint(c);
  assert.ok(warnings.some((w) => /week 1: Familiar dish "rajma" is tagged new-ish/.test(w)), warnings.join('\n'));
  assert.ok(warnings.some((w) => /week 1: Explore dish "bean-quesadillas" is tagged everyday/.test(w)));
});

test('a recipe card is in one Level only, and another Level can cook it', () => {
  const two = (fn) => broken((c) => {
    const V = structuredClone(level(c));
    V.id = 'level-x'; V.sideUnit = { ...V.sideUnit, number: 109, prefix: 'X' };
    fn(V);
    c.levels.push({ file: 'level-x.json', data: V });
  });
  assert.match(two(() => {}), /recipe bean-quesadillas: is already a recipe card in another Level/);
  // Without its own copies, level-x's weeks still know Level 3's cards.
  assert.doesNotMatch(two((V) => { V.recipes = []; }), /isn't a dish in course.json, a lesson, or (one of this|a) Level's recipe/);
});

test("each program's labels have a letter of their own; S and A are taken", () => {
  assert.match(broken((c) => { level(c).sideUnit.prefix = 'U'; }), /prefix "U" is already units\.json 8's/);
  assert.match(broken((c) => { level(c).sideUnit.prefix = 'S'; }), /prefix "S" is already Cook Around the World's/);
  assert.match(broken((c) => { level(c).sideUnit.prefix = 'A'; }), /prefix "A" is already Level 1's/);
});

test('the hard rule holds on Level pages and recipes', () => {
  const bad = (fn) => broken((c) => fn(level(c)));
  assert.match(bad((L) => { L.weeks[0].knowledge.body = ['Shrimp is safe at 145°F.']; }), /names a blocked food \("shrimp"\)/);
  assert.match(bad((L) => { L.recipes.find((r) => r.id === 'thick-burgers').about = 'Burgers with bacon on top.'; }), /recipe thick-burgers: about names a blocked food \("bacon"\)/);
  assert.match(bad((L) => { L.units[6].goal = 'Cooks shellfish gently'; }), /names a blocked food \("shellfish"\)/);
  assert.match(bad((L) => { L.recipes[0].id = 'shakshuka'; }), /has the same id as a Cook Around the World dish/);
});

test('a Level recipe written as a lesson is checked like a lesson and matches its card', () => {
  const shak = base.lessons.find((l) => l.data.id === 'shakshuka').data;
  const errs = broken((c) => {
    const L = { ...structuredClone(shak), id: 'thick-burgers', title: 'Thick beef burgers', unit: 103, cuisine: 'american', totalMinutes: 41 };
    L.steps[0].text = 'Add the ham.';
    c.levelLessons = [{ file: 'thick-burgers.json', data: L }];
  });
  assert.match(errs, /levels\/recipes\/thick-burgers.json: .*names a blocked food \("ham"\)/);
  assert.match(errs, /recipe thick-burgers: skills don't match the lesson's/);
  assert.match(errs, /recipe thick-burgers: minutes should be the lesson's/);
});

// 14f: Level 4's "Have an adult at home", and the portfolio's writing boxes.
test("only Level 4 says Have an adult at home, and a writing box's id is used once in its Level", () => {
  const four = (c) => c.levels.find((l) => l.data.id === 'sp-4').data;
  assert.ok(four(base).weeks.find((w) => w.week === 26).adultAtHome);
  assert.match(broken((c) => { level(c).weeks[0].adultAtHome = true; }), /week 1: has adultAtHome, which only Level 4 uses/);
  assert.match(broken((c) => { four(c).weeks.find((w) => w.week === 35).adultAtHome = true; }), /a practice week has no adultAtHome/);
  assert.match(broken((c) => { four(c).weeks.find((w) => w.week === 35).sabbath.write = [{ id: 'menu', label: 'The menu again' }]; }), /writing box "menu" is already used on another page of this Level/);
  // Write my recipe is Level 4's, on a mastery week or the capstone's weeks.
  assert.match(broken((c) => { level(c).weeks[3].ownRecipe = true; }), /week 4: has ownRecipe, which only Level 4 uses/);
  assert.match(broken((c) => { four(c).weeks[0].ownRecipe = true; }), /week 1: has ownRecipe, which is for a mastery week/);
});
