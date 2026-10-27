// The demo page (plan §6.16): no account, nothing saved to one. It hands the
// real lesson player a pretend profile and family, so what moms try is what
// kids get. It shows the two tracks: Cook Around the World (the sample
// lessons, the diet preview, a shopping list preview, the whole course, and
// the skills view) and Structured Progression (a Level week with a tab for
// each of its parts, the four Levels, and a pretend learner's progress). The
// Levels show once their release is launched (§8.6): until then the Worker
// serves no Levels, and the demo is Cook Around the World only.
import { openLesson } from './player.js';
import { dietView } from './lib/diet.js';
import { shoppingList } from './lib/shop.js';
import { numberCourse, courseNo } from './lib/course.js';
import { markTerms, toggleTermCard } from './lib/terms.js';
import { levelProgressView } from './rewards.js';
import { allLevels } from './level-outlines.js';

const root = document.getElementById('demo');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ic = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="/icons.svg#${id}"/></svg>`;
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`Couldn't load ${u}`); return r.json(); };

const [R, C, LV] = await Promise.all([getJSON('/content/registry.json'), getJSON('/content/course.json'), getJSON('/content/levels.json')]);

const DIET = { nuts: 'Tree nuts', peanuts: 'Peanuts', dairy: 'Dairy', egg: 'Eggs', gluten: 'Gluten', fish: 'Fish', meat: 'Meat and poultry' };
const SECTION_ICON = {
  produce: 's-produce', herbs: 's-produce', 'meat-fish': 's-meat', 'dairy-eggs': 's-dairy', 'bread-tortillas': 's-bakery',
  'grains-pasta': 's-pantry', 'canned-jarred': 's-canned', sauces: 's-canned', 'oils-vinegars': 's-pantry', baking: 's-bakery',
  spices: 's-pantry', specialty: 's-pantry', frozen: 's-frozen',
};
// The sample lessons as a pretend family's coming weeks, and a few pretend
// kitchen staples, for the shopping preview.
const DEMO_WEEKS = [['This week', ['shakshuka', 'beef-bulgogi']], ['Next week', ['buttermilk-biscuits']], ['The week after', ['brown-butter-cookies']]];
const DEMO_STAPLES = ['salt', 'black-pepper', 'olive-oil'];
// What Try it shows: one pick-one group, to show a skill's choices, then the
// samples. Lessons written later stay out of the demo unless they're added here.
const DEMO_TRY = [
  ['Pick one: three ways to learn julienne', 'Each foundation skill has a few dishes from different kitchens. Your family cooks the one it likes best.', ['spring-rolls', 'chicken-fajitas', 'shoestring-fries']],
  ['More sample lessons', '', ['shakshuka', 'beef-bulgogi', 'buttermilk-biscuits', 'brown-butter-cookies']],
];
// Structured Progression's sample: Level 3's first four weeks whose recipe
// and part pages are all written. A week's recipe is its Familiar dish, the
// default a course starts with (§12.0).
const L3 = LV.levels.find((x) => x.id === 'sp-3') ?? null;
const LEVEL = L3 && { ...L3, weeks: L3.weeks.map((w) => ({ ...w, recipe: w.familiar })) };
const written = new Set([...R.lessons, ...(R.levelLessons ?? [])].map((l) => l.id));
// A week's two dishes, Familiar then Explore: the ones written can be cooked here.
const weekRecipes = (w) => [w.familiar, w.explore].filter((id) => id && written.has(id));
const DEMO_WEEKS_LV = LEVEL ? LEVEL.weeks.filter((w) => weekRecipes(w).length && ['knowledge', 'drill', 'sabbath'].every((k) => w[k].body?.length)).slice(0, 4) : [];
const DEMO_IDS = new Set([...DEMO_TRY.flatMap(([, , ids]) => ids), ...DEMO_WEEKS_LV.flatMap(weekRecipes)]);
const lessons = Object.fromEntries(await Promise.all([...DEMO_IDS].filter((id) => written.has(id)).map(async (id) => [id, await getJSON(`/content/lessons/${id}.json`)])));
// Lesson numbers in the suggested course order (a family's own plan can change them).
const { labels: NUM } = numberCourse(C.dishes);

// The two tracks (owner, 2026-10-24): Cook Around the World, recipes only,
// and Structured Progression, the Levels as full courses.
const TRACKS = {
  catw: { name: 'Cook Around the World', short: 'Enhance your technique as you explore dishes from all over', tabs: [['try', 'Try it'], ['shop', 'Shopping'], ['course', 'Course'], ['skills', 'Skills']] },
  ...(DEMO_WEEKS_LV.length ? { sp: { name: 'Structured Progression', short: 'Fundamental cooking skills taught through reading, writing, and doing', tabs: [['week', 'Try a week'], ['levels', 'The Levels'], ['progress', 'Progress']] } } : {}),
};
const twoTracks = Object.keys(TRACKS).length > 1;
// What a visitor has chosen. Kept for this tab only.
let V = { track: 'catw', open: null, theme: 'quest', audience: 'kid', diet: [], tab: 'try', checked: [], shop: { step: 'needs', count: 0, have: [] }, lvWeek: 1, lvPart: 'knowledge', lvDone: [] };
try { V = { ...V, ...JSON.parse(sessionStorage.getItem('cpr.demo')) }; } catch { /* first visit */ }
V.shop = { step: 'needs', count: 0, have: [], ...(V.shop ?? {}) };
if (!TRACKS[V.track]?.tabs.some(([k]) => k === V.tab)) V = { ...V, track: 'catw', tab: 'try' };
const keep = () => { try { sessionStorage.setItem('cpr.demo', JSON.stringify(V)); } catch { /* private mode */ } };
const family = () => ({ diet_filters: V.diet, default_servings: 6 });
const profile = () => ({ id: `demo-${V.theme}-${V.audience}`, theme: V.theme, audience: V.audience, people: [{ name: 'Demo', color: 'tomato' }] });

