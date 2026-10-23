// Clean Plate Recipes, the app. Plain ES module, no build step. Screens are
// built with el(), which only ever sets text, so nothing a family types is
// parsed as markup. Routes live in the hash: #/login, #/kitchen/<id>, #/parent…
import { openLesson } from './player.js';
import { saveCook, saveReflection, flushCooks } from './cooks.js';
import { patchTargets, showValue } from './lib/patch.js';
import { courseEntries, prereqNotes } from './lib/course.js';
import { toBase, mixed } from './lib/units.js';
import { MEAL_TYPES, METHODS, METHOD_NAMES } from './lib/recipe.js';
import { progressView, celebrate } from './rewards.js';
import { isMuted, setMuted } from './sound.js';

const app = document.getElementById('app');

// ---------- helpers ----------

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) n.append(kid instanceof Node ? kid : String(kid));
  return n;
}

// Fixed art only: callers pass keys from the lists below, never typed text.
function art(svg) {
  const t = document.createElement('template');
  t.innerHTML = svg.trim();
  return t.content.firstElementChild;
}

// Every write sends JSON, even an empty one: the API refuses anything else.
async function api(method, path, body) {
  const write = method !== 'GET';
  const res = await fetch(path, {
    method,
    headers: write ? { 'content-type': 'application/json' } : {},
    body: write ? JSON.stringify(body ?? {}) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong. Try again.');
    err.code = data.error;
    err.problems = data.problems;
    throw err;
  }
  return data;
}

const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

// This tab only: which kitchen tab a profile was on, and its search.
function sessionGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } }
function sessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch { /* fine without it */ } }

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { return null; }
  return value;
}

// A form whose submit calls fn(values), shows its error, and disables the button while it runs.
// top: the buttons go first and stay in view, for a long form.
function form(fields, submitText, fn, { extra = [], top = false } = {}) {
  const msg = el('p', { class: 'err', role: 'alert', hidden: true });
  const btn = el('button', { class: 'hbtn pri', type: 'submit' }, submitText);
  const acts = el('div', { class: top ? 'acts formtop' : 'acts' }, btn, ...extra);
  const f = el('form', { class: 'card', novalidate: true }, ...(top ? [acts, msg, ...fields] : [...fields, msg, acts]));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.hidden = true;
    btn.disabled = true;
    try {
      await fn(Object.fromEntries(new FormData(f)), f);
    } catch (err) {
      msg.textContent = err.message;
      msg.hidden = false;
    } finally {
      btn.disabled = false;
    }
  });
  return f;
}

const field = (label, name, attrs = {}, hint) =>
  el('label', { class: 'f' }, label, hint ? el('span', { class: 'hint' }, hint) : null, el('input', { name, ...attrs }));

// ---------- art ----------

const COLORS = { tomato: '#E2553F', butter: '#F6C945', basil: '#6BA34F', sky: '#6FB7E8', plum: '#A77BCF', peach: '#F4A576', mint: '#7FD6B8', slate: '#8A94A6' };
const HAT = '<path d="M17 22c-4-.7-6-4-5-7.3s5.3-4.3 7.3-3C20 8 22.3 6 24.3 6s4.3 2 5 5.7c2-1.3 6.3-.3 7.3 3S35.7 21.3 31.7 22v6.6H17z" fill="#fff" stroke="#1F2328" stroke-width="2.3" stroke-linejoin="round"/>';
const avatar = (color) => art(`<svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="32" r="21" fill="${COLORS[color] ?? COLORS.slate}" stroke="#1F2328" stroke-width="2.5"/><circle cx="21" cy="33" r="2.6" fill="#1F2328"/><circle cx="35" cy="33" r="2.6" fill="#1F2328"/><path d="M21 41c4 3 10 3 14 0" fill="none" stroke="#1F2328" stroke-width="2.5" stroke-linecap="round"/><g transform="translate(4 -6)">${HAT}</g></svg>`);
const avatars = (people) => el('span', { class: 'av' }, people.slice(0, 3).map((p) => avatar(p.color)));

const THEMES = { quest: "Kitchen Quest", passport: "Chef's Passport" };

// The family's calendar: the queue and schedule work in the device's own days.
const tz = () => `tz=${new Date().getTimezoneOffset()}`;
const addDays = (d, n) => { const t = new Date(`${d}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
// Weeks run Sunday to Friday; Saturday is the Sabbath (owner, 2026-10-22).
const weekOf = (d) => addDays(d, -new Date(`${d}T12:00:00Z`).getUTCDay());
const localToday = () => { const t = new Date(); return new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
// Saturday is the Sabbath (owner, 2026-10-22): a banner, and no due dates or grading.
const isSabbath = () => new Date().getDay() === 6;
function sabbathBanner() {
  if (!isSabbath()) return null;
  return el('aside', { class: 'card notice sabbath', role: 'note' },
    el('h2', {}, 'Shabbat shalom!'),
    el('p', {}, "While you're welcome to follow the recipe, please note that grading and due dates are not available on the Sabbath. We hope your family enjoys the rest!"));
}
const fmtDay = (d, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, opts);
const DIET = {
  nuts: 'Tree nuts', peanuts: 'Peanuts', dairy: 'Dairy', egg: 'Eggs', gluten: 'Gluten', fish: 'Fish', meat: 'Meat and poultry',
};

// ---------- state ----------

let me = null;

function topbar(sub, ...right) {
  return el('header', { class: 'bar' },
    el('img', { src: 'img/logo.webp', alt: '', width: 56, height: 56 }),
    el('div', { class: 'grow' }, el('b', {}, 'Clean Plate Recipes'), sub ? el('small', {}, sub) : null),
    right.length ? el('div', { class: 'bar-acts' }, ...right) : null);
}

function screen(...kids) {
  app.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
  window.scrollTo(0, 0);
  const h = app.querySelector('h1');
  if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}

// ---------- signed out ----------

function welcome() {
  screen(el('section', { class: 'hero' },
    el('img', { src: 'img/logo.webp', alt: '', width: 220, height: 220 }),
    el('h1', {}, 'Clean Plate Recipes'),
    el('div', { class: 'stack' },
      el('a', { class: 'hbtn pri', href: '#/login' }, 'Log in'),
      el('a', { class: 'hbtn', href: '#/signup' }, 'Sign up'))));
}

function login() {
  screen(topbar(), el('div', { class: 'narrow' }, el('h1', {}, 'Log in'),
    form([
      field('Email', 'email', { type: 'email', autocomplete: 'email', required: true }),
      field('Password', 'password', { type: 'password', autocomplete: 'current-password', required: true }),
    ], 'Log in', async (v) => {
      await api('POST', '/api/login', v);
      await start('#/');
    }, { extra: [el('a', { class: 'hbtn link', href: '#/forgot' }, 'Forgot password?')] }),
    el('p', { class: 'mut' }, 'New here? ', el('a', { href: '#/signup' }, 'Sign up'))));
}

// Sign-up, step 1: email and password (and the beta word while it's on). A
// code is emailed; step 2 takes it. The pending email is kept for this tab, so
// a refresh or a trip to the inbox doesn't lose the step.
const PENDING = 'cpr.signup';
const pending = () => { try { return JSON.parse(sessionStorage.getItem(PENDING)); } catch { return null; } };
const setPending = (v) => { try { if (v) sessionStorage.setItem(PENDING, JSON.stringify(v)); else sessionStorage.removeItem(PENDING); } catch { /* private mode */ } };

async function signup() {
  const { beta_word } = await api('GET', '/api/signup');
  screen(topbar(), el('div', { class: 'narrow' }, el('h1', {}, 'Sign up'),
    form([
      beta_word ? field('Beta word', 'beta_word', { autocomplete: 'off', required: true }) : null,
      field('Email', 'email', { type: 'email', autocomplete: 'email', required: true }),
      field('Password', 'password', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }, 'At least 8 characters'),
    ].filter(Boolean), 'Sign up', async (v) => {
      const res = await api('POST', '/api/signup/start', v);
      setPending({ email: res.email, resend_at: res.resend_at });
      go('#/signup/code');
    }),
    el('p', { class: 'mut' }, 'Have an account? ', el('a', { href: '#/login' }, 'Log in'))));
}

// Sign-up, step 2: the emailed code, and the countdown to asking for a new one.
function signupCode() {
  const p = pending();
  if (!p) return go('#/signup');
  const resendBox = el('p', { class: 'mut' });
  let timer;
  const tick = () => {
    if (!document.body.contains(resendBox)) return clearInterval(timer);
    const left = Math.max(0, Date.parse(p.resend_at) - Date.now());
    if (left > 0) {
      const m = Math.floor(left / 60000), sec = String(Math.floor(left / 1000) % 60).padStart(2, '0');
      resendBox.replaceChildren(`Don't see it? Check your spam folder, or request a new one in ${m}:${sec}.`);
    } else {
      clearInterval(timer);
      resendBox.replaceChildren("Don't see it? Check your spam folder, or ", el('button', { type: 'button', class: 'hbtn link', onclick: async () => {
        const res = await api('POST', '/api/signup/resend', { email: p.email });
        setPending({ email: res.email, resend_at: res.resend_at });
        signupCode();
      } }, 'request a new one'), '.');
    }
  };
  screen(topbar(), el('div', { class: 'narrow' }, el('h1', {}, 'Check your email'),
    el('p', {}, 'We sent a code to ', el('b', {}, p.email), '.'),
    form([field('Code', 'code', { inputmode: 'numeric', autocomplete: 'one-time-code', pattern: '[0-9]*', maxlength: 6, required: true }, '6 digits')],
      'Finish signing up', async (v) => {
        await api('POST', '/api/signup/verify', { email: p.email, code: v.code });
        setPending(null);
        await start('#/');
      }, { extra: [el('button', { type: 'button', class: 'hbtn link', onclick: () => { setPending(null); go('#/signup'); } }, 'Use a different email')] }),
    resendBox));
  tick();
  timer = setInterval(tick, 1000);
}

function forgot() {
  const box = el('div', { class: 'narrow' }, el('h1', {}, 'Reset your password'));
  box.append(form([field('Email', 'email', { type: 'email', autocomplete: 'email', required: true })], 'Email me a link', async (v, f) => {
    await api('POST', '/api/password/forgot', v);
    f.replaceWith(el('div', { class: 'card' }, el('p', { class: 'ok' }, 'If that email has an account, a reset link is on its way. It works for an hour.'),
      el('a', { class: 'hbtn', href: '#/login' }, 'Back to log in')));
  }));
  screen(topbar(), box);
}

function reset(token) {
  screen(topbar(), el('div', { class: 'narrow' }, el('h1', {}, 'Choose a new password'),
    form([field('New password', 'password', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }, 'At least 8 characters')],
      'Save and log in', async (v) => {
        await api('POST', '/api/password/reset', { token, password: v.password });
        await start('#/');
      })));
}

// ---------- first run: the parent PIN ----------

function firstRun() {
  screen(topbar(), el('div', { class: 'narrow' }, el('h1', {}, 'Your family'),
    el('p', { class: 'mut' }, 'Kitchen devices stay logged in, so parent screens ask for a parent PIN.'),
    form([
      field('Family name', 'family_name', { autocomplete: 'organization', required: true, maxlength: 60 }, "Shown on your chef's lockers"),
      field('Parent PIN', 'pin', { inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, required: true }, '4 to 8 digits'),
      field('PIN again', 'again', { inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, required: true }),
    ], 'Continue', async (v) => {
      if (v.pin !== v.again) throw new Error("The two PINs don't match.");
      await api('POST', '/api/pin/set', { family_name: v.family_name, pin: v.pin });
      await start('#/parent/profiles/new');
    })));
}

// Asks for the PIN, then runs next(). Forgot PIN resets it with the account password.
function pinGate(next, title = 'Parent PIN') {
  const input = el('input', { name: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, 'aria-label': 'PIN' });
  const box = el('div', { class: 'narrow' }, el('h1', {}, title),
    form([el('div', { class: 'pin' }, input)], 'Unlock', async (v) => {
      await api('POST', '/api/pin/unlock', { pin: v.pin });
      await refresh();
      next();
    }, { extra: [el('button', { type: 'button', class: 'hbtn link', onclick: () => forgotPin(next) }, 'Forgot PIN?'),
      el('a', { class: 'hbtn link', href: '#/' }, 'Cancel')] }));
  screen(topbar(me.family.name), box);
  input.focus();
}

function forgotPin(next) {
  screen(topbar(me.family.name), el('div', { class: 'narrow' }, el('h1', {}, 'Reset the parent PIN'),
    form([
      field('Your account password', 'password', { type: 'password', autocomplete: 'current-password', required: true }),
      field('New PIN', 'pin', { inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, required: true }, '4 to 8 digits'),
    ], 'Save PIN', async (v) => {
      await api('POST', '/api/pin/reset', v);
      await refresh();
      next();
    }, { extra: [el('a', { class: 'hbtn link', href: '#/' }, 'Cancel')] })));
}

const unlocked = () => Boolean(me?.pin_unlocked_until && Date.parse(me.pin_unlocked_until) > Date.now());
const parentOnly = (fn) => (...args) => (unlocked() ? fn(...args) : pinGate(() => fn(...args)));

// ---------- the chef's lockers ----------

async function lockers() {
  const { profiles } = await api('GET', '/api/profiles');
  const grid = el('div', { class: 'lockers' },
    profiles.map((p) => el('a', { class: 'locker', href: `#/kitchen/${p.id}` },
      avatars(p.people), el('b', {}, p.name),
      el('small', {}, p.audience === 'adult' ? 'Adult' : p.people.length > 1 ? 'Shared' : 'Kid'),
      el('small', {}, THEMES[p.theme]))),
    el('a', { class: 'locker add', href: '#/parent/profiles/new' }, '+ Add a profile'));
  screen(topbar(me.family.name, el('a', { class: 'hbtn', href: '#/parent' }, 'Parents')),
    sabbathBanner(),
    me.parent.test_cook_notice ? testCookNotice() : null,
    el('h1', {}, "Who's cooking?"), grid);
}

// Shown once to each parent until the first-run wizard carries it (§6.9).
function testCookNotice() {
  const box = el('aside', { class: 'card notice', role: 'note' },
    el('h2', {}, 'Before your kids cook'),
    el('p', {}, "Not every recipe here has been test-cooked yet. Read a lesson all the way through before your kids cook it, and check the safety banners on its steps."),
    el('p', {}, 'Once you\'ve cooked one yourself, you can mark it test-cooked on the Queue screen.'),
    el('p', { class: 'mut small' }, 'Supervision is your call. The banners are a guide.'),
    el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn pri', onclick: async () => {
      await api('POST', '/api/notice/test-cook');
      me.parent.test_cook_notice = false;
      box.remove();
    } }, 'Got it')));
  return box;
}

// ---------- a profile's kitchen: the library in its theme ----------

