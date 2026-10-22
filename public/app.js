// Clean Plate Recipes, the app. Plain ES module, no build step. Screens are
// built with el(), which only ever sets text, so nothing a family types is
// parsed as markup. Routes live in the hash: #/login, #/kitchen/<id>, #/parent…
import { openLesson } from './player.js';
import { saveCook, flushCooks } from './cooks.js';
import { patchTargets, showValue } from './lib/patch.js';
import { courseEntries, prereqNotes } from './lib/course.js';

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

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { return null; }
  return value;
}

// A form whose submit calls fn(values), shows its error, and disables the button while it runs.
function form(fields, submitText, fn, { extra = [] } = {}) {
  const msg = el('p', { class: 'err', role: 'alert', hidden: true });
  const btn = el('button', { class: 'hbtn pri', type: 'submit' }, submitText);
  const f = el('form', { class: 'card', novalidate: true }, ...fields, msg, el('div', { class: 'acts' }, btn, ...extra));
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

async function kitchen(id) {
  const [{ profiles }, lib] = await Promise.all([api('GET', '/api/profiles'), api('GET', '/api/library')]);
  const p = profiles.find((x) => x.id === id);
  if (!p) return go('#/');
  const [{ cooks }, mine] = await Promise.all([api('GET', `/api/profiles/${p.id}/cooks`), api('GET', `/api/profiles/${p.id}/queue?${tz()}`)]);
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
    // Stamps and crests for a cooked lesson come with course progress (Phase 5).
    const done = cooks[L.id];
    const cooked = done ? el('p', { class: quest ? 'q-swap k-cooked' : 'p-swap k-cooked' },
      art('<svg class="ico" aria-hidden="true"><use href="/icons.svg#i-check"/></svg>'),
      done.times === 1 ? 'Cooked once' : `Cooked ${done.times} times`) : null;
    if (quest) {
      return el('article', { class: 'q-panel q-card' },
        el('p', { class: 'q-kick' }, `Path ${L.unit} · Quest ${L.label}`),
        el('div', { class: 'q-win' }, el('img', { src: L.image, alt: '', width: 230, height: 230, loading: 'lazy' })),
        el('h3', { class: 'q-title' }, L.title),
        el('p', { class: 'q-skill' }, L.skill),
        el('dl', { class: 'q-stats' },
          el('div', {}, el('dt', {}, 'Time'), el('dd', {}, time)),
          el('div', {}, el('dt', {}, 'Serves'), el('dd', {}, L.servings)),
          el('div', {}, el('dt', {}, 'From'), el('dd', {}, L.cuisine))),
        swaps ? el('p', { class: 'q-swap' }, `Made with ${swaps}`) : null,
        skip ? el('p', { class: 'q-swap' }, skip) : null,
        cooked);
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
      cooked);
  };

  const units = [...new Set(lib.lessons.map((l) => l.unit))].sort((a, b) => a - b);
  const body = units.length
    ? units.map((u) => [
      el('h2', { class: 'k-unit' }, quest ? `Path ${u}: ${lib.units[u]}` : lib.units[u]),
      el('div', { class: 'k-lib' }, lib.lessons.filter((l) => l.unit === u).map((L) => el('button', { type: 'button', class: 'lesson', 'aria-label': `Open ${L.title}`, onclick: () => go(`#/kitchen/${p.id}/${L.id}`) }, card(L)))),
    ])
    : el('div', { class: quest ? 'q-panel k-empty' : 'p-card k-empty' }, 'No lessons match this family\'s diet settings yet.');

  // Up next: this profile's queued lessons. Kids see "due Friday" in
  // homeschool mode and never anything about being late (§6.17).
  const when = (x) => (x.status === 'requested' ? 'You asked a grown-up'
    : x.due && !isSabbath() ? `Due ${fmtDay(x.due, { weekday: 'long' })}`
      : x.when === 'this-week' ? 'This week' : x.when === 'next-week' ? 'For next week'
        : x.planned_date ? fmtDay(x.planned_date) : 'Coming up');
  const upNext = mine.items.length ? [
    el('h2', { class: 'k-unit' }, quest ? 'Next quests' : 'Up next'),
    el('div', { class: 'k-lib' }, mine.items.map((x) => el('button', { type: 'button', class: 'lesson', 'aria-label': `Open ${x.title}`, onclick: () => go(`#/kitchen/${p.id}/${x.lesson_id}`) },
      el('article', { class: quest ? 'q-panel q-card k-next' : 'p-card k-next' },
        el('p', { class: quest ? 'q-kick' : 'p-lessonno' }, x.label ? `${quest ? 'Quest' : 'Lesson'} ${x.label}` : ''),
        el('h3', { class: quest ? 'q-title' : 'p-title' }, x.title),
        el('p', { class: quest ? 'q-swap' : 'p-swap' }, when(x)))))),
  ] : null;

  screen(el('section', { class: 'kitchen', 'data-kt': p.theme },
    el('a', { class: 'back', href: '#/' }, '← Lockers'),
    sabbathBanner(),
    el('div', { class: 'k-head' }, avatars(p.people),
      el('div', { class: 'grow' }, el('h1', {}, quest ? 'Quest board' : 'Recipe box'), el('div', {}, p.name))),
    el('div', { class: 'acts' },
      el('button', { class: 'themebtn', type: 'button', onclick: async () => {
        await api('PUT', `/api/profiles/${p.id}/theme`, { theme: other });
        kitchen(id);
      } }, `Switch to ${THEMES[other]}`)),
    upNext, body));
}