// ---------- shared parts ----------
function header() {
  return `<section class="d-hero"><img src="/img/logo.webp" alt="" width="110" height="110">
    <h1>Clean Plate Recipes</h1>
    <p><b>A cooking course, but not like any you've ever tried before.</b></p>
    <p>Appropriate for kids, teens, and even adults looking to expand to new culinary horizons, Clean Plate Recipes is built to be three things: fun, free, and fundamentally rooted in the dietary laws of the Most High.</p>
    <p>Check out the demo below to see our current build progress. Beta testing is now live. To participate, search Clean Plate Recipe App on Facebook.</p>
    <p class="by">By Immotus Apps</p></section>
    <div class="d-cta"><a class="hbtn pri" href="/#/signup">Sign up</a><a class="hbtn" href="/#/login">Log in</a><button type="button" class="hbtn link" data-beliefs>Our beliefs and the app's rules</button></div>
    ${twoTracks ? `<h2 class="d-tracks-h">Two ways to learn</h2>
    <div class="d-tracks">${Object.entries(TRACKS).map(([k, T]) => `<button type="button" class="d-trackbtn" data-pick="${k}" aria-pressed="${V.track === k}" aria-expanded="${V.open === k}" aria-controls="track-info"><b>${esc(T.name)}</b><small>${esc(T.short)}</small><i aria-hidden="true">${V.open === k ? '▴' : '▾'}</i></button>`).join('')}</div>
    ${V.open ? trackInfo(V.open) : ''}` : ''}`;
}
// A track's details, opened from its button under the header.
function trackInfo(k) {
  const info = k === 'catw'
    ? `<p class="who">For older teens and adults who want to practise their techniques and experiment with a wide range of dishes.</p>
        <ul><li><b>Recipes only:</b> ${C.dishes.length} dishes from kitchens around the world, each one teaching a skill</li>
          <li>Cook them in order, or pick what sounds good</li>
          <li>Homeschool families can grade cooks and print a transcript</li></ul>`
    : `<p class="who">For families teaching cooking from the fundamentals onward, even for young cooks.</p>
        <ul><li><b>Complete, credit-able courses</b> built on best practices, in Levels of 36 weeks</li>
          <li>Every week: <b>Knowledge, Drill, Recipe, and Beyond the Recipe</b>, for a full culinary and food-science education</li>
          <li>Two dishes each week, one familiar and one to explore, both teaching the week's skill</li>
          <li>Mastery checks, hours toward credit, and a transcript</li></ul>`;
  const syllabus = k === 'catw' ? '/syllabus/' : '/syllabus/structured-progression/';
  return `<article class="d-track" id="track-info"><h3>${esc(TRACKS[k].name)}</h3>${info}
    <div class="d-cta"><button type="button" class="hbtn pri" data-track="${k}">Explore ${esc(TRACKS[k].name)}</button><a class="hbtn link" href="${syllabus}">Review its homeschool syllabus</a></div></article>`;
}
const seg = (name, value, options) => `<div class="seg" role="group">${options.map(([v, label]) => `<button type="button" data-set="${name}" data-v="${v}" aria-pressed="${value === v}">${esc(label)}</button>`).join('')}</div>`;
// What each tab can switch: the theme and who's cooking change lessons and
// the Level views, and the diet changes lessons and the list.
const CONTROLS = { try: ['theme', 'audience', 'diet'], shop: ['diet'], week: ['theme', 'audience', 'diet'], progress: ['theme'] };
function controls() {
  const on = CONTROLS[V.tab] ?? [];
  if (!on.length) return '';
  return `<div class="d-controls card">
    ${on.includes('theme') ? `<div class="d-row"><b>Theme</b>${seg('theme', V.theme, [['quest', 'Kitchen Quest'], ['passport', "Chef's Passport"]])}</div>` : ''}
    ${on.includes('audience') ? `<div class="d-row"><b>Cooking as</b>${seg('audience', V.audience, [['kid', 'A kid'], ['adult', 'An adult']])}</div>` : ''}
    ${on.includes('diet') ? `<div class="d-row"><b>Leave out</b><div class="chips">${Object.entries(DIET).map(([t, label]) => `<label><input type="checkbox" data-diet="${t}" ${V.diet.includes(t) ? 'checked' : ''}>${esc(label)}</label>`).join('')}</div></div>` : ''}
  </div>`;
}
function tabs() {
  const T = TRACKS[V.track];
  return `<h2 class="d-track-now" id="track">${esc(T.name)}</h2><nav class="tabs" aria-label="${esc(T.name)}">${T.tabs.map(([k, l]) => `<a href="#${k}" data-tab="${k}" aria-current="${V.tab === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>`;
}

