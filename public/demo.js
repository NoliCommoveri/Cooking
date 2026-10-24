// The demo page (plan §6.16): no account, nothing saved to one. It hands the
// real lesson player a pretend profile and family, so what moms try is what
// kids get. It shows the two tracks: Cook Around the World (the sample
// lessons, the diet preview, a shopping list preview, the whole course, and
// the skills view) and Structured Progression (a Level week and its part
// pages, the four Levels, and a pretend learner's progress).
import { openLesson } from './player.js';
import { dietView } from './lib/diet.js';
import { shoppingList } from './lib/shop.js';
import { numberCourse } from './lib/course.js';
import { levelProgressView } from './rewards.js';

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
// Structured Progression's sample: Level 3's first unit, whose four weeks are
// written, recipe and part pages alike.
const LEVEL = LV.levels.find((x) => x.id === 'level-3');
const DEMO_WEEKS_LV = LEVEL.weeks.filter((w) => w.unit === 1);
const written = new Set([...R.lessons, ...(R.levelLessons ?? [])].map((l) => l.id));
// A week's recipe, then its options: the ones written can be cooked here.
const weekRecipes = (w) => [w.recipe, ...(w.options ?? [])].filter((id) => id && written.has(id));
const DEMO_IDS = new Set([...DEMO_TRY.flatMap(([, , ids]) => ids), ...DEMO_WEEKS_LV.flatMap(weekRecipes)]);
const lessons = Object.fromEntries(await Promise.all([...DEMO_IDS].filter((id) => written.has(id)).map(async (id) => [id, await getJSON(`/content/lessons/${id}.json`)])));
// Lesson numbers in the suggested course order (a family's own plan can change them).
const { labels: NUM, total: TOTAL } = numberCourse(C.dishes);

// The two tracks (owner, 2026-10-24): Cook Around the World, recipes only,
// and Structured Progression, the Levels as full courses.
const TRACKS = {
  catw: { name: 'Cook Around the World', tabs: [['try', 'Try it'], ['shop', 'Shopping'], ['course', 'Course'], ['skills', 'Skills']] },
  sp: { name: 'Structured Progression', tabs: [['week', 'Try a week'], ['levels', 'The Levels'], ['progress', 'Progress']] },
};
// What a visitor has chosen. Kept for this tab only.
let V = { track: 'catw', theme: 'quest', audience: 'kid', diet: [], tab: 'try', checked: [], shop: { step: 'needs', count: 0, have: [] }, lvWeek: 1, lvDone: [] };
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
    <p>Check out the demo below to see our current build progress. Beta testing via invitation will begin shortly.</p>
    <p class="by">By Immotus Apps</p></section>
    <div class="d-cta"><a class="hbtn pri" href="/#/signup">Sign up</a><a class="hbtn" href="/#/login">Log in</a></div>
    <h2 class="d-tracks-h">Two ways to learn</h2>
    <div class="d-tracks">
      <article class="d-track ${V.track === 'catw' ? 'on' : ''}"><h3>Cook Around the World</h3>
        <p class="who">For older teens and adults who want to practise their techniques and experiment with a wide range of dishes.</p>
        <ul><li><b>Recipes only:</b> ${C.dishes.length} dishes from kitchens around the world, each one teaching a skill</li>
          <li>Cook them in order, or pick what sounds good</li>
          <li>Homeschool families can grade cooks and print a transcript</li></ul>
        <button type="button" class="hbtn ${V.track === 'catw' ? 'pri' : ''}" data-track="catw" aria-pressed="${V.track === 'catw'}">Explore Cook Around the World</button>
        <a class="hbtn link" href="/syllabus/">Review its homeschool syllabus</a></article>
      <article class="d-track ${V.track === 'sp' ? 'on' : ''}"><h3>Structured Progression</h3>
        <p class="who">For families teaching cooking from the fundamentals onward, even for young cooks.</p>
        <ul><li><b>Complete, credit-able courses</b> built on best practices, in four Levels of 36 weeks</li>
          <li>Every week: <b>Knowledge, Drill, Recipe, and Beyond the Recipe</b>, for a full culinary and food-science education</li>
          <li>Mastery checks, hours toward credit, and a transcript</li></ul>
        <button type="button" class="hbtn ${V.track === 'sp' ? 'pri' : ''}" data-track="sp" aria-pressed="${V.track === 'sp'}">Explore Structured Progression</button></article>
    </div>`;
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
      ? `<article class="q-panel q-card"><p class="q-kick">Path ${L.unit} · Quest ${NUM[L.id]}</p><div class="q-win"><img src="/${esc(l.image)}" alt="" width="230" height="230" loading="lazy"></div><h3 class="q-title">${esc(L.title)}</h3><p class="q-skill">${esc(L.skill)}</p>
          <dl class="q-stats"><div><dt>Time</dt><dd>${L.totalMinutes} min</dd></div><div><dt>Serves</dt><dd>${L.servings}</dd></div><div><dt>From</dt><dd>${esc(cu)}</dd></div></dl>${notes.map((n) => `<p class="q-swap">${esc(n)}</p>`).join('')}</article>`
      : `<article class="p-card"><span class="tape t1"></span><span class="tape t2"></span><div class="p-photo"><img src="/${esc(l.image)}" alt="" width="220" height="220" loading="lazy"></div><p class="p-lessonno">Lesson ${NUM[L.id]}</p><h3 class="p-title">${esc(L.title)}</h3><p class="p-skill">${esc(L.skill)}</p>
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
      <div class="acts"><button type="button" class="hbtn" data-shop="needs">Make another</button></div>
      <p class="small mut" style="margin-top:12px">A preview: nothing here is saved. A family's list is kept, check-offs and all, so it survives closing the app.</p></section>`;
  }

  return `<section class="parent"><h3>Shopping</h3><p class="sub">Shopping lists are optional. Kids can start any lesson whenever you're ready.</p>
    <div class="psec"><h4>Make a shopping list</h4>
      <label class="f">How many lessons are you shopping for? <small class="mut">Counting from the next lesson not cooked yet</small>
        <select data-count><option value="0">Pick a number</option>${upcoming.map((_, i) => `<option value="${i + 1}" ${sh.count === i + 1 ? 'selected' : ''}>${i + 1} lesson${i ? 's' : ''}</option>`).join('')}</select></label>
      ${picked.length ? `<p class="small mut">For ${names(picked)}</p><div class="acts"><button type="button" class="hbtn pri" data-shop="preview">Next</button></div>` : ''}</div>
    <h3 style="margin-top:22px">What you'll need</h3>
    ${weeks.map(([name, ids], k) => `<details class="dweek" ${k < 2 ? 'open' : ''}><summary><b>${esc(name)}</b> · ${names(ids)}</summary>${groups(listOf(ids), used)}</details>`).join('')}
    <p class="small mut" style="margin-top:12px">A preview with the four sample lessons as a pretend family's next few weeks. Salt, black pepper, and olive oil play its kitchen staples, grouped under "May already have" and still on the list.</p></section>`;
}

