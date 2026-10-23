// Chef Ruth, the helper (plan §6.8): a scripted chat, not an AI. Every line she
// says is written here, and every answer saves through the same API calls as
// the parent pages. Her first task is Getting started (§6.9).
//
// The app hands her its helpers (ctx), so she builds screens and calls the API
// the same way the pages do.
import { STARTERS, nextStep } from './lib/getting-started.js';

export const RUTH = { name: 'Chef Ruth', photo: 'img/chef-ruth.webp' };

const HELLO = "Hi, I'm Ruth, your Clean Plate guru! I'm here to help you learn to navigate the app and get your family in the kitchen!";
const NEW_FAMILY = "Since you're a new user, I'm going to get you all set up! I'll ask you some questions and use your answers to configure your settings, get your little chefs their kitchen profiles, and get the first recipes in their queues! Sound good?";
const READY = "Great, you're ready to get cooking!";
const BETA = 'As a reminder, Clean Plate is still in beta testing. We strongly suggest that you review each recipe with your child as some of them have never been cooked by our team. If you find anything concerning in a recipe,  we appreciate you giving feedback so we can correct it as soon as possible.';
const COLORS = ['tomato', 'butter', 'basil', 'sky', 'plum', 'peach', 'mint', 'slate'];

// The floating button: her picture and her name.
export function ruthButton(ctx, onclick) {
  const { el } = ctx;
  return el('button', { type: 'button', class: 'ruth-fab', onclick, 'aria-label': `Ask ${RUTH.name}` },
    el('img', { src: RUTH.photo, alt: '', width: 64, height: 64 }), el('span', {}, RUTH.name));
}

// The chat panel. With required: true (Getting started for a new family) it
// has no close button and Escape does nothing.
function chatPanel(ctx, { required, onClose }) {
  const { el } = ctx;
  const log = el('div', { class: 'ruth-log', 'aria-live': 'polite' });
  const panel = el('div', { class: 'ruth-panel' });
  let peeking = null;
  const close = () => { ov.remove(); document.removeEventListener('keydown', esc); onClose?.(); };
  const esc = (e) => { if (e.key === 'Escape' && !required) close(); };
  const head = el('div', { class: 'ruth-head' },
    el('img', { src: RUTH.photo, alt: '', width: 48, height: 48 }),
    el('b', { class: 'grow' }, RUTH.name),
    required ? null : el('button', { type: 'button', class: 'hbtn', onclick: close }, 'Close'));
  const box = el('section', { class: 'ruth', role: 'dialog', 'aria-modal': 'true', 'aria-label': RUTH.name }, head, log, panel);
  const ov = el('div', { class: `ruth-ov${required ? ' required' : ''}` }, box);
  if (!required) ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(ov);
  const down = () => { log.scrollTop = log.scrollHeight; };

  const chat = {
    close,
    // Step aside so the screen behind shows, then come back. Her button, or 4
    // seconds, brings her back (owner, 2026-10-23).
    peek(hash, ms = 4000) {
      return new Promise((resolve) => {
        ov.hidden = true;
        let timer;
        const back = () => { clearTimeout(timer); peeking = null; ov.hidden = false; down(); resolve(); };
        peeking = back;
        timer = setTimeout(back, ms);
        ctx.go(hash);
      });
    },
    // Her button while she's stepped aside: come back now.
    resume() { peeking?.(); },
    get open() { return ov.isConnected; },
    // Her line, with her picture beside it. kids: extra nodes (a dish picture).
    say(text, ...kids) {
      log.append(el('div', { class: 'ruth-msg' }, el('img', { src: RUTH.photo, alt: '', width: 36, height: 36 }), el('p', {}, text, ...kids)));
      down();
    },
    // The parent's answer, on the right.
    you(text) { log.append(el('div', { class: 'ruth-you' }, el('p', {}, text))); down(); },
    // Buttons; resolves with the picked value, and leaves its label as the answer.
    choose(choices) {
      return new Promise((resolve) => {
        panel.replaceChildren(el('div', { class: 'ruth-choices' }, choices.map(([value, label]) => el('button', {
          type: 'button', class: 'hbtn', onclick: () => { panel.replaceChildren(); chat.you(label); resolve(value); },
        }, label))));
        panel.querySelector('button')?.focus();
        down();
      });
    },
    // A small form. submit(values) saves and returns the answer to show, or
    // throws an Error whose message shows under the form. extra: [[label, fn]]
    // buttons beside the submit; fn returns an answer, or null to stay.
    ask(fields, submitText, submit, { extra = [] } = {}) {
      return new Promise((resolve) => {
        const msg = el('p', { class: 'err', role: 'alert', hidden: true });
        const btn = el('button', { class: 'hbtn pri', type: 'submit' }, submitText);
        const done = (answer) => { panel.replaceChildren(); if (answer) chat.you(answer); resolve(answer); };
        const run = async (fn) => {
          msg.hidden = true;
          btn.disabled = true;
          try {
            const answer = await fn();
            if (answer !== null) done(answer);
          } catch (err) {
            msg.textContent = err.message;
            msg.hidden = false;
          } finally {
            btn.disabled = false;
          }
        };
        const f = el('form', { class: 'ruth-form', novalidate: true }, ...fields, msg,
          el('div', { class: 'acts' }, btn, extra.map(([label, fn]) => el('button', { type: 'button', class: 'hbtn', onclick: () => run(fn) }, label))));
        f.addEventListener('submit', (e) => { e.preventDefault(); run(() => submit(Object.fromEntries(new FormData(f)), f)); });
        panel.replaceChildren(f);
        f.querySelector('input, select, button')?.focus();
        down();
      });
    },
  };
  return chat;
}

