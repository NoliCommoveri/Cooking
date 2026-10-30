// Print and complete offline (plan §6.22, release 3): Print recipes and Print
// coursework fill the browser's print window (where it can be saved as a PDF)
// with a course's coming weeks, and Completed offline marks what was done
// away from the app: any of a week's four parts, the recipe included. For a
// learner in their kitchen or a parent on the course card. The app's helpers
// come in ctx, as Chef Ruth's do.
import { recipeSheet } from './player.js';
import { PART_NAMES } from './lib/levels.js';

// A Level week's four components, in the owner's order (§12.4).
const ORDER = ['knowledge', 'drill', 'recipe', 'sabbath'];
const NAMES = { ...PART_NAMES, recipe: 'Recipe' };
const MAX_WEEKS = 8;
// The release this comes with (src/worker/release.js).
export const OFFLINE_RELEASE = 3;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const load = (ctx, pid, n) => ctx.api('GET', `/api/profiles/${pid}/offline?weeks=${n}&${ctx.tz()}`);
const weekWords = (ctx, w) => `Week of ${ctx.fmtDay(w.week_start, { month: 'long', day: 'numeric' })}`;

// How many weeks, from this one.
const weeksPick = (ctx, n = 1) => ctx.el('select', { 'aria-label': 'How many weeks' },
  Array.from({ length: MAX_WEEKS }, (_, i) => ctx.el('option', { value: i + 1, selected: i + 1 === n }, i === 0 ? 'This week' : `This week and the next ${i}`)));

// The sheet over the page, printed on its own (app.css hides the rest), with
// Close for a device whose print window doesn't open.
function printSheet(ctx, title, html) {
  const close = () => { sheet.remove(); document.body.classList.remove('printing'); window.removeEventListener('afterprint', close); };
  const sheet = ctx.el('div', { class: 'printsheet' },
    ctx.el('div', { class: 'acts noprint' },
      ctx.el('button', { type: 'button', class: 'hbtn pri', onclick: () => window.print() }, 'Print or save as PDF'),
      ctx.el('button', { type: 'button', class: 'hbtn', onclick: close }, 'Close')));
  const body = ctx.el('div', { class: 'ps-body' });
  body.innerHTML = `<header class="ps-head"><h1>${esc(title)}</h1><p>Clean Plate Recipes · printed ${esc(ctx.fmtDay(ctx.localToday(), { year: 'numeric', month: 'long', day: 'numeric' }))}</p></header>${html}`;
  sheet.append(body);
  document.body.append(sheet);
  document.body.classList.add('printing');
  window.addEventListener('afterprint', close);
  setTimeout(() => window.print(), 300);
}