async function kitchen(id, tab = sessionGet(`cpr.tab.${id}`) ?? 'path') {
  const [{ profiles }, lib] = await Promise.all([api('GET', '/api/profiles'), api('GET', '/api/library')]);
  const p = profiles.find((x) => x.id === id);
  if (!p) return go('#/');
  // A cook just finished goes up first, so its rewards count (a few seconds at most).
  await Promise.race([flushCooks(), new Promise((ok) => setTimeout(ok, 4000))]);
  const [{ cooks }, mine, { recipes }, { recipes: feastShared }] = await Promise.all([api('GET', `/api/profiles/${p.id}/cooks?${tz()}`), api('GET', `/api/profiles/${p.id}/queue?${tz()}`), api('GET', '/api/recipes'), api('GET', '/api/shared?feast=1')]);
  store('cpr.profile', p.id);
  // A profile on a course takes its lesson numbers from the course plan (§4.1).
  const labels = mine.labels ?? lib.labels;
  for (const L of lib.lessons) L.label = labels[L.id] ?? L.label;
  const quest = p.theme === 'quest';
  const other = quest ? 'passport' : 'quest';

  const card = (L) => {
    const swaps = L.substitutions.map((s) => `${s.use} instead of ${s.for}`).join('; ');
    const skip = L.left_out.length ? `Leave out the ${L.left_out.join(', ').toLowerCase()}` : '';
    const time = `${L.totalMinutes} min`;
    const done = cooks[L.id];
    const cooked = done ? el('p', { class: quest ? 'q-swap k-cooked' : 'p-swap k-cooked' },
      art('<svg class="ico" aria-hidden="true"><use href="/icons.svg#i-check"/></svg>'),
      done.times === 1 ? 'Cooked once' : `Cooked ${done.times} times`) : null;
    // The Unleavened badge (§6.19): an icon and a word, never a pill.
    const unlv = L.unleavened ? el('p', { class: `${quest ? 'q-swap' : 'p-swap'} k-cooked` },
      art('<svg class="ico" aria-hidden="true"><use href="/icons.svg#i-unleavened"/></svg>'), 'Unleavened') : null;
    // A seasonal unit (Appointed Times) has its own labels, A1, A2.
    const seasonal = lib.seasonal?.includes(L.unit);
    if (quest) {
      return el('article', { class: 'q-panel q-card' },
        el('p', { class: 'q-kick' }, `${seasonal ? lib.units[L.unit] : `Path ${L.unit}`} · Quest ${L.label}`),
        el('div', { class: 'q-win' }, el('img', { src: L.image, alt: '', width: 230, height: 230, loading: 'lazy' })),
        el('h3', { class: 'q-title' }, L.title),
        el('p', { class: 'q-skill' }, L.skill),
        el('dl', { class: 'q-stats' },
          el('div', {}, el('dt', {}, 'Time'), el('dd', {}, time)),
          el('div', {}, el('dt', {}, 'Serves'), el('dd', {}, L.servings)),
          el('div', {}, el('dt', {}, 'From'), el('dd', {}, L.cuisine))),
        swaps ? el('p', { class: 'q-swap' }, `Made with ${swaps}`) : null,
        skip ? el('p', { class: 'q-swap' }, skip) : null,
        unlv, cooked);
    }
    return el('article', { class: 'p-card' },
      el('span', { class: 'tape t1' }), el('span', { class: 'tape t2' }),
      el('div', { class: 'p-photo' }, el('img', { src: L.image, alt: '', width: 220, height: 220, loading: 'lazy' })),
      el('p', { class: 'p-lessonno' }, `Lesson ${L.label}`),
      el('h3', { class: 'p-title' }, L.title),
      el('p', { class: 'p-skill' }, L.skill),
      el('div', { class: 'p-meta' }, el('span', {}, time), el('span', {}, `Serves ${L.servings}`), el('span', {}, L.cuisine)),
      swaps ? el('p', { class: 'p-swap' }, `Made with ${swaps}`) : null,
      skip ? el('p', { class: 'p-swap' }, skip) : null,
      unlv, cooked);
  };

  // The family's own recipes (§6.10), with their meal-type picture.
  const recipeCard = (r, kick = 'Family recipe') => {
    const done = cooks[r.id];
    const meta = [`${r.totalMinutes} min`, `Serves ${r.servings}`, r.meal];
    const marks = [
      r.unleavened ? el('p', { class: `${quest ? 'q-swap' : 'p-swap'} k-cooked` }, art('<svg class="ico" aria-hidden="true"><use href="/icons.svg#i-unleavened"/></svg>'), 'Unleavened') : null,
      done ? el('p', { class: `${quest ? 'q-swap' : 'p-swap'} k-cooked` }, art('<svg class="ico" aria-hidden="true"><use href="/icons.svg#i-check"/></svg>'), done.times === 1 ? 'Cooked once' : `Cooked ${done.times} times`) : null,
    ];
    return quest
      ? el('article', { class: 'q-panel q-card' }, el('p', { class: 'q-kick' }, kick),
        el('div', { class: 'q-win' }, el('img', { src: r.image, alt: '', width: 230, height: 230, loading: 'lazy' })),
        el('h3', { class: 'q-title' }, r.title), el('p', { class: 'q-skill' }, meta.join(' · ')), marks)
      : el('article', { class: 'p-card' }, el('span', { class: 'tape t1' }), el('span', { class: 'tape t2' }),
        el('div', { class: 'p-photo' }, el('img', { src: r.image, alt: '', width: 220, height: 220, loading: 'lazy' })),
        el('p', { class: 'p-lessonno' }, kick), el('h3', { class: 'p-title' }, r.title),
        el('div', { class: 'p-meta' }, meta.map((m) => el('span', {}, m))), marks);
  };
  const open = (lid) => () => go(`#/kitchen/${p.id}/${lid}`);
  const lessonBtn = (L) => el('button', { type: 'button', class: 'lesson', 'aria-label': `Open ${L.title}`, onclick: open(L.id) }, card(L));
  const recipeBtn = (r, kick) => el('button', { type: 'button', class: 'lesson', 'aria-label': `Open ${r.title}`, onclick: open(r.id) }, recipeCard(r, kick));
  const seasonalUnit = (u) => lib.seasonal?.includes(u);
  const unitName = (u) => (quest && !seasonalUnit(u) ? `Path ${u}: ${lib.units[u]}` : lib.units[u]);

  // ---- My path (Main quest): what's up next, then the next lessons on this
  // profile's path, a few at a time, never the whole course.
  const pathView = () => {
    const when = (x) => (x.status === 'requested' ? 'You asked a grown-up'
      : x.due && !isSabbath() ? `Due ${fmtDay(x.due, { weekday: 'long' })}`
        : x.when === 'this-week' ? 'This week'
          : x.planned_date ? fmtDay(x.planned_date) : 'Coming up');
    const queued = new Set(mine.items.map((x) => x.lesson_id));
    // The next lessons not cooked or queued, in this profile's order: a
    // pick-one group counts once, and once one of its dishes is cooked it's done.
    const doneGroups = new Set(lib.lessons.filter((L) => L.pick && (cooks[L.id] || queued.has(L.id))).map((L) => L.pick));
    const entries = [];
    // In the profile's course plan's order when it has one (§6.18).
    const byId = Object.fromEntries(lib.lessons.map((L) => [L.id, L]));
    const ordered = mine.order ? mine.order.map((x) => byId[x]).filter(Boolean) : lib.lessons;
    for (const L of ordered) {
      if (seasonalUnit(L.unit) || cooks[L.id] || queued.has(L.id) || (mine.labels && !mine.labels[L.id])) continue;
      if (L.pick && doneGroups.has(L.pick)) continue;
      const last = entries.at(-1);
      if (L.pick && last?.pick === L.pick) last.items.push(L); else entries.push({ pick: L.pick, items: [L] });
    }
    const next = entries.slice(0, 3).flatMap((e) => e.items);
    return [
      el('h2', { class: 'k-unit' }, quest ? 'Your next quests' : 'Up next'),
      mine.items.length
        ? el('div', { class: 'k-lib' }, mine.items.map((x) => el('button', { type: 'button', class: 'lesson', 'aria-label': `Open ${x.title}`, onclick: open(x.lesson_id) },
          el('article', { class: quest ? 'q-panel q-card k-next' : 'p-card k-next' },
            x.image ? el('div', { class: quest ? 'q-win' : 'p-photo' }, el('img', { src: x.image, alt: '', width: 160, height: 160, loading: 'lazy' })) : null,
            el('p', { class: quest ? 'q-kick' : 'p-lessonno' }, x.label ? `${quest ? 'Quest' : 'Lesson'} ${x.label}` : ''),
            el('h3', { class: quest ? 'q-title' : 'p-title' }, x.title),
            el('p', { class: quest ? 'q-swap' : 'p-swap' }, when(x))))))
        : el('div', { class: quest ? 'q-panel k-empty' : 'p-card k-empty' }, quest ? 'No quests queued yet. Ask a grown-up, or look in Side quests.' : 'Nothing queued yet. Ask a grown-up, or look in More recipes.'),
      next.length ? [el('h2', { class: 'k-unit' }, quest ? 'Coming up on your path' : 'Next on your journey'), el('div', { class: 'k-lib' }, next.map(lessonBtn))] : null,
    ];
  };

  // ---- More recipes (Side quests): every unit, the family's recipes, and the
  // User-shared shelf, each folded shut, with a search over names and ingredients.
  const feastShelf = feastShared.filter((r) => r.visible && !r.mine);
  const ours = recipes.filter((r) => r.visible && !r.held);
  const moreView = () => {
    const results = el('div');
    const search = el('input', { type: 'search', class: 'k-search', placeholder: quest ? 'Search quests: a dish or an ingredient' : 'Search: a dish or an ingredient', 'aria-label': 'Search recipes', value: sessionGet(`cpr.search.${p.id}`) ?? '' });
    const shelf = (title, items, open) => (items.length ? el('details', { class: 'k-shelf', open }, el('summary', {}, el('span', {}, title), el('small', {}, String(items.length))), el('div', { class: 'k-lib' }, items)) : null);
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      sessionSet(`cpr.search.${p.id}`, search.value);
      const hit = (x) => !q || q.split(/\s+/).every((w) => x.search?.includes(w));
      const units = [...new Set(lib.lessons.map((l) => l.unit))].sort((a, b) => a - b);
      const shelves = [
        ...units.map((u) => {
          const items = lib.lessons.filter((L) => L.unit === u && hit(L)).map(lessonBtn);
          if (seasonalUnit(u)) items.push(...feastShelf.filter(hit).map((r) => recipeBtn({ ...r, id: `shared:${r.id}` }, 'User-shared recipe')));
          return shelf(unitName(u), items, Boolean(q));
        }),
        shelf('Our recipes', ours.filter(hit).map((r) => recipeBtn(r)), Boolean(q)),
      ].filter(Boolean);
      results.replaceChildren(...(shelves.length ? shelves
        : [el('div', { class: quest ? 'q-panel k-empty' : 'p-card k-empty' }, q ? `Nothing matches "${search.value.trim()}".` : "No lessons match this family's diet settings yet.")]));
    };
    search.addEventListener('input', draw);
    draw();
    return [el('div', { class: 'k-searchrow' }, search), results];
  };

  // Progress and rewards (Phase 5): the skill tree, or the passport.
  const tabs = [['path', quest ? 'Main quest' : 'My journey'], ['more', quest ? 'Side quests' : 'More recipes'], ['progress', quest ? 'Skill tree' : 'Passport']];
  const current = tabs.some(([k]) => k === tab) ? tab : 'path';
  sessionSet(`cpr.tab.${p.id}`, current);
  screen(el('section', { class: 'kitchen k-tabbed', 'data-kt': p.theme },
    el('a', { class: 'back', href: '#/' }, '← Lockers'),
    sabbathBanner(),
    el('div', { class: 'k-head' }, avatars(p.people),
      el('div', { class: 'grow' }, el('h1', {}, quest ? 'Quest board' : 'Recipe box'), el('div', {}, p.name))),
    el('div', { class: 'acts' },
      el('button', { class: 'themebtn', type: 'button', onclick: async () => {
        await api('PUT', `/api/profiles/${p.id}/theme`, { theme: other });
        kitchen(id, current);
      } }, `Switch to ${THEMES[other]}`),
      // Sound effects on or off, remembered on this device (§5.5).
      el('button', { class: 'themebtn', type: 'button', 'aria-pressed': String(!isMuted()), onclick: (e) => {
        setMuted(!isMuted());
        e.currentTarget.setAttribute('aria-pressed', String(!isMuted()));
        e.currentTarget.textContent = isMuted() ? 'Sound effects: off' : 'Sound effects: on';
      } }, isMuted() ? 'Sound effects: off' : 'Sound effects: on')),
    current === 'more' ? moreView() : current === 'progress' ? await progressView(p, cooks) : pathView(),
    // Pinned to the bottom, where a thumb is, as in MCCE Kids.
    el('nav', { class: `k-tabs ${quest ? 'q' : 'p'}`, 'aria-label': 'Kitchen' }, tabs.map(([k, label]) => el('a', {
      href: `#/kitchen/${p.id}/@${k}`, 'aria-current': k === current ? 'page' : null,
    }, label)))));
  // Anything earned since this device last showed it: a stamp, a skill, a rank.
  celebrate(p, cooks);
}

// A lesson, played in the profile's theme (player.js).
async function lesson(profileId, lessonId) {
  const [{ profiles }, lib] = await Promise.all([api('GET', '/api/profiles'), api('GET', '/api/library')]);
  const p = profiles.find((x) => x.id === profileId);
  if (!p) return go('#/');
  const mine = await api('GET', `/api/profiles/${p.id}/queue?${tz()}`).catch(() => ({ items: [] }));
  const queued = mine.items.find((x) => x.lesson_id === lessonId);
  // A family recipe comes from the API in lesson shape (§6.10).
  const recipe = /^recipe:/.test(lessonId) ? await api('GET', `/api/recipes/${lessonId.slice(7)}`)
    : /^shared:/.test(lessonId) ? await api('GET', `/api/shared/${lessonId.slice(7)}`) : null;
  const mount = el('div');
  screen(mount);
  await openLesson(mount, {
    profile: p, family: me.family, lessonId, lesson: recipe?.lesson ?? null, extra: recipe?.extra ?? {}, onExit: () => go(`#/kitchen/${p.id}`),
    crew: profiles.filter((x) => x.id !== p.id), onCook: saveCook, onReflect: saveReflection, labels: mine.labels ?? lib.labels, total: mine.total ?? lib.total,
    // "I want to make this" or "Cook this" (§6.1), and the queued lesson's
    // servings and who it's for, for a fresh cook.
    ask: {
      status: queued?.status ?? null,
      // Off their list: later on their path (early), or not on it.
      early: Boolean(mine.order?.includes(lessonId)),
      approve: () => approveNow(p, lessonId, recipe?.lesson?.title ?? lib.lessons.find((x) => x.id === lessonId)?.title ?? 'this'),
      send: async () => {
        try { return (await api('POST', `/api/profiles/${p.id}/ask`, { lesson_id: lessonId })).status; } catch (err) { showToast(err.message); throw err; }
      },
    },
    // What the cook earned, shown when it's done (Phase 5).
    onDone: async () => {
      await Promise.race([flushCooks(), new Promise((ok) => setTimeout(ok, 4000))]);
      const { cooks } = await api('GET', `/api/profiles/${p.id}/cooks?${tz()}`).catch(() => ({ cooks: null }));
      if (cooks) await celebrate(p, cooks);
    },
    seed: queued ? { servings: queued.servings, with: (queued.profile_ids ?? []).filter((x) => x !== p.id), shopped: queued.shopped_for } : null,
    // Suggest a fix is for library lessons; a family edits its own recipes.
    fixes: recipe ? null : {
      suggest: (ctx) => suggestFix(p, ctx),
      list: async (lid) => (await api('GET', `/api/lessons/${encodeURIComponent(lid)}/fixes`)).fixes,
    },
  });
}

// ---------- Suggest a fix (§6.11) ----------

const FIX_KINDS = { amount: 'Wrong amount or time', unclear: 'Unclear step', safety: 'Safety problem', unclean: 'Unclean ingredient', other: 'Something else' };

// How a value is typed in: timers in minutes, everything else as it's stored.
const toInput = (kind, v) => (v == null ? '' : kind === 'minutes' ? String(Math.round((v / 60) * 100) / 100) : String(v));
const fromInput = (kind, v) => {
  const t = String(v ?? '').trim();
  if (t === '') return null;
  if (kind === 'minutes') return Math.round(Number(t) * 60);
  if (['amount', 'temp', 'int'].includes(kind)) return Number(t);
  return t;
};
const valueInput = (kind, name, value = '') => (kind === 'text'
  ? el('textarea', { name, rows: 3, maxlength: 600 }, value)
  : el('input', { name, value, inputmode: kind === 'unit' ? 'text' : 'decimal', autocomplete: 'off' }));

// A kid wants to cook something that isn't on their list (owner, 2026-10-23):
// a grown-up enters the PIN and says how it fits in, as an extra assigned meal
// or in place of one already assigned. Resolves to the lesson's new status, or
// null if they cancel.
function approveNow(profile, lessonId, title) {
  return new Promise((resolve) => {
    const box = el('div', { class: 'card' });
    const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': `OK ${title}` }, box);
    const close = (st) => { ov.remove(); resolve(st); };
    ov.addEventListener('click', (e) => { if (e.target === ov) close(null); });
    const cancel = () => el('button', { type: 'button', class: 'hbtn', onclick: () => close(null) }, 'Cancel');
    document.body.append(ov);

    const pinStep = () => {
      const input = el('input', { name: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, 'aria-label': 'Parent PIN' });
      box.replaceChildren(el('h2', {}, `${profile.name} wants to cook ${title}`),
        el('p', { class: 'mut' }, "It isn't on their list. A grown-up OKs it: enter the parent PIN."),
        form([el('div', { class: 'pin' }, input)], 'Unlock', async (v) => {
          await api('POST', '/api/pin/unlock', { pin: v.pin });
          await refresh();
          await choiceStep();
        }, { extra: [cancel()] }));
      input.focus();
    };

    const choiceStep = async () => {
      const mine = await api('GET', `/api/profiles/${profile.id}/queue?${tz()}`);
      const assigned = mine.items.filter((x) => ['assigned', 'shopped'].includes(x.status) && !x.swap);
      const pick = el('select', { name: 'replace', 'aria-label': 'The meal it replaces' }, assigned.map((x) => el('option', { value: x.id }, x.title)));
      const choice = (value, label, hint, checked) => el('label', { class: 'choice' },
        el('input', { type: 'radio', name: 'how', value, checked, onchange: () => { pick.disabled = value !== 'replace'; } }),
        el('span', {}, el('b', {}, label), el('small', { class: 'mut' }, ` ${hint}`)));
      pick.disabled = true;
      box.replaceChildren(el('h2', {}, `How does ${title} fit in?`),
        form([
          choice('extra', 'Add as an additional assigned meal', `${profile.name}'s assigned meals stay where they are.`, true),
          assigned.length ? choice('replace', 'Replace an assigned meal', 'A course lesson it replaces goes first next week, and nobody is shown as behind.', false) : null,
          assigned.length ? el('label', { class: 'f' }, 'The meal it replaces', pick) : null,
        ], 'OK, start cooking', async (v) => {
          const r = await api('POST', `/api/profiles/${profile.id}/approve?${tz()}`, { lesson_id: lessonId, replace: v.how === 'replace' ? pick.value : null });
          close(r.status);
        }, { extra: [cancel()] }));
    };

    if (unlocked()) choiceStep().catch((err) => { showToast(err.message); close(null); }); else pinStep();
  });
}