// The API, but a PIN that ran out (the app was closed and reopened later) is
// asked for right in the chat, and the call is tried again.
function caller(ctx, chat) {
  const call = async (method, path, body) => {
    try {
      return await ctx.api(method, path, body);
    } catch (err) {
      if (err.code !== 'pin_required') throw err;
      await askPin(ctx, chat);
      return ctx.api(method, path, body);
    }
  };
  return call;
}

async function askPin(ctx, chat) {
  const { field, api } = ctx;
  chat.say('Type your parent PIN so I can keep saving your answers.');
  const unlock = () => chat.ask([field('Parent PIN', 'pin', { inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, required: true })],
    'Unlock', async (v) => { await api('POST', '/api/pin/unlock', { pin: v.pin }); return 'PIN entered'; },
    { extra: [['Forgot PIN?', async () => 'forgot']] });
  let answer = await unlock();
  while (answer === 'forgot') {
    chat.say('No problem. Type your account password and pick a new PIN.');
    answer = await chat.ask([
      field('Your account password', 'password', { type: 'password', autocomplete: 'current-password', required: true }),
      field('New PIN', 'pin', { inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, required: true }, '4 to 8 digits'),
    ], 'Save PIN', async (v) => { await api('POST', '/api/pin/reset', v); return 'New PIN saved'; }, { extra: [['Back', async () => 'back']] });
    if (answer === 'back') answer = await unlock();
  }
  await ctx.refresh();
}

// ---------- Getting started (§6.9) ----------

// For a new family she opens on her own over the empty lockers, and there's no
// way out until it's done (owner, 2026-10-23). again: run from her task list
// later, to change answers.
export async function gettingStarted(ctx, { again = false, chat: given = null } = {}) {
  const me = ctx.me();
  const chat = given ?? chatPanel(ctx, { required: !again });
  const call = caller(ctx, chat);
  const step = async (s) => { if (!again) await call('POST', '/api/setup/step', { step: s }); };
  let at = again ? 'family' : nextStep(me.family.setup_step);

  if (!given) chat.say(HELLO);
  if (again) {
    chat.say("Sure thing! I'll go through your family's setup with you again. Change anything you like as we go.");
  } else if (me.family.setup_step) {
    chat.say("Welcome back! Let's pick up where we left off.");
    await chat.choose([['go', "Let's keep going"]]);
  } else {
    chat.say(NEW_FAMILY);
    await chat.choose([['go', "Sounds great, let's start!"]]);
  }

  const parts = { family: familyPart, servings: servingsPart, diet: dietPart, learners: learnersPart, logins: loginsPart, mode: modePart, course: coursePart };
  while (at) {
    await parts[at](ctx, chat, call, { again });
    await step(at);
    at = nextStep(at);
  }

  if (again) {
    chat.say("All done! Everything's saved.");
    await chat.choose([['ok', 'Thanks, Chef Ruth!']]);
    chat.close();
    return;
  }
  await call('POST', '/api/setup/done');
  await call('POST', '/api/notice/test-cook');
  await ctx.refresh();
  chat.say(READY);
  chat.say(BETA);
  await chat.choose([['go', "Let's go!"]]);
  chat.close();
  ctx.go('#/');
}