// ---------- try a lesson: the sample lessons in the profile's theme ----------
function tryView() {
  const quest = V.theme === 'quest';
  const hidden = [];
  const card = (l) => {
    const L = lessons[l.id], v = dietView(L, R.ingredients, V.diet);
    const name = (id) => R.ingredients[id]?.name.toLowerCase() ?? id;
    const notes = [...v.applied.map((x) => `Made with ${name(x.use)} instead of ${name(x.for)}`), ...v.leftOut.map((id) => `Leave out the ${name(id)}`)];
    const cu = R.cuisines[L.cuisine]?.name ?? L.cuisine;
    const inner = quest
      ? `<article class="q-panel q-card"><p class="q-kick">Path ${L.unit} · Quest ${courseNo(NUM[L.id])}</p><div class="q-win"><img src="/${esc(l.image)}" alt="" width="230" height="230" loading="lazy"></div><h3 class="q-title">${esc(L.title)}</h3><p class="q-skill">${esc(L.skill)}</p>
          <dl class="q-stats"><div><dt>Time</dt><dd>${L.totalMinutes} min</dd></div><div><dt>Serves</dt><dd>${L.servings}</dd></div><div><dt>From</dt><dd>${esc(cu)}</dd></div></dl>${notes.map((n) => `<p class="q-swap">${esc(n)}</p>`).join('')}</article>`
      : `<article class="p-card"><span class="tape t1"></span><span class="tape t2"></span><div class="p-photo"><img src="/${esc(l.image)}" alt="" width="220" height="220" loading="lazy"></div><p class="p-lessonno">Lesson ${courseNo(NUM[L.id])}</p><h3 class="p-title">${esc(L.title)}</h3><p class="p-skill">${esc(L.skill)}</p>
          <div class="p-meta"><span>${L.totalMinutes} min</span><span>Serves ${L.servings}</span><span>${esc(cu)}</span></div>${notes.map((n) => `<p class="p-swap">${esc(n)}</p>`).join('')}</article>`;
    return `<button type="button" class="lesson" data-open="${esc(l.id)}" aria-label="Try ${esc(L.title)}">${inner}</button>`;
  };
  const groups = DEMO_TRY.map(([title, note, ids]) => {
    const shown = [];
    for (const l of R.lessons.filter((x) => ids.includes(x.id))) (dietView(lessons[l.id], R.ingredients, V.diet).visible ? shown : hidden).push(l);
    return shown.length ? `<div class="d-group"><h3>${esc(title)}</h3>${note ? `<p>${esc(note)}</p>` : ''}<div class="k-lib">${shown.map(card).join('')}</div></div>` : '';
  }).join('');
  return `<section class="kitchen qx" data-kt="${V.theme}"><div class="k-head"><div class="grow"><h2 style="margin:0">${quest ? 'Quest board' : 'Recipe box'}</h2><div>The sample lessons. Tap one to cook it.</div></div></div>
    ${groups || '<p>Every sample lesson is hidden for this diet.</p>'}
    ${hidden.length ? `<p class="d-hidden">Hidden for this diet: ${hidden.map((l) => esc(l.title)).join(', ')}</p>` : ''}</section>`;
}

// ---------- shopping (§6.3): the real flow with the sample lessons, saving nothing ----------
function shopView() {
  const sh = V.shop;
  const visible = (id) => lessons[id] && dietView(lessons[id], R.ingredients, V.diet).visible;
  const weeks = DEMO_WEEKS.map(([name, ids]) => [name, ids.filter(visible)]).filter(([, ids]) => ids.length);
  const upcoming = weeks.flatMap(([, ids]) => ids);
  // Staples are grouped first while checking the cupboard; on the list itself
  // they're in their store aisles.
  const listOf = (ids, skip = [], staples = DEMO_STAPLES) => shoppingList({ lessons: ids.map((id) => ({ lesson: lessons[id], servings: 6 })), registry: R.ingredients, filters: V.diet, staples, skip });
  const used = (it) => `<div class="drow"><span><b>${esc(it.name)}</b><small>${esc(it.from.join(' · '))}${it.optional ? ' · optional' : ''}</small></span><span class="q">${esc(it.used ?? '')}</span></div>`;
  const groups = (list, row) => `${list.may_have.length ? `<div class="psec"><h4>May already have</h4>${list.may_have.map(row).join('')}</div>` : ''}${list.sections.map((x) => `<div class="psec"><h4>${ic(SECTION_ICON[x.id] ?? 's-pantry', '')}${esc(x.name)}</h4>${x.items.map(row).join('')}</div>`).join('')}`;
  const picked = upcoming.slice(0, sh.count);
  const names = (ids) => ids.map((id) => esc(lessons[id].title)).join(', ');
  if (!upcoming.length) return '<section class="parent"><h3>Shopping</h3><p class="sub">Nothing to shop for with this diet.</p></section>';

  if (sh.step === 'preview' && picked.length) {
    const list = listOf(picked);
    const tick = (it) => `<label class="dhave"><input type="checkbox" data-have="${esc(it.id)}" ${sh.have.includes(it.id) ? 'checked' : ''}><span><b>${esc(it.name)}</b><small>${[it.used ? `Recipes use ${esc(it.used)}` : null, it.buy && it.buy !== it.used ? `buy ${esc(it.buy)}` : null].filter(Boolean).join(' · ')}</small></span></label>`;
    return `<section class="parent"><h3>Before you make the list</h3><p class="sub">For ${names(picked)} (serves 6 each). Tick anything you already have. It's left off this list only.</p>
      ${groups(list, tick)}
      <div class="acts"><button type="button" class="hbtn" data-shop="needs">Back</button><button type="button" class="hbtn pri" data-shop="list">Create shopping list</button></div></section>`;
  }

  if (sh.step === 'list' && picked.length) {
    const list = listOf(picked, sh.have, []);
    const all = [...list.sections.flatMap((x) => x.items), ...list.may_have];
    const done = V.checked.filter((id) => all.some((x) => x.id === id)).length;
    const row = (it) => `<button type="button" class="pitem" data-check="${esc(it.id)}" aria-pressed="${V.checked.includes(it.id)}"><span class="bx">${ic('i-check', '')}</span><span class="nm">${esc(it.name)}<small>${esc(it.from.join(' · '))}</small></span><span class="q">${esc(it.buy ?? it.used ?? '')}${it.buy && it.used && it.used !== it.buy ? `<small>The recipes use ${esc(it.used)}</small>` : ''}</span></button>`;
    const had = listOf(picked).sections.flatMap((x) => x.items).concat(listOf(picked).may_have).filter((x) => sh.have.includes(x.id));
    return `<section class="parent"><h3>Shopping list</h3><p class="sub">For ${names(picked)} · ${done} of ${all.length} in the cart</p>
      ${groups(list, row)}
      ${had.length ? `<details class="psec"><summary>You have these (${had.length})</summary>${had.map((it) => `<div class="drow"><span><b>${esc(it.name)}</b></span><button type="button" class="hbtn" data-unhave="${esc(it.id)}">Put on the list</button></div>`).join('')}</details>` : ''}
      <div class="acts"><button type="button" class="hbtn" data-shop="needs">Make another</button></div></section>`;
  }

  return `<section class="parent"><h3>Shopping</h3><p class="sub">We help make sure everything you need is on hand.</p>
    <div class="psec"><h4>Make a shopping list</h4>
      <label class="f">How many lessons are you shopping for? <small class="mut">Counting from the next lesson not cooked yet</small>
        <select data-count><option value="0">Pick a number</option>${upcoming.map((_, i) => `<option value="${i + 1}" ${sh.count === i + 1 ? 'selected' : ''}>${i + 1} lesson${i ? 's' : ''}</option>`).join('')}</select></label>
      ${picked.length ? `<p class="small mut">For ${names(picked)}</p><div class="acts"><button type="button" class="hbtn pri" data-shop="preview">Next</button></div>` : ''}</div>
    <h3 style="margin-top:22px">What you'll need</h3>
    ${weeks.map(([name, ids], k) => `<details class="dweek" ${k < 2 ? 'open' : ''}><summary><b>${esc(name)}</b> · ${names(ids)}</summary>${groups(listOf(ids), used)}</details>`).join('')}
    </section>`;
}

