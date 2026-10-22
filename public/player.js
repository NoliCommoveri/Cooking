// The lesson player (plan §3, Phase 2): the lesson card, Learn, Prep, and Cook,
// drawn by the profile's theme (§5.4, §5.4a) with the showcase's components.
// Content comes from /content/ (lesson files and the registry) and is scaled in
// the browser with the same code the linter uses. Where a cook is up to is kept
// on this device, so leaving and coming back picks up at the same step, with
// timers still counting. In the app, each cook is also saved to the family's
// account for every profile on it (onCook); the demo saves nothing.
import { scaleLesson, servingOptions } from './lib/scale.js';
import { findTerms } from './lib/terms.js';
import { dietView } from './lib/diet.js';
import { voiceSupported, createVoice } from './voice.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ic = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="/icons.svg#${id}"/></svg>`;

let registry = null;
const lessons = {};
async function load(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("That lesson couldn't be loaded. Check the connection and try again.");
  return res.json();
}
const getRegistry = async () => (registry ??= await load('/content/registry.json'));
const getLesson = async (id) => (lessons[id] ??= await load(`/content/lessons/${encodeURIComponent(id)}.json`));

// ---------- saved state, per profile and lesson ----------
const key = (pid, lid) => `cpr.cook.${pid}.${lid}`;
function readState(pid, lid) {
  try { return JSON.parse(localStorage.getItem(key(pid, lid))) || null; } catch { return null; }
}
function writeState(pid, lid, s) {
  try { localStorage.setItem(key(pid, lid), JSON.stringify(s)); } catch { /* private mode: the cook still works, it just won't survive a reload */ }
}
function clearState(pid, lid) {
  try { localStorage.removeItem(key(pid, lid)); } catch { /* nothing kept */ }
}

// ---------- art and labels ----------
const LVL = {
  solo: { cls: 'solo', icon: 'i-spoon', head: 'Solo', kid: "You've got this one on your own." },
  'adult-nearby': { cls: '', icon: 'i-hat', head: 'Adult nearby', kid: 'A grown-up stays in the kitchen for this step.' },
  'adult-hands-on': { cls: 'hot', icon: 'i-mitt', head: 'Adult hands-on', kid: 'A grown-up helps with this step.' },
};
const SECTION_ICON = { produce: 's-produce', meat: 's-meat', fish: 's-fish', dairy: 's-dairy', bakery: 's-bakery', pantry: 's-pantry', canned: 's-canned', frozen: 's-frozen', spices: 's-pantry' };
const TOOL_ICON = { knives: 't-knives', pans: 't-pans', pots: 't-pots', bakeware: 't-bakeware', measuring: 't-measuring', mixing: 't-mixing', utensils: 't-utensils', openers: 't-opener', thermometers: 't-thermo' };
// The showcase drew these ingredients; everything else uses its store section's icon (§5.3a).
const OWN_ICON = { 'olive-oil': 'i-oil', 'onion-yellow': 'i-onion', 'bell-pepper-red': 'i-pepper', garlic: 'i-garlic', 'cumin-ground': 'i-cumin', 'paprika-smoked': 'i-paprika', 'tomatoes-crushed': 'i-tomato', egg: 'i-egg' };

const listNames = (n) => (n.length < 3 ? n.join(' and ') : `${n.slice(0, -1).join(', ')}, and ${n.at(-1)}`);
const fmt = (sec) => { sec = Math.max(0, Math.ceil(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`; };
const ago = (t) => { const m = Math.floor((Date.now() - t.endAt) / 60000); return m < 1 ? 'Ended just now' : `Ended ${m} min ago`; };
function ticks(cx, cy, r1, r2, n, stroke, w) {
  let o = '';
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n, s = Math.sin(a), c = Math.cos(a);
    o += `<line x1="${(cx + r1 * s).toFixed(1)}" y1="${(cy - r1 * c).toFixed(1)}" x2="${(cx + r2 * s).toFixed(1)}" y2="${(cy - r2 * c).toFixed(1)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return o;
}
function wedge(cx, cy, r, f) {
  if (f <= 0.001) return 'M0 0';
  if (f >= 0.999) return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  const a = 2 * Math.PI * f, x = cx + r * Math.sin(a), y = cy - r * Math.cos(a);
  return `M${cx} ${cy}L${cx} ${cy - r}A${r} ${r} 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`;
}
const dialSVG = (f) => `<svg viewBox="0 0 100 112" aria-hidden="true"><rect x="38" y="0" width="24" height="16" rx="4" fill="#2B2A28"/><circle cx="50" cy="62" r="46" fill="#D9412B" stroke="#2B2A28" stroke-width="3"/><circle cx="50" cy="62" r="38" fill="#FFF8E7"/><path fill="#F6C945" d="${wedge(50, 62, 36, f)}"/>${ticks(50, 62, 30, 36, 12, '#2B2A28', 2)}<circle cx="50" cy="62" r="7" fill="#2B2A28"/><path d="M50 62V30" stroke="#2B2A28" stroke-width="3" stroke-linecap="round"/></svg>`;
function cupSVG(done, of) {
  const f = of ? done / of : 0;
  return `<svg viewBox="0 0 120 150" role="img" aria-label="${done} of ${of} steps done"><defs><clipPath id="cupclip"><path d="M14 22h78l-7 116H21z"/></clipPath></defs>
  <path d="M92 44c24 0 26 46 0 50" fill="none" stroke="#2B2A28" stroke-width="9" stroke-linecap="round"/><path d="M14 22h78l-7 116H21z" fill="rgba(255,255,255,.75)"/>
  <g clip-path="url(#cupclip)"><rect x="0" y="${(138 - 116 * f).toFixed(1)}" width="120" height="${(116 * f + 2).toFixed(1)}" fill="#D9412B"/><rect x="0" y="${(138 - 116 * f).toFixed(1)}" width="120" height="5" fill="#F06A50"/></g>
  <path d="M14 22h78l-7 116H21z" fill="none" stroke="#2B2A28" stroke-width="3.5" stroke-linejoin="round"/><path d="M22 51h14M22 80h20M22 109h14" stroke="#2B2A28" stroke-width="2.5"/></svg>`;
}

// ---------- sound and the screen ----------
let audio = null;
function unlockSound() {
  if (audio) return;
  try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
}
function ding() {
  if (!audio) return;
  try {
    [0, 0.28, 0.56].forEach((d) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.0001, audio.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d + 0.25);
      o.start(audio.currentTime + d); o.stop(audio.currentTime + d + 0.26);
    });
  } catch { /* no sound on this device */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* no vibration */ }
}

