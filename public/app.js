// Clean Plate Recipes, the app. Plain ES module, no build step. Screens are
// built with el(), which only ever sets text, so nothing a family types is
// parsed as markup. Routes live in the hash: #/login, #/kitchen/<id>, #/parent…
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
    el('h1', {}, "Who's cooking?"), grid);
}

// ---------- a profile's kitchen: the library in its theme ----------

async function kitchen(id) {
  const [{ profiles }, lib] = await Promise.all([api('GET', '/api/profiles'), api('GET', '/api/library')]);
  const p = profiles.find((x) => x.id === id);
  if (!p) return go('#/');
  store('cpr.profile', p.id);
  const quest = p.theme === 'quest';
  const other = quest ? 'passport' : 'quest';

  const card = (L) => {
    const swaps = L.substitutions.map((s) => `${s.use} instead of ${s.for}`).join('; ');
    const skip = L.left_out.length ? `Leave out the ${L.left_out.join(', ').toLowerCase()}` : '';
    const time = `${L.totalMinutes} min`;
    if (quest) {
      return el('article', { class: 'q-panel q-card' },
        el('p', { class: 'q-kick' }, `Path ${L.unit} · Quest ${L.number}`),
        el('div', { class: 'q-win' }, el('img', { src: L.image, alt: '', width: 230, height: 230, loading: 'lazy' })),
        el('h3', { class: 'q-title' }, L.title),
        el('p', { class: 'q-skill' }, L.skill),
        el('dl', { class: 'q-stats' },
          el('div', {}, el('dt', {}, 'Time'), el('dd', {}, time)),
          el('div', {}, el('dt', {}, 'Serves'), el('dd', {}, L.servings)),
          el('div', {}, el('dt', {}, 'From'), el('dd', {}, L.cuisine))),
        swaps ? el('p', { class: 'q-swap' }, `Made with ${swaps}`) : null,
        skip ? el('p', { class: 'q-swap' }, skip) : null);
    }
    return el('article', { class: 'p-card' },
      el('span', { class: 'tape t1' }), el('span', { class: 'tape t2' }),
      el('div', { class: 'p-photo' }, el('img', { src: L.image, alt: '', width: 220, height: 220, loading: 'lazy' })),
      el('h3', { class: 'p-title' }, L.title),
      el('p', { class: 'p-skill' }, L.skill),
      el('div', { class: 'p-meta' }, el('span', {}, time), el('span', {}, `Serves ${L.servings}`), el('span', {}, L.cuisine)),
      swaps ? el('p', { class: 'p-swap' }, `Made with ${swaps}`) : null,
      skip ? el('p', { class: 'p-swap' }, skip) : null);
  };

  const units = [...new Set(lib.lessons.map((l) => l.unit))].sort((a, b) => a - b);
  const body = units.length
    ? units.map((u) => [
      el('h2', { class: 'k-unit' }, quest ? `Path ${u}: ${lib.units[u]}` : lib.units[u]),
      el('div', { class: 'k-lib' }, lib.lessons.filter((l) => l.unit === u).map(card)),
    ])
    : el('div', { class: quest ? 'q-panel k-empty' : 'p-card k-empty' }, 'No lessons match this family\'s diet settings yet.');

  screen(el('section', { class: 'kitchen', 'data-kt': p.theme },
    el('a', { class: 'back', href: '#/' }, '← Lockers'),
    el('div', { class: 'k-head' }, avatars(p.people),
      el('div', { class: 'grow' }, el('h1', {}, quest ? 'Quest board' : 'Recipe box'), el('div', {}, p.name))),
    el('div', { class: 'acts' },
      el('button', { class: 'themebtn', type: 'button', onclick: async () => {
        await api('PUT', `/api/profiles/${p.id}/theme`, { theme: other });
        kitchen(id);
      } }, `Switch to ${THEMES[other]}`)),
    body));
}

// ---------- parent area ----------

function parentTabs(current) {
  const tabs = [['profiles', 'Profiles'], ['family', 'Family'], ['parents', 'Logins']];
  if (me.parent.is_owner) tabs.push(['owner', 'Owner']);
  return el('nav', { class: 'tabs', 'aria-label': 'Parent screens' },
    tabs.map(([k, label]) => el('a', { href: `#/parent/${k}`, 'aria-current': k === current ? 'page' : null }, label)));
}

function parentScreen(current, ...kids) {
  screen(topbar(me.family.name,
    el('a', { class: 'hbtn', href: '#/' }, 'Lockers'),
    el('button', { class: 'hbtn', type: 'button', onclick: async () => { await api('POST', '/api/pin/lock'); await refresh(); go('#/'); } }, 'Lock'),
    el('button', { class: 'hbtn', type: 'button', onclick: async () => { await api('POST', '/api/logout'); store('cpr.profile', null); await start('#/'); } }, 'Log out')),
  el('h1', {}, 'Parents'), parentTabs(current), ...kids);
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
    saved,
  ], 'Save', async (v) => {
    saved.hidden = true;
    await api('PUT', '/api/family', {
      name: v.name, default_servings: Number(v.default_servings),
      diet_filters: f.diet_tags.filter((t) => v[`diet_${t}`]),
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
    if (top === 'kitchen' && sub) return await kitchen(sub);
    if (top === 'parent') {
      if (sub === 'profiles' && extra) return await profileEditor(extra);
      if (sub === 'family') return await familySettings();
      if (sub === 'parents') return await parentLogins();
      if (sub === 'owner') return await owner();
      return await parentProfiles();
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
  if (hash !== undefined && location.hash !== hash) location.hash = hash;
  else route();
}

// A button's failed request shows its message instead of failing silently.
const toast = el('p', { class: 'toast err', role: 'alert', hidden: true });
document.body.append(toast);
window.addEventListener('unhandledrejection', (e) => {
  toast.textContent = e.reason?.message || 'Something went wrong. Try again.';
  toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { toast.hidden = true; }, 6000);
});

window.addEventListener('hashchange', route);
start();