// ---------- the whole course ----------
const dishById = Object.fromEntries(C.dishes.map((d) => [d.id, d]));
const groupOf = (d) => (d.pickOne ? C.dishes.filter((x) => x.pickOne === d.pickOne) : [d]);
function courseView() {
  const units = [...new Set(C.dishes.map((d) => d.unit))];
  const row = (d) => {
    const cu = R.cuisines[d.cuisine]?.name ?? d.cuisine;
    const pick = d.pickOne ? `<small class="pick">Pick one: ${groupOf(d).map((x) => esc(x.title)).join(' · ')}</small>` : '';
    const body = `<img src="/${esc(d.image)}" alt="" width="64" height="64" loading="lazy"><span><b>${NUM[d.id]} · ${esc(d.title)}</b><small>${esc(cu)}${d.breakfast ? ' · breakfast' : ''}</small><small>${esc(d.skill)}</small>${pick}${lessons[d.id] ? `<span class="tag">${ic('i-check', '')}Try it now</span>` : ''}</span>`;
    return lessons[d.id] ? `<button type="button" class="c-dish" data-open="${esc(d.id)}">${body}</button>` : `<div class="c-dish">${body}</div>`;
  };
  return `<p class="mut">With over 100 dishes to choose from, you can build a course that is filled with dishes you love as you practice the skills you need. Where a skill has several dishes designed to teach it, we'll use your diet preferences to recommend the one we think you'll like best; however, you can swap, or add multiple, anytime you'd like!</p>
    ${units.map((u) => `<h3 class="c-unit">${R.units[u] === 'Desserts' ? 'Desserts' : `Unit ${u}: ${esc(R.units[u])}`}</h3><div class="c-grid">${C.dishes.filter((d) => d.unit === u).map(row).join('')}</div>`).join('')}`;
}

// ---------- skills: what the course teaches, and where each skill comes back ----------
function pinSVG(s) {
  const c = s.pin.color, shape = s.pin.shape === 'circle' ? `<circle cx="20" cy="20" r="17" fill="${c}"/>`
    : s.pin.shape === 'hex' ? `<polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="${c}"/>`
      : '<path d="M20 2l16 6v12c0 9-7 15-16 18C11 35 4 29 4 20V8z" fill="' + c + '"/>';
  return `<svg viewBox="0 0 40 40" aria-hidden="true">${shape}<use href="/icons.svg#g-${esc(s.pin.glyph)}" x="10" y="10" width="20" height="20" color="#fff"/></svg>`;
}
function skillsView() {
  const order = [];
  for (const d of C.dishes) for (const s of d.skills) {
    let e = order.find((x) => x.id === s);
    if (!e) order.push(e = { id: s, teach: [], practice: [] });
    // The first dish with the skill teaches it. When that dish is in a pick-one
    // group, every dish in the group that has the skill teaches it too (§4.0).
    if (!e.teach.length) e.teach.push(d.id);
    else if (d.pickOne && dishById[e.teach[0]].pickOne === d.pickOne) e.teach.push(d.id);
    else e.practice.push(d.id);
  }
  const names = (ids) => ids.map((id) => `${NUM[id]} ${esc(dishById[id].title)}${dishById[id].written ? ' ✓' : ''}`).join(', ');
  return `<p class="mut">${order.length} skills are taught or practiced throughout the course. Below is the general order in which they are taught.</p>
    <div class="sk-list">${order.map((e) => {
      const s = R.skills[e.id];
      return `<article class="sk"><h4>${pinSVG(s)}${esc(s.name)}</h4>${e.teach.length > 1 ? '<span class="found">Foundation skill · pick one</span>' : ''}<p>${esc(s.idea)}</p>
        <p class="mut"><b>Taught in:</b> ${names(e.teach)}</p>${e.practice.length ? `<p class="mut"><b>Practiced in:</b> ${names(e.practice)}</p>` : ''}</article>`;
    }).join('')}</div>`;
}