async function familyPart(ctx, chat, call, { again }) {
  const { field, api } = ctx;
  if (again) {
    chat.say("Your family's name goes on your chef's lockers.");
    const f = (await call('GET', '/api/family')).family;
    await chat.ask([field('Family name', 'name', { value: f.name, required: true, maxlength: 60 })], 'Save', async (v) => {
      await call('PUT', '/api/family', { ...f, name: v.name });
      return v.name.trim();
    });
    chat.say('You can change it any time in Menu → Family settings. The PIN is changed in Menu → Logins & PIN.');
    await ctx.refresh();
    return;
  }
  chat.say("First, your family's name and a parent PIN. The name goes on your chef's lockers. Kitchen devices stay logged in, so the PIN keeps the parent screens for adults.");
  await chat.ask([
    field('Family name', 'family_name', { autocomplete: 'organization', required: true, maxlength: 60 }),
    field('Parent PIN', 'pin', { inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, required: true }, '4 to 8 digits'),
    field('PIN again', 'again', { inputmode: 'numeric', autocomplete: 'off', pattern: '[0-9]*', maxlength: 8, required: true }),
  ], 'Save', async (v) => {
    if (v.pin !== v.again) throw new Error("The two PINs don't match.");
    await api('POST', '/api/pin/set', { family_name: v.family_name, pin: v.pin });
    await ctx.refresh();
    return `${v.family_name.trim()}, and a PIN`;
  });
  chat.say('You can change the name in Menu → Family settings, and the PIN in Menu → Logins & PIN.');
}

async function servingsPart(ctx, chat, call) {
  const { field } = ctx;
  const { family: f, servings_max } = await call('GET', '/api/family');
  chat.say('How many people do you usually cook for? Every recipe scales to this number, and you can still change it for any one cook.');
  await chat.ask([field('Servings', 'servings', { type: 'number', min: 1, max: servings_max, value: f.default_servings, inputmode: 'numeric', required: true })], 'Save', async (v) => {
    const n = Number(v.servings);
    if (!Number.isInteger(n) || n < 1 || n > servings_max) throw new Error(`Pick a number from 1 to ${servings_max}.`);
    await call('PUT', '/api/family', { ...f, default_servings: n });
    return `${n} servings`;
  });
  chat.say('You can change it any time in Menu → Family settings.');
}

async function dietPart(ctx, chat, call) {
  const { el } = ctx;
  const { family: f, diet_tags } = await call('GET', '/api/family');
  chat.say("Does anyone have allergies, or foods your family avoids? I'll hide the lessons that use them, unless a lesson has a swap. Unclean foods are never in any lesson, so you don't need to pick those.");
  await chat.ask([el('div', { class: 'grid2 tight' }, diet_tags.map((t) => el('label', { class: 'choice' },
    el('input', { type: 'checkbox', name: `diet_${t}`, checked: f.diet_filters.includes(t) }), el('span', {}, ctx.DIET[t] ?? t))))],
  "That's everything", async (v) => {
    const picked = diet_tags.filter((t) => v[`diet_${t}`]);
    await call('PUT', '/api/family', { ...f, diet_filters: picked });
    return picked.length ? `Leave out: ${picked.map((t) => ctx.DIET[t] ?? t).join(', ')}` : 'None of these';
  });
  chat.say('You can change these in Menu → Family settings.');
}