// A dialog over the lesson, in the house style. Resolves true once a fix is
// sent. A kid profile asks for the parent PIN first; an adult profile doesn't.
function suggestFix(profile, { lesson, stepId, servings, ingredients }) {
  return new Promise((resolve) => {
    const box = el('div', { class: 'card' });
    const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Suggest a fix' }, box);
    const close = (sent) => { ov.remove(); resolve(sent); };
    ov.addEventListener('click', (e) => { if (e.target === ov) close(false); });
    const cancel = () => el('button', { type: 'button', class: 'hbtn', onclick: () => close(false) }, 'Cancel');
    const stepNo = stepId ? lesson.steps.findIndex((x) => x.id === stepId) + 1 : 0;
    const where = `${lesson.title}${stepNo ? `, step ${stepNo}` : ''}`;
    document.body.append(ov);

    const pinStep = () => {
      const input = el('input', { name: 'pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, 'aria-label': 'Parent PIN' });
      box.replaceChildren(el('h2', {}, 'Suggest a fix'), el('p', { class: 'mut' }, 'A grown-up fills this in. Enter the parent PIN.'),
        form([el('div', { class: 'pin' }, input)], 'Unlock', async (v) => {
          await api('POST', '/api/pin/unlock', { pin: v.pin });
          await refresh();
          formStep();
        }, { extra: [cancel()] }));
      input.focus();
    };

    const formStep = () => {
      const name = (id) => ingredients[id]?.name ?? id;
      const parts = patchTargets(lesson, stepId).map((t) => ({ ...t, label: t.ingredient ? `${name(t.ingredient)}: ${t.label.toLowerCase()}` : t.label }));
      const nowBox = el('p', { class: 'mut small', style: 'margin:0' });
      const instead = el('div', { class: 'stack', style: 'width:100%' });
      const select = el('select', { name: 'field' },
        el('option', { value: '' }, 'Something else (say what below)'),
        parts.map((t) => el('option', { value: t.path }, t.label)));
      const showPart = () => {
        const t = parts.find((x) => x.path === select.value);
        if (!t) { nowBox.replaceChildren(); instead.replaceChildren(); return; }
        const base = t.ingredient && t.kind === 'amount' ? ` (for ${lesson.servings} servings; you're making ${servings})` : '';
        nowBox.replaceChildren('Now it says: ', el('b', {}, showValue(t.kind, t.value)), base);
        instead.replaceChildren(el('label', { class: 'f', style: 'width:100%' }, 'It should say instead',
          t.kind === 'minutes' ? el('span', { class: 'hint' }, 'In minutes') : t.kind === 'amount' && t.ingredient ? el('span', { class: 'hint' }, `For ${lesson.servings} servings`) : null,
          valueInput(t.kind, 'suggested', toInput(t.kind, t.value))));
      };
      select.addEventListener('change', showPart);
      const kinds = el('div', { class: 'grid2' }, Object.entries(FIX_KINDS).map(([k, label], i) => el('label', { class: 'choice' },
        el('input', { type: 'radio', name: 'kind', value: k, checked: i === 0 }), el('span', {}, label))));
      box.replaceChildren(el('h2', {}, 'Suggest a fix'), el('p', { class: 'mut', style: 'margin:0' }, where),
        form([
          el('fieldset', {}, el('legend', {}, "What's the problem?"), kinds),
          el('label', { class: 'f' }, 'Which part?', select), nowBox, instead,
          el('label', { class: 'f' }, "What's wrong?", el('span', { class: 'hint' }, 'A sentence or two is plenty'), el('textarea', { name: 'note', rows: 3, maxlength: 1000, required: true })),
        ], 'Send', async (v) => {
          const t = parts.find((x) => x.path === v.field);
          if (!String(v.note ?? '').trim()) throw new Error("Say what's wrong.");
          await api('POST', '/api/fix-requests', {
            lesson_id: lesson.id, profile_id: profile.id, step: stepId, servings, kind: v.kind, note: v.note,
            ...(t ? { field: t.path, suggested_value: fromInput(t.kind, v.suggested) } : {}),
          });
          box.replaceChildren(el('h2', {}, 'Thanks'), el('p', {}, 'The fix is on its way to be checked. What comes of it shows on this lesson.'),
            el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn pri', onclick: () => close(true) }, 'Back to the lesson')));
        }, { extra: [cancel()] }));
      if (stepId && parts.length) { select.value = parts[0].path; showPart(); }
    };

    if (profile.audience === 'adult' || unlocked()) formStep(); else pinStep();
  });
}

// ---------- parent area ----------

// Every parent screen sits behind the Menu button, in a few groups, the way
// MCCE's parents app does it. One group is open at a time, and the menu opens
// on the group holding the screen being read. The Owner group shows only to
// the owner.
const PARENT_GROUPS = [['learning', 'Learning path'], ['recipes', 'Recipes'], ['setup', 'Setup'], ['owner', 'Owner']];
const PARENT_PAGES = [
  { key: 'queue', group: 'learning', label: 'Queue' },
  { key: 'shopping', group: 'learning', label: 'Shopping' },
  { key: 'progress', group: 'learning', label: 'Progress' },
  { key: 'recipes', group: 'recipes', label: 'Our recipes' },
  { key: 'shared', group: 'recipes', label: 'User-shared recipes' },
  { key: 'courses', group: 'setup', label: 'Courses' },
  { key: 'profiles', group: 'setup', label: 'Profiles' },
  { key: 'family', group: 'setup', label: 'Family settings' },
  { key: 'parents', group: 'setup', label: 'Logins & PIN' },
  { key: 'owner', group: 'owner', label: 'Families & beta word', owner: true },
  { key: 'fixes', group: 'owner', label: 'Fix requests', owner: true },
  { key: 'reviews', group: 'owner', label: 'Recipe reviews', owner: true },
  { key: 'reports', group: 'owner', label: 'Reported recipes', owner: true },
];

function parentMenu(current) {
  const pages = PARENT_PAGES.filter((x) => !x.owner || me.parent.is_owner);
  const groups = PARENT_GROUPS.filter(([g]) => pages.some((x) => x.group === g));
  let open = pages.find((x) => x.key === current)?.group ?? groups[0][0];
  const panel = el('nav', { class: 'drawer-panel', 'aria-label': 'Parent screens' });
  const drawer = el('div', { class: 'drawer', hidden: true });
  const button = el('button', { class: 'hbtn drawer-button', type: 'button', 'aria-expanded': 'false' }, '☰ Menu');
  const draw = () => {
    panel.replaceChildren(...groups.flatMap(([g, label]) => [
      el('button', { type: 'button', class: g === open ? 'drawer-group on' : 'drawer-group', 'aria-expanded': String(g === open), onclick: () => { open = g; draw(); } }, label),
      g === open ? el('div', { class: 'drawer-pages' }, pages.filter((x) => x.group === g).map((x) => el('a', {
        href: `#/parent/${x.key}`, class: x.key === current ? 'on' : null, 'aria-current': x.key === current ? 'page' : null, onclick: () => show(false),
      }, x.label))) : null,
    ].filter(Boolean)));
  };
  const onKey = (e) => { if (e.key === 'Escape') show(false); };
  const show = (on) => {
    drawer.hidden = !on;
    button.setAttribute('aria-expanded', String(on));
    if (on) { document.addEventListener('keydown', onKey); panel.querySelector('button')?.focus(); } else { document.removeEventListener('keydown', onKey); button.focus(); }
  };
  button.addEventListener('click', () => show(drawer.hidden));
  drawer.append(el('div', { class: 'drawer-scrim', onclick: () => show(false) }), panel);
  draw();
  return [button, drawer];
}

function parentScreen(current, ...kids) {
  const [button, drawer] = parentMenu(current);
  const head = topbar(me.family.name,
    el('a', { class: 'hbtn', href: '#/' }, 'Lockers'),
    el('button', { class: 'hbtn', type: 'button', onclick: async () => { await api('POST', '/api/pin/lock'); await refresh(); go('#/'); } }, 'Lock'),
    el('button', { class: 'hbtn', type: 'button', onclick: async () => { await api('POST', '/api/logout'); store('cpr.profile', null); await start('#/'); } }, 'Log out'));
  head.prepend(button);
  // The app's name goes back to the Queue, where the Parents button lands.
  const brand = head.querySelector('.grow b');
  brand.replaceWith(el('a', { class: 'brand', href: '#/parent/queue' }, brand.textContent));
  const page = PARENT_PAGES.find((x) => x.key === current);
  const group = PARENT_GROUPS.find(([g]) => g === page?.group)?.[1];
  screen(head, drawer,
    group ? el('p', { class: 'eyebrow' }, group) : null,
    el('h1', {}, page?.label ?? 'Parents'), sabbathBanner(), ...kids);
}

const parentProfiles = parentOnly(async (adding = false) => {
  const { profiles } = await api('GET', '/api/profiles');
  const add = () => {
    let close = () => {};
    const f = profileForm(null, { cancel: el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel'), done: () => { close(); go('#/parent/profiles'); } });
    close = modal('Add a profile', f);
  };
  parentScreen('profiles',
    addHead(null, 'Add a profile', add),
    el('div', { class: 'card' },
      profiles.length ? el('div', { class: 'rows' }, profiles.map((p) => el('div', { class: 'rowi with-av' },
        avatars(p.people),
        el('div', {}, el('b', {}, p.name), el('small', {}, `${p.audience === 'adult' ? 'Adult' : 'Kid'} · ${THEMES[p.theme]} · ${p.people.map((x) => x.name).join(', ')}`)),
        el('a', { class: 'hbtn', href: `#/parent/profiles/${p.id}` }, 'Edit'))))
        : el('p', { class: 'mut' }, 'No profiles yet.')));
  if (adding) add();
});

// A profile's form, for adding one (in a dialog) or editing one (its page).
// cancel: the Cancel button or link; done(): after it saves or is deleted.
function profileForm(existing, { cancel, done }) {
  const people = existing ? existing.people.map((p) => ({ ...p })) : [{ name: '', color: 'tomato' }];
  const peopleBox = el('div', { class: 'stack', style: 'width:100%' });

  const drawPeople = () => {
    peopleBox.replaceChildren(...people.map((person, i) => el('div', { class: 'card', style: 'padding:12px' },
      el('div', { class: 'person' },
        el('label', { class: 'f' }, people.length > 1 ? `Person ${i + 1}` : 'Name',
          el('input', { value: person.name, maxlength: 30, required: true, oninput: (e) => { person.name = e.target.value; } })),
        people.length > 1 ? el('button', { type: 'button', class: 'hbtn', 'aria-label': `Remove person ${i + 1}`, onclick: () => { people.splice(i, 1); drawPeople(); } }, 'Remove') : null),
      el('div', { class: 'swatches', role: 'group', 'aria-label': 'Avatar color' }, Object.entries(COLORS).map(([key, hex]) => {
        const b = el('button', { type: 'button', class: 'swatch', 'aria-label': key, 'aria-pressed': String(person.color === key), onclick: () => { person.color = key; drawPeople(); } });
        b.append(art(`<i style="background:${hex}"></i>`));
        return b;
      })))),
    el('button', { type: 'button', class: 'hbtn', onclick: () => { people.push({ name: '', color: Object.keys(COLORS)[people.length % 8] }); drawPeople(); } }, '+ Someone else shares this profile'));
  };
  drawPeople();

  const radio = (name, value, label, note, checked) => el('label', { class: 'choice' },
    el('input', { type: 'radio', name, value, checked }), el('span', {}, label, note ? el('em', {}, ` ${note}`) : null));

  const extra = [cancel];
  if (existing) {
    extra.push(el('button', { type: 'button', class: 'hbtn bad', onclick: async () => {
      if (!confirm(`Delete ${existing.name}?`)) return;
      await api('DELETE', `/api/profiles/${existing.id}`);
      done();
    } }, 'Delete'));
  }

  return form([
    el('fieldset', {}, el('legend', {}, 'Who uses this profile'), peopleBox),
    field('Locker name', 'name', { value: existing?.name ?? '', maxlength: 40 }, 'Optional. Leave blank to use the names'),
    el('fieldset', {}, el('legend', {}, 'Kid or adult'),
      el('div', { class: 'grid2' },
        radio('audience', 'kid', 'Kid', 'Pick this if any kid shares it', (existing?.audience ?? 'kid') === 'kid'),
        radio('audience', 'adult', 'Adult', null, existing?.audience === 'adult'))),
    el('fieldset', {}, el('legend', {}, 'Theme'),
      el('div', { class: 'grid2' }, Object.entries(THEMES).map(([k, label]) => radio('theme', k, label, null, (existing?.theme ?? 'quest') === k)))),
  ], existing ? 'Save' : 'Add profile', async (v) => {
    const body = { name: v.name.trim() || undefined, people: people.map((p) => ({ name: p.name.trim(), color: p.color })), audience: v.audience, theme: v.theme };
    if (body.people.some((p) => !p.name)) throw new Error('Every person needs a name.');
    await api(existing ? 'PUT' : 'POST', existing ? `/api/profiles/${existing.id}` : '/api/profiles', body);
    done();
  }, { extra });
}

// Editing a profile is its own page; adding one opens the dialog on the list.
const profileEditor = parentOnly(async (id) => {
  if (id === 'new') return parentProfiles(true);
  const { profiles } = await api('GET', '/api/profiles');
  const existing = profiles.find((p) => p.id === id);
  if (!existing) return go('#/parent/profiles');
  parentScreen('profiles', el('h2', {}, `Edit ${existing.name}`),
    profileForm(existing, { cancel: el('a', { class: 'hbtn', href: '#/parent/profiles' }, 'Cancel'), done: () => go('#/parent/profiles') }));
});

const familySettings = parentOnly(async () => {
  const f = await api('GET', '/api/family');
  const saved = el('p', { class: 'ok', hidden: true }, 'Saved.');
  parentScreen('family', form([
    field('Family name', 'name', { value: f.family.name, required: true, maxlength: 60 }),
    field('Default servings', 'default_servings', { type: 'number', min: 1, max: f.servings_max, value: f.family.default_servings, inputmode: 'numeric' }, 'Recipes scale to this'),
    el('fieldset', {}, el('legend', {}, 'Leave out'),
      el('p', { class: 'mut small', style: 'margin:0' }, 'Lessons with these are hidden, unless a lesson has a swap for them.'),
      el('div', { class: 'grid2 tight' }, f.diet_tags.map((t) => el('label', { class: 'choice' },
        el('input', { type: 'checkbox', name: `diet_${t}`, checked: f.family.diet_filters.includes(t) }), el('span', {}, DIET[t] ?? t))))),
    el('fieldset', {}, el('legend', {}, 'How you use the app'),
      el('div', { class: 'grid2' },
        el('label', { class: 'choice' }, el('input', { type: 'radio', name: 'mode', value: 'casual', checked: f.family.mode !== 'homeschool' }), el('span', {}, 'Casual', el('em', {}, ' Cook when you like'))),
        el('label', { class: 'choice' }, el('input', { type: 'radio', name: 'mode', value: 'homeschool', checked: f.family.mode === 'homeschool' }), el('span', {}, 'Homeschool', el('em', {}, ' A course with due dates')))),
      el('label', { class: 'choice' }, el('input', { type: 'checkbox', name: 'plan_weeks', checked: f.family.plan_weeks }),
        el('span', {}, 'Plan our weeks', el('em', {}, ' In casual mode: set up a course, and each week\'s lessons load into the queue. Homeschool mode always does.'))),
      el('p', { class: 'mut small', style: 'margin:0' }, 'Switching never deletes anything.')),
    el('fieldset', {}, el('legend', {}, 'Voice step control'),
      el('p', { class: 'mut small', style: 'margin:0' }, 'In cook mode, kids can say "next," "back," or "again" instead of tapping.'),
      el('details', { class: 'psec' }, el('summary', {}, 'Where it works, and privacy'),
        el('p', { class: 'mut small', style: 'margin:0' },
          'It works in Chrome on Android, and on other devices whose browser can recognize speech. ',
          'The browser usually sends what the mic hears to Google to recognize it, so it stays off until you turn it on.')),
      el('label', { class: 'choice' }, el('input', { type: 'checkbox', name: 'voice_enabled', checked: f.family.voice_enabled }), el('span', {}, 'Turn on voice step control'))),
    saved,
  ], 'Save', async (v) => {
    saved.hidden = true;
    await api('PUT', '/api/family', {
      name: v.name, default_servings: Number(v.default_servings),
      diet_filters: f.diet_tags.filter((t) => v[`diet_${t}`]),
      voice_enabled: Boolean(v.voice_enabled),
      mode: v.mode, plan_weeks: Boolean(v.plan_weeks),
    });
    await refresh();
    saved.hidden = false;
  }, { top: true }));
});

const parentLogins = parentOnly(async () => {
  const f = await api('GET', '/api/family');
  const add = () => {
    let close = () => {};
    close = modal('Add another parent', form([
      field('Their email', 'email', { type: 'email', autocomplete: 'off', required: true }),
      field('A password for them', 'password', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }, 'At least 8 characters. They can change it with Forgot password.'),
    ], 'Add parent', async (v) => {
      await api('POST', '/api/parents', v);
      close();
      parentLogins();
    }, { extra: [el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel')] }));
  };
  parentScreen('parents',
    addHead('Parent logins', 'Add a parent', add),
    el('div', { class: 'card' },
      el('div', { class: 'rows' }, f.parents.map((e) => el('div', { class: 'rowi' }, el('b', {}, e), e === me.parent.email ? el('small', {}, 'You') : el('span'))))),
    el('h2', {}, 'Parent PIN'),
    el('div', { class: 'card' }, el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => forgotPin(() => go('#/parent/parents')) }, 'Change the PIN'))));
});

// ---------- the queue (§6.2) and courses (§6.18) ----------

const SAFETY = { 'adult-nearby': 'Adult nearby', 'adult-hands-on': 'Adult hands-on', solo: 'On their own' };
const foundationMark = () => el('span', { class: 'found' }, art('<svg class="ico" aria-hidden="true"><use href="/icons.svg#i-shield"/></svg>'), 'Foundation');
// A dish's name, which opens its dish card (below).
const lessonName = (x) => [x.label ? `${x.label} · ` : '', el('button', { type: 'button', class: 'hbtn link dishlink', onclick: () => showDish(x.lesson_id ?? x.id) }, x.title)];

// The dish card: what a dish is, at a glance, for a family that has never
// eaten it. A line about it, its main ingredients, how it cooks, and the time.
let courseCache = null;
async function showDish(id) {
  let d;
  if (/^recipe:/.test(id)) {
    const r = await api('GET', `/api/recipes/${id.slice(7)}`);
    d = { title: r.title, image: r.image, minutes: r.totalMinutes, cuisine: 'Family recipe', ...r.card };
  } else if (/^shared:/.test(id)) {
    const r = await api('GET', `/api/shared/${id.slice(7)}`);
    d = { title: r.title, image: r.image, minutes: r.totalMinutes, cuisine: 'User-shared recipe', ...r.card };
  } else {
    const [C, R] = await Promise.all([courseCache ??= fetch('/content/course.json').then((x) => x.json()), contentRegistry()]);
    const L = R.lessons.find((x) => x.id === id), c = C.dishes.find((x) => x.id === id);
    const src = L ?? c;
    if (!src) return;
    d = { title: src.title, image: src.image, minutes: L?.minutes ?? c?.minutes, estimated: !L && c?.estimated, cuisine: R.cuisines[src.cuisine]?.name ?? src.cuisine,
      about: L?.about ?? c?.about, main: L?.main ?? c?.main, method: L?.method ?? c?.method, written: Boolean(L) };
  }
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': d.title, onclick: (e) => { if (e.target === ov) close(); } },
    el('div', { class: 'card dishcard' },
      el('img', { src: d.image, alt: '', width: 160, height: 160 }),
      el('h2', {}, d.title),
      el('p', { class: 'mut' }, [d.cuisine, d.minutes ? `${d.estimated ? 'about ' : ''}${d.minutes} min` : null, d.method ? METHOD_NAMES[d.method] : null].filter(Boolean).join(' · ')),
      d.about ? el('p', {}, d.about) : null,
      d.main?.length ? [el('h3', {}, 'Main ingredients'), el('ul', {}, d.main.map((m) => el('li', {}, m)))] : null,
      d.written === false ? el('p', { class: 'mut small' }, 'This lesson is still being written.') : null,
      el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn pri', onclick: close }, 'Close'))));
  document.addEventListener('keydown', onKey);
  document.body.append(ov);
  ov.querySelector('button.pri').focus();
}

// Every step an adult needs to be in the kitchen for, loaded when opened.
function safetyReview(lessonId) {
  const box = el('div', { class: 'stack' }, el('p', { class: 'mut small' }, 'Loading…'));
  const d = el('details', { class: 'safety' }, el('summary', {}, 'Safety review'), box);
  d.addEventListener('toggle', async () => {
    if (!d.open || d.dataset.loaded) return;
    d.dataset.loaded = '1';
    const s = await api('GET', `/api/lessons/${encodeURIComponent(lessonId)}/safety`);
    box.replaceChildren(s.steps.length
      ? el('ul', { class: 'safety-list' }, s.steps.map((x) => el('li', {}, el('b', {}, `Step ${x.n} · ${SAFETY[x.safety] ?? x.safety}${x.hazard ? ` · ${x.hazard}` : ''}`), el('span', {}, x.text))))
      : el('p', { class: 'mut small' }, 'Every step is one a kid can do on their own.'));
  });
  return d;
}

// A button that runs fn, shows its error, and is off while it runs.
const actBtn = (label, cls, fn) => el('button', { type: 'button', class: `hbtn ${cls}`, onclick: async (e) => {
  e.currentTarget.disabled = true;
  try { await fn(); } catch (err) { showToast(err.message); e.target.disabled = false; }
} }, label);

const servingsPick = (x, onChange) => (x.servings_options?.length
  ? el('label', { class: 'f inline' }, 'Serves', el('select', { onchange: (e) => onChange(Number(e.target.value)) },
    x.servings_options.map((n) => el('option', { value: n, selected: n === x.servings }, n))))
  : null);

// Adding something new opens in a dialog over the page (owner, 2026-10-23).
// Returns close().
function modal(title, ...body) {
  const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    el('div', { class: 'card' }, el('h2', {}, title), body));
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc); window.removeEventListener('hashchange', close); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', esc);
  // Going to another page closes it.
  window.addEventListener('hashchange', close);
  document.body.append(ov);
  ov.querySelector('select, input, textarea, button')?.focus();
  return close;
}

// A two-way switch between views of a page; the choice is kept for the visit.
// options: [[value, label]]
function viewToggle(key, options, fallback, onPick) {
  const current = sessionGet(key) ?? fallback;
  return el('div', { class: 'seg', role: 'group', 'aria-label': 'Show' }, options.map(([value, label]) => el('button', {
    type: 'button', 'aria-pressed': String(value === current),
    onclick: () => { sessionSet(key, value); onPick(value); },
  }, label)));
}

// A list's heading with its add button on the right (owner, 2026-10-23).
// action: an onclick, or a link to the page that adds one.
const addHead = (title, label, action) => el('div', { class: 'pagehead' }, title ? el('h2', {}, title) : el('span'),
  typeof action === 'string' ? el('a', { class: 'hbtn pri', href: action }, `+ ${label}`) : el('button', { type: 'button', class: 'hbtn pri', onclick: action }, `+ ${label}`));

// A row that opens to show its tools: the summary is one line, and the
// buttons stay out of the way until it's opened.
const expander = (summary, ...body) => el('details', { class: 'xrow' }, el('summary', {}, summary), el('div', { class: 'xbody' }, body));

// A "⋯" menu of actions, kept on the screen wherever its button wrapped to.
// items: [label, onclick] pairs (null ones are left out).
function onScreen(box) {
  box.style.transform = '';
  const r = box.getBoundingClientRect(), gap = 16, w = document.documentElement.clientWidth;
  const shift = r.left < gap ? gap - r.left : r.right > w - gap ? w - gap - r.right : 0;
  if (shift) box.style.transform = `translateX(${Math.round(shift)}px)`;
}
const menu = (label, items) => el('details', { class: 'more', ontoggle: (e) => { if (e.target.open) onScreen(e.target.querySelector('.more-menu')); } },
  el('summary', { 'aria-label': label }, '⋯'),
  el('div', { class: 'more-menu' }, items.filter(Boolean).map(([text, fn]) => el('button', { type: 'button', class: 'hbtn link', onclick: (e) => { e.target.closest('details').open = false; Promise.resolve(fn()).catch((err) => showToast(err.message)); } }, text))));
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : /(s|sh|ch)$/.test(word) ? 'es' : 's'}`;

const parentQueue = parentOnly(async (flash) => {
  const [q, { profiles }] = await Promise.all([api('GET', `/api/queue?${tz()}`), api('GET', '/api/profiles')]);
  const pname = (id) => profiles.find((p) => p.id === id)?.name ?? 'Someone';
  const names = (ids) => ids.map(pname).join(' & ') || 'Nobody';
  const homeschool = q.mode === 'homeschool';
  // A done-message, with Undo where there is one.
  const again = (msg, undo) => parentQueue(el('p', { class: 'ok flash', role: 'status' }, msg, ' ',
    undo ? el('button', { type: 'button', class: 'hbtn link', onclick: async () => { await undo(); parentQueue(); } }, 'Undo') : null));
  const tested = (lid) => {
    const t = q.test_cooks[lid];
    return t
      ? el('small', { class: 'mut' }, `Test-cooked ${fmtDay(t.cooked_on)}${t.by_me ? ' by you' : ''} · `,
        el('button', { type: 'button', class: 'hbtn link', onclick: async () => { await api('DELETE', `/api/test-cooks/${lid}`); parentQueue(); } }, 'Unmark'))
      : el('button', { type: 'button', class: 'hbtn link', onclick: async () => {
        await api('POST', '/api/test-cooks', { lesson_id: lid, cooked_on: localToday() });
        again('Marked test-cooked.', () => api('DELETE', `/api/test-cooks/${lid}`));
      } }, "I've test-cooked this");
  };
  const setServings = (qid) => async (n) => { await api('PUT', `/api/queue/${qid}`, { servings: n }); };

  // ---- requests ----
  // A request is approved as an extra meal, or in place of one of the asker's
  // assigned meals (owner, 2026-10-23).
  const replaceable = (pid) => [
    ...q.queued.filter((x) => x.profile_ids.includes(pid) && !x.swap).map((x) => ({ id: x.id, title: x.title })),
    ...q.courses.filter((c) => c.profile_ids.includes(pid)).flatMap((c) => c.this_week.lessons.filter((x) => x.queue_id && !x.done).map((x) => ({ id: x.queue_id, title: x.title }))),
  ];
  const replaceApprove = (r) => {
    const pick = el('select', { 'aria-label': `The meal ${r.title} replaces` }, replaceable(r.requested_by).map((x) => el('option', { value: x.id }, x.title)));
    return el('span', { class: 'acts' }, actBtn('Approve, replacing', '', async () => {
      await api('POST', `/api/queue/${r.id}/approve?${tz()}`, { replace: pick.value });
      again(`${r.title} replaces ${pick.selectedOptions[0].textContent} on ${pname(r.requested_by)}'s list.`);
    }), pick);
  };
  const requests = q.requests.map((r) => el('div', { class: 'card qcard' },
    el('div', {}, el('b', {}, `${pname(r.requested_by)} asked for `, ...lessonName(r)), r.foundation ? foundationMark() : null,
      el('small', { class: 'mut' }, ` · ${fmtDay(r.created_at.slice(0, 10))}`)),
    r.already_queued ? el('p', { class: 'mut small', style: 'margin:0' }, `It's already on ${pname(r.requested_by)}'s list, so Not now is fine.`) : null,
    safetyReview(r.lesson_id), tested(r.lesson_id),
    el('div', { class: 'acts' },
      servingsPick(r, setServings(r.id)),
      actBtn('Approve as an extra meal', 'pri', async () => { await api('POST', `/api/queue/${r.id}/approve?${tz()}`); again(`${r.title} is on ${pname(r.requested_by)}'s list as an extra meal.`); }),
      replaceable(r.requested_by).length ? replaceApprove(r) : null,
      actBtn('Not now', '', async () => {
        await api('POST', `/api/queue/${r.id}/decline`);
        again(`Not now for ${r.title}.`, () => api('POST', `/api/queue/${r.id}/put-back`));
      }))));

  // ---- courses ----
  const courseBox = (c) => {
    const behind = c.weeks_behind ? `${c.weeks_behind} week${c.weeks_behind === 1 ? '' : 's'} behind` : 'On track';
    // A lesson is one line; its tools open under it, so nothing is tapped by
    // accident while scrolling.
    const status = (x, week) => (x.done ? 'Cooked'
      : x.extra ? 'Extra, this week only'
        : isSabbath() || !homeschool ? null
          : [x.overdue ? el('span', { class: 'late' }, 'Overdue · ') : null, `Due ${fmtDay(addDays(week, c.due_day))}`].filter(Boolean));
    const lessonRow = (x, week) => (x.done
      ? el('div', { class: 'rowi' }, el('div', {}, el('b', {}, ...lessonName(x)), el('small', {}, 'Cooked')), el('span', { class: 'mut' }, '✓'))
      : expander(el('span', {}, el('b', {}, ...lessonName(x)), x.foundation ? foundationMark() : null, status(x, week) ? el('small', {}, status(x, week)) : null),
        el('div', { class: 'qtools' }, safetyReview(x.lesson_id), tested(x.lesson_id)),
        el('div', { class: 'acts' },
          x.queue_id ? servingsPick(x, setServings(x.queue_id)) : null,
          actBtn('Skip this recipe', '', async () => {
            await api('POST', `/api/courses/${c.id}/skip-recipe`, { lesson_id: x.lesson_id });
            again(`Skipped ${x.title}. The next lesson takes its place.`, () => api('POST', `/api/courses/${c.id}/put-back-recipe`, { lesson_id: x.lesson_id }));
          }),
          x.queue_id ? swapLink(x, x.queue_id) : null)));
    const tw = c.this_week;
    return el('section', { class: 'card qcourse' },
      el('div', { class: 'rowi' },
        el('div', {}, el('h3', { style: 'margin:0' }, c.name || `${names(c.profile_ids)}'s course`),
          el('small', {}, `${names(c.profile_ids)} · ${c.per_week} a week · ${c.done} of ${c.total} cooked`)),
        el('a', { class: 'hbtn', href: `#/parent/courses/${c.id}` }, 'Edit')),
      c.total ? el('p', { class: 'mut small', style: 'margin:0' },
        c.projected_finish ? `Planned finish: week of ${fmtDay(c.planned_finish)}. ${c.started ? behind : `Starts ${fmtDay(c.start_date)}`}.` : 'Every lesson is cooked.')
        : el('p', { class: 'mut small' }, 'No lessons in this course can be cooked yet.'),
      c.unwritten ? el('p', { class: 'mut small', style: 'margin:0' }, `${c.unwritten} more lesson${c.unwritten === 1 ? ' is' : 's are'} still being written. They join the schedule when they're ready.`) : null,
      c.hidden ? el('p', { class: 'mut small', style: 'margin:0' }, `${c.hidden} lesson${c.hidden === 1 ? ' is' : 's are'} hidden by your diet settings, so ${c.hidden === 1 ? "it isn't" : "they aren't"} scheduled.`) : null,
      c.started ? el('section', { class: 'qweek' },
        el('div', { class: 'qweek-head' },
          el('h4', {}, 'This week', el('small', {}, `${fmtDay(tw.week)} to ${fmtDay(addDays(tw.week, 5))}`)),
          menu(`Change this week`, tw.skipped
            ? [['Put this week back', async () => { await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, skipped: false }); again('This week is back.'); }]]
            : [
              c.done + tw.lessons.filter((x) => !x.done).length < c.total ? ['Cook another recipe', async () => {
                await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, extra: 1 });
                again('Added the next lesson to this week, for this week only.', () => api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, extra: -1 }));
              }] : null,
              ['Skip this week', async () => {
                await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, skipped: true });
                again('Skipped this week. Everything moves back a week.', () => api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, skipped: false }));
              }],
            ])),
        tw.skipped ? el('p', { class: 'mut' }, 'Skipped. Everything moved back a week.')
          : tw.lessons.length ? el('div', { class: 'rows' }, tw.lessons.map((x) => lessonRow(x, tw.week)))
            : el('p', { class: 'mut' }, 'Nothing left this week.')) : null,
      // Next week is a look ahead, closed until it's wanted.
      el('details', { class: 'qweek' },
        el('summary', {}, el('h4', {}, c.started ? 'Next week' : 'First week', el('small', {}, `${fmtDay(c.next_week.week)} · ${c.next_week.skipped ? 'skipped' : plural(c.next_week.lessons.length, 'lesson')}`))),
        c.next_week.skipped ? el('p', { class: 'mut' }, 'Skipped.') : el('div', { class: 'rows' }, c.next_week.lessons.map((x) => el('div', { class: 'rowi' },
          el('div', {}, el('b', {}, ...lessonName(x)), x.foundation ? foundationMark() : null)))),
        el('div', { class: 'acts' }, actBtn(c.next_week.skipped ? 'Put next week back' : 'Skip next week', '', async () => {
          await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: c.next_week.week, skipped: !c.next_week.skipped });
          parentQueue();
        }))),
      c.skipped_recipes.length ? el('details', { class: 'qweek' },
        el('summary', {}, el('h4', {}, 'Skipped recipes', el('small', {}, String(c.skipped_recipes.length)))),
        el('div', { class: 'rows' }, c.skipped_recipes.map((x) => el('div', { class: 'rowi' },
          el('b', {}, x.title), actBtn('Put back', '', async () => { await api('POST', `/api/courses/${c.id}/put-back-recipe`, { lesson_id: x.lesson_id }); again(`${x.title} is back in the course.`); }))))) : null);
  };

  // ---- lessons queued by hand ----
  // Swap for an Appointed Time meal instead (§6.19): kept in a "⋯" menu, not on the card.
  const swapPicker = async (qid, title) => {
    const d = await api('GET', `/api/queue/${qid}/swap?${tz()}`);
    const close = () => ov.remove();
    const groups = [...new Set(d.options.map((o) => o.group))];
    const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Swap for an Appointed Time meal' },
      el('div', { class: 'card' },
        el('h2', {}, 'Swap for an Appointed Time meal'),
        el('p', { class: 'mut' }, `Instead of ${title}${d.spring ? '. Spring: unleavened meals only.' : '.'}`),
        groups.length ? groups.map((g) => [el('h3', {}, g), el('div', { class: 'rows' }, d.options.filter((o) => o.group === g).map((o) => el('div', { class: 'rowi with-av' },
          el('img', { src: o.image, alt: '', width: 48, height: 48 }),
          el('div', {}, el('b', {}, el('button', { type: 'button', class: 'hbtn link dishlink', onclick: () => showDish(o.id) }, `${o.label ? `${o.label} · ` : ''}${o.title}`)),
            o.unleavened || o.feast ? el('div', { class: 'badges' }, o.unleavened ? badge('i-unleavened', 'Unleavened') : null, o.feast ? badge('i-feast', 'Good for Feast Days') : null) : null),
          el('div', { class: 'acts' }, actBtn('Pick', 'pri', async () => {
            const res = await api('POST', `/api/queue/${qid}/swap?${tz()}`, { lesson_id: o.id });
            close();
            again(`Swapped ${title} for ${o.title}.`, () => api('POST', `/api/queue/${res.id}/unswap`));
          })))))])
          : el('p', {}, 'Nothing to offer for that week yet.'),
        el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: close }, 'Cancel'))));
    document.body.append(ov);
  };
  const swapLink = (x, qid) => el('button', { type: 'button', class: 'hbtn link', onclick: () => swapPicker(qid, x.title) }, 'Swap for an Appointed Time meal');

  const queuedRow = (x) => expander(el('span', {}, el('b', {}, ...lessonName(x)), x.foundation ? foundationMark() : null,
    el('small', {}, `For ${names(x.profile_ids)}${x.planned_date ? ` · ${fmtDay(x.planned_date)}` : ''}${x.status === 'shopped' ? ' · Shopped for' : ''}${x.swap ? ' · Swapped in' : ''}`)),
  el('div', { class: 'qtools' }, safetyReview(x.lesson_id), tested(x.lesson_id)),
  el('div', { class: 'acts' }, servingsPick(x, setServings(x.id)),
    x.swap
      ? actBtn('Undo swap', '', async () => { await api('POST', `/api/queue/${x.id}/unswap`); again(`Undid the swap for ${x.title}.`); })
      : actBtn('Remove', '', async () => {
        await api('DELETE', `/api/queue/${x.id}`);
        again(`Took ${x.title} off the queue.`, () => api('POST', `/api/queue/${x.id}/put-back`));
      }),
    x.swap ? null : swapLink(x, x.id)));

  // ---- add a lesson ----
  const note = el('p', { class: 'mut small note', hidden: true }, 'Most lessons use knife work. We suggest a Unit 1 lesson first.');
  const lessonSel = el('select', { name: 'lesson_id', required: true },
    el('option', { value: '' }, 'Pick a lesson'),
    q.library.map((L) => el('option', { value: L.id }, `${L.label ? `${L.label} · ` : ''}${L.title}${L.foundation ? ' (foundation)' : ''}`)),
    // The family's own recipes (§6.10).
    q.recipes?.length ? el('optgroup', { label: 'Our recipes' }, q.recipes.map((r) => el('option', { value: r.id }, r.title))) : null);
  const pickable = [...q.library, ...(q.recipes ?? [])];
  const who = el('div', { class: 'grid2' }, profiles.map((p) => el('label', { class: 'choice' },
    el('input', { type: 'checkbox', name: `p_${p.id}`, value: p.id }), el('span', {}, p.name))));
  // The knife-work note (§4.0): a suggestion, not a block.
  const checkNote = () => {
    const L = pickable.find((x) => x.id === lessonSel.value);
    const picked = profiles.filter((p) => who.querySelector(`[name="p_${p.id}"]`).checked).map((p) => p.id);
    note.hidden = !L || L.unit === 1 || !L.unit || !picked.length || picked.some((pid) => q.knife_ok.includes(pid));
  };
  lessonSel.addEventListener('change', checkNote);
  who.addEventListener('change', checkNote);
  let closeAdd = () => {};
  const addForm = form([
    el('label', { class: 'f' }, 'Lesson', lessonSel),
    el('fieldset', {}, el('legend', {}, "Who's cooking"), el('p', { class: 'mut small', style: 'margin:0' }, 'Pick more than one to cook it together. It counts for each of them.'), who),
    note,
    field('Serves', 'servings', { type: 'number', min: 1, value: q.default_servings, inputmode: 'numeric' }),
    field('Planned date', 'planned_date', { type: 'date' }, 'Optional'),
  ], 'Add to the queue', async (v) => {
    const ids = profiles.filter((p) => v[`p_${p.id}`]).map((p) => p.id);
    if (!v.lesson_id) throw new Error('Pick a lesson.');
    if (!ids.length) throw new Error("Pick who's cooking.");
    const L = pickable.find((x) => x.id === v.lesson_id);
    const n = Number(v.servings);
    // A lesson with set sizes takes the nearest one it offers.
    const servings = L.servings_options.includes(n) ? n : L.servings_options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
    await api('POST', '/api/queue', { lesson_id: v.lesson_id, profile_ids: ids, servings, planned_date: v.planned_date || null });
    closeAdd();
    again(`${L.title} is in the queue${servings !== n ? `, serving ${servings} (the nearest size it makes)` : ''}.`);
  }, { extra: [el('button', { type: 'button', class: 'hbtn', onclick: () => closeAdd() }, 'Cancel')] });

  const courses = q.weeks_on
    ? (q.courses.length ? q.courses.map(courseBox)
      : el('div', { class: 'card' }, el('p', {}, homeschool ? 'Homeschool mode plans your weeks from a course.' : 'Plan our weeks is on.'),
        el('div', { class: 'acts' }, el('a', { class: 'hbtn pri', href: '#/parent/courses/new' }, 'Set up a course'))))
    : null;

  // Course lessons and lessons added by hand, one at a time (owner, 2026-10-23).
  const extraList = [
    q.queued.length ? el('div', { class: 'card' }, el('div', { class: 'rows' }, q.queued.map(queuedRow)))
      : el('p', { class: 'mut' }, courses ? 'No additional lessons assigned.' : 'Nothing queued yet. Add a lesson, or turn on Plan our weeks in Family.'),
    q.put_back.length ? el('details', { class: 'psec' }, el('summary', {}, `Recently taken off (${q.put_back.length})`), el('div', { class: 'card' }, el('div', { class: 'rows' }, q.put_back.map((x) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, x.title), el('small', {}, `${x.status === 'declined' ? `${pname(x.requested_by)} asked · Not now` : 'Removed'} · ${names(x.profile_ids)}`)),
      actBtn('Put back', '', async () => { await api('POST', `/api/queue/${x.id}/put-back`); again(`${x.title} is back.`); })))))) : null,
  ];
  const view = el('div', {});
  const show = (which) => {
    view.replaceChildren(...[which === 'course' && courses ? courses : extraList].flat().filter(Boolean));
    toggle?.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(['course', 'extra'][i] === which)));
  };
  const toggle = courses ? viewToggle('cpr.queue.view', [['course', 'Course'], ['extra', `Additional${q.queued.length ? ` (${q.queued.length})` : ''}`]], 'course', show) : null;
  show(courses ? sessionGet('cpr.queue.view') ?? 'course' : 'extra');

  parentScreen('queue',
    flash ?? null,
    q.requests.length ? [el('h2', {}, `Requests (${q.requests.length})`), requests] : null,
    el('div', { class: 'pagehead' }, el('h2', {}, 'The queue'),
      el('button', { type: 'button', class: 'hbtn pri', onclick: () => { closeAdd = modal('Add a lesson', addForm); } }, '+ Add a lesson')),
    toggle,
    view);
});