// A lesson, played in the profile's theme (player.js).
async function lesson(profileId, lessonId) {
  const [{ profiles }, lib] = await Promise.all([api('GET', '/api/profiles'), api('GET', '/api/library')]);
  const p = profiles.find((x) => x.id === profileId);
  if (!p) return go('#/');
  const mine = await api('GET', `/api/profiles/${p.id}/queue?${tz()}`).catch(() => ({ items: [] }));
  const queued = mine.items.find((x) => x.lesson_id === lessonId);
  const mount = el('div');
  screen(mount);
  await openLesson(mount, {
    profile: p, family: me.family, lessonId, onExit: () => go(`#/kitchen/${p.id}`),
    crew: profiles.filter((x) => x.id !== p.id), onCook: saveCook, labels: mine.labels ?? lib.labels, total: mine.total ?? lib.total,
    // "I want to make this" or "Cook this" (§6.1), and the queued lesson's
    // servings and who it's for, for a fresh cook.
    ask: {
      status: queued?.status ?? null,
      send: async () => {
        try { return (await api('POST', `/api/profiles/${p.id}/ask`, { lesson_id: lessonId })).status; } catch (err) { showToast(err.message); throw err; }
      },
    },
    seed: queued ? { servings: queued.servings, with: (queued.profile_ids ?? []).filter((x) => x !== p.id), shopped: queued.shopped_for } : null,
    fixes: {
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

function parentTabs(current) {
  const tabs = [['queue', 'Queue'], ['shopping', 'Shopping'], ['courses', 'Courses'], ['profiles', 'Profiles'], ['family', 'Family'], ['parents', 'Logins']];
  if (me.parent.is_owner) tabs.push(['owner', 'Owner'], ['fixes', 'Fix requests']);
  return el('nav', { class: 'tabs', 'aria-label': 'Parent screens' },
    tabs.map(([k, label]) => el('a', { href: `#/parent/${k}`, 'aria-current': k === current ? 'page' : null }, label)));
}

function parentScreen(current, ...kids) {
  screen(topbar(me.family.name,
    el('a', { class: 'hbtn', href: '#/' }, 'Lockers'),
    el('button', { class: 'hbtn', type: 'button', onclick: async () => { await api('POST', '/api/pin/lock'); await refresh(); go('#/'); } }, 'Lock'),
    el('button', { class: 'hbtn', type: 'button', onclick: async () => { await api('POST', '/api/logout'); store('cpr.profile', null); await start('#/'); } }, 'Log out')),
  el('h1', {}, 'Parents'), parentTabs(current), sabbathBanner(), ...kids);
}

const parentProfiles = parentOnly(async () => {
  const { profiles } = await api('GET', '/api/profiles');
  parentScreen('profiles', el('div', { class: 'card' },
    profiles.length ? el('div', { class: 'rows' }, profiles.map((p) => el('div', { class: 'rowi with-av' },
      avatars(p.people),
      el('div', {}, el('b', {}, p.name), el('small', {}, `${p.audience === 'adult' ? 'Adult' : 'Kid'} · ${THEMES[p.theme]} · ${p.people.map((x) => x.name).join(', ')}`)),
      el('a', { class: 'hbtn', href: `#/parent/profiles/${p.id}` }, 'Edit'))))
      : el('p', { class: 'mut' }, 'No profiles yet.'),
    el('div', { class: 'acts' }, el('a', { class: 'hbtn pri', href: '#/parent/profiles/new' }, 'Add a profile'))));
});

const profileEditor = parentOnly(async (id) => {
  const { profiles } = await api('GET', '/api/profiles');
  const existing = id === 'new' ? null : profiles.find((p) => p.id === id);
  if (id !== 'new' && !existing) return go('#/parent/profiles');
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

  const extra = [el('a', { class: 'hbtn', href: '#/parent/profiles' }, 'Cancel')];
  if (existing) {
    extra.push(el('button', { type: 'button', class: 'hbtn bad', onclick: async () => {
      if (!confirm(`Delete ${existing.name}?`)) return;
      await api('DELETE', `/api/profiles/${existing.id}`);
      go('#/parent/profiles');
    } }, 'Delete'));
  }

  parentScreen('profiles', el('h2', {}, existing ? `Edit ${existing.name}` : 'Add a profile'),
    form([
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
      go('#/parent/profiles');
    }, { extra }));
});

const familySettings = parentOnly(async () => {
  const f = await api('GET', '/api/family');
  const saved = el('p', { class: 'ok', hidden: true }, 'Saved.');
  parentScreen('family', form([
    field('Family name', 'name', { value: f.family.name, required: true, maxlength: 60 }),
    field('Default servings', 'default_servings', { type: 'number', min: 1, max: f.servings_max, value: f.family.default_servings, inputmode: 'numeric' }, 'Recipes scale to this'),
    el('fieldset', {}, el('legend', {}, 'Leave out'),
      el('p', { class: 'mut small', style: 'margin:0' }, 'Lessons with these are hidden, unless a lesson has a swap for them.'),
      el('div', { class: 'grid2' }, f.diet_tags.map((t) => el('label', { class: 'choice' },
        el('input', { type: 'checkbox', name: `diet_${t}`, checked: f.family.diet_filters.includes(t) }), el('span', {}, DIET[t] ?? t))))),
    el('fieldset', {}, el('legend', {}, 'How you use the app'),
      el('div', { class: 'grid2' },
        el('label', { class: 'choice' }, el('input', { type: 'radio', name: 'mode', value: 'casual', checked: f.family.mode !== 'homeschool' }), el('span', {}, 'Casual', el('em', {}, ' Cook when you like'))),
        el('label', { class: 'choice' }, el('input', { type: 'radio', name: 'mode', value: 'homeschool', checked: f.family.mode === 'homeschool' }), el('span', {}, 'Homeschool', el('em', {}, ' A course with due dates')))),
      el('label', { class: 'choice' }, el('input', { type: 'checkbox', name: 'plan_weeks', checked: f.family.plan_weeks }),
        el('span', {}, 'Plan our weeks', el('em', {}, ' In casual mode: set up a course, and each week\'s lessons load into the queue. Homeschool mode always does.'))),
      el('p', { class: 'mut small', style: 'margin:0' }, 'Switching never deletes anything.')),
    el('fieldset', {}, el('legend', {}, 'Voice step control'),
      el('p', { class: 'mut small', style: 'margin:0' },
        'In cook mode, kids can say "next," "back," or "again" instead of tapping. It works in Chrome on Android, and on other devices whose browser can recognize speech. ',
        'The browser usually sends what the mic hears to Google to recognize it, so it stays off until you turn it on.'),
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
  }));
});

const parentLogins = parentOnly(async () => {
  const f = await api('GET', '/api/family');
  parentScreen('parents',
    el('div', { class: 'card' }, el('h3', {}, 'Parent logins'),
      el('div', { class: 'rows' }, f.parents.map((e) => el('div', { class: 'rowi' }, el('b', {}, e), e === me.parent.email ? el('small', {}, 'You') : el('span'))))),
    el('h2', {}, 'Add another parent'),
    form([
      field('Their email', 'email', { type: 'email', autocomplete: 'off', required: true }),
      field('A password for them', 'password', { type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }, 'At least 8 characters. They can change it with Forgot password.'),
    ], 'Add parent', async (v) => {
      await api('POST', '/api/parents', v);
      parentLogins();
    }),
    el('h2', {}, 'Parent PIN'),
    el('div', { class: 'card' }, el('div', { class: 'acts' }, el('button', { type: 'button', class: 'hbtn', onclick: () => forgotPin(() => go('#/parent/parents')) }, 'Change the PIN'))));
});

// ---------- the queue (§6.2) and courses (§6.18) ----------

const SAFETY = { 'adult-nearby': 'Adult nearby', 'adult-hands-on': 'Adult hands-on', solo: 'On their own' };
const foundationMark = () => el('span', { class: 'found' }, art('<svg class="ico" aria-hidden="true"><use href="/icons.svg#i-shield"/></svg>'), 'Foundation');
const lessonName = (x) => [x.label ? `${x.label} · ` : '', x.title];

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
  const requests = q.requests.map((r) => el('div', { class: 'card qcard' },
    el('div', {}, el('b', {}, `${pname(r.requested_by)} asked for `, ...lessonName(r)), r.foundation ? foundationMark() : null,
      el('small', { class: 'mut' }, ` · ${fmtDay(r.created_at.slice(0, 10))}`)),
    r.already_queued ? el('p', { class: 'mut small', style: 'margin:0' }, `It's already on ${pname(r.requested_by)}'s list, so Not now is fine.`) : null,
    safetyReview(r.lesson_id), tested(r.lesson_id),
    el('div', { class: 'acts' },
      servingsPick(r, setServings(r.id)),
      actBtn('Approve', 'pri', async () => { await api('POST', `/api/queue/${r.id}/approve`); again(`${r.title} is on ${pname(r.requested_by)}'s list.`); }),
      actBtn('Not now', '', async () => {
        await api('POST', `/api/queue/${r.id}/decline`);
        again(`Not now for ${r.title}.`, () => api('POST', `/api/queue/${r.id}/put-back`));
      }))));

  // ---- courses ----
  const courseBox = (c) => {
    const behind = c.weeks_behind ? `${c.weeks_behind} week${c.weeks_behind === 1 ? '' : 's'} behind` : 'On track';
    const lessonRow = (x, week) => el('div', { class: x.done ? 'rowi' : 'rowi qrow' },
      el('div', {}, el('b', {}, ...lessonName(x)), x.foundation ? foundationMark() : null,
        el('small', {}, x.done ? 'Cooked'
          : x.extra ? 'Extra, this week only'
            : isSabbath() || !homeschool ? 'This week'
              : [x.overdue ? el('span', { class: 'late' }, 'Overdue · ') : null, `Due ${fmtDay(addDays(week, c.due_day))}`].filter(Boolean)),
        x.done ? null : el('div', { class: 'qtools' }, safetyReview(x.lesson_id), tested(x.lesson_id))),
      x.done ? el('span', { class: 'mut' }, '✓') : el('div', { class: 'acts' },
        x.queue_id ? servingsPick(x, setServings(x.queue_id)) : null,
        actBtn('Skip this recipe', '', async () => {
          await api('POST', `/api/courses/${c.id}/skip-recipe`, { lesson_id: x.lesson_id });
          again(`Skipped ${x.title}. The next lesson takes its place.`, () => api('POST', `/api/courses/${c.id}/put-back-recipe`, { lesson_id: x.lesson_id }));
        })));
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
      c.started ? [
        el('h4', {}, `This week · ${fmtDay(tw.week)} to ${fmtDay(addDays(tw.week, 5))}`),
        tw.skipped ? el('p', { class: 'mut' }, 'Skipped. Everything moved back a week.')
          : tw.lessons.length ? el('div', { class: 'rows' }, tw.lessons.map((x) => lessonRow(x, tw.week)))
            : el('p', { class: 'mut' }, 'Nothing left this week.'),
        el('div', { class: 'acts' },
          tw.skipped
            ? actBtn('Put this week back', '', async () => { await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, skipped: false }); again('This week is back.'); })
            : [
              c.done + tw.lessons.filter((x) => !x.done).length < c.total ? actBtn('Cook another recipe', '', async () => {
                await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, extra: 1 });
                again('Added the next lesson to this week, for this week only.', () => api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, extra: -1 }));
              }) : null,
              actBtn('Skip this week', '', async () => {
                await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, skipped: true });
                again('Skipped this week. Everything moves back a week.', () => api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: tw.week, skipped: false }));
              }),
            ]),
      ] : null,
      c.next_week ? [
        el('h4', {}, `Next week · ${fmtDay(c.next_week.week)}`),
        c.next_week.skipped ? el('p', { class: 'mut' }, 'Skipped.') : el('div', { class: 'rows' }, c.next_week.lessons.map((x) => el('div', { class: 'rowi' },
          el('div', {}, el('b', {}, ...lessonName(x)), x.foundation ? foundationMark() : null),
          x.queue_id ? servingsPick(x, setServings(x.queue_id)) : el('span')))),
        el('div', { class: 'acts' }, actBtn(c.next_week.skipped ? 'Put next week back' : 'Skip next week', '', async () => {
          await api('POST', `/api/courses/${c.id}/week?${tz()}`, { week: c.next_week.week, skipped: !c.next_week.skipped });
          parentQueue();
        })),
      ] : el('p', { class: 'mut small' }, `Next week's lessons show here from ${fmtDay(c.next_week_from, { weekday: 'long' })}, so you can shop for them.`),
      c.skipped_recipes.length ? [el('h4', {}, 'Skipped recipes'), el('div', { class: 'rows' }, c.skipped_recipes.map((x) => el('div', { class: 'rowi' },
        el('b', {}, x.title), actBtn('Put back', '', async () => { await api('POST', `/api/courses/${c.id}/put-back-recipe`, { lesson_id: x.lesson_id }); again(`${x.title} is back in the course.`); }))))] : null);
  };

  // ---- lessons queued by hand ----
  const queuedRow = (x) => el('div', { class: 'rowi qrow' },
    el('div', {}, el('b', {}, ...lessonName(x)), x.foundation ? foundationMark() : null,
      el('small', {}, `For ${names(x.profile_ids)}${x.planned_date ? ` · ${fmtDay(x.planned_date)}` : ''}${x.status === 'shopped' ? ' · Shopped for' : ''}`),
      el('div', { class: 'qtools' }, safetyReview(x.lesson_id), tested(x.lesson_id))),
    el('div', { class: 'acts' }, servingsPick(x, setServings(x.id)),
      actBtn('Remove', '', async () => {
        await api('DELETE', `/api/queue/${x.id}`);
        again(`Took ${x.title} off the queue.`, () => api('POST', `/api/queue/${x.id}/put-back`));
      })));

  // ---- add a lesson ----
  const note = el('p', { class: 'mut small note', hidden: true }, 'Most lessons use knife work. We suggest a Unit 1 lesson first.');
  const lessonSel = el('select', { name: 'lesson_id', required: true },
    el('option', { value: '' }, 'Pick a lesson'),
    q.library.map((L) => el('option', { value: L.id }, `${L.label ? `${L.label} · ` : ''}${L.title}${L.foundation ? ' (foundation)' : ''}`)));
  const who = el('div', { class: 'grid2' }, profiles.map((p) => el('label', { class: 'choice' },
    el('input', { type: 'checkbox', name: `p_${p.id}`, value: p.id }), el('span', {}, p.name))));
  // The knife-work note (§4.0): a suggestion, not a block.
  const checkNote = () => {
    const L = q.library.find((x) => x.id === lessonSel.value);
    const picked = profiles.filter((p) => who.querySelector(`[name="p_${p.id}"]`).checked).map((p) => p.id);
    note.hidden = !L || L.unit === 1 || !picked.length || picked.some((pid) => q.knife_ok.includes(pid));
  };
  lessonSel.addEventListener('change', checkNote);
  who.addEventListener('change', checkNote);
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
    const L = q.library.find((x) => x.id === v.lesson_id);
    const n = Number(v.servings);
    // A lesson with set sizes takes the nearest one it offers.
    const servings = L.servings_options.includes(n) ? n : L.servings_options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
    await api('POST', '/api/queue', { lesson_id: v.lesson_id, profile_ids: ids, servings, planned_date: v.planned_date || null });
    again(`${L.title} is in the queue${servings !== n ? `, serving ${servings} (the nearest size it makes)` : ''}.`);
  });

  const courses = q.weeks_on
    ? (q.courses.length ? q.courses.map(courseBox)
      : el('div', { class: 'card' }, el('p', {}, homeschool ? 'Homeschool mode plans your weeks from a course.' : 'Plan our weeks is on.'),
        el('div', { class: 'acts' }, el('a', { class: 'hbtn pri', href: '#/parent/courses/new' }, 'Set up a course'))))
    : null;

  parentScreen('queue',
    flash ?? null,
    q.requests.length ? [el('h2', {}, `Requests (${q.requests.length})`), requests] : null,
    courses ? [el('h2', {}, 'This week'), courses] : null,
    el('h2', {}, courses ? 'Other lessons in the queue' : 'The queue'),
    q.queued.length ? el('div', { class: 'card' }, el('div', { class: 'rows' }, q.queued.map(queuedRow)))
      : el('p', { class: 'mut' }, courses ? 'Nothing else queued.' : 'Nothing queued yet. Add a lesson below, or turn on Plan our weeks in Family.'),
    q.put_back.length ? [el('h3', {}, 'Recently taken off'), el('div', { class: 'card' }, el('div', { class: 'rows' }, q.put_back.map((x) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, x.title), el('small', {}, `${x.status === 'declined' ? `${pname(x.requested_by)} asked · Not now` : 'Removed'} · ${names(x.profile_ids)}`)),
      actBtn('Put back', '', async () => { await api('POST', `/api/queue/${x.id}/put-back`); again(`${x.title} is back.`); })))))] : null,
    el('h2', {}, 'Add a lesson'),
    addForm);
});