async function learnersPart(ctx, chat, call, { again }) {
  const { el } = ctx;
  let { profiles } = await call('GET', '/api/profiles');
  chat.say("Now your learners. Each profile gets its own chef's locker, kitchen, and progress. A profile can be shared by kids who always cook together, or each kid can have their own, even if they plan to cook together, so their progress is their own.");
  if (profiles.length) chat.say(`${again ? 'You have' : "You've added"} ${profiles.map((p) => p.name).join(', ')} so far.`);
  let more = profiles.length ? await chat.choose([['add', 'Add another learner'], ['done', "That's everyone"]]) : 'add';
  while (more === 'add') {
    const names = [el('input', { name: 'n0', maxlength: 30, required: true, 'aria-label': 'Name' })];
    const box = el('div', { class: 'stack', style: 'width:100%' }, names[0]);
    const addName = el('button', { type: 'button', class: 'hbtn link', onclick: () => {
      const i = names.length;
      names.push(el('input', { name: `n${i}`, maxlength: 30, 'aria-label': `Person ${i + 1}` }));
      box.append(names[i]);
      names[i].focus();
    } }, '+ Someone else shares this profile');
    const radio = (value, label, note, checked) => el('label', { class: 'choice' },
      el('input', { type: 'radio', name: 'audience', value, checked }), el('span', {}, label, note ? el('em', {}, ` ${note}`) : null));
    await chat.ask([
      el('label', { class: 'f' }, 'Name', box), addName,
      el('fieldset', {}, el('legend', {}, 'Kid or adult'), el('div', { class: 'grid2' },
        radio('kid', 'Kid', 'Pick this if any kid shares it', true), radio('adult', 'Adult', null, false))),
    ], 'Add this learner', async (v) => {
      const people = names.map((n) => n.value.trim()).filter(Boolean);
      if (!people.length) throw new Error('Type a name.');
      const start = profiles.length;
      await call('POST', '/api/profiles', { people: people.map((name, i) => ({ name, color: COLORS[(start + i) % COLORS.length] })), audience: v.audience });
      profiles = (await call('GET', '/api/profiles')).profiles;
      return `${people.join(' & ')}, ${v.audience === 'adult' ? 'adult' : people.length > 1 ? 'kids sharing a profile' : 'kid'}`;
    });
    chat.say(`Got it! Anyone else?`);
    more = await chat.choose([['add', 'Add another learner'], ['done', "That's everyone"]]);
  }
  chat.say("Each kid picks their own theme the first time they open their kitchen. To change a profile later, go to Menu → Profiles.");
}

async function loginsPart(ctx, chat, call) {
  const { el, field } = ctx;
  const { profiles } = await call('GET', '/api/profiles');
  const kids = [];
  for (const p of profiles.filter((x) => x.audience === 'kid')) {
    try {
      if (!(await call('GET', `/api/profiles/${p.id}/login`)).login) kids.push(p);
    } catch { /* kid logins wait for their update on /ops; the rest goes on */ }
  }
  if (!kids.length) return;
  chat.say("A kid can have their own login, on their own device. They log in with their first name and last initial, a picture, and a password, and see only their kitchen: no lockers and no parent screens. Without one, they cook from the lockers on a shared device.");
  for (const p of kids) {
    const yes = await chat.choose([['yes', `Yes, give ${p.name} a login`], ['no', 'No, not now']]);
    if (yes === 'no') continue;
    const famInitial = ctx.familyInitial();
    const first = el('input', { name: 'first', value: p.people[0]?.name ?? p.name, maxlength: 20, autocomplete: 'off', required: true });
    const initial = el('input', { name: 'initial', value: famInitial, maxlength: 1, autocomplete: 'off', required: true, class: 'initial' });
    const grid = el('div');
    const shown = el('p', { class: 'mut small', style: 'margin:0', 'aria-live': 'polite' });
    let picked = null;
    const draw = async () => {
      const q = new URLSearchParams({ first: first.value, initial: initial.value, profile: p.id });
      const d = await call('GET', `/api/login-pictures?${q}`);
      const taken = new Set(d.pictures.filter((x) => x.taken).map((x) => x.id));
      if (taken.has(picked)) picked = null;
      grid.replaceChildren(ctx.pictureGrid('picture', { checked: picked, taken }));
      shown.textContent = d.error ?? `They'll type: ${d.name}`;
    };
    grid.addEventListener('change', (e) => { picked = e.target.value; });
    let timer;
    for (const x of [first, initial]) x.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => draw().catch(() => {}), 300); });
    draw().catch(() => {});
    chat.say(`Let's set up ${p.name}'s login. They tap their picture when they log in, so pick one they'll remember.`);
    await chat.ask([
      el('div', { class: 'namepair' }, el('label', { class: 'f' }, 'First name', first), el('label', { class: 'f' }, 'Last initial', initial)),
      shown,
      el('fieldset', {}, el('legend', {}, 'Their picture'), grid),
      ...ctx.passwordFields(),
    ], 'Give them a login', async (v) => {
      if (!v.picture) throw new Error('Pick a picture.');
      if (v.password !== v.password2) throw new Error("The passwords don't match.");
      await call('PUT', `/api/profiles/${p.id}/login`, { first: v.first, initial: v.initial, picture: v.picture, password: v.password });
      const pic = ctx.LOGIN_PICTURES.find((x) => x.id === v.picture)?.name ?? v.picture;
      return `${v.first.trim()} ${v.initial.trim().toUpperCase()}, with the ${pic.toLowerCase()}`;
    });
    chat.say(`Done! On ${p.name}'s device, they tap Log in, then Kid, and use the name, picture, and password you just picked.`);
  }
  chat.say("You can add, change, or turn off a kid's login on their profile, in Menu → Profiles.");
}