// ---------- courses: the list and the editor (§6.18) ----------

const courseList = parentOnly(async () => {
  const [{ courses, weeks_on, mode }, { profiles }] = await Promise.all([api('GET', '/api/courses'), api('GET', '/api/profiles')]);
  const names = (ids) => ids.map((id) => profiles.find((p) => p.id === id)?.name ?? 'Someone').join(' & ') || 'Nobody';
  const active = courses.filter((c) => !c.archived_at), ended = courses.filter((c) => c.archived_at);
  parentScreen('courses',
    addHead(null, 'Set up a course', '#/parent/courses/new'),
    !weeks_on ? el('p', { class: 'card mut' }, 'Plan our weeks is off, so courses don\'t load lessons into the queue. Turn it on in Family, or switch to homeschool mode.') : null,
    el('p', { class: 'mut' }, mode === 'homeschool'
      ? 'Set each course up once: the lessons in order, a start date, and how many a week. Each week\'s lessons load into the queue, and an unfinished one moves to the next week.'
      : 'A course plans your weeks: set it up once, and each week\'s lessons load into the queue.'),
    el('div', { class: 'card' }, active.length ? el('div', { class: 'rows' }, active.map((c) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, c.name || `${names(c.profile_ids)}'s course`), el('small', {}, `${names(c.profile_ids)} · from ${fmtDay(c.start_date)} · ${c.per_week} a week`)),
      el('a', { class: 'hbtn', href: `#/parent/courses/${c.id}` }, 'Edit'))))
      : el('p', { class: 'mut' }, 'No courses yet.')),
    ended.length ? [el('h2', {}, 'Ended courses'), el('div', { class: 'card' }, el('div', { class: 'rows' }, ended.map((c) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, c.name || `${names(c.profile_ids)}'s course`), el('small', {}, `Ended ${fmtDay(c.archived_at.slice(0, 10))}`)),
      actBtn('Put back', '', async () => { await api('POST', `/api/courses/${c.id}/put-back`); courseList(); })))))] : null);
});