// ---------- courses: the list and the editor (§6.18) ----------

const courseList = parentOnly(async () => {
  const [{ courses, weeks_on, mode }, { profiles }] = await Promise.all([api('GET', '/api/courses'), api('GET', '/api/profiles')]);
  const names = (ids) => ids.map((id) => profiles.find((p) => p.id === id)?.name ?? 'Someone').join(' & ') || 'Nobody';
  const active = courses.filter((c) => !c.archived_at), ended = courses.filter((c) => c.archived_at);
  parentScreen('courses',
    !weeks_on ? el('p', { class: 'card mut' }, 'Plan our weeks is off, so courses don\'t load lessons into the queue. Turn it on in Family, or switch to homeschool mode.') : null,
    el('p', { class: 'mut' }, mode === 'homeschool'
      ? 'Set each course up once: the lessons in order, a start date, and how many a week. Each week\'s lessons load into the queue, and an unfinished one moves to the next week.'
      : 'A course plans your weeks: set it up once, and each week\'s lessons load into the queue.'),
    el('div', { class: 'card' }, active.length ? el('div', { class: 'rows' }, active.map((c) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, c.name || `${names(c.profile_ids)}'s course`), el('small', {}, `${names(c.profile_ids)} · from ${fmtDay(c.start_date)} · ${c.per_week} a week`)),
      el('a', { class: 'hbtn', href: `#/parent/courses/${c.id}` }, 'Edit'))))
      : el('p', { class: 'mut' }, 'No courses yet.'),
    el('div', { class: 'acts' }, el('a', { class: 'hbtn pri', href: '#/parent/courses/new' }, 'Set up a course'))),
    ended.length ? [el('h2', {}, 'Ended courses'), el('div', { class: 'card' }, el('div', { class: 'rows' }, ended.map((c) => el('div', { class: 'rowi' },
      el('div', {}, el('b', {}, c.name || `${names(c.profile_ids)}'s course`), el('small', {}, `Ended ${fmtDay(c.archived_at.slice(0, 10))}`)),
      actBtn('Put back', '', async () => { await api('POST', `/api/courses/${c.id}/put-back`); courseList(); })))))] : null);
});