async function modePart(ctx, chat, call) {
  const { family: f } = await call('GET', '/api/family');
  chat.say('How will you use Clean Plate? Casual: cook when you like. Homeschool: lessons follow a course with due dates, and you can print a record of what each kid has cooked. Switching later never deletes anything.');
  const mode = await chat.choose([['casual', 'Casual'], ['homeschool', 'Homeschool']]);
  await call('PUT', '/api/family', { ...f, mode });
  chat.say('You can switch any time in Menu → Family settings.');
}

async function coursePart(ctx, chat, call, { again }) {
  const { el, field } = ctx;
  const data = await call('GET', '/api/courses');
  const { profiles } = await call('GET', '/api/profiles');
  if (data.courses.some((c) => !c.archived_at)) {
    if (again) chat.say('You already have a course. To change it, go to Menu → Courses.');
    return;
  }
  chat.say(data.mode === 'homeschool'
    ? 'Homeschool mode runs on a course. A course plans your weeks: set it up once, and each week\'s lessons load into the queue on Sunday. A lesson that isn\'t finished moves to the next week.'
    : 'Would you like a course? It plans your weeks: set it up once, and each week\'s lessons load into the queue on Sunday. A lesson that isn\'t finished moves to the next week.');
  const yes = await chat.choose([['yes', 'Yes, set up a course'], ['no', 'No, not now']]);
  if (yes === 'no') return firstLesson(ctx, chat, call, profiles);

  chat.say("Who's it for? Siblings can share a course and cook together, or each have their own.");
  let pids = [];
  await chat.ask([el('div', { class: 'grid2' }, profiles.map((p) => el('label', { class: 'choice' },
    el('input', { type: 'checkbox', name: `p_${p.id}`, checked: true }), el('span', {}, p.name))))],
  'Next', async (v) => {
    pids = profiles.filter((p) => v[`p_${p.id}`]).map((p) => p.id);
    if (!pids.length) throw new Error('Pick who the course is for.');
    return profiles.filter((p) => pids.includes(p.id)).map((p) => p.name).join(' & ');
  });

  chat.say('Want to give the course a name, like "Culinary Arts"? It\'s optional.');
  let name = '';
  await chat.ask([field('Course name', 'name', { maxlength: 60 })], 'Save name', async (v) => {
    name = v.name.trim();
    if (!name) throw new Error('Type a name, or tap Skip.');
    return name;
  }, { extra: [['Skip', async () => 'No name']] });

  chat.say('When should it start? Weeks run Sunday to Friday, since Saturday is the Sabbath, so lessons join the queue each Sunday.');
  let start = '';
  await chat.ask([field('Start date', 'start', { type: 'date', value: ctx.weekOf(ctx.localToday()), required: true })], 'Next', async (v) => {
    if (!v.start) throw new Error('Pick a date.');
    start = v.start;
    return ctx.fmtDay(v.start, { weekday: 'long', month: 'long', day: 'numeric' });
  });

  chat.say('How many lessons a week? One or two is a good place to start.');
  await chat.ask([field('Lessons per week', 'per', { type: 'number', min: 1, max: data.per_week_max, value: 1, inputmode: 'numeric', required: true })], 'Start the course', async (v) => {
    const per = Number(v.per);
    if (!Number.isInteger(per) || per < 1 || per > data.per_week_max) throw new Error(`Pick a number from 1 to ${data.per_week_max}.`);
    await call('POST', '/api/courses', { name, start_date: start, per_week: per, profile_ids: pids, plan: data.default_plan });
    return `${per} a week`;
  });
  if (data.mode !== 'homeschool') {
    const { family: f } = await call('GET', '/api/family');
    if (!f.plan_weeks) await call('PUT', '/api/family', { ...f, plan_weeks: true });
    chat.say("I turned on Plan our weeks, so your course loads each week's lessons into the queue.");
  }
  chat.say("Your course follows our suggested order. You can edit it to change the lesson order or drop lessons, and to pick a different dish where a skill has a few to choose from, in Menu → Courses.");
}