const courseEditor = parentOnly(async (cid) => {
  const [data, { profiles }, outline, lib] = await Promise.all([api('GET', '/api/courses'), api('GET', '/api/profiles'), fetch('/content/course.json').then((r) => r.json()), api('GET', '/api/library')]);
  const existing = cid === 'new' ? null : data.courses.find((c) => c.id === cid);
  if (cid !== 'new' && !existing) return go('#/parent/courses');
  const dish = Object.fromEntries(outline.dishes.map((d) => [d.id, d]));
  const written = new Set(data.written), hidden = new Set(data.hidden);
  // Profiles already on another active course can't be picked.
  const taken = new Set(data.courses.filter((c) => !c.archived_at && c.id !== existing?.id).flatMap((c) => c.profile_ids));
  let plan = (existing?.plan ?? data.default_plan).filter((x) => dish[x.id]).map((x) => ({ ...x }));
  const listBox = el('div', { class: 'stack plan' });
  const finishBox = el('p', { class: 'mut small', style: 'margin:0' });
  const notesBox = el('div');

  const startIn = el('input', { type: 'date', name: 'start_date', required: true, value: existing?.start_date ?? weekOf(localToday()) });
  const perIn = el('input', { type: 'number', name: 'per_week', min: 1, max: data.per_week_max, value: existing?.per_week ?? 1, inputmode: 'numeric' });

  const usable = () => plan.filter((x) => !x.removed && written.has(x.id) && !hidden.has(x.id)).length;
  const drawFinish = () => {
    const n = usable(), per = Math.max(1, Number(perIn.value) || 1), start = weekOf(startIn.value || localToday());
    const kept = plan.filter((x) => !x.removed).length;
    finishBox.replaceChildren(n
      ? `${n} lesson${n === 1 ? '' : 's'} ready to cook now, so the schedule runs to the week of ${fmtDay(addDays(start, (Math.ceil(n / per) - 1) * 7))}.`
      : 'None of the lessons kept can be cooked yet.',
    kept > n ? ` ${kept - n} more join the schedule as they're written.` : '');
  };
  startIn.addEventListener('input', drawFinish);
  perIn.addEventListener('input', drawFinish);

  const openParts = new Set();
  const drawPlan = () => {
    const entries = courseEntries(plan.map((x) => dish[x.id]));
    const removed = plan.filter((x) => x.removed).map((x) => x.id);
    const notes = prereqNotes(outline.dishes, { order: entries.map((e) => e.key), removed });
    notesBox.replaceChildren(...(notes.length ? [el('div', { class: 'card notice' }, el('b', {}, 'Heads up'), el('ul', {}, notes.map((n) => el('li', {}, n.text))),
      el('p', { class: 'mut small' }, "These are suggestions. You can keep the order you like."))] : []));
    let n = 0;
    const move = (i, dir) => {
      const j = i + dir;
      if (j < 0 || j >= entries.length) return;
      [entries[i], entries[j]] = [entries[j], entries[i]];
      const byId = Object.fromEntries(plan.map((x) => [x.id, x]));
      plan = entries.flatMap((e) => e.ids.map((id) => byId[id]));
      drawPlan();
    };
    const row = (e, i) => {
      const keptIds = e.ids.filter((id) => !plan.find((x) => x.id === id).removed);
      const num = keptIds.length ? ++n : null;
      const dishRow = (id) => {
        const x = plan.find((y) => y.id === id), d = dish[id];
        const tag = !written.has(id) ? 'Being written' : hidden.has(id) ? 'Hidden by your diet settings' : null;
        return el('div', { class: 'dishpick' },
          el('label', { class: 'choice' },
            el('input', { type: 'checkbox', checked: !x.removed, onchange: (ev) => { x.removed = !ev.target.checked; drawPlan(); } }),
            el('span', {}, d.title, tag ? el('small', { class: 'mut' }, ` · ${tag}`) : null)),
          el('button', { type: 'button', class: 'hbtn link', 'aria-label': `What is ${d.title}?`, onclick: () => showDish(id) }, d.skill ? `${d.skill} ›` : 'What is it? ›'));
      };
      return el('div', { class: `planrow${keptIds.length ? '' : ' out'}` },
        el('div', { class: 'planno' }, num ?? '–'),
        el('div', { class: 'grow' },
          e.pickOne ? el('div', { class: 'planpick' }, foundationMark(), el('small', { class: 'mut' }, ' Pick one, or tick more')) : null,
          e.ids.map(dishRow)),
        el('div', { class: 'planmove' },
          el('button', { type: 'button', class: 'hbtn', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
          el('button', { type: 'button', class: 'hbtn', 'aria-label': 'Move down', disabled: i === entries.length - 1, onclick: () => move(i, 1) }, '↓')));
    };
    // The lessons fold into their paths, closed until opened, so the plan
    // isn't one long scroll. A path stays open while it's being worked on.
    const parts = [];
    entries.forEach((e, i) => {
      const unit = dish[e.ids[0]].unit;
      if (parts.at(-1)?.unit !== unit) parts.push({ unit, items: [] });
      parts.at(-1).items.push([e, i]);
    });
    listBox.replaceChildren(...parts.map((part) => {
      const rows = part.items.map(([e, i]) => row(e, i));
      const ids = part.items.flatMap(([e]) => e.ids);
      const kept = ids.filter((id) => !plan.find((x) => x.id === id).removed).length;
      return el('details', { class: 'planpart', open: openParts.has(part.unit), ontoggle: (ev) => { if (ev.target.open) openParts.add(part.unit); else openParts.delete(part.unit); } },
        el('summary', {}, el('span', {}, el('b', {}, `Path ${part.unit}${lib.units?.[part.unit] ? `: ${lib.units[part.unit]}` : ''}`),
          el('small', {}, `${kept} of ${plural(ids.length, 'dish')} ticked`))),
        el('div', {}, rows));
    }));
    drawFinish();
  };
  drawPlan();

  const extra = [el('a', { class: 'hbtn', href: '#/parent/queue' }, 'Cancel')];
  if (existing && !existing.archived_at) {
    extra.push(actBtn('End this course', 'bad', async () => {
      if (!confirm('End this course? Its lessons leave the queue. You can put it back from Courses.')) return;
      await api('POST', `/api/courses/${existing.id}/end`);
      go('#/parent/courses');
    }));
  }

  parentScreen('courses', el('h2', {}, existing ? 'Edit course' : 'Set up a course'),
    form([
      el('fieldset', {}, el('legend', {}, "Who it's for"),
        el('p', { class: 'mut small', style: 'margin:0' }, 'Siblings can share a course and cook together, or each have their own.'),
        el('div', { class: 'grid2' }, profiles.map((p) => el('label', { class: 'choice' },
          el('input', { type: 'checkbox', name: `p_${p.id}`, checked: existing?.profile_ids.includes(p.id), disabled: taken.has(p.id) }),
          el('span', {}, p.name, taken.has(p.id) ? el('em', {}, ' On another course') : null))))),
      field('Course name', 'name', { value: existing?.name ?? '', maxlength: 60 }, 'Optional'),
      el('div', { class: 'grid2' },
        el('label', { class: 'f' }, 'Start date', el('span', { class: 'hint' }, 'Weeks run Sunday to Friday'), startIn),
        el('label', { class: 'f' }, 'Lessons per week', perIn)),
      finishBox,
      el('fieldset', {}, el('legend', {}, 'The lessons, in order'),
        el('p', { class: 'mut small', style: 'margin:0' }, 'Untick a lesson to leave it out. Foundation skills have a few lessons to pick from: one is ticked, and you can tick more.'),
        notesBox, listBox),
    ], existing ? 'Save course' : 'Start the course', async (v) => {
      const body = {
        name: v.name, start_date: startIn.value, per_week: Number(perIn.value),
        profile_ids: profiles.filter((p) => v[`p_${p.id}`]).map((p) => p.id), plan,
      };
      if (!body.profile_ids.length) throw new Error('Pick who the course is for.');
      await api(existing ? 'PUT' : 'POST', existing ? `/api/courses/${existing.id}` : '/api/courses', body);
      go('#/parent/queue');
    }, { extra, top: true }));
});

// ---------- shopping (§6.3): optional; nothing waits on it ----------

const SECTION_ICON = {
  produce: 's-produce', herbs: 's-produce', 'meat-fish': 's-meat', 'dairy-eggs': 's-dairy', 'bread-tortillas': 's-bakery',
  'grains-pasta': 's-pantry', 'canned-jarred': 's-canned', sauces: 's-canned', 'oils-vinegars': 's-pantry', baking: 's-bakery',
  spices: 's-pantry', specialty: 's-pantry', frozen: 's-frozen',
};
const sectionHead = (sid, name) => el('h4', {}, art(`<svg aria-hidden="true"><use href="/icons.svg#${SECTION_ICON[sid] ?? 's-pantry'}"/></svg>`), name);
const MAY_HAVE = 'May already have';
const usedLine = (x) => el('div', { class: 'rowi' }, el('div', {}, el('b', {}, x.name), el('small', {}, [x.from.join(' · '), x.optional ? 'optional' : null].filter(Boolean).join(' · '))),
  el('span', { class: 'amt' }, x.used ?? ''));

const shopping = parentOnly(async (flash) => {
  const [d, { profiles }, pantry] = await Promise.all([api('GET', `/api/shopping?${tz()}`), api('GET', '/api/profiles'), api('GET', '/api/pantry')]);
  const again = (msg, undo) => shopping(el('p', { class: 'ok flash', role: 'status' }, msg, ' ',
    undo ? el('button', { type: 'button', class: 'hbtn link', onclick: async () => { await undo(); shopping(); } }, 'Undo') : null));
  const names = (ids) => ids.map((id) => profiles.find((p) => p.id === id)?.name ?? 'Someone').join(' & ');
  const weekName = (w) => (w === null ? 'No date set' : w === d.this_week ? `This week · ${fmtDay(w)}` : w === addDays(d.this_week, 7) ? `Next week · ${fmtDay(w)}` : `Week of ${fmtDay(w)}`);

  // Make a shopping list: how many lessons, then their names.
  const max = Math.min(d.list_max, d.upcoming.length);
  const namesBox = el('p', { class: 'mut small', style: 'margin:0', 'aria-live': 'polite' });
  const countSel = el('select', { name: 'count' }, el('option', { value: '' }, 'Pick a number'),
    Array.from({ length: max }, (_, i) => el('option', { value: i + 1 }, `${i + 1} lesson${i ? 's' : ''}`)));
  countSel.addEventListener('change', () => {
    const n = Number(countSel.value);
    namesBox.replaceChildren(n ? `For ${d.upcoming.slice(0, n).map((x) => x.title).join(', ')}` : '');
  });
  let closeMaker = () => {};
  const maker = max
    ? form([el('label', { class: 'f' }, 'How many lessons are you shopping for?', el('span', { class: 'hint' }, 'Counting from the next lesson not cooked yet'), countSel), namesBox],
      'Next', async (v) => {
        if (!v.count) throw new Error('Pick how many lessons.');
        closeMaker();
        go(`#/parent/shopping/new/${v.count}`);
      }, { extra: [el('button', { type: 'button', class: 'hbtn', onclick: () => closeMaker() }, 'Cancel')] })
    : el('p', { class: 'card mut' }, 'Nothing is coming up yet. Queue a lesson, or set up a course.');

  const open = d.lists.filter((l) => !l.done_at), past = d.lists.filter((l) => l.done_at);
  const listRow = (l) => el('div', { class: 'rowi' },
    el('div', {}, el('b', {}, `List from ${fmtDay(l.created_at.slice(0, 10))}`), el('small', {}, `${l.lessons.join(', ')} · ${l.checked} of ${l.total} in the cart`)),
    el('a', { class: 'hbtn', href: `#/parent/shopping/list/${l.id}` }, 'Open'));

  // What you'll need, week by week, each folded until it's opened.
  const weeks = d.weeks.map((w) => el('details', { class: 'card week' },
    el('summary', {}, el('b', {}, weekName(w.week)), el('small', { class: 'mut' }, ` · ${w.lessons.length} lesson${w.lessons.length === 1 ? '' : 's'}`)),
    el('ul', { class: 'weeklessons' }, w.lessons.map((x) => el('li', {}, el('b', {}, x.title), ` · serves ${x.servings}${x.profile_ids.length ? ` · ${names(x.profile_ids)}` : ''}`))),
    w.needs.sections.map((s) => el('div', { class: 'psec' }, sectionHead(s.id, s.name), el('div', { class: 'rows' }, s.items.map(usedLine)))),
    w.needs.may_have.length ? el('div', { class: 'psec' }, el('h4', {}, MAY_HAVE), el('div', { class: 'rows' }, w.needs.may_have.map(usedLine))) : null));

  // Lists, newest first, and what's coming up, one at a time (owner, 2026-10-23).
  const newest = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
  const lists = [
    addHead(null, 'Make a shopping list', () => { closeMaker = max ? modal('Make a shopping list', maker) : modal('Make a shopping list', maker, el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => closeMaker() }, 'Close'))); }),
    open.length ? el('div', { class: 'card' }, el('div', { class: 'rows' }, [...open].sort(newest).map(listRow))) : el('p', { class: 'mut' }, 'No lists open.'),
    past.length ? [el('h3', {}, 'Done lists'), el('div', { class: 'card' }, el('div', { class: 'rows' }, [...past].sort(newest).map(listRow)))] : null,
  ];
  const upcoming = [
    weeks.length ? weeks : el('p', { class: 'mut' }, 'Nothing is coming up yet.'),
    el('p', { class: 'mut small' }, `Kitchen staples are grouped under "${MAY_HAVE}" so you can check the cupboard first.`),
  ];

  // Kitchen staples: the ones the family keeps, each with Remove; more are
  // added by searching for them (owner, 2026-10-23).
  const ingredients = pantry.sections.flatMap((sec) => sec.items.map((i) => ({ ...i, section: sec.name })));
  const byId = Object.fromEntries(ingredients.map((i) => [i.id, i]));
  const have = new Set(pantry.pantry.filter((x) => byId[x]));
  const saveStaples = () => api('PUT', '/api/pantry', { ingredient_ids: [...have] });
  const addStaples = () => {
    const search = el('input', { type: 'search', placeholder: 'Search: olive oil, salt, rice…', 'aria-label': 'Search ingredients', autocomplete: 'off' });
    const results = el('div', { class: 'rows', 'aria-live': 'polite' });
    const added = [];
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      // Names starting with what's typed first, then a word starting with it, then the rest.
      const rank = (name) => (name.startsWith(q) ? 0 : new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name) ? 1 : 2);
      const hits = q ? ingredients.filter((i) => !have.has(i.id) && i.name.toLowerCase().includes(q))
        .sort((a, b) => rank(a.name.toLowerCase()) - rank(b.name.toLowerCase()) || a.name.localeCompare(b.name)).slice(0, 12) : [];
      results.replaceChildren(...(q && !hits.length ? [el('p', { class: 'mut' }, 'No ingredient by that name, or it\'s a staple already.')]
        : hits.map((i) => el('div', { class: 'rowi' }, el('div', {}, el('b', {}, i.name), el('small', {}, i.section)),
          actBtn('Add', 'pri', async () => {
            have.add(i.id);
            await saveStaples();
            added.push(i.name);
            draw();
            search.focus();
          })))));
    };
    search.addEventListener('input', draw);
    const close = modal('Add kitchen staples', search, results,
      el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn pri', onclick: () => { close(); if (added.length) again(`Added ${added.join(', ')} to your kitchen staples.`); } }, 'Done')));
    search.focus();
  };
  const staples = [
    addHead(null, 'Add a staple', addStaples),
    el('p', { class: 'mut small', style: 'margin:0' }, `Things your kitchen usually has. They stay on every list, grouped under "${MAY_HAVE}" so you can check the cupboard first.`),
    have.size ? el('div', { class: 'card' }, el('div', { class: 'rows' }, [...have].map((x) => byId[x]).sort((a, b) => a.name.localeCompare(b.name)).map((i) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, i.name), el('small', {}, i.section)),
      actBtn('Remove', '', async () => {
        have.delete(i.id);
        await saveStaples();
        again(`${i.name} is off your kitchen staples.`, () => { have.add(i.id); return saveStaples(); });
      })))))
      : el('p', { class: 'mut' }, 'No kitchen staples yet.'),
  ];
  const view = el('div', {});
  const show = (which) => {
    view.replaceChildren(...[{ lists, staples }[which] ?? upcoming].flat(2).filter(Boolean));
    toggle.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String(['upcoming', 'lists', 'staples'][i] === which)));
  };
  const toggle = viewToggle('cpr.shop.view', [['upcoming', 'Upcoming'], ['lists', `Lists${open.length ? ` (${open.length})` : ''}`], ['staples', 'Staples']], 'upcoming', show);

  parentScreen('shopping', flash ?? null,
    el('p', { class: 'mut' }, 'See at a glance what ingredients are needed for future queued lessons. You can also generate a shopping list. First select everything you have on-hand already; anything checkmarked will be left off the list.'),
    toggle, view);
  show(sessionGet('cpr.shop.view') ?? 'upcoming');
});