// The screen stays awake during Prep and Cook (§3). Where the browser can't,
// a one-time tip says to raise the auto-lock time (§8.2).
let wake = null, wanted = false;
async function keepAwake(on) {
  wanted = on;
  if (!on) { try { await wake?.release(); } catch { /* already gone */ } wake = null; return true; }
  if (!('wakeLock' in navigator)) return false;
  try { wake = await navigator.wakeLock.request('screen'); return true; } catch { return false; }
}
document.addEventListener('visibilitychange', () => { if (wanted && document.visibilityState === 'visible') keepAwake(true); });

// ---------- the player ----------

// mount: the element to draw in. profile: the profile cooking. family: from
// /api/me. onExit: back to the quest board or recipe box. crew: the family's
// other profiles, who can join this cook. onCook(id, cook): saves the cook.
export async function openLesson(mount, { profile, family, lessonId, onExit, crew = [], onCook = null }) {
  const [R, L] = await Promise.all([getRegistry(), getLesson(lessonId)]);
  const quest = profile.theme === 'quest';
  const adult = profile.audience === 'adult';
  const view = dietView(L, R.ingredients, family.diet_filters);
  const options = servingOptions(L);
  const pick = (n) => (options.includes(n) ? n : options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a)));
  const fresh = () => ({ stage: 'card', servings: pick(family.default_servings), learn: 0, quiz: {}, got: [], gear: [], step: 0, timers: [], with: [] });
  let S = readState(profile.id, L.id) || fresh();
  S.with = (S.with ?? []).filter((id) => crew.some((p) => p.id === id));
  // A cook in progress reopens on its lesson card, with Keep going and Start over.
  if (S.stage !== 'done') S.stage = 'card';
  let term = null, why = null, tick = null;
  const save = () => writeState(profile.id, L.id, S);
  // The whole cook, sent each time it moves on (a new stage or step, servings,
  // who's on it, Plate it). Check-offs ride along with the next one.
  const sync = () => {
    if (!onCook || !S.cookId) return;
    onCook(S.cookId, {
      lesson_id: L.id, servings: S.servings, profile_ids: [profile.id, ...S.with], started_at: S.startedAt, finished_at: S.finishedAt ?? null,
      checklist_state: { stage: S.stage === 'card' ? S.last ?? 'learn' : S.stage, step: S.step, got: S.got, gear: S.gear },
    });
  };
  const begin = () => {
    S.started = true;
    if (S.cookId) return;
    const b = new Uint8Array(8);
    crypto.getRandomValues(b);
    S.cookId = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    S.startedAt = new Date().toISOString();
  };
  // Voice step control (§6.12): only where the family turned it on and the
  // device can recognize speech. The mic starts on a tap, never on its own.
  const voiceOk = Boolean(family.voice_enabled) && voiceSupported();
  let voice = null, voiceStatus = 'off';
  const VOICE_LABEL = {
    off: 'Voice: tap to say "next"',
    listening: 'Listening: say "next," "back," or "again"',
    speaking: 'Reading it out…',
    offline: 'Voice paused, no connection',
    blocked: "The mic is blocked. Allow it in this browser's settings, then tap here",
  };
  const voiceBtn = () => (voiceOk
    ? `<button type="button" class="${quest ? 'q-tstart' : 'p-tstart'} voicebtn" data-act="voice" aria-pressed="${voiceStatus !== 'off' && voiceStatus !== 'blocked'}">${ic('i-mic')}<span data-voice-label>${esc(VOICE_LABEL[voiceStatus])}</span></button>`
    : '');
  function onVoiceStatus(st) {
    voiceStatus = st;
    const b = mount.querySelector('[data-act="voice"]');
    if (!b) return;
    b.setAttribute('aria-pressed', String(st !== 'off' && st !== 'blocked'));
    b.querySelector('[data-voice-label]').textContent = VOICE_LABEL[st];
  }
  // What "next" says on a doneness step instead of moving on, so a stray
  // "next" can't skip a food-safety check.
  const targetSpeech = (t) => `${t.temp ? `Check it with the thermometer. It's done at ${t.temp} degrees.` : `It's done when ${t.look}.`} Tap Next when it is.`;
  function onVoice(cmd) {
    if (!mount.isConnected) return voice.destroy(); // left by the browser's back button
    if (S.stage !== 'cook' || why) return;
    const steps = scaled().steps, i = Math.min(S.step, steps.length - 1), s = steps[i];
    if (cmd === 'again') return voice.say(s.text);
    if (cmd === 'next') {
      if (s.type === 'doneness' && s.target) return voice.say(targetSpeech(s.target));
      if (i === steps.length - 1) return voice.say('That was the last step. Tap Plate it when you are done.');
      S.step = i + 1;
    } else {
      if (i === 0) return; // "back" doesn't leave cook mode; the Prep button does
      S.step = i - 1;
    }
    term = null;
    save();
    sync();
    draw();
    // Hands-free: the step "next" moves to is read aloud (owner, 2026-10-22).
    if (cmd === 'next') voice.say(scaled().steps[S.step].text);
  }
  const crewNames = () => [profile, ...crew.filter((p) => S.with.includes(p.id))].map((p) => p.name);

  const leftOut = new Set(view.leftOut);
  const swapFor = Object.fromEntries(view.applied.map((x) => [x.for, x.use]));
  const name = (id) => R.ingredients[id]?.name ?? id;
  const scaled = () => scaleLesson(L, R.ingredients, S.servings);
  const ingredientsNow = () => scaled().ingredients.filter((i) => !leftOut.has(i.id));
  const tools = L.equipment.map((id) => R.equipment[id] ?? { id, name: id, category: 'utensils' });

  // classes that differ by theme
  const T = quest
    ? { btn: 'q-btn', back: 'q-back', h: 'q-h', kick: 'q-kick', card: 'q-panel lore', note: 'q-note' }
    : { btn: 'p-btn', back: 'p-back', h: 'p-h', kick: 'p-kick', card: 'p-card p-lore', note: 'p-note' };
  const tape = quest ? '' : '<i class="tape t1"></i>';

  function banner(level, hazard) {
    const lv = LVL[level] ?? LVL.solo;
    const cls = quest ? 'q-banner' : 'p-banner';
    // An adult profile sees only the hazard, without "an adult must…" (§3).
    if (adult) return `<div class="${cls} ${lv.cls}" role="note">${ic(lv.icon)}<div><b>${esc(hazard || lv.head)}</b></div></div>`;
    return `<div class="${cls} ${lv.cls}" role="note">${ic(lv.icon)}<div><b>${esc(lv.head)}</b>${esc(lv.kid)}${hazard ? ` ${esc(hazard)}.` : ''}</div></div>`;
  }

  // Step text with kitchen words as buttons (§6.1).
  function withTerms(text) {
    const hits = findTerms(text, R.terms);
    let out = '', at = 0;
    for (const h of hits) {
      out += esc(text.slice(at, h.start)) + `<button type="button" class="kw" data-act="term" data-id="${esc(h.id)}">${esc(text.slice(h.start, h.end))}</button>`;
      at = h.end;
    }
    return out + esc(text.slice(at));
  }
  function termCard() {
    if (!term) return '';
    const t = R.terms.find((x) => x.id === term);
    if (!t) return '';
    const taught = R.lessons.find((x) => x.number === t.taughtIn);
    return `<div class="kwcard" role="note"><b>${esc(t.word)}</b><p>${esc(t.means)}</p>${taught ? `<small>Practiced in lesson ${taught.number}, ${esc(taught.title)}</small>` : ''}<button type="button" class="kwclose" data-act="term" data-id="">Got it</button></div>`;
  }

  // ---------- the lesson card ----------
  function cardView() {
    const cu = R.cuisines[L.cuisine]?.name ?? L.cuisine;
    const sc = scaled();
    const fixedSizes = L.scaling.mode === 'fixed';
    const picker = quest
      ? `<div class="serve"><span class="lbl">Party size</span>${fixedSizes
        ? `<div class="sizes" role="radiogroup" aria-label="Servings">${options.map((n) => `<button type="button" class="size" role="radio" aria-checked="${n === S.servings}" data-act="serv-set" data-n="${n}">${n}</button>`).join('')}</div>`
        : `<div class="serve-row"><button type="button" class="step" data-act="serv" data-i="-1" aria-label="Fewer servings" ${S.servings <= options[0] ? 'disabled' : ''}>−</button><span class="num" aria-live="polite">${S.servings}</span><button type="button" class="step" data-act="serv" data-i="1" aria-label="More servings" ${S.servings >= options.at(-1) ? 'disabled' : ''}>+</button></div><div class="heads" aria-hidden="true">${ic('i-hat', '').repeat(S.servings)}</div>`}
        <p class="meta">Your family's usual: ${family.default_servings}</p>${sc.note ? `<p class="pan">${ic('t-pans')}${esc(sc.note)}</p>` : ''}</div>`
      : `<div class="p-serve">${fixedSizes
        ? `<div class="p-serve-row"><span class="p-lbl">Serves</span>${options.map((n) => `<button type="button" class="p-step" style="width:auto;padding:0 14px" aria-pressed="${n === S.servings}" data-act="serv-set" data-n="${n}">${n}</button>`).join('')}</div>`
        : `<div class="p-serve-row"><span class="p-lbl">Serves</span><button type="button" class="p-step" data-act="serv" data-i="-1" aria-label="Fewer servings" ${S.servings <= options[0] ? 'disabled' : ''}>−</button><span class="p-num" aria-live="polite">${S.servings}</span><button type="button" class="p-step" data-act="serv" data-i="1" aria-label="More servings" ${S.servings >= options.at(-1) ? 'disabled' : ''}>+</button></div><div class="p-plates" aria-hidden="true">${'<svg viewBox="0 0 100 100"><use href="/icons.svg#plate"/></svg>'.repeat(S.servings)}</div>`}
        <p class="p-small">Your family's usual: ${family.default_servings}</p>${sc.note ? `<p class="p-pan">${ic('t-pans')}${esc(sc.note)}</p>` : ''}</div>`;
    const changes = [
      ...view.applied.map((x) => `Use ${esc(name(x.use).toLowerCase())} instead of ${esc(name(x.for).toLowerCase())}.`),
      ...view.leftOut.map((id) => `Leave out the ${esc(name(id).toLowerCase())}.`),
    ];
    const swaps = changes.length ? `<p class="${T.note}"><b>For your family:</b> ${changes.join(' ')}</p>` : '';
    // Profiles cooking together share one cook, and it counts for each of them (§1).
    const who = crew.length
      ? `<div class="${quest ? 'serve' : 'p-serve'} crew"><span class="${quest ? 'lbl' : 'p-lbl'}">Cooking with someone?</span><div class="${quest ? 'sizes' : 'p-sizes'}" role="group" aria-label="Who's cooking">${crew.map((p) => `<button type="button" class="${quest ? 'size' : 'p-size'}" role="checkbox" aria-checked="${S.with.includes(p.id)}" data-act="crew" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div></div>`
      : '';
    const top = quest
      ? `<article class="q-panel q-card"><p class="q-kick">Path ${L.unit} · Quest ${L.number}</p><div class="q-win"><img src="/img/${esc(L.image.replace(/\.png$/, '.webp'))}" alt="" width="230" height="230"></div>
          <h2 class="q-title">${esc(L.title)}</h2><p class="q-skill"><b>${esc(L.skill)}</b></p>
          <dl class="q-stats"><div><dt>Time</dt><dd>${L.totalMinutes} min</dd></div><div><dt>From</dt><dd>${esc(cu)}</dd></div><div><dt>Steps</dt><dd>${L.steps.length}</dd></div></dl>${picker}${who}${swaps}
          <button type="button" class="q-btn" data-act="start">${!S.started ? 'Start quest' : 'Keep going'}</button></article>`
      : `<article class="p-card p-main" style="padding:26px 20px 18px;display:grid;gap:8px"><i class="tape t1"></i><i class="tape t2"></i><div class="p-photo"><img src="/img/${esc(L.image.replace(/\.png$/, '.webp'))}" alt="" width="250" height="250"></div>
          <h2 class="p-title">${esc(L.title)}</h2><p class="p-skill">${esc(L.skill)}</p>
          <div class="p-meta"><span>${L.totalMinutes} min</span><span>${esc(cu)}</span><span>${L.steps.length} steps</span></div>${picker}${who}${swaps}
          <button type="button" class="p-btn" data-act="start">${!S.started ? "Let's cook" : 'Keep going'}</button></article>`;
    const restart = S.started ? `<button type="button" class="${T.back}" data-act="restart">Start over</button>` : '';
    return `${top}<div class="${quest ? 'q-nav' : 'p-nav'}" style="margin-top:12px">${restart}</div>`;
  }

  // ---------- Learn (§3): the move, why it works, same move elsewhere, when it goes wrong, quiz ----------
  function learnCards() {
    const cards = [];
    if (L.learn.callback) {
      const cb = R.lessons.find((x) => x.number === L.learn.callback.lesson);
      cards.push({ kind: 'You did this before', title: cb ? cb.title : '', body: L.learn.callback.body, img: cb?.image });
    }
    cards.push({ kind: 'The move', title: L.learn.move.title, body: L.learn.move.body });
    for (const w of L.learn.why) cards.push({ kind: 'Why it works', title: w.title, body: w.body });
    // Same move, other dishes: built from the skills across every lesson (§3).
    const others = L.skills.map((sk) => ({ sk, list: R.lessons.filter((x) => x.id !== L.id && x.skills.includes(sk)) })).filter((x) => x.list.length);
    if (others.length) cards.push({ kind: 'Same move, other dishes', title: 'Where else this works', xfer: others });
    if (L.learn.wrong?.length) cards.push({ kind: 'When it goes wrong', title: 'How to tell, and how to fix it', wrong: L.learn.wrong });
    if (L.learn.quiz?.length) cards.push({ kind: 'Quick quiz', title: 'Want to try?', quiz: L.learn.quiz });
    return cards;
  }
  function loreCard(c) {
    let body;
    if (c.xfer) {
      body = `<div class="xfer">${c.xfer.map(({ sk, list }) => `<div class="${quest ? '' : 'p-xfer'}"><h5>${esc(R.skills[sk]?.name ?? sk)}</h5><div class="xdishes">${list.map((d) => `<div class="${quest ? 'xd' : 'p-xd'}"><img src="/${esc(d.image)}" alt="" width="64" height="64">${esc(d.title)}<small>Lesson ${d.number}</small></div>`).join('')}</div></div>`).join('')}</div>`;
    } else if (c.wrong) {
      body = `<ul class="${quest ? 'wrongs' : 'p-wrongs'}">${c.wrong.map((w) => `<li><b>${esc(w.sign)}</b>${esc(w.fix)}</li>`).join('')}</ul>`;
    } else if (c.quiz) {
      body = c.quiz.map((q, qi) => {
        const got = S.quiz[qi];
        const opt = quest ? 'qopt' : 'p-qopt';
        return `<div class="quiz"><p class="qq" style="font-weight:800;font-size:17px;margin:0">${esc(q.q)}</p>${q.choices.map((o, oi) => `<button type="button" class="${opt} ${got === undefined ? '' : oi === q.answer ? 'right' : oi === got ? 'wrong' : ''}" data-act="quiz" data-q="${qi}" data-i="${oi}">${esc(o)}</button>`).join('')}${got !== undefined ? `<p class="${quest ? 'qfb' : 'p-qfb'}">${got === q.answer ? 'Yes! ' : 'Not quite. '}${esc(q.explain ?? '')}</p>` : ''}</div>`;
      }).join('');
    } else if (c.img) {
      body = `<div class="callimg"><img src="/${esc(c.img)}" alt="" width="84" height="84"><p>${esc(c.body)}</p></div>`;
    } else {
      body = `<p>${esc(c.body)}</p>`;
    }
    return `<article class="${T.card}">${tape}<p class="${T.kick}">${esc(c.kind)}</p>${c.title ? `<h4>${esc(c.title)}</h4>` : ''}${body}</article>`;
  }
  function learnView() {
    const cards = learnCards(), n = cards.length, i = Math.min(S.learn, n - 1);
    const seg = quest
      ? `<div class="tut-seg" style="--n:${n}" aria-hidden="true">${cards.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div>`
      : `<div class="p-dots" aria-hidden="true">${cards.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div>`;
    return `<div class="learn" style="max-width:680px">
      <div class="${quest ? 'tut-top' : 'p-top'}"><p class="${quest ? 'q-kick' : 'p-sub'}">Learn · ${i + 1} of ${n}</p><button type="button" class="${quest ? 'tut-skip' : 'p-skip'}" data-act="goto" data-to="prep">Skip to Prep</button></div>
      ${seg}${loreCard(cards[i])}
      <div class="${quest ? 'tut-nav' : 'p-tnav'}"><button type="button" class="${T.back}" data-act="learn" data-i="-1">Back</button>${i < n - 1 ? `<button type="button" class="${T.btn}" data-act="learn" data-i="1">Next card</button>` : `<button type="button" class="${T.btn}" data-act="goto" data-to="prep">On to Prep</button>`}</div></div>`;
  }

  // ---------- Prep (§3): ingredients, then tools; cook mode unlocks when both are checked ----------
  function prepView() {
    const ing = ingredientsNow(), got = new Set(S.got), gear = new Set(S.gear);
    const allI = ing.every((i) => got.has(i.id)), allG = tools.every((t) => gear.has(t.id));
    const label = (i) => `${i.line}${i.prep ? `, ${i.prep}` : ''}${i.optional ? ' (optional)' : ''}`;
    const iconOf = (i) => OWN_ICON[i.id] ?? SECTION_ICON[R.ingredients[i.id]?.section] ?? 's-pantry';
    const swapNote = (i) => (swapFor[i.id] ? `<small>Use ${esc(name(swapFor[i.id]).toLowerCase())} instead</small>` : '');
    const unlock = allI && allG
      ? `<div class="${quest ? 'gate' : 'p-gate'}"><button type="button" class="${T.btn}" data-act="goto" data-to="cook">${quest ? 'Enter the kitchen' : 'Start cooking'}</button></div>`
      : `<p class="${quest ? 'gate' : 'p-gate'}">${ic('i-lock')}Check off everything to unlock cook mode</p>`;
    if (quest) {
      const meter = (n, of) => `<div class="q-meter" style="--n:${of}" aria-hidden="true">${Array.from({ length: of }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</div>`;
      return `<h3 class="q-h">Gather supplies <span>${ing.filter((i) => got.has(i.id)).length}/${ing.length}</span></h3>${meter(ing.filter((i) => got.has(i.id)).length, ing.length)}
        <div class="q-inv">${ing.map((i) => `<button type="button" class="q-slot ${got.has(i.id) ? 'on' : ''}" data-act="got" data-id="${esc(i.id)}" aria-pressed="${got.has(i.id)}">${ic(iconOf(i), 'ii')}<span class="nm">${esc(label(i))}</span>${swapNote(i)}</button>`).join('')}</div>
        <div class="gear" style="margin-top:18px"><h3 class="q-h">Gear loadout <span>${tools.filter((t) => gear.has(t.id)).length}/${tools.length}</span></h3>${meter(tools.filter((t) => gear.has(t.id)).length, tools.length)}
        <div class="q-inv">${tools.map((t) => `<button type="button" class="q-slot ${gear.has(t.id) ? 'on' : ''}" data-act="gear" data-id="${esc(t.id)}" aria-pressed="${gear.has(t.id)}">${ic(TOOL_ICON[t.category] ?? 't-utensils', 'ii')}<span class="nm">${esc(t.name)}</span></button>`).join('')}</div></div>${unlock}`;
    }
    const inBowl = ing.filter((i) => got.has(i.id));
    const spots = [[24, 52], [68, 56], [112, 56], [156, 52], [46, 30], [90, 32], [134, 30], [90, 8]];
    const heap = inBowl.slice(0, spots.length).map((i, k) => `<use href="/icons.svg#${iconOf(i)}" x="${spots[k][0]}" y="${spots[k][1]}" width="56" height="56"/>`).join('');
    return `<div class="p-prep"><div class="p-bowlwrap"><svg class="p-bowl" viewBox="0 0 240 182" role="img" aria-label="Mixing bowl with ${inBowl.length} of ${ing.length} ingredients">
        <ellipse cx="120" cy="96" rx="104" ry="16" fill="#BFAE8F" stroke="#2B2A28" stroke-width="3"/><g>${heap}</g>
        <path d="M14 96H226C226 150 180 178 120 178S14 150 14 96Z" fill="#F4EBD8" stroke="#2B2A28" stroke-width="3" stroke-linejoin="round"/>
        <path d="M22 116H218" stroke="#D9412B" stroke-width="7"/><path d="M34 132H206" stroke="#D9412B" stroke-width="3"/></svg>
        <p class="p-count">${inBowl.length} of ${ing.length} in the bowl</p></div>
      <div class="p-card p-lined p-list"><i class="tape t1"></i><h3 class="p-h">Ingredients <span>for ${S.servings}</span></h3>
        ${ing.map((i) => `<button type="button" class="p-item ${got.has(i.id) ? 'on' : ''}" data-act="got" data-id="${esc(i.id)}" aria-pressed="${got.has(i.id)}">${ic(iconOf(i), 'ii')}<span class="nm">${esc(label(i))}${swapNote(i)}</span><svg class="p-ck" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13"/><path d="M9 16l5 5 9-10"/></svg></button>`).join('')}</div></div>
      <h3 class="p-h" style="margin-top:18px">Pegboard <span>${tools.filter((t) => gear.has(t.id)).length} of ${tools.length}</span></h3>
      <div class="p-peg"><div class="p-tools">${tools.map((t) => `<button type="button" class="p-tool ${gear.has(t.id) ? 'on' : ''}" data-act="gear" data-id="${esc(t.id)}" aria-pressed="${gear.has(t.id)}"><span class="hook" aria-hidden="true"></span>${ic(TOOL_ICON[t.category] ?? 't-utensils', 'ii')}<span class="got" aria-hidden="true">${ic('i-check', '')}</span><span class="tag">${esc(t.name)}</span></button>`).join('')}</div></div>${unlock}`;
  }

  // ---------- Cook (§3) ----------
  function timerTray() {
    const live = S.timers.filter((t) => t.state !== 'idle');
    const left = (t) => (t.state === 'run' ? Math.max(0, (t.endAt - Date.now()) / 1000) : t.left);
    if (quest) {
      const C = 2 * Math.PI * 40;
      return `<h3 class="q-h" style="margin-top:14px">Timer tray</h3><div class="q-timers" aria-label="Timers">${live.length ? live.map((t) => `<div class="q-timer ${t.state}${t.ringing ? ' ringing' : ''}">
        <button type="button" class="dial" data-act="${t.state === 'ended' ? 'tclear' : 'ttoggle'}" data-step="${esc(t.step)}" aria-label="${esc(t.label)} timer: ${t.state === 'run' ? 'pause' : t.state === 'paused' ? 'resume' : 'clear'}">
        <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="#1A2042" stroke="#3D4985" stroke-width="9"/>
        <circle data-ring="${esc(t.step)}" cx="50" cy="50" r="40" fill="none" stroke="${t.state === 'paused' ? '#A6AED8' : '#5BD6C8'}" stroke-width="9" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - left(t) / t.sec)).toFixed(1)}" transform="rotate(-90 50 50)"/>
        ${ticks(50, 50, 46, 49, 8, '#F2B640', 2.5)}<text x="50" y="57" text-anchor="middle" font-size="${t.state === 'ended' ? 15 : 20}" data-left="${esc(t.step)}">${t.state === 'ended' ? (t.ringing ? 'DONE!' : 'Done') : fmt(left(t))}</text></svg></button>
        <span class="lb">${esc(t.label)}${t.state === 'paused' ? '<br>Paused' : ''}${t.state === 'ended' && !t.ringing ? `<br>${ago(t)}` : ''}</span>
        ${t.ringing ? `<button type="button" class="stop" data-act="tclear" data-step="${esc(t.step)}">Stop</button>` : ''}</div>`).join('') : '<span class="empty">No timers running. Start one from a step.</span>'}</div>`;
    }
    return `<h3 class="p-h" style="margin-top:14px">The counter</h3><div class="p-counter" aria-label="Timers">${live.length ? live.map((t) => `<div class="p-timer ${t.state}${t.ringing ? ' ringing' : ''}">
      <button type="button" class="dial" data-act="${t.state === 'ended' ? 'tclear' : 'ttoggle'}" data-step="${esc(t.step)}" aria-label="${esc(t.label)} timer: ${t.state === 'run' ? 'pause' : t.state === 'paused' ? 'resume' : 'clear'}">${dialSVG(left(t) / t.sec)}</button>
      <span class="lb">${esc(t.label)}${t.state === 'paused' ? ' · paused' : ''}</span>
      ${t.state === 'ended' ? `<span class="tt">${t.ringing ? "Time's up!" : 'Done'}</span>${t.ringing ? '' : `<span class="ago">${ago(t)}</span>`}` : `<span class="tt" data-left="${esc(t.step)}">${fmt(left(t))}</span>`}
      ${t.ringing ? `<button type="button" class="stop" data-act="tclear" data-step="${esc(t.step)}">Stop</button>` : ''}</div>`).join('') : '<span class="empty">No timers going. Start one from a step.</span>'}</div>`;
  }

  function cookView() {
    const steps = scaled().steps, n = steps.length, i = Math.min(S.step, n - 1), s = steps[i], last = i === n - 1;
    const notes = [];
    if (s.type === 'doneness' && s.target) {
      notes.push(s.target.temp
        ? `<p class="${T.note} done-target">${ic('i-thermo')}<b>Thermometer:</b> at least ${s.target.temp}°${esc(s.target.unit || 'F')}</p>`
        : `<p class="${T.note} done-target">${ic('i-check')}<b>Done when:</b> ${esc(s.target.look)}</p>`);
    }
    if (s.look) notes.push(`<p class="${T.note}"><b>Should look like:</b> ${esc(s.look)}</p>`);
    if (s.tip) notes.push(`<p class="${T.note}"><b>Tip:</b> ${esc(s.tip)}</p>`);
    const timer = S.timers.find((t) => t.step === s.id);
    const startTimer = s.timerSeconds && (!timer || timer.state === 'idle')
      ? `<button type="button" class="${quest ? 'q-tstart' : 'p-tstart'}" data-act="tstart" data-step="${esc(s.id)}">${ic('i-clock')}Start the ${fmt(s.timerSeconds)} timer${s.timerLabel ? `: ${esc(s.timerLabel)}` : ''}</button>` : '';
    const whyBtn = s.why ? `<button type="button" class="${quest ? 'whybtn' : 'p-why'}" data-act="why" data-id="${esc(s.why)}">${ic('i-flame')}Why?</button>` : '';
    const text = `${s.type === 'wash' ? `${ic('i-wash')} ` : ''}${withTerms(s.text)}`;
    const nav = `<div class="${quest ? 'q-nav' : 'p-nav'}"><button type="button" class="${T.back}" data-act="step" data-i="-1">${i === 0 ? 'Prep' : 'Back'}</button><button type="button" class="${T.btn}" data-act="${last ? 'finish' : 'step'}" data-i="1">${last ? 'Plate it' : 'Next step'}</button></div>`;
    const body = quest
      ? `<div class="q-cook">${banner(s.safety, s.hazard)}<div class="q-stages" style="grid-template-columns:repeat(${n},1fr)" role="img" aria-label="Stage ${i + 1} of ${n}">${steps.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div>
          <article class="q-panel q-log"><p class="q-kick">Stage ${i + 1} of ${n}</p><p class="steptxt">${text}</p>${termCard()}${notes.join('')}${startTimer}<div class="logacts">${whyBtn}${voiceBtn()}</div></article>${nav}</div>`
      : `<div class="p-cook">${banner(s.safety, s.hazard)}<div class="p-cookbody"><article class="p-card p-lined p-stepcard"><p class="p-stepno">Step ${i + 1} of ${n}</p><p class="p-steptxt">${text}</p>${termCard()}${notes.join('')}${startTimer}<div class="p-acts">${whyBtn}${voiceBtn()}</div></article>
          <div class="p-cup">${cupSVG(i, n)}<span>${i} of ${n} done</span></div></div>${nav}</div>`;
    return body + timerTray();
  }

  function whyView() {
    if (!why) return '';
    const c = L.learn.why.find((w) => w.id === why);
    if (!c) return '';
    return `<div class="whyov" data-act="why-close"><div class="${T.card}" role="dialog" aria-modal="true" aria-label="Why: ${esc(c.title)}">${tape}<p class="${T.kick}">Why? · from the Learn cards</p><h4>${esc(c.title)}</h4><p>${esc(c.body)}</p><button type="button" class="${T.btn}" data-act="why-close">Back to cooking</button></div></div>`;
  }

  function doneView() {
    return `<article class="${T.card}" style="text-align:center;justify-items:center">${tape}<p class="${T.kick}">${quest ? 'Quest cleared' : 'Dish done'}</p><h4>${esc(L.title)}</h4>
      <div class="${quest ? 'q-win' : 'p-photo'}" style="max-width:220px"><img src="/img/${esc(L.image.replace(/\.png$/, '.webp'))}" alt="" width="220" height="220"></div>
      <p>Nice cooking. Plate it up and enjoy it.</p>${onCook ? `<p class="${T.note}">This cook counts for ${esc(listNames(crewNames()))}.</p>` : ''}<button type="button" class="${T.btn}" data-act="exit-done">${quest ? 'Back to the quest board' : 'Back to the recipe box'}</button></article>`;
  }

  // ---------- drawing and events ----------
  const STAGES = { card: cardView, learn: learnView, prep: prepView, cook: cookView, done: doneView };
  let wakeTipShown = false;
  async function draw(focusTop = true) {
    if (S.stage !== 'card' && S.stage !== 'done') { S.last = S.stage; save(); }
    const back = `<a class="back" href="#" data-act="exit">← ${quest ? 'Quest board' : 'Recipe box'}</a>`;
    mount.innerHTML = `<section class="kitchen qx player" data-kt="${quest ? 'quest' : 'passport'}">${back}${STAGES[S.stage]()}${whyView()}</section>`;
    if (focusTop) window.scrollTo(0, 0);
    if (S.stage !== 'cook' && voice?.on) voice.stop();
    const awake = S.stage === 'prep' || S.stage === 'cook';
    const ok = await keepAwake(awake);
    if (awake && !ok && !wakeTipShown && !readFlag('cpr.waketip')) {
      wakeTipShown = true;
      setFlag('cpr.waketip');
      mount.querySelector('.player').insertAdjacentHTML('afterbegin', `<p class="${T.note}"><b>Tip:</b> this device may turn its screen off while you cook. Set its auto-lock to a longer time in the device's settings.</p>`);
    }
    clearInterval(tick);
    if (S.stage === 'cook' && S.timers.some((t) => t.state === 'run' || t.ringing)) tick = setInterval(onTick, 1000);
  }
  function onTick() {
    let changed = false;
    for (const t of S.timers) {
      if (t.state === 'run' && Date.now() >= t.endAt) { t.state = 'ended'; t.ringing = true; changed = true; ding(); }
    }
    if (changed) { save(); return draw(false); }
    for (const t of S.timers) {
      if (t.state !== 'run') continue;
      const left = Math.max(0, (t.endAt - Date.now()) / 1000);
      mount.querySelectorAll(`[data-left="${CSS.escape(t.step)}"]`).forEach((n) => { n.textContent = fmt(left); });
      const ring = mount.querySelector(`[data-ring="${CSS.escape(t.step)}"]`);
      if (ring) ring.setAttribute('stroke-dashoffset', (2 * Math.PI * 40 * (1 - left / t.sec)).toFixed(1));
      const wedgePath = mount.querySelector(`.p-timer [data-step="${CSS.escape(t.step)}"] path[fill="#F6C945"]`);
      if (wedgePath) wedgePath.setAttribute('d', wedge(50, 62, 36, left / t.sec));
    }
  }
  // A timer that ended while the app was closed shows as ended, not ringing (§8.2).
  for (const t of S.timers) if (t.state === 'run' && Date.now() >= t.endAt) { t.state = 'ended'; t.ringing = false; }

  function readFlag(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function setFlag(k) { try { localStorage.setItem(k, '1'); } catch { /* not kept */ } }

  function exit() {
    clearInterval(tick);
    voice?.destroy();
    keepAwake(false);
    mount.removeEventListener('click', onClick);
    onExit();
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || !mount.contains(b)) return;
    if (b.dataset.act === 'why-close' && b.classList.contains('whyov') && e.target !== b) return;
    e.preventDefault();
    unlockSound();
    const act = b.dataset.act, d = b.dataset;
    const step = (dir) => {
      const n = L.steps.length;
      if (dir < 0 && S.step === 0) S.stage = 'prep';
      else S.step = Math.max(0, Math.min(n - 1, S.step + dir));
      term = null;
    };
    switch (act) {
      case 'exit': return exit();
      case 'exit-done': clearState(profile.id, L.id); return exit();
      case 'serv': S.servings = options[Math.max(0, Math.min(options.length - 1, options.indexOf(S.servings) + Number(d.i)))]; break;
      case 'serv-set': S.servings = Number(d.n); break;
      case 'start': S.stage = S.started ? S.last || 'learn' : 'learn'; begin(); break;
      case 'restart': S = fresh(); break;
      case 'crew': S.with = S.with.includes(d.id) ? S.with.filter((x) => x !== d.id) : [...S.with, d.id]; break;
      case 'learn': {
        const next = S.learn + Number(d.i);
        if (next < 0) S.stage = 'card'; else S.learn = Math.min(learnCards().length - 1, next);
        break;
      }
      case 'quiz': if (S.quiz[d.q] === undefined) S.quiz[d.q] = Number(d.i); return save(), draw(false);
      case 'goto': S.stage = d.to; begin(); break;
      case 'got': case 'gear': {
        const list = act === 'got' ? S.got : S.gear, at = list.indexOf(d.id);
        if (at >= 0) list.splice(at, 1); else list.push(d.id);
        save();
        return draw(false);
      }
      case 'step': step(Number(d.i)); break;
      case 'finish': S.stage = 'done'; S.timers = []; S.finishedAt = new Date().toISOString(); break;
      case 'term': term = d.id && d.id !== term ? d.id : null; return draw(false);
      case 'why': why = d.id; return draw(false);
      case 'why-close': why = null; return draw(false);
      case 'tstart': {
        const s = L.steps.find((x) => x.id === d.step);
        S.timers = S.timers.filter((t) => t.step !== s.id);
        S.timers.push({ step: s.id, label: s.timerLabel || 'Timer', sec: s.timerSeconds, endAt: Date.now() + s.timerSeconds * 1000, state: 'run' });
        save();
        return draw(false);
      }
      case 'ttoggle': {
        const t = S.timers.find((x) => x.step === d.step);
        if (t.state === 'run') { t.left = Math.max(0, (t.endAt - Date.now()) / 1000); t.state = 'paused'; } else { t.endAt = Date.now() + t.left * 1000; t.state = 'run'; }
        save();
        return draw(false);
      }
      case 'voice':
        voice ??= createVoice({ onCommand: onVoice, onStatus: onVoiceStatus });
        if (voice.on) voice.stop(); else voice.start();
        return;
      case 'tclear': S.timers = S.timers.filter((x) => x.step !== d.step); save(); return draw(false);
      default: return;
    }
    save();
    sync();
    draw();
  }
  mount.addEventListener('click', onClick);
  draw();
}