// No course: a first lesson by hand (owner, 2026-10-23). She offers the first
// matching lesson, then the next; a second no ends it.
async function firstLesson(ctx, chat, call, profiles) {
  const { el } = ctx;
  const queued = (await call('GET', `/api/queue?${ctx.tz()}`).catch(() => ({ queued: [] }))).queued ?? [];
  if (queued.length) return;
  chat.say("No problem! Let's add a first lesson by hand instead. What would you like to start with?");
  const kind = await chat.choose(Object.entries(STARTERS));
  const { lessons } = await call('GET', `/api/setup/starters?kind=${kind}`);
  const where = 'You can add lessons yourself any time in Menu → Queue → + Add a lesson.';
  if (!lessons.length) {
    chat.say(`I don't have a ${STARTERS[kind].toLowerCase()} lesson that fits your family's diet settings yet. ${where}`);
    return;
  }
  const servings = ctx.me().family.default_servings;
  for (const [i, L] of lessons.slice(0, 2).entries()) {
    chat.say(`${i ? 'Or how about' : 'How about'} lesson ${L.label}, ${L.title}? ${L.about}`,
      el('img', { class: 'ruth-dish', src: L.image, alt: '', width: 160, height: 160 }));
    const pick = await chat.choose([['add', `Add ${L.title}`], ['no', i ? 'No, thanks' : 'Something else']]);
    if (pick === 'add') {
      await call('POST', '/api/queue', { lesson_id: L.id, profile_ids: profiles.map((p) => p.id), servings, planned_date: null });
      chat.say(`Done! ${L.title} is in everyone's queue. You can change who's cooking it in Menu → Queue.`);
      return;
    }
  }
  chat.say(`No problem! ${where}`);
}

// ---------- Show me around (owner, 2026-10-23) ----------

// Every parent screen, starting with the Queue: she says what it's for, steps
// aside for a look, then pops back to say how to use it. The owner's screens
// come last, for the owner only.
const TOUR = [
  { hash: '#/parent/queue', name: 'Queue', called: 'the Queue', what: "It's the one \"up next\" list for every learner, and it's where the Parents button takes you.", how: [
    'Lessons from a course show under Course, and lessons you add yourself under Additional. Tap + Add a lesson to queue any lesson, for one learner or several cooking together.',
    'When a kid asks to make something, it shows at the top under Requests, for you to approve or say Not now.',
    "Tap a lesson to open its tools: Safety review lists its safety steps, and I've test-cooked this marks one you've cooked yourself. A course lesson can also be skipped, or swapped for an Appointed Time meal.",
  ] },
  { hash: '#/parent/shopping', name: 'Shopping', what: "Everything you'll need for the lessons coming up.", how: [
    'Upcoming shows the ingredients week by week. Make a shopping list picks the next few lessons, lets you tick what you already have, and rounds the rest to store packages, grouped by aisle, so you can check things off in the store.',
    "Lists keeps the ones you've made, newest first. Staples are things you always keep at home, like salt and oil: add them by searching, and they show as \"May already have.\"",
  ] },
  { hash: '#/parent/progress', name: 'Progress', what: 'What each learner has cooked.', how: [
    'Pick a learner, or Everyone, to see the date, dish, cuisine, skill, and rating of every cook.',
    'Tap Print, or save it as a PDF from the print window, or Download CSV for a spreadsheet. Handy for homeschool records.',
    "If a kid marked a dish done but didn't really make it, tap Didn't make it on that row. It stops counting, and the lesson goes back on the queue. There's an Undo.",
  ] },
  { hash: '#/parent/recipes', name: 'Our recipes', what: "Your family's own recipes.", how: [
    'Tap + Add a recipe, and it walks you through one thing at a time: ingredients, tools, steps, then a review. The same food rules and safety checks as our lessons apply.',
    'Your recipes show on an "Our recipes" shelf in every kitchen, and can be queued and shopped for like any lesson. Tap Share to put one in User-shared recipes for other families, with no family name on it.',
  ] },
  { hash: '#/parent/shared', name: 'User-shared recipes', what: 'Recipes other families have shared.', how: [
    'Search by name or ingredient, and tap Add to our recipes to save one for your family.',
    'If something in one looks wrong, tap Report and tell us what.',
  ] },
  { hash: '#/parent/courses', name: 'Courses', what: 'Where your courses live.', how: [
    "A course plans your weeks: its lessons in order, a start date, and how many a week. Each week's lessons load into the queue on Sunday, and an unfinished one moves to the next week. In casual mode, Plan our weeks in Family settings needs to be on.",
    'Tap Set up a course to make one, or Edit to change the lesson order, drop lessons, or pick a different dish where a skill has a few to choose from. End this course stops it, and you can put it back.',
  ] },
  { hash: '#/parent/profiles', name: 'Profiles', what: 'Your learners.', how: [
    'Tap + Add a profile for a new learner, or Edit to change a name, kid or adult, the theme, or who shares it.',
    "On a kid's profile you'll find Kid login: give them their own login, change their password, or turn it off.",
  ] },
  { hash: '#/parent/family', name: 'Family settings', what: 'Settings for the whole family.', how: [
    'Your family name, default servings, the foods to leave out, casual or homeschool, and Plan our weeks.',
    'Voice step control is here too: it lets kids say "next," "back," or "again" in cook mode instead of tapping. Change what you like and tap Save.',
  ] },
  { hash: '#/parent/parents', name: 'Logins & PIN', what: 'Who can sign in as a parent, and the PIN.', how: [
    'Tap + Add a parent to give another adult their own login to your family.',
    'Change the PIN is below. The PIN keeps the parent screens for adults, since kitchen devices stay logged in.',
  ] },
  { hash: '#/parent/owner', name: 'Families & beta word', owner: true, what: 'Your owner tools.', how: [
    'Set or clear the beta word new families need to sign up, see the families using the app, and set a parent\'s password if they\'re locked out.',
  ] },
  { hash: '#/parent/fixes', name: 'Fix requests', owner: true, what: 'Suggestions from families to fix a lesson.', how: [
    "Apply one to change the lesson for every family, after the same checks as our content, or decline it. Anything applied can be reverted.",
  ] },
  { hash: '#/parent/reviews', name: 'Recipe reviews', owner: true, what: 'Shared recipes waiting on you.', how: [
    'Clear or decline each one, and decide whether it gets the Unleavened badge.',
  ] },
  { hash: '#/parent/reports', name: 'Reported recipes', owner: true, what: 'Recipes families have reported.', how: [
    'Hide one to take it out of User-shared recipes, and Unhide to put it back.',
  ] },
];