// The preview: tick what's on hand; the rest becomes the list.
const shoppingPreview = parentOnly(async (count) => {
  const p = await api('POST', `/api/shopping/preview?${tz()}`, { count: Number(count) });
  const all = [...p.sections.flatMap((s) => s.items), ...p.may_have];
  const tick = (x) => el('label', { class: 'choice havebox' },
    el('input', { type: 'checkbox', name: `h_${x.id}` }),
    el('span', {}, el('b', {}, x.name), el('small', {}, [x.used ? `Recipes use ${x.used}` : null, x.buy && x.buy !== x.used ? `buy ${x.buy}` : null, x.from.join(' · ')].filter(Boolean).join(' · '))));
  parentScreen('shopping', el('h2', {}, 'Before you make the list'),
    el('p', {}, `For ${p.lessons.map((x) => `${x.title} (serves ${x.servings})`).join(', ')}.`),
    form([
      el('p', { class: 'mut small', style: 'margin:0' }, "Tick anything you already have. It's left off this list only."),
      p.sections.map((s) => el('fieldset', { class: 'psec' }, el('legend', {}, s.name), el('div', { class: 'stack' }, s.items.map(tick)))),
      p.may_have.length ? el('fieldset', { class: 'psec' }, el('legend', {}, MAY_HAVE), el('div', { class: 'stack' }, p.may_have.map(tick))) : null,
    ], 'Create shopping list', async (v) => {
      const res = await api('POST', `/api/shopping/lists?${tz()}`, { keys: p.lessons.map((x) => x.key), on_hand: all.filter((x) => v[`h_${x.id}`]).map((x) => x.id) });
      go(`#/parent/shopping/list/${res.id}`);
    }, { extra: [el('a', { class: 'hbtn', href: '#/parent/shopping' }, 'Back')] }));
});

// The list, in the store: tap to check off, saved as it's tapped.
const shoppingListView = parentOnly(async (lid, flash) => {
  const { list: l } = await api('GET', `/api/shopping/lists/${lid}`);
  const again = (msg, undo) => shoppingListView(lid, el('p', { class: 'ok flash', role: 'status' }, msg, ' ',
    undo ? el('button', { type: 'button', class: 'hbtn link', onclick: async () => { await undo(); shoppingListView(lid); } }, 'Undo') : null));
  const all = [...l.sections.flatMap((s) => s.items), ...l.may_have];
  const checked = new Set(l.checked);
  const count = el('p', { class: 'sub', 'aria-live': 'polite' });
  const drawCount = () => count.replaceChildren(`${all.filter((x) => checked.has(x.id)).length} of ${all.length} in the cart`);
  drawCount();
  const row = (x) => {
    const b = el('button', { type: 'button', class: 'pitem', 'aria-pressed': String(checked.has(x.id)) },
      el('span', { class: 'bx' }, art('<svg aria-hidden="true"><use href="/icons.svg#i-check"/></svg>')),
      el('span', { class: 'nm' }, x.name, el('small', {}, [x.from.join(' · '), x.optional ? 'optional' : null].filter(Boolean).join(' · '))),
      el('span', { class: 'q' }, x.buy ?? '', x.used && x.used !== x.buy ? el('small', {}, x.buy ? `The recipes use ${x.used}` : x.used) : null));
    b.addEventListener('click', async () => {
      const on = !checked.has(x.id);
      if (on) checked.add(x.id); else checked.delete(x.id);
      b.setAttribute('aria-pressed', String(on));
      drawCount();
      try { await api('POST', `/api/shopping/lists/${lid}/check`, { ingredient_id: x.id, checked: on }); } catch (err) {
        if (on) checked.delete(x.id); else checked.add(x.id);
        b.setAttribute('aria-pressed', String(!on));
        drawCount();
        showToast(err.message);
      }
    });
    return b;
  };
  parentScreen('shopping', flash ?? null,
    el('a', { class: 'hbtn link', href: '#/parent/shopping' }, '← Shopping'),
    el('section', { class: 'card shoplist' },
      el('div', {}, el('h2', { style: 'margin:0' }, `Shopping list · ${fmtDay(l.created_at.slice(0, 10))}`), count,
        el('p', { class: 'mut small', style: 'margin:0' }, `For ${l.lessons.map((x) => `${x.title} (serves ${x.servings})`).join(', ')}`)),
      l.sections.map((s) => el('div', { class: 'psec' }, sectionHead(s.id, s.name), s.items.map(row))),
      l.may_have.length ? el('div', { class: 'psec' }, el('h4', {}, MAY_HAVE), l.may_have.map(row)) : null,
      l.on_hand.length ? el('details', { class: 'psec' }, el('summary', {}, `You have these (${l.on_hand.length})`),
        el('div', { class: 'rows' }, l.on_hand.map((x) => el('div', { class: 'rowi' }, el('div', {}, el('b', {}, x.name), el('small', {}, x.used ?? '')),
          actBtn('Put on the list', '', async () => { await api('POST', `/api/shopping/lists/${lid}/on-hand`, { ingredient_id: x.id, on_hand: false }); shoppingListView(lid); }))))) : null,
      el('div', { class: 'acts' },
        l.done_at
          ? actBtn('Not done yet', '', async () => { await api('POST', `/api/shopping/lists/${lid}/not-done`); shoppingListView(lid); })
          : actBtn('Done shopping', 'pri', async () => {
            await api('POST', `/api/shopping/lists/${lid}/done`);
            again('Marked done. It moves to Done lists.', () => api('POST', `/api/shopping/lists/${lid}/not-done`));
          }),
        actBtn('Delete list', '', async () => {
          await api('POST', `/api/shopping/lists/${lid}/delete`);
          shopping(el('p', { class: 'ok flash', role: 'status' }, 'List deleted. ',
            el('button', { type: 'button', class: 'hbtn link', onclick: async () => { await api('POST', `/api/shopping/lists/${lid}/restore`); shoppingListView(lid); } }, 'Undo')));
        }))));
});

// Kitchen staples are the Staples view of Shopping now; old links land there.
const pantryEditor = () => { sessionSet('cpr.shop.view', 'staples'); go('#/parent/shopping'); };

// ---------- Print our progress (§6.15) ----------

const csvCell = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));

const progress = parentOnly(async (which = 'all') => {
  const d = await api('GET', `/api/progress?${tz()}`);
  const shown = which === 'all' ? d.profiles : d.profiles.filter((p) => p.id === which);
  const pick = el('select', { 'aria-label': 'Whose progress', onchange: (e) => progress(e.target.value) },
    el('option', { value: 'all', selected: which === 'all' }, 'Everyone'),
    d.profiles.map((p) => el('option', { value: p.id, selected: p.id === which }, p.name)));
  // The same rows as a spreadsheet, for homeschool records.
  const csv = () => {
    const lines = [['Profile', 'Date', 'Dish', 'Cuisine', 'Skill', 'Rating'],
      ...shown.flatMap((p) => p.rows.map((r) => [p.name, r.date, r.dish, r.cuisine, r.skill, r.rating ?? '']))];
    const blob = new Blob([lines.map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n'], { type: 'text/csv' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `${d.family || 'family'} progress ${localToday()}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  parentScreen('progress',
    el('div', { class: 'acts noprint' }, el('label', { class: 'f inline' }, 'Show', pick),
      el('button', { type: 'button', class: 'hbtn pri', onclick: () => window.print() }, 'Print'),
      el('button', { type: 'button', class: 'hbtn', onclick: csv }, 'Download CSV')),
    el('p', { class: 'mut small noprint' }, 'Print, or save it as a PDF from the print window.'),
    el('section', { class: 'printout' },
      el('h2', {}, `${d.family}: what we've cooked`),
      el('p', { class: 'mut small' }, `Clean Plate Recipes · printed ${fmtDay(localToday(), { year: 'numeric', month: 'long', day: 'numeric' })}`),
      shown.map((p) => el('div', { class: 'ptable' }, el('h3', {}, p.name),
        p.rows.length
          ? el('table', {}, el('thead', {}, el('tr', {}, ['Date', 'Dish', 'Cuisine', 'Skill', 'Rating'].map((h) => el('th', {}, h)))),
            el('tbody', {}, p.rows.map((r) => el('tr', {}, el('td', {}, fmtDay(r.date, { year: 'numeric', month: 'short', day: 'numeric' })), el('td', {}, r.dish), el('td', {}, r.cuisine), el('td', {}, r.skill), el('td', {}, r.rating ? `${r.rating} of 5` : '—')))))
          : el('p', { class: 'mut' }, 'Nothing cooked yet.')))));
});

// ---------- owner screens ----------

const owner = parentOnly(async (flash) => {
  if (!me.parent.is_owner) return go('#/parent');
  const o = await api('GET', '/api/owner');
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString() : '—');
  const setWord = async (word) => {
    const res = await api('PUT', '/api/owner/beta-word', { beta_word: word });
    owner(el('p', { class: 'ok' }, res.beta_word ? `Beta word saved: sign-up asks for "${res.beta_word}".` : 'Beta word off: anyone can sign up.'));
  };

  parentScreen('owner',
    flash ?? null,
    !o.email_ready ? el('p', { class: 'err' }, "Email is not set up yet, so nobody can sign up. See /ops.") : null,

    el('h2', {}, 'Beta word'),
    form([field('Word', 'beta_word', { value: o.beta_word ?? '', autocomplete: 'off', maxlength: 40 },
      o.beta_word ? 'On. Sign-up asks for this word first.' : 'Off. Anyone can sign up. Type a word to require it.')],
    'Save word', (v) => setWord(v.beta_word),
    { extra: o.beta_word ? [el('button', { type: 'button', class: 'hbtn', onclick: () => setWord(null) }, 'Turn off')] : [] }),

    el('h2', {}, `Families (${o.families.length})`),
    el('div', { class: 'card' },
      o.waiting ? el('p', { class: 'mut', style: 'margin:0' }, `${o.waiting} sign-up${o.waiting === 1 ? '' : 's'} waiting on an email code.`) : null,
      o.families.length ? el('div', { class: 'rows' }, o.families.map((f) => el('div', { class: 'rowi' },
        el('div', {}, el('b', {}, f.name || 'Not named yet'), el('small', {}, `${f.profiles} profile${f.profiles === 1 ? '' : 's'} · joined ${day(f.created_at)}`)),
        el('small', {}, `Active ${day(f.last_active_at)}`))))
        : el('p', { class: 'mut' }, 'No families yet.')),

    el('h2', {}, "Set a parent's password"),
    form([
      field('Parent email', 'email', { type: 'email', autocomplete: 'off', required: true }),
      field('New password', 'password', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }),
    ], 'Set password', async (v, f) => {
      await api('POST', '/api/owner/parent-password', v);
      f.reset();
      owner(el('p', { class: 'ok' }, `Password set for ${v.email}. They're logged out everywhere.`));
    }));
});

// ---------- owner: fix requests and lesson patches (§6.11) ----------

const STATUS = { fixed: 'Applied', declined: 'Declined', duplicate: 'Duplicate', needs_content_change: 'Needs a content change' };
const CLOSE_AS = { declined: 'Decline', duplicate: 'Duplicate', needs_content_change: 'Needs a content change' };

const ownerFixes = parentOnly(async (flash) => {
  if (!me.parent.is_owner) return go('#/parent');
  const o = await api('GET', '/api/owner/fixes');
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString() : '');
  const again = (msg) => ownerFixes(el('p', { class: 'ok' }, msg));
  // Shows why a fix can't go live: the checks' own words, one per line.
  const problemsOf = (err) => (err.problems?.length ? el('ul', { class: 'err' }, err.problems.map((x) => el('li', {}, x))) : null);

  const requestCard = (r) => {
    const msg = el('div', { role: 'alert' });
    const show = (err) => msg.replaceChildren(el('p', { class: 'err' }, err.message), problemsOf(err) ?? '');
    const valueBox = r.field ? valueInput(r.field_kind, 'value', toInput(r.field_kind, r.suggested)) : null;
    const replyBox = el('input', { name: 'reply', maxlength: 500, autocomplete: 'off' });
    const act = (label, cls, fn) => el('button', { type: 'button', class: `hbtn ${cls}`, onclick: async (e) => {
      e.target.disabled = true;
      try { await fn(); } catch (err) { show(err); } finally { e.target.disabled = false; }
    } }, label);
    const close = (status, done) => act(CLOSE_AS[status], '', async () => {
      await api('POST', `/api/owner/fixes/${r.id}/close`, { status, reply: replyBox.value });
      again(done);
    });
    const changed = r.field && JSON.stringify(r.live) !== JSON.stringify(r.current);
    return el('div', { class: 'card fixcard' },
      el('div', {}, el('b', {}, `${r.kind_label} · ${r.where}`), el('small', { class: 'mut' }, ` · sent ${day(r.created_at)}${r.servings ? ` · cooking for ${r.servings}` : ''}`)),
      el('p', { style: 'margin:0' }, r.note),
      r.field ? el('div', { class: 'fixcmp' },
        el('div', {}, el('small', { class: 'mut' }, `${r.field_label}, now`), el('p', {}, showValue(r.field_kind, r.live))),
        el('div', {}, el('small', { class: 'mut' }, 'Suggested'), el('p', {}, showValue(r.field_kind, r.suggested)))) : null,
      changed ? el('p', { class: 'mut small', style: 'margin:0' }, `When this was sent it said: ${showValue(r.field_kind, r.current)}`) : null,
      valueBox ? el('label', { class: 'f' }, 'Apply this', el('span', { class: 'hint' }, r.field_kind === 'minutes' ? 'In minutes. Edit it first if you like.' : 'Edit it first if you like.'), valueBox) : null,
      el('label', { class: 'f' }, 'Reply to the family', el('span', { class: 'hint' }, 'Optional. They see it on the lesson.'), replyBox),
      msg,
      el('div', { class: 'acts' },
        r.field ? act('Apply', 'pri', async () => {
          const res = await api('POST', `/api/owner/fixes/${r.id}/apply`, { value: fromInput(r.field_kind, valueBox.value), reply: replyBox.value });
          again(`Applied. ${r.lesson_title} is now version ${res.version} for every family.`);
        }) : null,
        close('declined', 'Declined.'), close('duplicate', 'Marked as a duplicate.'), close('needs_content_change', 'Saved for a content change.')));
  };

  const byLesson = {};
  for (const r of o.open) (byLesson[r.lesson_title] ??= []).push(r);
  const live = o.patches.filter((p) => !p.reverted_at);
  const reverted = o.patches.filter((p) => p.reverted_at);

  parentScreen('fixes',
    flash ?? null,
    el('p', { class: 'mut' }, 'Families suggest fixes from a lesson. Apply puts one live for every family after the same checks as the content linter. Every applied fix has a Revert.'),
    el('h2', {}, `Waiting (${o.open.length})`),
    o.open.length ? Object.entries(byLesson).map(([title, list]) => [el('h3', {}, title), list.map(requestCard)])
      : el('p', { class: 'mut' }, 'Nothing waiting.'),

    el('h2', {}, `Live fixes (${live.length})`),
    live.length ? el('div', { class: 'card' }, el('div', { class: 'rows' }, live.map((p) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, `${p.lesson_title} · ${p.where} · ${p.field_label}`),
        el('small', {}, `${showValue(p.field_kind, p.old)} → ${showValue(p.field_kind, p.new)} · applied ${day(p.applied_at)}`)),
      p.can_revert
        ? el('button', { type: 'button', class: 'hbtn', onclick: async () => {
          try {
            await api('POST', `/api/owner/patches/${p.id}/revert`);
            again(`Reverted. ${p.lesson_title} is back the way it was, and the request is waiting again.`);
          } catch (err) { ownerFixes(el('div', {}, el('p', { class: 'err' }, err.message), problemsOf(err))); }
        } }, 'Revert')
        : el('small', { class: 'mut' }, 'A later fix changed this part. Revert that one first.')))))
      : el('p', { class: 'mut' }, 'No fixes are live.'),

    el('h2', {}, 'Answered'),
    o.closed.length ? el('div', { class: 'card' }, el('div', { class: 'rows' }, o.closed.map((r) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, `${r.lesson_title} · ${r.where} · ${STATUS[r.status]}`), el('small', {}, `${r.note}${r.owner_reply ? ` · You said: ${r.owner_reply}` : ''}`)),
      r.status === 'fixed' ? el('small', { class: 'mut' }, 'Revert it above') : el('button', { type: 'button', class: 'hbtn', onclick: async () => {
        await api('POST', `/api/owner/fixes/${r.id}/reopen`);
        again('Back in the queue.');
      } }, 'Reopen')))))
      : el('p', { class: 'mut' }, 'None yet.'),
    reverted.length ? [el('h2', {}, 'Reverted'), el('div', { class: 'card' }, el('div', { class: 'rows' }, reverted.map((p) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, `${p.lesson_title} · ${p.where} · ${p.field_label}`), el('small', {}, `${showValue(p.field_kind, p.old)} → ${showValue(p.field_kind, p.new)} · reverted ${day(p.reverted_at)}`)), el('span')))))] : null);
});

