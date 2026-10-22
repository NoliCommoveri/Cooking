// The demo page (plan §6.16): no account, nothing saved to one. It hands the
// real lesson player a pretend profile and family, so what moms try is what
// kids get, and adds the diet preview, a shopping list preview, the whole
// course, and the skills view.
import { openLesson } from './player.js';
import { dietView } from './lib/diet.js';
import { shoppingList } from './lib/shop.js';
import { numberCourse } from './lib/course.js';

const root = document.getElementById('demo');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ic = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="/icons.svg#${id}"/></svg>`;
const getJSON = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`Couldn't load ${u}`); return r.json(); };

const [R, C] = await Promise.all([getJSON('/content/registry.json'), getJSON('/content/course.json')]);
const lessons = Object.fromEntries(await Promise.all(R.lessons.map(async (l) => [l.id, await getJSON(`/content/lessons/${l.id}.json`)])));

const DIET = { nuts: 'Tree nuts', peanuts: 'Peanuts', dairy: 'Dairy', egg: 'Eggs', gluten: 'Gluten', fish: 'Fish', meat: 'Meat and poultry' };
const SECTION_ICON = {
  produce: 's-produce', herbs: 's-produce', 'meat-fish': 's-meat', 'dairy-eggs': 's-dairy', 'bread-tortillas': 's-bakery',
  'grains-pasta': 's-pantry', 'canned-jarred': 's-canned', sauces: 's-canned', 'oils-vinegars': 's-pantry', baking: 's-bakery',
  spices: 's-pantry', specialty: 's-pantry', frozen: 's-frozen',
};
const DEMO_SHOP = ['shakshuka', 'beef-bulgogi'].filter((id) => lessons[id]);
// Lesson numbers in the suggested course order (a family's own plan can change them).
const { labels: NUM, total: TOTAL } = numberCourse(C.dishes);

// What a visitor has chosen. Kept for this tab only.
let V = { theme: 'quest', audience: 'kid', diet: [], tab: 'try', checked: [] };
try { V = { ...V, ...JSON.parse(sessionStorage.getItem('cpr.demo')) }; } catch { /* first visit */ }
const keep = () => { try { sessionStorage.setItem('cpr.demo', JSON.stringify(V)); } catch { /* private mode */ } };
const family = () => ({ diet_filters: V.diet, default_servings: 6 });
const profile = () => ({ id: `demo-${V.theme}-${V.audience}`, theme: V.theme, audience: V.audience, people: [{ name: 'Demo', color: 'tomato' }] });

// ---------- shared parts ----------
function header() {
  return `<section class="d-hero"><img src="/img/logo.webp" alt="" width="110" height="110">
    <h1>Clean Plate Recipes</h1>
    <p>A cooking course for kids: one real skill and one real dish in every lesson, with recipes that are biblically clean. Try a sample lesson below, in either theme, the way your kids would.</p>
    <p class="by">By Immotus Apps</p></section>
    <div class="d-cta"><a class="hbtn pri" href="/#/signup">Sign up</a><a class="hbtn" href="/#/login">Log in</a>
    <a class="hbtn link" href="/syllabus/">Using this as a homeschool course? Review our syllabus</a></div>`;
}
const seg = (name, value, options) => `<div class="seg" role="group">${options.map(([v, label]) => `<button type="button" data-set="${name}" data-v="${v}" aria-pressed="${value === v}">${esc(label)}</button>`).join('')}</div>`;
function controls() {
  const lesson = V.tab === 'try';
  return `<div class="d-controls card">
    ${lesson ? `<div class="d-row"><b>Theme</b>${seg('theme', V.theme, [['quest', 'Kitchen Quest'], ['passport', "Chef's Passport"]])}</div>
    <div class="d-row"><b>Cooking as</b>${seg('audience', V.audience, [['kid', 'A kid'], ['adult', 'An adult']])}</div>` : ''}
    <div class="d-row"><b>Leave out</b><div class="chips">${Object.entries(DIET).map(([t, label]) => `<label><input type="checkbox" data-diet="${t}" ${V.diet.includes(t) ? 'checked' : ''}>${esc(label)}</label>`).join('')}</div></div>
  </div>`;
}
function tabs() {
  const T = [['try', 'Try it'], ['shop', 'Shopping'], ['course', 'Course'], ['skills', 'Skills']];
  return `<nav class="tabs" aria-label="Demo">${T.map(([k, l]) => `<a href="#${k}" data-tab="${k}" aria-current="${V.tab === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>`;
}

// ---------- try a lesson: the sample lessons in the profile's theme ----------
function tryView() {
  const quest = V.theme === 'quest';
  const shown = [], hidden = [];
  for (const l of R.lessons) (dietView(lessons[l.id], R.ingredients, V.diet).visible ? shown : hidden).push(l);
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
  return `<section class="kitchen qx" data-kt="${V.theme}"><div class="k-head"><div class="grow"><h2 style="margin:0">${quest ? 'Quest board' : 'Recipe box'}</h2><div>The sample lessons. Tap one to cook it.</div></div></div>
    ${shown.length ? `<div class="k-lib">${shown.map(card).join('')}</div>` : '<p>Every sample lesson is hidden for this diet.</p>'}
    ${hidden.length ? `<p class="d-hidden">Hidden for this diet: ${hidden.map((l) => esc(l.title)).join(', ')}</p>` : ''}</section>`;
}