// ---------- Structured Progression: a Level week, the Levels, and progress ----------
const PART_NAMES = { knowledge: 'Knowledge', drill: 'Drill', sabbath: 'Beyond the Recipe' };
const unitOf = (n) => LEVEL.units.find((u) => u.number === n);
// The week's recipe for this diet: its Familiar dish, or its Explore dish
// when the diet rules the Familiar out (§12.0).
const weekRecipe = (w) => weekRecipes(w).find((id) => dietView(lessons[id], R.ingredients, V.diet).visible) ?? null;
const titleOf = (id) => lessons[id]?.title ?? id;

// This week's card (12c), with a small tab for each of its four parts in
// the owner's order (Knowledge, Drill, Recipe, Beyond the Recipe), and the
// open part's page under them: its reading, steps, and quiz with Done, or
// the recipe with Cook it. Done is kept for this tab only.
const WEEK_TABS = [['knowledge', 'Knowledge'], ['drill', 'Drill'], ['recipe', 'Recipe'], ['sabbath', 'Beyond the Recipe']];
const cardOf = (id) => [...R.lessons, ...(R.levelLessons ?? [])].find((l) => l.id === id);
function weekView() {
  const quest = V.theme === 'quest';
  const w = DEMO_WEEKS_LV.find((x) => x.week === V.lvWeek) ?? DEMO_WEEKS_LV[0];
  const u = unitOf(w.unit), id = weekRecipe(w);
  const done = (k) => V.lvDone.includes(`${w.week}-${k}`);
  const on = WEEK_TABS.some(([k]) => k === V.lvPart) ? V.lvPart : 'knowledge';
  const swapped = id && id !== w.recipe;
  const tabsRow = `<div class="d-ptabs" role="tablist" aria-label="This week's parts">${WEEK_TABS.map(([k, label]) => `<button type="button" role="tab" id="pt-${k}" aria-controls="pt-panel" aria-selected="${k === on}" data-ptab="${k}"><span>${esc(label)}</span><small>${k === 'recipe' ? (id ? `${lessons[id].totalMinutes} min` : 'Swap') : done(k) ? 'Done ✓' : `${w[k].minutes} min`}</small></button>`).join('')}</div>`;
  return `<p class="mut d-lede">A sample of Unit 1 for <b>${esc(LEVEL.name)}</b>. Each week, your learner reads a new Knowledge page, practices a Drill, cooks a Recipe, and completes a Beyond the Recipe activity.</p>
    <div class="seg d-weeks" role="group" aria-label="Week">${DEMO_WEEKS_LV.map((x) => `<button type="button" data-lvweek="${x.week}" aria-pressed="${x.week === w.week}">Week ${x.week}${x.mastery ? ' · Mastery' : ''}</button>`).join('')}</div>
    <section class="kitchen qx" data-kt="${V.theme}"><article class="${quest ? 'q-panel' : 'p-card'} k-level">
      <p class="${quest ? 'q-kick' : 'p-lessonno'}">${esc(LEVEL.name)} · Week ${w.week} of ${LEVEL.weeks.length}</p>
      <h2 class="${quest ? 'q-title' : 'p-title'}">Unit ${u.number}: ${esc(u.name)}</h2>
      ${w.mastery ? `<p class="${quest ? 'q-swap' : 'p-swap'}">Mastery week: cook it on your own</p>` : ''}
      ${tabsRow}
      <div class="d-ppanel" role="tabpanel" id="pt-panel" aria-labelledby="pt-${on}">${on === 'recipe' ? recipePanel(w, id, swapped, quest) : partPanel(w, on, quest)}</div>
    </article>
    <p class="d-goal"><b>Unit goal:</b> ${esc(u.goal)}</p></section>`;
}