// ---------- routing ----------

// ---------- family recipes (§6.10) ----------

const UNIT_NAMES = { tsp: 'tsp', tbsp: 'tbsp', cup: 'cup', floz: 'fl oz', ml: 'ml', l: 'liter', oz: 'oz', lb: 'lb', g: 'g', kg: 'kg', count: 'whole (count)' };
const SAFETY_NAMES = { solo: 'Kid can do it alone', 'adult-nearby': 'An adult in the kitchen', 'adult-hands-on': 'An adult helping' };
let registryCache = null;
const contentRegistry = async () => (registryCache ??= await (await fetch('/content/registry.json')).json());

// "1 1/2", "3/4", "2.5" → a number; blank → null ("to taste").
function parseAmount(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  const m = /^(\d+)\s+(\d+)\/(\d+)$/.exec(t);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  const f = /^(\d+)\/(\d+)$/.exec(t);
  if (f) return Number(f[1]) / Number(f[2]);
  return Number(t);
}

// The owner's wording for the leaven flag (§6.10).
const LEAVEN_NOTICE = 'Our automated ingredients checker flagged this as possibly containing leaven, so it will not be presented as an appropriate option for the spring Appointed Time. If you disagree and would like a human review, please click the "Send for review" button.';
const TYPED_NOTICE = 'This recipe has an ingredient that isn\'t in our ingredient list, so a person checks it before it\'s shared. Please click the "Send for review" button.';
const blockedNotice = (words) => `Our automated ingredients checker flagged this as possibly containing an unclean food (${words.join(', ')}), so it can't be saved or shared yet. If it's a false alarm and you would like a human review, please click the "Send for review" button.`;
const badge = (icon, word) => el('span', { class: 'badge' }, art(`<svg class="ico" aria-hidden="true"><use href="/icons.svg#${icon}"/></svg>`), word);

const parentRecipes = parentOnly(async (flash) => {
  const { recipes } = await api('GET', '/api/recipes');
  const again = (msg, undo) => parentRecipes(el('p', { class: 'ok flash', role: 'status' }, msg, ' ',
    undo ? el('button', { type: 'button', class: 'hbtn link', onclick: async () => { await undo(); parentRecipes(); } }, 'Undo') : null));
  const hex = (r) => r.id.slice(7);
  // Where a recipe stands: held, shared, or what came of its review.
  const status = (r) => {
    const out = [];
    if (r.held) out.push('Waiting on a review before it can be cooked or shared');
    if (r.shared) out.push(r.shared.hidden ? 'Shared, but taken out of the directory by the owner' : `Shared as ${r.shared.kind === 'feast' ? 'a feast-day recipe' : 'a general recipe'}`);
    if (r.review?.status === 'pending' && !r.held) out.push('Sent for review');
    if (r.review?.status === 'declined') out.push(`Review declined: "${r.review.owner_reply}"`);
    if (r.source_hidden) out.push('Added from User-shared recipes; it has since been taken out of the directory');
    return out;
  };
  parentScreen('recipes', flash ?? null,
    addHead(null, 'Add a recipe', '#/parent/recipes/new'),
    el('div', { class: 'card' },
      el('p', { class: 'mut' }, "Your family's own recipes. They show in every profile's kitchen and cook in the same player as the lessons. Only your family sees them, unless you share one."),
      recipes.length
        ? el('div', { class: 'rows' }, recipes.map((r) => el('div', { class: 'rowi stacked' },
          el('div', {},
            el('b', {}, el('button', { type: 'button', class: 'hbtn link dishlink', onclick: () => showDish(r.id) }, r.title)),
            el('small', {}, [r.meal, `serves ${r.servings}`, `${r.totalMinutes} min`, r.visible ? null : 'hidden by your diet settings'].filter(Boolean).join(' · ')),
            r.unleavened || r.shared?.kind === 'feast' ? el('div', { class: 'badges' }, r.unleavened ? badge('i-unleavened', 'Unleavened') : null, r.shared?.kind === 'feast' ? badge('i-feast', 'Good for Feast Days') : null) : null,
            status(r).map((t) => el('small', {}, t))),
          el('div', { class: 'acts' },
            el('a', { class: 'hbtn', href: `#/parent/recipes/${hex(r)}` }, 'Edit'),
            r.held ? null : r.shared && !r.shared.hidden
              ? actBtn('Stop sharing', '', async () => { await api('DELETE', `/api/recipes/${hex(r)}/share`); again(`${r.title} is out of the directory.`); })
              : actBtn('Share', '', () => shareRecipe(r)),
            actBtn('Delete', 'bad', async () => {
              await api('DELETE', `/api/recipes/${hex(r)}`);
              again(`Deleted ${r.title}.`, () => api('POST', `/api/recipes/${hex(r)}/restore`));
            })))))
        : el('p', {}, 'No recipes yet.'),
      el('div', { class: 'acts' }, el('a', { class: 'hbtn', href: '#/parent/shared' }, 'User-shared recipes'))));
});

// Share a recipe (§6.10): General or Feast day, then the routine's answer.
function shareRecipe(r) {
  const hex = r.id.slice(7);
  return new Promise((resolve) => {
    const box = el('div', { class: 'card' });
    const fill = (...kids) => box.replaceChildren(...kids.filter(Boolean));
    const close = () => { ov.remove(); resolve(); parentRecipes(); };
    const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Share ${r.title}` }, box);
    const closeBtn = el('button', { type: 'button', class: 'hbtn', onclick: close }, 'Close');
    let kind = 'general';
    const reviewBtn = (reason, review) => {
      const sent = review === 'pending';
      const b = el('button', { type: 'button', class: 'hbtn', disabled: sent }, sent ? 'Sent for review' : 'Send for review');
      b.addEventListener('click', async () => {
        b.disabled = true;
        try { await api('POST', `/api/recipes/${hex}/review`, { reason, kind }); b.textContent = 'Sent for review'; } catch (err) { showToast(err.message); b.disabled = false; }
      });
      return b;
    };
    const answer = (res) => {
      if (res.status === 'shared') {
        fill(el('h2', {}, 'Shared'), el('p', {}, `${r.title} is in User-shared recipes${res.unleavened ? ', with the Unleavened badge' : ''}${kind === 'feast' ? ' and Good for Feast Days' : ''}.`), el('div', { class: 'acts' }, closeBtn));
      } else if (res.status === 'needs_review') {
        fill(el('h2', {}, 'A review first'), el('p', {}, TYPED_NOTICE),
          res.review === 'declined' ? el('p', { class: 'err' }, `The last review was declined: "${res.reply}"`) : null,
          el('div', { class: 'acts' }, reviewBtn('typed_in', res.review), closeBtn));
      } else if (res.status === 'leaven_flag') {
        const shareBtn = actBtn('Share recipe', 'pri', async () => answer(await api('POST', `/api/recipes/${hex}/share`, { kind, without_badge: true })));
        fill(el('h2', {}, 'Possibly leavened'), el('p', {}, LEAVEN_NOTICE),
          res.found?.length ? el('p', { class: 'mut small' }, `It found: ${res.found.join(', ')}.`) : null,
          res.review === 'declined' ? el('p', { class: 'err' }, `The last review was declined: "${res.reply}"`) : null,
          el('div', { class: 'acts' }, reviewBtn('leaven', res.review), shareBtn, closeBtn));
      }
    };
    box.append(el('h2', {}, `Share ${r.title}`),
      el('p', {}, 'It goes into User-shared recipes for every family, with nothing that says who shared it.'),
      el('fieldset', {}, el('legend', {}, 'Share it as'),
        el('div', { class: 'grid2' }, [['general', 'General'], ['feast', 'Feast day']].map(([k, v]) => el('label', { class: 'choice' },
          el('input', { type: 'radio', name: 'kind', value: k, checked: k === kind, onchange: () => { kind = k; } }), el('span', {}, v))))),
      el('div', { class: 'acts' }, actBtn('Share', 'pri', async () => answer(await api('POST', `/api/recipes/${hex}/share`, { kind }))), closeBtn));
    document.body.append(ov);
  });
}

// User-shared recipes (§6.10): the directory every family can search and add from.
const sharedDirectory = parentOnly(async (flash, opts = {}) => {
  const q = opts.q ?? '', feast = Boolean(opts.feast);
  const { recipes } = await api('GET', `/api/shared?q=${encodeURIComponent(q)}${feast ? '&feast=1' : ''}`);
  const reload = (msg) => sharedDirectory(msg ? el('p', { class: 'ok flash', role: 'status' }, msg) : null, { q: search.value, feast: feastBox.checked });
  const search = el('input', { type: 'search', value: q, placeholder: 'Search by name or ingredient', 'aria-label': 'Search' });
  const feastBox = el('input', { type: 'checkbox', checked: feast });
  const shown = recipes.filter((r) => r.visible);
  parentScreen('shared', flash ?? null,
    el('form', { class: 'card', onsubmit: (e) => { e.preventDefault(); reload(); } },
      el('div', { class: 'acts' }, el('div', { class: 'grow' }, search), el('button', { class: 'hbtn pri', type: 'submit' }, 'Search')),
      el('label', { class: 'choice' }, feastBox, el('span', {}, 'Good for Feast Days only'))),
    el('div', { class: 'card' },
      shown.length ? el('div', { class: 'rows' }, shown.map((r) => el('div', { class: 'rowi with-av' },
        el('img', { src: r.image, alt: '', width: 56, height: 56 }),
        el('div', {},
          el('b', {}, el('button', { type: 'button', class: 'hbtn link dishlink', onclick: () => showDish(`shared:${r.id}`) }, r.title)),
          el('small', {}, [r.meal, `serves ${r.servings}`, `${r.totalMinutes} min`, r.mine ? 'shared by your family' : null].filter(Boolean).join(' · ')),
          r.unleavened || r.feast ? el('div', { class: 'badges' }, r.unleavened ? badge('i-unleavened', 'Unleavened') : null, r.feast ? badge('i-feast', 'Good for Feast Days') : null) : null),
        el('div', { class: 'acts' },
          r.mine ? null : r.added ? el('small', { class: 'mut' }, 'In our recipes') : actBtn('Add to our recipes', '', async () => { await api('POST', `/api/shared/${r.id}/add`); reload(`${r.title} is in your recipes.`); }),
          r.mine ? null : actBtn('Report', '', () => reportShared(r, reload)),
          me.parent.is_owner ? actBtn('Hide', 'bad', async () => { await api('POST', `/api/owner/shared/${r.id}/hide`); reload(`Hid ${r.title}. Reported recipes has Unhide.`); }) : null))))
        : el('p', {}, recipes.length ? "Nothing here fits your family's diet settings." : 'No recipes yet.')));
});

// Report a shared recipe: what's wrong, in a few words.
function reportShared(r, done) {
  return new Promise((resolve) => {
    const kinds = { unclean: 'Unclean ingredient', safety: 'Food-safety problem', wrong: 'Wrong or unclear', inappropriate: 'Inappropriate', other: 'Something else' };
    const ov = el('div', { class: 'fixov', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Report ${r.title}` });
    const close = () => { ov.remove(); resolve(); };
    ov.append(form([
      el('h2', {}, `Report ${r.title}`),
      el('label', { class: 'f' }, 'What kind of problem', el('select', { name: 'kind' }, Object.entries(kinds).map(([k, v]) => el('option', { value: k }, v)))),
      el('label', { class: 'f' }, "What's wrong", el('textarea', { name: 'note', rows: 4, maxlength: 1000 })),
    ], 'Send report', async (v) => {
      await api('POST', `/api/shared/${r.id}/report`, v);
      close();
      done('Report sent. Thank you.');
    }, { extra: [el('button', { type: 'button', class: 'hbtn', onclick: close }, 'Cancel')] }));
    document.body.append(ov);
  });
}

// ---------- the owner's recipe screens (§6.2a) ----------

const ownerReviews = parentOnly(async (flash) => {
  const { reviews } = await api('GET', '/api/owner/recipe-reviews');
  const again = (msg) => ownerReviews(el('p', { class: 'ok flash', role: 'status' }, msg));
  const REASONS = { typed_in: 'A typed-in ingredient', leaven: 'Flagged for leaven (feast day)', hard_block: 'A blocked word, sent as a false alarm' };
  const line = (l) => `${l.amount == null ? l.text : `${l.amount} ${l.unit}`} ${l.name ?? l.ingredient}${l.prep ? `, ${l.prep}` : ''}`;
  parentScreen('reviews', flash ?? null,
    reviews.length ? reviews.map((v) => {
      const unlv = el('input', { type: 'checkbox', checked: v.reason === 'leaven' });
      const note = el('input', { maxlength: 500, placeholder: 'A note for the family' });
      return el('div', { class: 'card' },
        el('h2', {}, v.title),
        el('p', {}, el('b', {}, REASONS[v.reason]), ` · to share as ${v.kind === 'feast' ? 'a feast-day recipe' : 'a general recipe'}${v.stale ? ' · edited since it was sent' : ''}`),
        v.blocked.length ? el('p', {}, 'Blocked words: ', el('b', {}, v.blocked.join(', '))) : null,
        v.typed_in.length ? el('p', {}, 'Typed in: ', el('b', {}, v.typed_in.join(', '))) : null,
        v.leaven.length ? el('p', {}, 'Leaven check found: ', el('b', {}, v.leaven.join(', '))) : null,
        el('details', {}, el('summary', {}, 'The whole recipe'),
          el('ul', {}, v.recipe.ingredients.map((l) => el('li', {}, line(l)))),
          el('ol', {}, v.recipe.steps.map((st) => el('li', {}, st.text)))),
        v.reason === 'hard_block' ? el('p', { class: 'mut small' }, 'Clear it only if the word is a false alarm. A review never lets unclean food through.') : el('label', { class: 'choice' }, unlv, el('span', {}, 'Give it the Unleavened badge')),
        el('label', { class: 'f' }, 'Note', note),
        el('div', { class: 'acts' },
          actBtn('Clear', 'pri', async () => { await api('POST', `/api/owner/recipe-reviews/${v.id}/clear`, { unleavened: unlv.checked, note: note.value }); again(`Cleared ${v.title}.`); }),
          actBtn('Decline', 'bad', async () => { await api('POST', `/api/owner/recipe-reviews/${v.id}/decline`, { note: note.value }); again(`Declined ${v.title}.`); })));
    }) : el('div', { class: 'card' }, el('p', {}, 'No recipes waiting.')));
});

const ownerReports = parentOnly(async (flash) => {
  const d = await api('GET', '/api/owner/recipe-reports');
  const again = (msg) => ownerReports(el('p', { class: 'ok flash', role: 'status' }, msg));
  parentScreen('reports', flash ?? null,
    el('div', { class: 'card' }, el('h2', {}, 'Reports'),
      d.reports.length ? el('div', { class: 'rows' }, d.reports.map((r) => el('div', { class: 'rowi' },
        el('div', {}, el('b', {}, el('button', { type: 'button', class: 'hbtn link dishlink', onclick: () => showDish(`shared:${r.recipe_id}`) }, r.title)), el('small', {}, `${r.kind} · ${fmtDay(r.created_at.slice(0, 10))}`), el('p', { style: 'margin:4px 0 0' }, r.note)),
        el('div', { class: 'acts' },
          actBtn('Hide', 'bad', async () => { await api('POST', `/api/owner/shared/${r.recipe_id}/hide`); again(`Hid ${r.title}.`); }),
          actBtn('Dismiss', '', async () => { await api('POST', `/api/owner/recipe-reports/${r.id}/dismiss`); again('Dismissed.'); })))))
        : el('p', {}, 'No open reports.')),
    el('div', { class: 'card' }, el('h2', {}, 'Hidden recipes'),
      d.hidden.length ? el('div', { class: 'rows' }, d.hidden.map((c) => el('div', { class: 'rowi' },
        el('div', {}, el('b', {}, c.title), el('small', {}, `Hidden ${fmtDay(c.hidden_at.slice(0, 10))}`)),
        el('div', { class: 'acts' }, actBtn('Unhide', '', async () => { await api('POST', `/api/owner/shared/${c.id}/unhide`); again(`${c.title} is back in the directory.`); })))))
        : el('p', {}, 'Nothing hidden.')));
});