// ---------- shopping list preview (§6.3, the same list as a real trip) ----------
function shopView() {
  const shopLessons = DEMO_SHOP.map((id) => lessons[id]).filter((L) => dietView(L, R.ingredients, V.diet).visible);
  const list = shoppingList({ lessons: shopLessons.map((L) => ({ lesson: L, servings: 6, date: null })), registry: R.ingredients, filters: V.diet });
  const all = list.sections.flatMap((s) => s.items);
  const total = all.length, done = V.checked.filter((id) => all.some((x) => x.id === id)).length;
  return `<section class="parent"><h3>Shopping trip</h3><p class="sub">${shopLessons.map((L) => `${esc(L.title)} (serves 6)`).join(' and ') || 'Nothing to shop for with this diet'} · ${done} of ${total} in the cart</p>
    ${list.sections.map((s) => `<div class="psec"><h4>${ic(SECTION_ICON[s.id] ?? 's-pantry', '')}${esc(s.name)}</h4>${s.items.map((it) => `<button type="button" class="pitem" data-check="${esc(it.id)}" aria-pressed="${V.checked.includes(it.id)}"><span class="bx">${ic('i-check', '')}</span><span class="nm">${esc(it.name)}${it.from.length > 1 ? `<small>For both dishes</small>` : `<small>${esc(it.from[0])}</small>`}</span><span class="q">${esc(it.buy ?? it.used ?? '')}${it.buy && it.used && it.used !== it.buy ? `<small>The recipes use ${esc(it.used)}</small>` : ''}</span></button>`).join('')}</div>`).join('')}
    <p class="small mut" style="margin-top:12px">A preview. A family picks how many lessons to shop for, ticks what they already have, and the list remembers what's in the cart.</p></section>`;
}

// ---------- the whole course ----------
const dishById = Object.fromEntries(C.dishes.map((d) => [d.id, d]));
const groupOf = (d) => (d.pickOne ? C.dishes.filter((x) => x.pickOne === d.pickOne) : [d]);
function courseView() {
  const units = [...new Set(C.dishes.map((d) => d.unit))];
  const row = (d) => {
    const cu = R.cuisines[d.cuisine]?.name ?? d.cuisine;
    const pick = d.pickOne ? `<small class="pick">Pick one: ${groupOf(d).map((x) => esc(x.title)).join(' · ')}</small>` : '';
    const body = `<img src="/${esc(d.image)}" alt="" width="64" height="64" loading="lazy"><span><b>${NUM[d.id]}. ${esc(d.title)}</b><small>${esc(cu)}${d.breakfast ? ' · breakfast' : ''}</small><small>${esc(d.skill)}</small>${pick}${d.written ? `<span class="tag">${ic('i-check', '')}Try it now</span>` : ''}</span>`;
    return d.written ? `<button type="button" class="c-dish" data-open="${esc(d.id)}">${body}</button>` : `<div class="c-dish">${body}</div>`;
  };
  return `<p class="mut">${C.dishes.length} dishes in ${units.length} units, ${TOTAL} lessons on one cook's path: dishes that share a number, like 1a, 1b, and 1c, are pick-one choices. Each unit teaches a set of skills; the ones marked "Try it now" are written and ready.</p>
    ${units.map((u) => `<h3 class="c-unit">${u === 7 ? 'Desserts' : `Unit ${u}: ${esc(R.units[u])}`}</h3><div class="c-grid">${C.dishes.filter((d) => d.unit === u).map(row).join('')}</div>`).join('')}`;
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

// ---------- drawing ----------
const VIEWS = { try: tryView, shop: shopView, course: courseView, skills: skillsView };
function draw() {
  // The theme and diet switches change the lessons and the list, not the course views.
  root.innerHTML = `${header()}${tabs()}${V.tab === 'try' || V.tab === 'shop' ? controls() : ''}<div id="pane">${VIEWS[V.tab]()}</div>
    <p class="d-foot">Clean Plate Recipes is published by Immotus Apps. Nothing you do here is saved to an account.</p>`;
}

async function open(id) {
  const pane = document.getElementById('pane');
  pane.innerHTML = '';
  root.querySelector('.d-controls')?.setAttribute('hidden', '');
  await openLesson(pane, { profile: profile(), family: family(), lessonId: id, onExit: () => { V.tab = 'try'; keep(); draw(); window.scrollTo(0, root.querySelector('.tabs').offsetTop - 8); } });
  pane.scrollIntoView();
}

root.addEventListener('click', (e) => {
  const t = e.target;
  const set = t.closest('[data-set]'), tab = t.closest('[data-tab]'), openBtn = t.closest('[data-open]'), check = t.closest('[data-check]');
  if (set) { V[set.dataset.set] = set.dataset.v; keep(); return draw(); }
  if (tab) { e.preventDefault(); V.tab = tab.dataset.tab; keep(); return draw(); }
  if (openBtn) return open(openBtn.dataset.open);
  if (check) {
    const id = check.dataset.check;
    V.checked = V.checked.includes(id) ? V.checked.filter((x) => x !== id) : [...V.checked, id];
    keep();
    return draw();
  }
});
root.addEventListener('change', (e) => {
  const d = e.target.dataset.diet;
  if (!d) return;
  V.diet = e.target.checked ? [...new Set([...V.diet, d])] : V.diet.filter((x) => x !== d);
  keep();
  draw();
});
draw();