const courseEditor = parentOnly(async (cid) => {
  const [data, { profiles }, outline] = await Promise.all([api('GET', '/api/courses'), api('GET', '/api/profiles'), fetch('/content/course.json').then((r) => r.json())]);
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
    listBox.replaceChildren(...entries.map((e, i) => {
      const keptIds = e.ids.filter((id) => !plan.find((x) => x.id === id).removed);
      const num = keptIds.length ? ++n : null;
      const dishRow = (id) => {
        const x = plan.find((y) => y.id === id), d = dish[id];
        const tag = !written.has(id) ? 'Being written' : hidden.has(id) ? 'Hidden by your diet settings' : null;
        return el('label', { class: 'choice' },
          el('input', { type: 'checkbox', checked: !x.removed, onchange: (ev) => { x.removed = !ev.target.checked; drawPlan(); } }),
          el('span', {}, d.title, el('em', {}, ` ${d.skill ?? ''}`), tag ? el('small', { class: 'mut' }, ` · ${tag}`) : null));
      };
      return el('div', { class: `planrow${keptIds.length ? '' : ' out'}` },
        el('div', { class: 'planno' }, num ?? '–'),
        el('div', { class: 'grow' },
          e.pickOne ? el('div', {}, foundationMark(), el('small', { class: 'mut' }, ' Pick one, or tick more to cook more than one')) : null,
          e.ids.map(dishRow)),
        el('div', { class: 'planmove' },
          el('button', { type: 'button', class: 'hbtn', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
          el('button', { type: 'button', class: 'hbtn', 'aria-label': 'Move down', disabled: i === entries.length - 1, onclick: () => move(i, 1) }, '↓')));
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
    }, { extra }));
});

// ---------- shopping trips and the pantry (§6.3) ----------

const SECTION_ICON = {
  produce: 's-produce', herbs: 's-produce', 'meat-fish': 's-meat', 'dairy-eggs': 's-dairy', 'bread-tortillas': 's-bakery',
  'grains-pasta': 's-pantry', 'canned-jarred': 's-canned', sauces: 's-canned', 'oils-vinegars': 's-pantry', baking: 's-bakery',
  spices: 's-pantry', specialty: 's-pantry', frozen: 's-frozen',
};
const sectionIcon = (sid) => art(`<svg aria-hidden="true"><use href="/icons.svg#${SECTION_ICON[sid] ?? 's-pantry'}"/></svg>`);
const PERISH_CHOICES = [3, 5, 7, 10, 14];

// One line of the list: what to buy, how much the recipes use, and which lessons.
const itemNote = (x) => [x.from.join(' · '), x.optional ? 'optional' : null, x.perishable && x.no_date ? 'no date set' : null].filter(Boolean).join(' · ');

const shopping = parentOnly(async (flash) => {
  const [d, { profiles }] = await Promise.all([api('GET', `/api/trips?${tz()}`), api('GET', '/api/profiles')]);
  const names = (ids) => ids.map((id) => profiles.find((p) => p.id === id)?.name ?? 'Someone').join(' & ');
  const again = (msg, undo) => shopping(el('p', { class: 'ok flash', role: 'status' }, msg, ' ',
    undo ? el('button', { type: 'button', class: 'hbtn link', onclick: async () => { await undo(); shopping(); } }, 'Undo') : null));
  const when = (x) => (x.date ? fmtDay(x.date) : 'No date set');
  const lessonLine = (x) => `${x.title} · serves ${x.servings} · ${x.profile_ids.length ? `for ${names(x.profile_ids)} · ` : ''}${when(x)}`;
  const pantryLink = el('p', { class: 'mut small' }, 'Staples you always have drop to "You should have." ', el('a', { href: '#/parent/pantry' }, 'Pantry staples'));

  // Lessons to pick from, all ticked to start.
  const picker = (list) => el('div', { class: 'stack' }, list.map((x) => el('label', { class: 'choice' },
    el('input', { type: 'checkbox', name: `q_${x.id}`, value: x.id, checked: true }),
    el('span', {}, lessonLine(x)))));
  const picked = (v, list) => list.filter((x) => v[`q_${x.id}`]).map((x) => x.id);
  const perishSel = (value, onchange) => el('label', { class: 'f inline' }, 'Perishables for the next',
    el('select', { name: 'perish_days', onchange }, PERISH_CHOICES.map((n) => el('option', { value: n, selected: n === value }, `${n} days`))));

  const t = d.trip;
  if (!t) {
    parentScreen('shopping', flash ?? null,
      el('h2', {}, 'Start a shopping trip'),
      d.candidates.length
        ? form([
          el('p', { class: 'mut small', style: 'margin:0' }, `For the week of ${fmtDay(d.shop_week)}. From Thursday, the list is for next week.`),
          picker(d.candidates), perishSel(7),
        ], 'Make the list', async (v) => {
          const ids = picked(v, d.candidates);
          if (!ids.length) throw new Error('Pick at least one lesson.');
          await api('POST', '/api/trips', { queue_ids: ids, perish_days: Number(v.perish_days) });
          shopping();
        })
        : el('p', { class: 'card mut' }, `Nothing for the week of ${fmtDay(d.shop_week)} is waiting to be shopped for.`),
      pantryLink,
      d.recent.length ? [el('h3', {}, 'Recent trips'), el('div', { class: 'card' }, el('div', { class: 'rows' }, d.recent.map((r) => el('div', { class: 'rowi' },
        el('div', {}, el('b', {}, `Started ${fmtDay(r.created_at.slice(0, 10))}`), el('small', {}, r.cancelled_at ? 'Cancelled' : `Ended ${fmtDay(r.ended_at.slice(0, 10))}`)),
        actBtn('Reopen', '', async () => { await api('POST', `/api/trips/${r.id}/reopen`); shopping(); })))))] : null);
    return;
  }

  const all = t.list.sections.flatMap((s) => s.items);
  const checked = new Set(t.checked);
  const count = el('p', { class: 'sub', 'aria-live': 'polite' });
  const drawCount = () => count.replaceChildren(`${all.filter((x) => checked.has(x.id)).length} of ${all.length} in the cart`);
  drawCount();
  const row = (x) => {
    const b = el('button', { type: 'button', class: 'pitem', 'aria-pressed': String(checked.has(x.id)) },
      el('span', { class: 'bx' }, art('<svg aria-hidden="true"><use href="/icons.svg#i-check"/></svg>')),
      el('span', { class: 'nm' }, x.name, el('small', {}, itemNote(x))),
      el('span', { class: 'q' }, x.buy ?? '', x.used && x.used !== x.buy ? el('small', {}, x.buy ? `The recipes use ${x.used}` : x.used) : null));
    b.addEventListener('click', async () => {
      const on = !checked.has(x.id);
      if (on) checked.add(x.id); else checked.delete(x.id);
      b.setAttribute('aria-pressed', String(on));
      drawCount();
      try { await api('POST', `/api/trips/${t.id}/check`, { ingredient_id: x.id, checked: on }); } catch (err) {
        if (on) checked.delete(x.id); else checked.add(x.id);
        b.setAttribute('aria-pressed', String(!on));
        drawCount();
        showToast(err.message);
      }
    });
    return b;
  };
  const plain = (x) => el('div', { class: 'rowi' }, el('div', {}, el('b', {}, x.name), el('small', {}, itemNote(x))), el('small', {}, x.used ?? ''));

  parentScreen('shopping', flash ?? null,
    el('section', { class: 'card shoplist' },
      el('div', {}, el('h2', { style: 'margin:0' }, 'Shopping list'), count),
      el('div', { class: 'rows' }, t.lessons.map((x) => el('div', { class: 'rowi' },
        el('small', {}, lessonLine(x)),
        t.lessons.length > 1 ? el('button', { type: 'button', class: 'hbtn link', 'aria-label': `Take ${x.title} off this trip`, onclick: async () => {
          await api('PUT', `/api/trips/${t.id}`, { remove_queue_id: x.id });
          again(`Took ${x.title} off this trip.`, () => api('PUT', `/api/trips/${t.id}`, { add_queue_ids: [x.id] }));
        } }, 'Remove') : el('span')))),
      perishSel(t.perish_days, async (e) => { await api('PUT', `/api/trips/${t.id}`, { perish_days: Number(e.target.value) }); shopping(); }),
      t.list.sections.map((s) => el('div', { class: 'psec' }, el('h4', {}, sectionIcon(s.id), s.name), s.items.map(row))),
      t.list.have.length ? el('details', { class: 'psec' }, el('summary', {}, `You should have (${t.list.have.length})`), el('div', { class: 'rows' }, t.list.have.map(plain))) : null,
      t.list.later.length ? el('details', { class: 'psec' }, el('summary', {}, `Buy closer to the day (${t.list.later.length})`),
        el('p', { class: 'mut small' }, `Perishables for lessons more than ${t.perish_days} days away.`), el('div', { class: 'rows' }, t.list.later.map(plain))) : null,
      el('div', { class: 'acts' },
        actBtn('End trip', 'pri', async () => {
          await api('POST', `/api/trips/${t.id}/end`);
          again('Trip ended. Its lessons are shopped for.', () => api('POST', `/api/trips/${t.id}/reopen`));
        }),
        actBtn('Cancel trip', '', async () => {
          await api('POST', `/api/trips/${t.id}/cancel`);
          again('Trip cancelled.', () => api('POST', `/api/trips/${t.id}/reopen`));
        }))),
    d.candidates.length ? [el('h3', {}, 'Add lessons to this trip'), form([picker(d.candidates)], 'Add to the list', async (v) => {
      const ids = picked(v, d.candidates);
      if (!ids.length) throw new Error('Pick at least one lesson.');
      await api('PUT', `/api/trips/${t.id}`, { add_queue_ids: ids });
      shopping();
    })] : null,
    pantryLink);
});

const pantryEditor = parentOnly(async () => {
  const p = await api('GET', '/api/pantry');
  const have = new Set(p.pantry);
  const saved = el('p', { class: 'ok', hidden: true }, 'Saved.');
  parentScreen('shopping', el('h2', {}, 'Pantry staples'),
    el('p', { class: 'mut' }, 'Tick what you always have on hand. It moves to "You should have" on every shopping list, where you can still check it.'),
    form([
      ...p.sections.map((s) => el('fieldset', {}, el('legend', {}, s.name), el('div', { class: 'grid2' }, s.items.map((i) => el('label', { class: 'choice' },
        el('input', { type: 'checkbox', name: `i_${i.id}`, checked: have.has(i.id) }), el('span', {}, i.name)))))),
      saved,
    ], 'Save', async (v) => {
      saved.hidden = true;
      await api('PUT', '/api/pantry', { ingredient_ids: p.sections.flatMap((s) => s.items).filter((i) => v[`i_${i.id}`]).map((i) => i.id) });
      saved.hidden = false;
    }, { extra: [el('a', { class: 'hbtn', href: '#/parent/shopping' }, 'Back to shopping')] }));
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
    if (top === 'kitchen' && sub && extra) return await lesson(sub, decodeURIComponent(extra));
    if (top === 'kitchen' && sub) return await kitchen(sub);
    if (top === 'parent') {
      if (sub === 'profiles' && extra) return await profileEditor(extra);
      if (sub === 'courses' && extra) return await courseEditor(extra);
      if (sub === 'courses') return await courseList();
      if (sub === 'queue') return await parentQueue();
      if (sub === 'shopping') return await shopping();
      if (sub === 'pantry') return await pantryEditor();
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