// The guided entry flow: one thing at a time (§6.10). The draft is kept on
// this device until it's saved, so a closed tab doesn't lose it.
const recipeEditor = parentOnly(async (rid) => {
  const R = await contentRegistry();
  const existing = rid === 'new' ? null : await api('GET', `/api/recipes/${rid}`);
  const draftKey = `cpr.recipe.${rid}`;
  let D;
  try { D = JSON.parse(sessionStorage.getItem(draftKey)); } catch { D = null; }
  D ??= existing ? structuredClone(existing.recipe) : { title: '', servings: me.family.default_servings, totalMinutes: '', mealType: '', why: null, ingredients: [], equipment: [], steps: [] };
  // Wash steps are added on the way in, so they aren't edited here.
  D.steps = D.steps.filter((s) => s.type !== 'wash');
  let page = 0;
  const keep = () => { try { sessionStorage.setItem(draftKey, JSON.stringify(D)); } catch { /* the draft just won't survive a reload */ } };
  const PAGES = ['The basics', 'Ingredients', 'Tools', 'Steps', 'Meal type and how it cooks', 'Review'];
  const ingByName = new Map(Object.values(R.ingredients).map((i) => [i.name.toLowerCase(), i]));
  const unitsFor = (id) => {
    const ing = R.ingredients[id];
    if (!ing) return Object.keys(UNIT_NAMES);
    return [...Object.keys(UNIT_NAMES), ...Object.keys(ing.units ?? {})].filter((u) => toBase(1, u, ing) != null);
  };
  const unitLabel = (u, id) => UNIT_NAMES[u] ?? R.ingredients[id]?.units?.[u]?.one ?? u;
  const bind = (obj, key, fn = (v) => v) => (e) => { obj[key] = fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value); keep(); };

  const pages = [
    // 1. title, servings, time
    () => [
      el('label', { class: 'f' }, 'Recipe name', el('input', { value: D.title, maxlength: 80, oninput: bind(D, 'title') })),
      el('label', { class: 'f' }, 'Serves', el('input', { type: 'number', min: 1, max: 12, inputmode: 'numeric', value: D.servings ?? '', oninput: bind(D, 'servings', Number) })),
      el('label', { class: 'f' }, 'Total time, in minutes', el('input', { type: 'number', min: 1, inputmode: 'numeric', value: D.totalMinutes ?? '', oninput: bind(D, 'totalMinutes', Number) })),
      el('p', { class: 'mut small' }, existing ? 'A picture for its meal type shows on its card.' : 'Next, the ingredients. Pick each one from our list when you can, so it can be scaled, merged on shopping lists, and checked.'),
    ],
    // 2. ingredients
    () => {
      const list = el('datalist', { id: 'ing-names' }, Object.values(R.ingredients).map((i) => el('option', { value: i.name })));
      const row = (l, i) => {
        const name = l.ingredient ? R.ingredients[l.ingredient]?.name ?? l.ingredient : l.name ?? '';
        const unitSel = el('select', { 'aria-label': 'Unit', onchange: bind(l, 'unit') },
          unitsFor(l.ingredient).map((u) => el('option', { value: u, selected: u === l.unit }, unitLabel(u, l.ingredient))));
        const nameIn = el('input', { list: 'ing-names', value: name, 'aria-label': 'Ingredient', placeholder: 'Start typing: flour, carrots…', onchange: (e) => {
          const hit = ingByName.get(e.target.value.trim().toLowerCase());
          if (hit) { l.ingredient = hit.id; delete l.name; } else { delete l.ingredient; l.name = e.target.value.trim(); }
          if (!unitsFor(l.ingredient).includes(l.unit)) l.unit = unitsFor(l.ingredient)[0];
          keep(); draw();
        } });
        return el('div', { class: 'card' },
          el('div', { class: 'acts' }, el('b', { class: 'grow' }, `Ingredient ${i + 1}`),
            el('button', { type: 'button', class: 'hbtn link', onclick: () => { D.ingredients.splice(i, 1); keep(); draw(); } }, 'Remove')),
          el('label', { class: 'f' }, 'What', nameIn),
          l.name ? el('p', { class: 'mut small' }, "That isn't in our ingredient list, so it's kept as you typed it. It won't merge with other recipes on a shopping list.") : null,
          el('div', { class: 'grid2' },
            el('label', { class: 'f' }, 'How much', el('span', { class: 'hint' }, 'Like 2, 1/2, or 1 1/2. Leave it blank for "to taste".'),
              el('input', { inputmode: 'decimal', value: l.amount == null ? '' : String(l.amount), oninput: (e) => { l.amount = parseAmount(e.target.value); if (l.amount != null && !l.unit) l.unit = unitsFor(l.ingredient)[0]; keep(); } })),
            el('label', { class: 'f' }, 'Unit', unitSel)),
          el('label', { class: 'f' }, 'How it\'s prepared', el('span', { class: 'hint' }, 'Optional, like "diced" or "softened"'), el('input', { value: l.prep ?? '', maxlength: 60, oninput: bind(l, 'prep') })),
          el('label', { class: 'choice' }, el('input', { type: 'checkbox', checked: !!l.optional, onchange: bind(l, 'optional') }), el('span', {}, 'Optional')));
      };
      return [list, D.ingredients.map(row),
        el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => { D.ingredients.push({ amount: null, unit: 'cup' }); keep(); draw(); } }, '+ Add an ingredient'))];
    },
    // 3. tools
    () => {
      const byCat = {};
      for (const t of Object.values(R.equipment)) (byCat[t.category] ??= []).push(t);
      return [el('p', {}, 'Tick the tools it needs. They become the tools checklist in Prep.'),
        el('div', { class: 'grid2' }, Object.values(byCat).flat().map((t) => el('label', { class: 'choice' },
          el('input', { type: 'checkbox', checked: D.equipment.includes(t.id), onchange: (e) => {
            D.equipment = e.target.checked ? [...D.equipment, t.id] : D.equipment.filter((x) => x !== t.id); keep();
          } }), el('span', {}, t.name))))];
    },
    // 4. steps
    () => {
      const step = (s, i) => {
        const done = s.target ? (s.target.temp != null ? 'temp' : 'look') : 'none';
        return el('div', { class: 'card' },
          el('div', { class: 'acts' }, el('b', { class: 'grow' }, `Step ${i + 1}`),
            i ? el('button', { type: 'button', class: 'hbtn link', onclick: () => { [D.steps[i - 1], D.steps[i]] = [D.steps[i], D.steps[i - 1]]; keep(); draw(); } }, 'Move up') : null,
            el('button', { type: 'button', class: 'hbtn link', onclick: () => { D.steps.splice(i, 1); keep(); draw(); } }, 'Remove')),
          el('label', { class: 'f' }, 'What to do', el('textarea', { rows: 3, maxlength: 400, oninput: bind(s, 'text') }, s.text ?? '')),
          el('label', { class: 'f' }, 'Who needs to be in the kitchen', el('select', { onchange: (e) => { s.safety = e.target.value; keep(); draw(); } },
            el('option', { value: '' }, 'Pick one'), Object.entries(SAFETY_NAMES).map(([k, v]) => el('option', { value: k, selected: s.safety === k }, v)))),
          s.safety && s.safety !== 'solo' ? el('label', { class: 'f' }, 'The hazard', el('span', { class: 'hint' }, 'A few words an adult profile sees, like "Hot oven" or "Sharp knife"'), el('input', { value: s.hazard ?? '', maxlength: 60, oninput: bind(s, 'hazard') })) : null,
          el('div', { class: 'grid2' },
            el('label', { class: 'f' }, 'Timer, in minutes', el('span', { class: 'hint' }, 'Optional'), el('input', { type: 'number', min: 0, inputmode: 'decimal', value: s.timerSeconds ? s.timerSeconds / 60 : '', oninput: (e) => { s.timerSeconds = e.target.value ? Math.round(Number(e.target.value) * 60) : null; keep(); } })),
            el('label', { class: 'f' }, 'Timer name', el('span', { class: 'hint' }, 'Like "Bake bread"'), el('input', { value: s.timerLabel ?? '', maxlength: 60, oninput: bind(s, 'timerLabel') }))),
          el('label', { class: 'choice' }, el('input', { type: 'checkbox', checked: !!s.raw, onchange: bind(s, 'raw') }),
            el('span', {}, 'This step handles raw meat, poultry, fish, or eggs', el('em', {}, ' A wash-hands step goes after it.'))),
          el('label', { class: 'f' }, 'Is this the "is it done?" check', el('select', { onchange: (e) => { s.target = e.target.value === 'temp' ? { temp: '' } : e.target.value === 'look' ? { look: '' } : null; keep(); draw(); } },
            el('option', { value: 'none', selected: done === 'none' }, 'No'),
            el('option', { value: 'temp', selected: done === 'temp' }, 'Yes, with a thermometer'),
            el('option', { value: 'look', selected: done === 'look' }, 'Yes, by how it looks'))),
          done === 'temp' ? el('label', { class: 'f' }, 'Done at, °F', el('span', { class: 'hint' }, 'Poultry 165, ground meat 160, other meat and fish 145'), el('input', { type: 'number', inputmode: 'numeric', value: s.target.temp ?? '', oninput: (e) => { s.target.temp = e.target.value === '' ? '' : Number(e.target.value); keep(); } })) : null,
          done === 'look' ? el('label', { class: 'f' }, 'It\'s done when…', el('input', { value: s.target.look ?? '', maxlength: 200, oninput: (e) => { s.target.look = e.target.value; keep(); } })) : null);
      };
      return [D.steps.map(step), el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => { D.steps.push({ text: '', safety: '' }); keep(); draw(); } }, '+ Add a step'))];
    },
    // 5. meal type and the "why we make this" card
    () => [
      el('fieldset', {}, el('legend', {}, 'What kind of dish is it?'), el('p', { class: 'mut small', style: 'margin:0' }, 'It picks the picture on its card.'),
        el('div', { class: 'grid2' }, MEAL_TYPES.map(([k, v]) => el('label', { class: 'choice' },
          el('input', { type: 'radio', name: 'meal', value: k, checked: D.mealType === k, onchange: () => { D.mealType = k; keep(); } }),
          el('img', { src: `img/meals/${k}.svg`, alt: '', width: 40, height: 40 }), el('span', {}, v))))),
      el('fieldset', {}, el('legend', {}, 'How does it cook?'),
        el('div', { class: 'grid2' }, METHODS.map((k) => el('label', { class: 'choice' },
          el('input', { type: 'radio', name: 'method', value: k, checked: D.method === k, onchange: () => { D.method = k; keep(); } }), el('span', {}, METHOD_NAMES[k]))))),
      el('h3', {}, 'Why we make this'),
      el('p', { class: 'mut small' }, 'Optional. A card your kids see before they cook, like a lesson\'s Learn stage: where the recipe comes from, or why your family makes it.'),
      el('label', { class: 'f' }, 'Card title', el('input', { value: D.why?.title ?? '', maxlength: 60, oninput: (e) => { D.why = { ...(D.why ?? {}), title: e.target.value }; keep(); } })),
      el('label', { class: 'f' }, 'Card words', el('textarea', { rows: 4, maxlength: 400, oninput: (e) => { D.why = { ...(D.why ?? {}), body: e.target.value }; keep(); } }, D.why?.body ?? '')),
    ],
    // 6. review: the server's checks, then save
    () => {
      const box = el('div', {}, el('p', { class: 'mut' }, 'Checking…'));
      api('POST', '/api/recipes/check', { ...D, id: existing ? rid : undefined }).then((c) => {
        const r = c.recipe;
        box.replaceChildren(
          // Only a blocked word wrong: it may be a false alarm, for the owner to review (§6.10).
          c.reviewable
            ? el('div', { class: 'card notice', role: 'alert' }, el('p', {}, blockedNotice(c.blocked)),
              el('div', { class: 'acts' }, actBtn('Send for review', '', async () => {
                const res = existing ? await api('PUT', `/api/recipes/${rid}`, { ...D, send_for_review: true }) : await api('POST', '/api/recipes', { ...D, send_for_review: true });
                try { sessionStorage.removeItem(draftKey); } catch { /* nothing kept */ }
                parentRecipes(el('p', { class: 'ok flash', role: 'status' }, `Saved ${r.title} and sent it for review. It can be cooked once it's cleared.`));
                return res;
              })))
            : c.problems.length
              ? el('div', { class: 'card notice', role: 'alert' }, el('h3', {}, 'A few things to fix first'), el('ul', {}, c.problems.map((p) => el('li', {}, p))))
              : el('p', { class: 'ok' }, 'Everything checks out.'),
          el('h3', {}, r.title || 'Untitled'),
          el('p', { class: 'mut' }, `Serves ${r.servings} · ${r.totalMinutes} min`),
          el('ul', {}, r.ingredients.map((l) => el('li', {}, `${l.amount == null ? l.text : `${[8, 3].some((d) => Math.abs(l.amount * d - Math.round(l.amount * d)) < 1e-6) && !/^0$/.test(mixed(l.amount)) ? mixed(l.amount) : l.amount} ${unitLabel(l.unit, l.ingredient)}`} ${l.ingredient ? R.ingredients[l.ingredient]?.name.toLowerCase() : l.name}${l.prep ? `, ${l.prep}` : ''}${l.optional ? ' (optional)' : ''}`))),
          el('ol', {}, r.steps.map((s) => el('li', {}, s.text, s.type === 'wash' ? el('small', { class: 'mut' }, ' (added for you)') : null))),
          c.problems.length ? null : el('div', { class: 'acts' }, actBtn(existing ? 'Save changes' : 'Save recipe', 'pri', async () => {
            const res = existing ? await api('PUT', `/api/recipes/${rid}`, D) : await api('POST', '/api/recipes', D);
            try { sessionStorage.removeItem(draftKey); } catch { /* nothing kept */ }
            parentRecipes(el('p', { class: 'ok flash', role: 'status' }, `Saved ${r.title}. It's in every profile's kitchen.`));
            return res;
          })));
      }, (err) => box.replaceChildren(el('p', { class: 'err' }, err.message)));
      return box;
    },
  ];

  const body = el('div', {});
  function draw() {
    body.replaceChildren(el('div', { class: 'card' },
      el('p', { class: 'mut small' }, `${page + 1} of ${PAGES.length}`),
      el('h2', {}, PAGES[page]),
      pages[page](),
      el('div', { class: 'acts' },
        page ? el('button', { type: 'button', class: 'hbtn', onclick: () => { page--; draw(); window.scrollTo(0, 0); } }, 'Back') : el('a', { class: 'hbtn', href: '#/parent/recipes' }, 'Cancel'),
        page < PAGES.length - 1 ? el('button', { type: 'button', class: 'hbtn pri', onclick: () => { page++; draw(); window.scrollTo(0, 0); } }, 'Next') : null)));
  }
  draw();
  parentScreen('recipes', el('a', { class: 'hbtn link', href: '#/parent/recipes' }, '← Our recipes'),
    existing ? null : el('p', { class: 'mut' }, 'Add your family\'s recipe one thing at a time. Nothing is saved until the last step.'), body);
});

async function refresh() {
  me = await api('GET', '/api/me');
}

async function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const [top, sub, extra] = parts;
  try {
    if (top === 'reset' && sub) return reset(sub);
    if (!me?.signed_in) {
      if (top === 'login') return login();
      if (top === 'signup' && sub === 'code') return signupCode();
      if (top === 'signup') return await signup();
      if (top === 'forgot') return forgot();
      return welcome();
    }
    if (!me.family.pin_set) return firstRun();
    if (top === 'kitchen' && sub && extra?.startsWith('@')) return await kitchen(sub, extra.slice(1));
    if (top === 'kitchen' && sub && extra) return await lesson(sub, decodeURIComponent(extra));
    if (top === 'kitchen' && sub) return await kitchen(sub);
    if (top === 'parent') {
      if (sub === 'profiles' && extra) return await profileEditor(extra);
      if (sub === 'courses' && extra) return await courseEditor(extra);
      if (sub === 'recipes' && extra) return await recipeEditor(extra);
      if (sub === 'recipes') return await parentRecipes();
      if (sub === 'shared') return await sharedDirectory();
      if (sub === 'reviews') return await ownerReviews();
      if (sub === 'reports') return await ownerReports();
      if (sub === 'courses') return await courseList();
      if (sub === 'queue') return await parentQueue();
      if (sub === 'shopping' && extra === 'new') return await shoppingPreview(parts[3]);
      if (sub === 'shopping' && extra === 'list') return await shoppingListView(parts[3]);
      if (sub === 'shopping') return await shopping();
      if (sub === 'pantry') return await pantryEditor();
      if (sub === 'progress') return await progress(extra);
      if (sub === 'family') return await familySettings();
      if (sub === 'parents') return await parentLogins();
      if (sub === 'owner') return await owner();
      if (sub === 'fixes') return await ownerFixes();
      if (sub === 'profiles') return await parentProfiles();
      return await parentQueue();
    }
    if (top === 'owner') return go('#/parent/owner');
    return await lockers();
  } catch (err) {
    if (err.code === 'signed_out') { me = null; return welcome(); }
    if (err.code === 'pin_required') { await refresh(); return route(); }
    screen(topbar(), el('div', { class: 'card narrow' }, el('h1', {}, 'Something went wrong'), el('p', { class: 'err' }, err.message),
      el('div', { class: 'acts' }, el('button', { class: 'hbtn', type: 'button', onclick: () => start(location.hash) }, 'Try again'))));
  }
}

async function start(hash) {
  try {
    await refresh();
  } catch (err) {
    return screen(topbar(), el('div', { class: 'card narrow' }, el('h1', {}, 'Not ready yet'), el('p', {}, err.message)));
  }
  // Cooks saved on this device while offline or signed out go up now.
  if (me.signed_in) flushCooks();
  if (hash !== undefined && location.hash !== hash) location.hash = hash;
  else route();
}

// A button's failed request shows its message instead of failing silently.
const toast = el('p', { class: 'toast err', role: 'alert', hidden: true });
document.body.append(toast);
function showToast(message) {
  toast.textContent = message || 'Something went wrong. Try again.';
  toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toast.hidden = true; }, 6000);
}
window.addEventListener('unhandledrejection', (e) => showToast(e.reason?.message));

window.addEventListener('hashchange', route);
start();