// One part page, for paper: its reading, steps, watch-for list, quiz with
// boxes to tick, and lines under each writing box.
function partPage(course, e, x) {
  const quiz = (x.quiz ?? []).map((q) => `<li><b>${esc(q.q)}</b><ul class="ps-choices">${q.choices.map((c) => `<li><span class="ps-box"></span>${esc(c)}</li>`).join('')}</ul></li>`).join('');
  const write = (x.write ?? []).map((b) => `<div class="ps-write"><b>${esc(b.label)}</b>${b.hint ? `<small>${esc(b.hint)}</small>` : ''}${x.written?.[b.id] ? `<p class="ps-typed">${esc(x.written[b.id])}</p>` : '<div class="ps-lines"></div>'}</div>`).join('');
  const written = x.body?.length || x.steps?.length || x.quiz?.length;
  return `<article class="ps-page">
    <p class="ps-kick">${esc(course.name)} · Week ${e.level_week} · ${esc(NAMES[x.part])}</p>
    <h2>${esc(x.title)}</h2><p class="ps-meta">About ${x.minutes} minutes</p>
    ${(x.body ?? []).map((t) => `<p>${esc(t)}</p>`).join('')}
    ${x.steps?.length ? `<ol>${x.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
    ${x.watch?.length ? `<div class="ps-note"><b>Watch for</b><ul>${x.watch.map((i) => `<li><b>${esc(i.name)}</b>: ${esc(i.hides)}</li>`).join('')}</ul></div>` : ''}
    ${quiz ? `<h3>Check yourself</h3><ol class="ps-quiz">${quiz}</ol>` : ''}
    ${write}
    ${written ? '' : '<p>This page is still being written. Do what the title says, with an adult if you need one.</p>'}
    <p class="ps-done">Done on: ____________</p>
  </article>`;
}

export async function printRecipes(ctx, { profile, n }) {
  const d = await load(ctx, profile.id, n);
  const pages = [];
  for (const w of d.weeks) for (const e of w.entries) {
    const kicker = `${e.level_week ? `${d.course.name} · Week ${e.level_week}` : weekWords(ctx, w)}`;
    pages.push(e.library
      ? await recipeSheet({ family: ctx.family(), lessonId: e.id, variation: e.variation, servings: d.servings, feastDays: w.feast, kicker })
      : `<article class="ps-page"><p class="ps-kick">${esc(kicker)}</p><h2>${esc(e.title)}</h2><p>${e.written ? 'Print this one from My recipes.' : 'This recipe is still being written.'}</p></article>`);
  }
  printSheet(ctx, `${profile.name}'s recipes`, pages.join('') || '<p>No recipes in these weeks.</p>');
}

export async function printCoursework(ctx, { profile, n }) {
  const d = await load(ctx, profile.id, n);
  const pages = d.weeks.flatMap((w) => w.entries.flatMap((e) => (e.parts ?? []).map((x) => partPage(d.course, e, x))));
  printSheet(ctx, `${profile.name}'s coursework`, pages.join('') || '<p>No coursework in these weeks.</p>');
}

// Completed offline: the day it was done, who did it, and a tick for each
// component of each week, with All for a whole week.
export async function completedOffline(ctx, { profile, after }) {
  const { el } = ctx;
  const n = weeksPick(ctx);
  const list = el('div', { class: 'offweeks' });
  const today = ctx.localToday();
  // The Sabbath can't be picked (§6.18), so it starts on Friday then.
  const start = new Date(`${today}T12:00:00`).getDay() === 6 ? new Date(Date.parse(`${today}T12:00:00Z`) - 864e5).toISOString().slice(0, 10) : today;
  const date = el('input', { type: 'date', value: start, max: today, required: true });
  const who = el('div', { class: 'offwho' });
  const msg = el('p', { class: 'bad', hidden: true, role: 'alert' });
  let d = null, ticks = [];
  const draw = async () => {
    d = await load(ctx, profile.id, Number(n.value));
    ticks = [];
    who.replaceChildren(...(d.profiles.length > 1 ? [el('b', {}, 'Who did it'), ...d.profiles.map((p) => el('label', { class: 'offitem' }, el('input', { type: 'checkbox', value: p.id, checked: p.id === profile.id }), p.name))] : []));
    list.replaceChildren(...d.weeks.flatMap((w) => w.entries.map((e) => {
      const items = ORDER.flatMap((k) => (k === 'recipe' ? [{ k, done: e.done, label: `Recipe: ${e.title}` }]
        : (e.parts ?? []).filter((x) => x.part === k).map((x) => ({ k, week: x.week, done: Boolean(x.done_at), skipped: x.skipped, label: `${NAMES[k]}: ${x.title}` }))));
      const boxes = items.map((x) => {
        const box = el('input', { type: 'checkbox', disabled: x.done || x.skipped, checked: x.done });
        if (!x.done && !x.skipped) ticks.push({ ...x, id: e.id, box });
        return el('label', { class: 'offitem' }, box, x.label, x.done ? el('small', {}, ' (done)') : x.skipped ? el('small', {}, ' (skipped)') : null);
      });
      const open = boxes.map((b) => b.querySelector('input')).filter((b) => !b.disabled);
      const all = el('input', { type: 'checkbox', disabled: !open.length, onchange: () => { for (const b of open) b.checked = all.checked; } });
      return el('fieldset', { class: 'offweek' },
        el('legend', {}, e.level_week ? `Week ${e.level_week}` : weekWords(ctx, w)),
        el('label', { class: 'offitem' }, all, el('b', {}, 'All of it')), boxes);
    })));
  };
  n.addEventListener('change', () => draw().catch((err) => ctx.showToast(err)));
  await draw();
  const close = ctx.modal('Completed offline',
    el('p', { class: 'mut small' }, 'Tick what was done away from the app. A recipe ticked counts as cooked on that day, the same as cooking it here.'),
    el('label', { class: 'f' }, 'Which weeks', n),
    el('label', { class: 'f' }, 'The day it was done', date),
    who, list, msg,
    el('div', { class: 'acts' },
      el('button', { type: 'button', class: 'hbtn pri', onclick: async (ev) => {
        msg.hidden = true;
        const picked = ticks.filter((x) => x.box.checked);
        if (!picked.length) { msg.textContent = 'Tick at least one thing that was done.'; msg.hidden = false; return; }
        const btn = ev.currentTarget;
        btn.disabled = true;
        try {
          const ids = [...who.querySelectorAll('input:checked')].map((b) => b.value);
          const out = await ctx.api('POST', `/api/profiles/${profile.id}/offline?${ctx.tz()}`, {
            date: date.value, profile_ids: ids.length ? ids : [profile.id],
            recipes: picked.filter((x) => x.k === 'recipe').map((x) => x.id),
            parts: picked.filter((x) => x.k !== 'recipe').map((x) => ({ week: x.week, part: x.k })),
          });
          close();
          ctx.showToast(`Marked done: ${out.cooked.length} recipe${out.cooked.length === 1 ? '' : 's'}${out.parts ? ` and ${picked.filter((x) => x.k !== 'recipe').length} part${picked.filter((x) => x.k !== 'recipe').length === 1 ? '' : 's'}` : ''}.`);
          after?.();
        } catch (err) {
          // A calm note, not a red error (owner, 2026-10-28).
          msg.textContent = err.message ?? String(err);
          msg.hidden = false;
          btn.disabled = false;
        }
      } }, 'Mark done'),
      el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel')));
}

// The row of buttons: Print recipes, Print coursework (a Level course only),
// and Completed offline. Each print button asks how many weeks first.
export function offlineButtons(ctx, { profile, level, cls = 'themebtn', after }) {
  const { el } = ctx;
  const printAsk = (title, run) => () => {
    const n = weeksPick(ctx);
    const close = ctx.modal(title,
      el('p', { class: 'mut small' }, 'Opens the print window, where you can print or save it as a PDF.'),
      el('label', { class: 'f' }, 'Which weeks', n),
      el('div', { class: 'acts' },
        el('button', { type: 'button', class: 'hbtn pri', onclick: async (ev) => {
          ev.currentTarget.disabled = true;
          try { await run({ profile, n: Number(n.value) }); close(); } catch (err) { ctx.showToast(err); ev.currentTarget.disabled = false; }
        } }, 'Print'),
        el('button', { type: 'button', class: 'hbtn', onclick: () => close() }, 'Cancel')));
  };
  return el('div', { class: 'acts offline' },
    el('button', { type: 'button', class: cls, onclick: printAsk('Print recipes', (o) => printRecipes(ctx, o)) }, 'Print recipes'),
    level ? el('button', { type: 'button', class: cls, onclick: printAsk('Print coursework', (o) => printCoursework(ctx, o)) }, 'Print coursework') : null,
    el('button', { type: 'button', class: cls, onclick: () => completedOffline(ctx, { profile, after }).catch((err) => ctx.showToast(err)) }, 'Completed offline'));
}