export const tourStops = (isOwner) => TOUR.filter((t) => !t.owner || isOwner);

async function showMeAround(ctx, chat) {
  const stops = tourStops(ctx.me().parent?.is_owner);
  chat.say("Love it! I'll take you to each parent screen, starting with the Queue. I'll step aside for a few seconds so you can look around, then pop back and tell you how to use it. Tap my button if you want me back sooner. Sound good?");
  if (await chat.choose([['go', "Sounds great, let's start!"], ['no', 'Never mind']]) === 'no') return false;
  for (const [i, t] of stops.entries()) {
    chat.say(`${i ? 'Next' : 'First'}, ${t.called ?? t.name}. ${t.what}`);
    let pick = 'again';
    while (pick === 'again') {
      await chat.peek(t.hash);
      for (const line of t.how) chat.say(line);
      const next = stops[i + 1];
      pick = await chat.choose([
        ['next', next ? `Next: ${next.name}` : 'Finish the tour'],
        ['again', 'Show me again'],
        ...(next ? [['stop', 'Stop the tour']] : []),
      ]);
    }
    if (pick === 'stop') { chat.say('No problem! Every screen is in the Menu button at the top.'); return true; }
  }
  chat.say("That's the tour! Every screen is in the Menu button at the top, and I'm right here if you need a hand.");
  return true;
}

// ---------- her menu, from the parent screens ----------

let current = null;

export function openRuth(ctx) {
  // Stepped aside for a tour stop: her button brings her back.
  if (current?.open) { current.resume(); return; }
  const chat = chatPanel(ctx, { required: false, onClose: () => { current = null; } });
  current = chat;
  chat.say(HELLO);
  const menu = async () => {
    for (;;) {
      chat.say('What can I help with?');
      const pick = await chat.choose([['tour', 'Show me around'], ['setup', 'Getting started (change your setup)'], ['bye', 'Nothing right now']]);
      if (pick === 'bye') { chat.say('Okay! Tap my button any time.'); return; }
      if (pick === 'setup') return gettingStarted(ctx, { again: true, chat });
      await showMeAround(ctx, chat);
    }
  };
  menu().catch((err) => chat.say(err.message));
}