// ---------- the whole course ----------
const dishById = Object.fromEntries(C.dishes.map((d) => [d.id, d]));
const groupOf = (d) => (d.pickOne ? C.dishes.filter((x) => x.pickOne === d.pickOne) : [d]);
function courseView() {
  const units = [...new Set(C.dishes.map((d) => d.unit))];
  const row = (d) => {
    const cu = R.cuisines[d.cuisine]?.name ?? d.cuisine;
    const pick = d.pickOne ? `<small class="pick">Pick one: ${groupOf(d).map((x) => esc(x.title)).join(' · ')}</small>` : '';
    const body = `<img src="/${esc(d.image)}" alt="" width="64" height="64" loading="lazy"><span><b>${NUM[d.id]}. ${esc(d.title)}</b><small>${esc(cu)}${d.breakfast ? ' · breakfast' : ''}</small><small>${esc(d.skill)}</small>${pick}${lessons[d.id] ? `<span class="tag">${ic('i-check', '')}Try it now</span>` : ''}</span>`;
    return lessons[d.id] ? `<button type="button" class="c-dish" data-open="${esc(d.id)}">${body}</button>` : `<div class="c-dish">${body}</div>`;
  };
  return `<p class="mut">${C.dishes.length} dishes in ${units.length} units, ${TOTAL} lessons on one cook's path: dishes that share a number, like 1a, 1b, and 1c, are pick-one choices. Each unit teaches a set of skills; the ones marked "Try it now" can be tried here.</p>
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
  return `<p class="mut">${order.length} skills across ${C.dishes.length} dishes, in the order the course first teaches them. ✓ marks a lesson you can try now.</p>
    <div class="sk-list">${order.map((e) => {
      const s = R.skills[e.id];
      return `<article class="sk"><h4>${pinSVG(s)}${esc(s.name)}</h4>${e.teach.length > 1 ? '<span class="found">Foundation skill · pick one</span>' : ''}<p>${esc(s.idea)}</p>
        <p class="mut"><b>Taught in:</b> ${names(e.teach)}</p>${e.practice.length ? `<p class="mut"><b>Practiced in:</b> ${names(e.practice)}</p>` : ''}</article>`;
    }).join('')}</div>`;
}

// ---------- Structured Progression: a Level week, the Levels, and progress ----------
const PART_NAMES = { knowledge: 'Knowledge', drill: 'Drill', sabbath: 'Beyond the Recipe' };
const unitOf = (n) => LEVEL.units.find((u) => u.number === n);
// The week's recipe for this diet: its own, or the first option that fits,
// as best fit would pick (§12.2).
const weekRecipe = (w) => weekRecipes(w).find((id) => dietView(lessons[id], R.ingredients, V.diet).visible) ?? null;
const titleOf = (id) => lessons[id]?.title ?? id;

// This week's card, drawn as the kitchen draws it (12c), in the owner's
// order: Knowledge, Drill, Recipe, Beyond the Recipe. Done is kept for this
// tab only.
function weekView() {
  const quest = V.theme === 'quest';
  const w = DEMO_WEEKS_LV.find((x) => x.week === V.lvWeek) ?? DEMO_WEEKS_LV[0];
  const u = unitOf(w.unit), id = weekRecipe(w);
  const done = (part) => V.lvDone.includes(`${w.week}-${part}`);
  const row = (label, title, note, attrs, on) => `<button type="button" class="k-part${on ? ' done' : ''}" ${attrs}><span class="k-part-l">${esc(label)}</span><b>${esc(title)}</b><small>${esc(note)}</small></button>`;
  const part = (k) => row(PART_NAMES[k], w[k].title, done(k) ? 'Done ✓' : `${w[k].minutes} min`, `data-part="${k}"`, done(k));
  const swapped = id && id !== w.recipe;
  const recipe = id ? row('Recipe', titleOf(id), `${lessons[id].totalMinutes} min`, `data-open="${esc(id)}"`, false)
    : `<div class="k-part"><span class="k-part-l">Recipe</span><b>None of this week's recipes fit this diet</b><small>Swap recipe</small></div>`;
  return `<p class="mut d-lede">A sample from <b>${esc(LEVEL.name)}</b>, Unit ${u.number}: ${esc(u.name)}. Each week of a Level has four parts, and a week is done when its recipe is cooked. Pick a week, then open any part.</p>
    <div class="seg d-weeks" role="group" aria-label="Week">${DEMO_WEEKS_LV.map((x) => `<button type="button" data-lvweek="${x.week}" aria-pressed="${x.week === w.week}">Week ${x.week}${x.mastery ? ' · Mastery' : ''}</button>`).join('')}</div>
    <section class="kitchen qx" data-kt="${V.theme}"><article class="${quest ? 'q-panel' : 'p-card'} k-level">
      <p class="${quest ? 'q-kick' : 'p-lessonno'}">${esc(LEVEL.name)} · Week ${w.week} of ${LEVEL.weeks.length}</p>
      <h2 class="${quest ? 'q-title' : 'p-title'}">Unit ${u.number}: ${esc(u.name)}</h2>
      ${w.mastery ? `<p class="${quest ? 'q-swap' : 'p-swap'}">Mastery week: cook it on your own</p>` : ''}
      ${id ? '' : `<p class="${quest ? 'q-swap' : 'p-swap'}">A parent would use Swap recipe to pick another dish that teaches this week's skill.</p>`}
      ${swapped ? `<p class="${quest ? 'q-swap' : 'p-swap'}">${esc(titleOf(w.recipe))} doesn't fit this diet, so this week cooks one of its options.</p>` : ''}
      <div class="k-parts">${part('knowledge')}${part('drill')}${recipe}${part('sabbath')}</div>
    </article>
    <p class="d-goal"><b>Unit goal:</b> ${esc(u.goal)}</p></section>`;
}

// A part's page (12c), with Done and Skip this, saving nothing.
function partView(k) {
  const quest = V.theme === 'quest';
  const w = DEMO_WEEKS_LV.find((x) => x.week === V.lvWeek) ?? DEMO_WEEKS_LV[0];
  const x = w[k], on = V.lvDone.includes(`${w.week}-${k}`);
  const quiz = (x.quiz ?? []).map((q, n) => `<div class="k-pagebody"><b>${esc(q.q)}</b><div class="k-parts">${q.choices.map((c, i) => `<button type="button" class="k-part" data-quiz="${n}-${i}"><b>${esc(c)}</b></button>`).join('')}</div><p data-why="${n}" hidden></p></div>`).join('');
  return `<section class="kitchen" data-kt="${V.theme}"><button type="button" class="back" data-part="">${quest ? '← Quest board' : '← Recipe box'}</button>
    <article class="${quest ? 'q-panel' : 'p-card'} k-level">
      <p class="${quest ? 'q-kick' : 'p-lessonno'}">${esc(LEVEL.name)} · Week ${w.week} · ${PART_NAMES[k]}</p>
      <h2 class="${quest ? 'q-title' : 'p-title'}">${esc(x.title)}</h2>
      <p>About ${x.minutes} minutes</p>
      <div class="k-pagebody">${(x.body ?? []).map((t) => `<p>${esc(t)}</p>`).join('')}${x.steps?.length ? `<ol>${x.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}${quiz}</div>
      ${on ? `<p class="${quest ? 'q-swap' : 'p-swap'}">Done ✓</p>` : `<div class="acts"><button type="button" class="${quest ? 'q-btn' : 'p-btn'}" data-done="${k}">Done</button></div>`}
    </article></section>`;
}

// The four Levels (§12.1). Level 3 is built; the others are the owner's
// outlines, still being written.
const LEVEL_OUTLINES = [
  { name: 'Level 1 Helper', week: 'About 1 hour a week', credit: 'Hours tracked for your records', units: ['Clean hands, clean kitchen', 'Clean and unclean animals', 'Measuring', 'Mixing and no-bake recipes', 'Fruits: washing and soft cuts', 'Vegetables and salads', 'Tasting the basic flavors', 'Bread and baking with an adult', 'Capstone: set the table and help make a Sabbath meal'].map((name) => ({ name })) },
  { name: 'Level 2 Apprentice', week: 'About 2 hours a week', hours: 72, credit: 'A middle-grades elective', units: [
    ['Knife and heat safety', 'Cuts soft foods safely, handles hot pans and the oven with mitts, and knows what to do in a small kitchen fire'],
    ['Reading recipes and mise en place', 'Reads a recipe through, gathers and measures everything first, and cleans as they go'],
    ['Eggs', 'Cracks and separates eggs cleanly and cooks them scrambled, boiled, and fried to the right doneness'],
    ['Quick breads', 'Uses the muffin and biscuit methods, measures flour correctly, and tests doneness with a toothpick'],
    ['Boiling and simmering', 'Tells a boil from a simmer, cooks pasta and rice to doneness, and drains safely'],
    ['Labels and hidden unclean ingredients', 'Reads an ingredient list and spots ingredients from unclean sources'],
    ['Salt, herbs, and spices', 'Salts food by tasting, tells herbs from spices, and uses each at the right time'],
    ['Simple pan cooking', 'Preheats a pan, cooks without crowding, and flips and checks food for doneness'],
    ['Storage, leftovers, and Sabbath capstone', 'Stores food safely, reuses leftovers, and prepares one Sabbath dish from a written prep list'],
  ].map(([name, goal]) => ({ name, goal })) },
  { built: true },
  { name: 'Level 4 Chef', week: 'About 3¾ hours a week', hours: 135, credit: 'One high-school elective credit in most states', note: 'Learners work independently, with adult-style safety notes.', units: [
    ['Precision, speed, and scaling', 'Cuts fine and fast, weighs ingredients, and scales any recipe up or down accurately'],
    ['Braising, stewing, beef and lamb cuts', 'Matches tough cuts to low, slow, moist heat, sears for flavor, and cooks to fork-tender'],
    ['Pastry and enriched breads', 'Makes flaky pastry with cold fat, laminates a dough, and shapes an enriched yeast bread'],
    ['Foundational sauces', 'Thickens with a roux, builds an emulsion and rescues it if it breaks, and makes a pan sauce from fond'],
    ['Frying and grilling', 'Fries at a controlled oil temperature, sets up a breading station, and grills with direct and indirect heat'],
    ['Flavor profiles by cuisine', 'Names the core flavors of a cuisine, builds them from scratch, and adapts a dish to clean ingredients'],
    ['Menus, nutrition, and budgeting', 'Plans balanced meals, prices them per serving, and stretches ingredients across several meals'],
    ['Allergens, sourcing, and cooking for groups', 'Cooks safely for guests with allergies, judges where meat and fish come from, and serves 12 or more'],
    ['Sabbath capstone for household and guests', 'Plans, budgets, shops for, and cooks a full Sabbath meal for the household and guests, entirely on their own'],
  ].map(([name, goal]) => ({ name, goal })) },
];
function levelsView() {
  const card = (o) => {
    const L = o.built ? { name: LEVEL.name, week: 'About 3½ hours a week', hours: LEVEL.hours, credit: 'One high-school elective credit in most states', units: LEVEL.units } : o;
    const weeksOf = (n) => LEVEL.weeks.filter((w) => w.unit === n);
    const unit = (u, i) => `<li><b>Unit ${i + 1}: ${esc(u.name)}</b>${u.goal ? `<small>${esc(u.goal)}</small>` : ''}${o.built ? `<details><summary>Weeks ${weeksOf(u.number)[0].week}–${weeksOf(u.number).at(-1).week}</summary><ol class="d-wks">${weeksOf(u.number).map((w) => `<li value="${w.week}">${esc(w.title ?? (w.kind === 'capstone' ? 'Capstone' : 'Practice run'))}${w.mastery ? ' <em>Mastery</em>' : ''}</li>`).join('')}</ol></details>` : ''}</li>`;
    return `<article class="d-level ${o.built ? 'built' : ''}"><div class="d-level-h"><h3>${esc(L.name)}</h3><span class="d-badge">${o.built ? 'Ready now' : 'Being written'}</span></div>
      <p class="d-facts"><span>36 weeks</span><span>${esc(L.week)}</span>${L.hours ? `<span>About ${L.hours} hours</span>` : ''}<span>${esc(L.credit)}</span></p>
      ${L.note ? `<p class="mut">${esc(L.note)}</p>` : ''}
      <details ${o.built ? 'open' : ''}><summary>The ${L.units.length} units</summary><ol class="d-units">${L.units.map(unit).join('')}</ol></details></article>`;
  };
  return `<p class="mut d-lede">Four Levels, each a full school year of 36 weeks in units of four: three weeks to learn and practise, then a mastery week cooked on their own. Every Level ends with a Sabbath capstone. Levels go by what a cook can already do, so a family starts wherever fits.</p>
    <div class="d-levels">${LEVEL_OUTLINES.map(card).join('')}</div>`;
}

// A pretend learner partway through Level 3, drawn by the real progress view
// (12e): weeks 1–5 done, Unit 1 mastered, week 6 begun.
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

// ---------- drawing ----------
const VIEWS = { try: tryView, shop: shopView, course: courseView, skills: skillsView, week: weekView, levels: levelsView, progress: progressView };
let part = '';
async function draw() {
  root.innerHTML = `${header()}${tabs()}${part ? '' : controls()}<div id="pane">${part ? partView(part) : VIEWS[V.tab]()}</div>
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
  const set = t.closest('[data-set]'), tab = t.closest('[data-tab]'), openBtn = t.closest('[data-open]'), check = t.closest('[data-check]');
  if (set) { V[set.dataset.set] = set.dataset.v; keep(); return draw(); }
  const track = t.closest('[data-track]');
  if (track) {
    if (V.track !== track.dataset.track) { V.track = track.dataset.track; V.tab = TRACKS[V.track].tabs[0][0]; part = ''; keep(); draw(); }
    return document.getElementById('track').scrollIntoView({ behavior: 'smooth' });
  }
  if (tab) { e.preventDefault(); V.tab = tab.dataset.tab; part = ''; keep(); return draw(); }
  // Structured Progression: a week, a part page, Done, and a quiz answer.
  const lvweek = t.closest('[data-lvweek]'), partBtn = t.closest('[data-part]'), doneBtn = t.closest('[data-done]'), quiz = t.closest('[data-quiz]');
  if (lvweek) { V.lvWeek = Number(lvweek.dataset.lvweek); keep(); return draw(); }
  if (partBtn) { part = partBtn.dataset.part; draw(); return document.getElementById('pane').scrollIntoView(); }
  if (doneBtn) { V.lvDone = [...new Set([...V.lvDone, `${V.lvWeek}-${doneBtn.dataset.done}`])]; part = ''; keep(); return draw(); }
  if (quiz) {
    const [n, i] = quiz.dataset.quiz.split('-').map(Number);
    const w = DEMO_WEEKS_LV.find((x) => x.week === V.lvWeek), q = w[part].quiz[n];
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