// The week's recipe: its card, and Cook it to open the real player.
function recipePanel(w, id, swapped, quest) {
  if (!id) return `<h3 class="${quest ? 'q-title' : 'p-title'}">None of this week's recipes fit this diet</h3><p>A parent would use Swap recipe to pick another dish that teaches this week's skill.</p>`;
  const L = lessons[id], c = cardOf(id);
  const other = [w.familiar, w.explore].find((x) => x !== id);
  return `${swapped ? `<p class="${quest ? 'q-swap' : 'p-swap'}">${esc(w.title)} doesn't fit this diet, so this week cooks its Explore dish.</p>` : ''}
    <div class="d-precipe">${c?.image ? `<img src="/${esc(c.image)}" alt="" width="120" height="120" loading="lazy">` : ''}<div>
      <h3 class="${quest ? 'q-title' : 'p-title'}">${esc(L.title)}</h3><p class="${quest ? 'q-skill' : 'p-skill'}">${esc(L.skill)}</p>
      <p>${L.totalMinutes} min · Serves ${L.servings} · ${esc(R.cuisines[L.cuisine]?.name ?? L.cuisine)}</p></div></div>
    ${w.note ? `<p><b>This week:</b> ${esc(w.note)}</p>` : ''}
    <div class="acts"><button type="button" class="${quest ? 'q-btn' : 'p-btn'}" data-open="${esc(id)}">Cook it</button></div>
    ${other ? `<p class="mut">${other === w.explore ? 'Or explore' : 'Or the familiar one'}: ${esc(other === w.explore ? w.exploreTitle : w.title)}${weekRecipes(w).includes(other) && dietView(lessons[other], R.ingredients, V.diet).visible ? ` <button type="button" class="hbtn link" data-open="${esc(other)}">Cook this instead</button>` : ''}</p>` : ''}`;
}

// A drill, knowledge, or Beyond the Recipe page (12c), with Done, saving nothing.
function partPanel(w, k, quest) {
  const x = w[k], on = V.lvDone.includes(`${w.week}-${k}`);
  const quiz = (x.quiz ?? []).map((q, n) => `<div class="k-pagebody"><b>${esc(q.q)}</b><div class="k-parts">${q.choices.map((c, i) => `<button type="button" class="k-part" data-quiz="${n}-${i}"><b>${esc(c)}</b></button>`).join('')}</div><p data-why="${n}" hidden></p></div>`).join('');
  return `<h3 class="${quest ? 'q-title' : 'p-title'}">${esc(x.title)}</h3>
    <p>About ${x.minutes} minutes</p>
    <div class="k-pagebody">${(x.body ?? []).map((t) => `<p>${markTerms(t, R.terms, esc)}</p>`).join('')}${x.steps?.length ? `<ol>${x.steps.map((t) => `<li>${markTerms(t, R.terms, esc)}</li>`).join('')}</ol>` : ''}${x.watch?.length ? `<div class="k-watch"><b>Watch for</b><ul>${x.watch.map((i) => `<li><b>${esc(i.name)}</b>: ${esc(i.hides)}</li>`).join('')}</ul></div>` : ''}${quiz}</div>
    ${on ? `<p class="${quest ? 'q-swap' : 'p-swap'}">Done ✓</p>` : `<div class="acts"><button type="button" class="${quest ? 'q-btn' : 'p-btn'}" data-done="${k}">Done</button></div>`}`;
}

function levelsView() {
  const card = (L) => {
    const weeksOf = (n) => L.weeks.filter((w) => w.unit === n);
    const dishes = (w) => (w.title ? `${esc(w.title)} <small>or ${esc(w.exploreTitle)}</small>` : esc(w.kind === 'capstone' ? 'Capstone' : 'Practice run'));
    const unit = (u) => `<li><b>Unit ${u.number}: ${esc(u.name)}</b>${u.goal ? `<small>${esc(u.goal)}</small>` : ''}${weeksOf(u.number).length ? `<details><summary>Weeks ${weeksOf(u.number)[0].week}–${weeksOf(u.number).at(-1).week}</summary><ol class="d-wks">${weeksOf(u.number).map((w) => `<li value="${w.week}">${dishes(w)}${w.mastery ? ' <em>Mastery</em>' : ''}</li>`).join('')}</ol></details>` : ''}</li>`;
    return `<article class="d-level ${L.later ? '' : 'built'}"><div class="d-level-h"><h3>${esc(L.name)}</h3>${L.later ? '<span class="d-badge">Being planned</span>' : ''}</div>
      <p class="d-facts"><span>36 weeks</span><span>${esc(L.week)}</span>${L.hours ? `<span>About ${L.hours} hours</span>` : ''}<span>${esc(L.credit)}</span></p>
      ${L.note ? `<p class="mut">${esc(L.note)}</p>` : ''}
      <details ${L.name === LEVEL.name ? 'open' : ''}><summary>The ${L.units.length} units</summary><ol class="d-units">${L.units.map(unit).join('')}</ol></details></article>`;
  };
  return `<p class="mut d-lede">Each Level is a full school year of 36 weeks, and every Level covers the same nine units by cooking method, so siblings on different Levels stay in step. What climbs is how hard the recipes are. Each unit ends with a mastery week cooked on their own, and every Level ends with a Sabbath capstone. Levels go by what a cook can already do, so a family starts wherever fits.</p>
    <div class="d-levels">${allLevels(LV.levels).map(card).join('')}</div>
    <p><a class="hbtn link" href="/syllabus/structured-progression/">Review the Structured Progression syllabus</a></p>`;
}

// A pretend learner partway through Level 3, drawn by the real progress view
// (12e): weeks 1–5 done, Unit 1 (weeks 1–4) mastered, week 6 begun.
const DEMO_NOW = 6;
const dayOf = (week) => new Date(Date.UTC(2026, 8, 6 + (week - 1) * 7 + 3)).toISOString().slice(0, 10);
function demoLevel() {
  const kept = ['knowledge', 'drill', 'sabbath'];
  let minutes = 0;
  const units = LEVEL.units.map((u) => ({ number: u.number, name: u.name, goal: u.goal, mastered: u.number === 1 ? dayOf(4) : null,
    weeks: LEVEL.weeks.filter((w) => w.unit === u.number).map((w) => {
      const past = w.week < DEMO_NOW;
      const parts = Object.fromEntries(kept.map((k) => [k, past || (w.week === DEMO_NOW && k === 'knowledge') ? dayOf(w.week) : null]));
      for (const k of kept) if (parts[k]) minutes += w[k].minutes;
      if (past) minutes += lessons[w.recipe]?.totalMinutes ?? 60;
      return { week: w.week, title: w.title ?? null, recipe: w.recipe ?? null, cooked: past ? dayOf(w.week) : null, mastery: Boolean(w.mastery), kind: w.kind ?? null, parts, skipped: [] };
    }) }));
  const w = LEVEL.weeks.find((x) => x.week === DEMO_NOW);
  return {
    week: { week: w.week, unit: w.unit, recipe: w.recipe, recipe_title: w.title, recipe_done: false,
      parts: kept.map((k) => ({ part: k, week: w.week, title: w[k].title, minutes: w[k].minutes, done_at: k === 'knowledge' ? dayOf(w.week) : null })) },
    progress: { name: LEVEL.name, weeks: LEVEL.weeks.length, hours: LEVEL.hours, hours_done: Math.round(minutes / 60), on: kept, complete: null, units },
  };
}
// The pretend learner's cooks, for My cooking collection.
const demoCooks = () => Object.fromEntries(LEVEL.weeks.filter((w) => w.week < DEMO_NOW && written.has(w.recipe)).map((w) => [w.recipe, { times: 1, first: `${dayOf(w.week)}T18:00:00Z`, last: `${dayOf(w.week)}T18:00:00Z` }]));
function progressView() {
  const lv = demoLevel();
  const rows = LEVEL.weeks.filter((w) => w.week <= 2).flatMap((w) => [['knowledge', w.knowledge], ['drill', w.drill], ['recipe', { title: w.title, minutes: lessons[w.recipe]?.totalMinutes ?? 60 }], ['sabbath', w.sabbath]]
    .map(([k, x]) => `<tr><td>${esc(new Date(`${dayOf(w.week)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</td><td>Week ${w.week} · ${k === 'recipe' ? 'Recipe' : PART_NAMES[k]}<small>${esc(x.title)}</small></td><td>${(x.minutes / 60).toFixed(1)}</td></tr>`));
  return `<p class="mut d-lede">What a learner sees on their progress tab, here for a pretend learner in week ${DEMO_NOW} of ${esc(LEVEL.name)}. Switch the theme to see the passport version.</p>
    <section class="kitchen qx" data-kt="${V.theme}" id="lvprogress"></section>
    <section class="parent d-transcript"><h3>On the transcript</h3><p class="sub">Each part checked off prints as its own row with its planned hours, beside the recipes cooked, the units mastered, and the Level's total hours. The parent grades the recipes and enters the final grade and credit.</p>
      <table><thead><tr><th>Date</th><th>Work</th><th>Hours</th></tr></thead><tbody>${rows.join('')}</tbody></table>
      <p class="small mut">The first two weeks of the pretend learner's transcript.</p></section>`;
}

// ---------- the welcome note (owner, 2026-10-27) ----------
// The creator's family's beliefs and the rules the code enforces. It opens on
// a visitor's first look and comes back from the button under the header. It
// sits outside the demo's root, so drawing the page leaves it alone.
const beliefs = document.createElement('dialog');
beliefs.className = 'd-beliefs';
beliefs.setAttribute('aria-labelledby', 'beliefs-h');
beliefs.innerHTML = `<div class="card">
  <h2 id="beliefs-h" tabindex="-1" autofocus>Welcome to Clean Plate!</h2>
  <p><b>A quick note on the app:</b></p>
  <p>Clean Plate was developed with a specific set of dietary beliefs: namely, that the Levitical food laws are still in full effect, and that the Holy Times are mandatory, not suggestions. Though we acknowledge that others believe differently, this app was not built to cater to different beliefs. Therefore, the following rules are enforced within the code:</p>
  <ul>
    <li>Only those meats coming from animals identified as “clean” in Leviticus and Deuteronomy are used in Clean Plate recipes. Additionally, non-“meat” products like pork gelatin or pork casings are excluded. Blood and organ fats (rendered or whole) do not appear as ingredients, either. We have a reporting feature and encourage all users to flag if a recipe does not meet these rules.</li>
    <li>Shabbat/Sabbath is not the time for schoolwork. Therefore, while the recipe player remains open to use for family building, no cooking completed on Saturdays will count towards transcripts or grades, and all weekly scheduled work is Sunday–Friday.</li>
    <li>Unleavened Bread/Hag HaMatzot is enforced. Since there are multiple calculation methods used today, families are asked to select the specific dates their calendar observes. During those dates, all recipes will swap ingredients that contain leavening with unleavened ones, if possible. Recipes with no unleavened adjustment possible will not be available to cook during the Feast.</li>
    <li>“Leavening” is defined in the app as “a substance (as yeast) used to produce fermentation in dough or a liquid; or a material (as baking powder) used to produce a gas that lightens dough or batter.”</li>
    <li>Many of our courses contain readings, quiz questions, and writing prompts that explicitly reference Scripture and encourage learners to read their Bibles to learn what it says about food, feasts, hospitality, and the responsibility of believers to care for the poor. We aim to encourage a proper relationship with food and the Creator who provides it as much as showing how to cook it.</li>
  </ul>
  <p>If you have any concerns about this, please feel free to reach out to our Facebook group with a private message. Otherwise, happy cooking!</p>
  <div class="d-cta"><button type="button" class="hbtn pri" data-close>Got it</button></div>
</div>`;
document.body.append(beliefs);
beliefs.addEventListener('click', (e) => { if (e.target === beliefs || e.target.closest('[data-close]')) beliefs.close(); });
beliefs.addEventListener('close', () => { try { localStorage.setItem('cpr.demo.beliefs', 'seen'); } catch { /* private mode */ } });
let seen = false;
try { seen = localStorage.getItem('cpr.demo.beliefs') === 'seen'; } catch { /* private mode */ }

// ---------- drawing ----------
const VIEWS = { try: tryView, shop: shopView, course: courseView, skills: skillsView, week: weekView, levels: levelsView, progress: progressView };
async function draw() {
  root.innerHTML = `${header()}${tabs()}${controls()}<div id="pane">${VIEWS[V.tab]()}</div>
    <p class="d-foot">Clean Plate Recipes is published by Immotus Apps. Nothing you do here is saved to an account.</p>`;
  const box = document.getElementById('lvprogress');
  if (box) box.append(await levelProgressView(profile(), demoLevel(), demoCooks()));
}

async function open(id) {
  const pane = document.getElementById('pane');
  pane.innerHTML = '';
  root.querySelector('.d-controls')?.setAttribute('hidden', '');
  const mastery = V.tab === 'week' && Boolean(DEMO_WEEKS_LV.find((x) => x.week === V.lvWeek)?.mastery);
  await openLesson(pane, { profile: profile(), family: family(), lessonId: id, mastery, onExit: () => { keep(); draw(); window.scrollTo(0, root.querySelector('.tabs').offsetTop - 8); } });
  pane.scrollIntoView();
}

root.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('[data-beliefs]')) return beliefs.showModal();
  const set = t.closest('[data-set]'), tab = t.closest('[data-tab]'), openBtn = t.closest('[data-open]'), check = t.closest('[data-check]');
  if (set) { V[set.dataset.set] = set.dataset.v; keep(); return draw(); }
  // A track's button picks it and opens its details; tapped again, they close.
  const pick = t.closest('[data-pick]');
  if (pick) {
    const k = pick.dataset.pick;
    V.open = V.open === k ? null : k;
    if (V.track !== k) { V.track = k; V.tab = TRACKS[k].tabs[0][0]; }
    keep();
    return draw();
  }
  const track = t.closest('[data-track]');
  if (track) {
    if (V.track !== track.dataset.track) { V.track = track.dataset.track; V.tab = TRACKS[V.track].tabs[0][0]; keep(); draw(); }
    return document.getElementById('track').scrollIntoView({ behavior: 'smooth' });
  }
  if (tab) { e.preventDefault(); V.tab = tab.dataset.tab; keep(); return draw(); }
  // Structured Progression: a week, a part's tab, Done, and a quiz answer.
  const lvweek = t.closest('[data-lvweek]'), ptab = t.closest('[data-ptab]'), doneBtn = t.closest('[data-done]'), quiz = t.closest('[data-quiz]');
  const kw = t.closest('[data-term]');
  if (kw) return toggleTermCard(kw, root, R.terms, esc);
  if (lvweek) { V.lvWeek = Number(lvweek.dataset.lvweek); keep(); return draw(); }
  if (ptab) { V.lvPart = ptab.dataset.ptab; keep(); draw(); return root.querySelector('.d-ptabs [aria-selected="true"]').focus({ preventScroll: true }); }
  if (doneBtn) { V.lvDone = [...new Set([...V.lvDone, `${V.lvWeek}-${doneBtn.dataset.done}`])]; keep(); return draw(); }
  if (quiz) {
    const [n, i] = quiz.dataset.quiz.split('-').map(Number);
    const w = DEMO_WEEKS_LV.find((x) => x.week === V.lvWeek), q = w[V.lvPart].quiz[n];
    const why = root.querySelector(`[data-why="${n}"]`);
    why.hidden = false;
    why.textContent = `${i === q.answer ? 'Yes!' : `Not quite: it's "${q.choices[q.answer]}".`} ${q.explain}`;
    return;
  }
  if (openBtn) return open(openBtn.dataset.open);
  const shop = t.closest('[data-shop]'), unhave = t.closest('[data-unhave]');
  if (shop) { V.shop.step = shop.dataset.shop; if (shop.dataset.shop === 'needs') V.shop.have = []; keep(); return draw(); }
  if (unhave) { V.shop.have = V.shop.have.filter((x) => x !== unhave.dataset.unhave); keep(); return draw(); }
  if (check) {
    const id = check.dataset.check;
    V.checked = V.checked.includes(id) ? V.checked.filter((x) => x !== id) : [...V.checked, id];
    keep();
    return draw();
  }
});
root.addEventListener('change', (e) => {
  if (e.target.matches('[data-count]')) { V.shop.count = Number(e.target.value); keep(); return draw(); }
  const h = e.target.dataset.have;
  if (h) { V.shop.have = e.target.checked ? [...new Set([...V.shop.have, h])] : V.shop.have.filter((x) => x !== h); keep(); return; }
  const d = e.target.dataset.diet;
  if (!d) return;
  V.diet = e.target.checked ? [...new Set([...V.diet, d])] : V.diet.filter((x) => x !== d);
  keep();
  draw();
});
draw();
if (!seen) beliefs.showModal();
