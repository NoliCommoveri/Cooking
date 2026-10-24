// Course progress and rewards in the profile's theme (plan §5.2, §5.4, §5.4a,
// Phase 5): the kitchen's third tab, and the celebration after a cook. The art
// is the approved showcase's (mockups/quest-showcase/), drawn as SVG. What a
// profile has earned is worked out from its cooks (lib/rewards.js); what it has
// already been shown is kept on this device, so each reward pops once here.
import { rewards, newSince, RANKS } from './lib/rewards.js';
import { thunk, chime, fanfare } from './sound.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ic = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="/icons.svg#${id}"/></svg>`;
const hex = (cx, cy, r) => Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 3) * i - Math.PI / 2; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
const day = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

let content = null;
const loadContent = () => (content ??= Promise.all([fetch('/content/registry.json'), fetch('/content/course.json')].map((p) => p.then((r) => r.json()))));

export async function profileRewards(cooks) {
  const [registry, course] = await loadContent();
  return { r: rewards(cooks, registry, course), registry };
}

// ---------- art ----------

// The stamp for a cuisine (Chef's Passport): one design per cuisine, so every
// Japanese dish gets the same stamp with its own date (§5.4).
const INKS = ['#D9412B', '#22406B', '#4E8B3A', '#7A3E8E', '#2E7D7A', '#B5651D'];
function stampSVG(registry, cuisine, date) {
  const ids = Object.keys(registry.cuisines), k = Math.max(0, ids.indexOf(cuisine));
  const t = (registry.cuisines[cuisine]?.name ?? cuisine).toUpperCase();
  const shape = ['circle', 'rect', 'hex', 'oval'][k % 4], col = INKS[k % INKS.length], rot = ((k * 37) % 19) - 9;
  const ring = (w) => `fill="none" stroke="currentColor" stroke-width="${w}"`;
  const sh = shape === 'rect' ? `<rect x="8" y="18" width="84" height="64" rx="5" ${ring(4)}/><rect x="14" y="24" width="72" height="52" rx="2" ${ring(1.5)}/>`
    : shape === 'hex' ? `<polygon points="${hex(50, 50, 45)}" ${ring(4)}/><polygon points="${hex(50, 50, 38)}" ${ring(1.5)}/>`
      : shape === 'oval' ? `<ellipse cx="50" cy="50" rx="46" ry="36" ${ring(4)}/><ellipse cx="50" cy="50" rx="39" ry="29" ${ring(1.5)}/>`
        : `<circle cx="50" cy="50" r="44" ${ring(4)}/><circle cx="50" cy="50" r="36" ${ring(1.5)}/>`;
  const fit = t.length > 8 ? `textLength="${shape === 'hex' ? 62 : 66}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true" style="color:${col};--rot:${rot}deg;transform:rotate(${rot}deg)">${sh}<text x="50" y="${date ? 48 : 55}" text-anchor="middle" font-family="Lilita One,Fredoka,sans-serif" font-size="15" fill="currentColor" ${fit}>${esc(t)}</text>${date ? `<text x="50" y="63" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="10" fill="currentColor">${esc(day(date).toUpperCase())}</text>` : ''}<path d="M50 ${date ? 70 : 66}l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" fill="currentColor"/></svg>`;
}
const emptyStamp = (next) => `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 6"/>${next ? '<text x="50" y="56" text-anchor="middle" font-family="Lilita One,Fredoka,sans-serif" font-size="17" fill="#D9412B">NEXT</text>' : ''}</svg>`;

// The chef at each rank (§5.4): the hat, apron, and extras change. Executive
// Chef (owner, 2026-10-23) wears the tallest hat with a gold band and star, and
// a black jacket with gold buttons.
const APRON = ['#EFE6D2', '#F6C945', '#D9412B', '#22406B', '#2B2A28', '#F6C945'];
export function chefAv(r, cls = '') {
  const top = [0, 16, 10, 4, -2, -6][r], ink = '#2B2A28', exec = r === 5, gold = '#F6C945';
  const hat = r === 0 ? `<path d="M25 38v-7c0-4 7-6 15-6s15 2 15 6v7z" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/><path d="M27 33c8-3 18-3 26 0" stroke="#CDBE9E" stroke-width="2" fill="none"/>`
    : `<path d="M28 33V${top + 8}C19 ${top + 8} 17 ${top - 3} 25 ${top - 5}C27 ${top - 12} 36 ${top - 13} 40 ${top - 8}C44 ${top - 13} 53 ${top - 12} 55 ${top - 5}C63 ${top - 3} 61 ${top + 8} 52 ${top + 8}V33z" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`
      + (r >= 3 ? `<path d="M34 ${top + 10}V32M40 ${top + 6}V32M46 ${top + 10}V32" stroke="#CDBE9E" stroke-width="2"/>` : '')
      + `<rect x="27" y="31" width="26" height="7" rx="1.5" fill="${r >= 4 ? gold : '#fff'}" stroke="${ink}" stroke-width="2.5"/>`
      + (exec ? `<path d="M40 ${top + 12}l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" fill="${gold}" stroke="${ink}" stroke-width="1.2"/>` : '');
  return `<svg class="${cls}" viewBox="0 -18 80 120" aria-hidden="true">
  <path d="M14 101c0-18 11-30 26-30s26 12 26 30z" fill="${exec ? ink : '#fff'}" stroke="${ink}" stroke-width="2.5"/>
  ${exec ? `<g fill="${gold}"><circle cx="32" cy="80" r="2"/><circle cx="48" cy="80" r="2"/><circle cx="32" cy="90" r="2"/><circle cx="48" cy="90" r="2"/></g>`
    : r >= 3 ? `<g fill="${ink}"><circle cx="34" cy="78" r="1.8"/><circle cx="46" cy="78" r="1.8"/></g>` : ''}
  ${exec ? '' : `<path d="M30 85l3-12M50 85l-3-12" stroke="${APRON[r] === '#EFE6D2' ? '#CDBE9E' : APRON[r]}" stroke-width="3"/>
  <path d="M27 85h26v16H27z" fill="${APRON[r]}" stroke="${r === 4 ? gold : ink}" stroke-width="2.5"/>`}
  ${r === 2 ? '<path d="M33 85v16M40 85v16M47 85v16" stroke="#fff" stroke-width="2.5"/>' : ''}
  ${r >= 2 ? `<path d="M33 69h14l-7 8z" fill="${r >= 3 ? gold : '#D9412B'}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` : ''}
  <circle cx="40" cy="52" r="14" fill="#F2C9A0" stroke="${ink}" stroke-width="2.5"/>
  <circle cx="35" cy="51" r="2" fill="${ink}"/><circle cx="45" cy="51" r="2" fill="${ink}"/>
  <path d="M35 57c3 3 7 3 10 0" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="31" cy="56" r="2" fill="#F29B85"/><circle cx="49" cy="56" r="2" fill="#F29B85"/>
  ${hat}</svg>`;
}

// Kitchen Quest's level badge: a hex crest with the hat and the level.
const levelBadge = (r, cls = '') => `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true"><polygon points="${hex(32, 32, 30)}" fill="#2B3260" stroke="#F2B640" stroke-width="3"/><use href="/icons.svg#i-hat" x="16" y="12" width="32" height="32" color="#F2B640"/><text x="32" y="58" text-anchor="middle" font-family="Pixelify Sans" font-weight="700" font-size="11" fill="#5BD6C8">LV ${r + 1}</text></svg>`;

// A skill as a crest (Kitchen Quest) or an enamel pin (Chef's Passport).
const shapeOf = (pin, cx, r, stroke, w) => (pin.shape === 'hex' ? `<polygon points="${hex(cx, cx, r)}" fill="${pin.color}" stroke="${stroke}" stroke-width="${w}"/>`
  : pin.shape === 'shield' ? `<path d="M${cx} ${cx - r}l${r * 0.93} ${r * 0.3}v${r * 0.63}c0 ${r * 0.56}-${r * 0.41} ${r * 0.93}-${r * 0.93} ${r * 1.1}C${cx - r * 0.52} ${cx + r * 0.95} ${cx - r * 0.93} ${cx + r * 0.58} ${cx - r * 0.93} ${cx + r * 0.03}V${cx - r * 0.7}z" fill="${pin.color}" stroke="${stroke}" stroke-width="${w}"/>`
    : `<circle cx="${cx}" cy="${cx}" r="${r}" fill="${pin.color}" stroke="${stroke}" stroke-width="${w}"/>`);
function crestSVG(s) {
  if (!s.earned) return `<svg viewBox="0 0 60 60" aria-hidden="true"><polygon points="${hex(30, 30, 26)}" fill="#232A4E" stroke="#3D4985" stroke-width="3" stroke-dasharray="4 4"/><use href="/icons.svg#i-lock" x="19" y="19" width="22" height="22" color="#6A74AE"/></svg>`;
  return `<svg viewBox="0 0 60 60" aria-hidden="true">${shapeOf(s.pin, 30, 26, '#F2B640', 3.5)}<use href="/icons.svg#g-${s.pin.glyph}" x="17" y="17" width="26" height="26" color="#fff"/></svg>`;
}
function pinSVG(s) {
  if (!s.earned) return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="none" stroke="#E2EEDA" stroke-width="2.5" stroke-dasharray="4 4"/><use href="/icons.svg#i-lock" x="14" y="14" width="20" height="20" color="#E2EEDA"/></svg>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${shapeOf(s.pin, 24, 21, '#F6C945', 3)}<use href="/icons.svg#g-${s.pin.glyph}" x="13" y="13" width="22" height="22" color="#fff"/></svg>`;
}

// Short path names for the skill tree's columns.
const PATH_SHORT = { 1: 'Knife', 2: 'Stove', 3: 'Spice', 4: 'Meat', 5: 'Dough', 6: 'Oven', 7: 'Sweet', 8: 'Feast' };

// The skill tree (§5.4a): one path per unit, one hex node per dish. Cleared
// quests are lit; the next one on a started path pulses.
function treeSVG(paths) {
  const colW = 360 / paths.length, maxLen = Math.max(...paths.map((p) => p.nodes.length)), step = 24;
  const H = 60 + maxLen * step, ys = (k) => H - 34 - k * step;
  let g = '';
  paths.forEach((p, c) => {
    const x = colW * (c + 0.5), lit = (k) => Boolean(p.nodes[k]?.date);
    const nextAt = p.done > 0 ? p.nodes.findIndex((n) => !n.date) : -1;
    g += `<path d="M180 ${H - 6} C180 ${H - 20} ${x} ${H - 14} ${x} ${ys(0)}" fill="none" stroke="${p.done ? '#F2B640' : '#3D4985'}" stroke-width="3"/>`;
    for (let k = 1; k < p.nodes.length; k++) {
      const on = lit(k - 1) && lit(k), nx = k === nextAt && lit(k - 1);
      g += `<line x1="${x}" y1="${ys(k - 1)}" x2="${x}" y2="${ys(k)}" stroke="${on ? '#F2B640' : nx ? '#5BD6C8' : '#3D4985'}" stroke-width="3" ${on || nx ? '' : 'stroke-dasharray="3 4"'}/>`;
    }
    p.nodes.forEach((n, k) => {
      const st = n.date ? 'lit' : k === nextAt ? 'next' : 'off';
      g += `<polygon points="${hex(x, ys(k), 9)}" fill="${st === 'lit' ? '#F2B640' : st === 'next' ? '#161A31' : '#232A4E'}" stroke="${st === 'lit' ? '#FFE3A0' : st === 'next' ? '#5BD6C8' : '#3D4985'}" stroke-width="2.5" ${st === 'next' ? 'class="q-nextnode"' : ''}><title>${esc(n.title)}${n.date ? ' · cleared' : ''}</title></polygon>`;
    });
    g += `<text x="${x}" y="${ys(p.nodes.length - 1) - 18}" text-anchor="middle" font-size="${paths.length > 7 ? 10 : 12}" fill="${p.done ? '#F2B640' : '#6A74AE'}">${esc((PATH_SHORT[p.unit] ?? p.name).toUpperCase())}</text>`;
  });
  const label = paths.map((p) => `${p.name}: ${p.done} of ${p.nodes.length}`).join('. ');
  return `<svg viewBox="0 0 360 ${H}" role="img" aria-label="Skill tree. ${esc(label)}.">${g}<polygon points="${hex(180, H - 8, 9)}" fill="#5BD6C8"/></svg>`;
}

// The world map (§5.4): the owner's map, a mask per region. A region turns
// butter with its first stamp and basil when every stamp is in.
function mapHTML(regions, open) {
  const fill = (r) => (r.done === 0 ? (r.id === open ? '#F3C6B6' : '') : r.done === r.slots.length ? '#4E8B3A' : '#F6C945');
  return `<div class="p-world" role="img" aria-label="World map. ${esc(regions.map((r) => `${r.name}: ${r.done} of ${r.slots.length}`).join('. '))}.">
  <img src="/img/map/map-base.webp" alt="" width="1100" height="550">
  ${regions.map((r) => { const f = fill(r), m = `url(/img/map/map-${r.id}.png)`; return f ? `<span class="${r.id === open ? 'sel' : ''}"><i style="background:${f};-webkit-mask-image:${m};mask-image:${m}"></i></span>` : ''; }).join('')}
  <img src="/img/map/map-lines.webp" alt="" width="1100" height="550"></div>`;
}
const REGION_SHORT = { easia: 'East & SE Asia', mena: 'Middle East & N. Africa', sasia: 'South Asia', africa: 'Africa', europe: 'Europe', latam: 'Latin America', usa: 'United States' };

// ---------- the Progress tab ----------

function rankCard(r, quest) {
  const { rank, dishes } = r;
  const next = rank.next;
  const frac = next ? Math.min(1, (dishes - rank.at) / (next.at - rank.at)) : 1;
  const word = quest ? 'quests' : 'dishes';
  const line = next ? `${dishes} ${word} ${quest ? 'cleared' : 'cooked'} · ${next.at - dishes} more to reach ${next.name}` : `${dishes} ${word} ${quest ? 'cleared' : 'cooked'} · the top rank`;
  const bar = `role="img" aria-label="${esc(next ? `${dishes} of ${next.at} to ${next.name}` : 'Top rank')}"`;
  if (quest) {
    return `<div class="q-panel q-lvl">${levelBadge(rank.index)}<b>${esc(rank.name)}</b><div class="q-xp" ${bar}><i style="width:calc(${(frac * 100).toFixed(0)}% - 6px)"></i></div><span>${esc(line)}</span></div>`;
  }
  return `<div class="p-card p-rank"><i class="tape t2"></i>${chefAv(rank.index)}<b>${esc(rank.name)}</b>
    <div class="p-xp" ${bar}><i style="width:${(frac * 100).toFixed(0)}%"></i></div><p>${esc(line)}</p>
    <div class="p-ladder">${RANKS.map((x, k) => `<div class="${k < rank.index ? 'got' : k === rank.index ? 'cur' : 'fut'}">${chefAv(k)}${esc(x.name)}<small>${x.at}</small></div>`).join('')}</div></div>`;
}

function skillsHTML(r, quest, sel) {
  const got = r.skills.filter((s) => s.earned).length;
  const s = r.skills.find((x) => x.id === sel);
  const info = s ? `<div class="${quest ? 'q-panel crestinfo' : 'p-card p-pininfo'}">${quest ? '' : '<i class="tape t1"></i>'}<h5>${esc(s.name)}${s.earned ? '' : ' · not earned yet'}</h5><p>${esc(s.idea)}</p>
    <ul>${s.dishes.map((d) => `<li class="${d.date ? '' : 'todo'}">${ic(d.date ? 'i-check' : 'i-lock')}${esc(d.title)}</li>`).join('')}</ul></div>`
    : `<p class="${quest ? 'q-note' : 'p-hint'}">Tap a ${quest ? 'crest' : 'pin'} to see the idea behind it and every dish that uses it.</p>`;
  if (quest) {
    return `<h3 class="q-h">Crests <span>${got}/${r.skills.length}</span></h3>${info}<div class="crests">${r.skills.map((x) => `<button type="button" class="crest ${x.earned ? '' : 'locked'}" data-skill="${esc(x.id)}" aria-pressed="${x.id === sel}">${crestSVG(x)}${esc(x.name)}</button>`).join('')}</div>`;
  }
  return `<h3 class="p-h">Skill pins <span>${got} of ${r.skills.length}</span></h3>${info}<div class="p-apron">${r.skills.map((x) => `<button type="button" class="p-pin ${x.earned ? '' : 'locked'}" data-skill="${esc(x.id)}" aria-pressed="${x.id === sel}">${pinSVG(x)}${esc(x.name)}</button>`).join('')}</div>`;
}

function passportHTML(r, registry, open) {
  const reg = r.regions.find((x) => x.id === open) ?? r.regions[0];
  const total = r.regions.reduce((n, x) => n + x.slots.length, 0), stamped = r.regions.reduce((n, x) => n + x.done, 0);
  const nextId = reg.slots.find((x) => !x.date)?.id;
  return `<h3 class="p-h">Passport <span>${stamped} of ${total} stamped</span></h3>
  <div class="p-map">${mapHTML(r.regions, reg.id)}</div>
  <div class="p-legend"><span><i style="background:#EFE6D0"></i>Not started</span><span><i style="background:#F6C945"></i>Started</span><span><i style="background:#4E8B3A"></i>Every stamp</span></div>
  <div class="p-tabs" role="group" aria-label="Passport pages">${r.regions.map((x) => `<button type="button" class="p-tab" data-region="${esc(x.id)}" aria-pressed="${x.id === reg.id}">${esc(REGION_SHORT[x.id] ?? x.name)}<small>${x.done} of ${x.slots.length}</small></button>`).join('')}</div>
  <div class="p-book"><div class="p-page"><h4>${esc(reg.name)}</h4><p class="sub">${reg.done} of ${reg.slots.length} stamped</p>
    <div class="p-stamps">${reg.slots.map((x) => (x.date ? `<div class="p-st">${stampSVG(registry, x.cuisine, x.date)}<span>${esc(x.title)}</span></div>`
    : `<div class="p-st empty ${x.id === nextId && reg.done ? 'next' : ''}">${emptyStamp(x.id === nextId && reg.done)}<span>${esc(x.title)}</span></div>`)).join('')}</div></div></div>`;
}

// The Progress tab's contents for a profile. Returns an element that redraws
// itself when a skill or a passport page is tapped.
// ranks: false leaves out the dish-count ranks, for a Level learner (§12.4).
export async function progressView(profile, cooks, { ranks = true } = {}) {
  const { r, registry } = await profileRewards(cooks);
  const quest = profile.theme === 'quest';
  const ui = { skill: null, region: r.stamps.at(-1)?.region ?? r.regions[0]?.id };
  const box = document.createElement('div');
  box.className = 'k-progress';
  const draw = () => {
    box.innerHTML = quest
      ? `${ranks ? rankCard(r, true) : ''}<h3 class="q-h">Skill tree <span>${r.stamps.length} cleared</span></h3><div class="q-tree q-panel">${treeSVG(r.paths)}</div>
        <p class="q-note k-pathlist">${r.paths.map((p) => `<span>${esc(PATH_SHORT[p.unit] ?? p.name)} ${p.done}/${p.nodes.length}</span>`).join('')}</p>${skillsHTML(r, true, ui.skill)}`
      : `${passportHTML(r, registry, ui.region)}${ranks ? rankCard(r, false) : ''}${skillsHTML(r, false, ui.skill)}`;
  };
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-skill],[data-region]');
    if (!b) return;
    if (b.dataset.skill) ui.skill = ui.skill === b.dataset.skill ? null : b.dataset.skill;
    if (b.dataset.region) ui.region = b.dataset.region;
    draw();
    // The skill's card sits above the crests or pins, so bring it into view.
    if (b.dataset.skill && ui.skill) box.querySelector('.crestinfo,.p-pininfo')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  draw();
  return box;
}

// ---------- a Level learner's progress (12e) ----------

// A Level learner isn't working through Cook Around the World's path, so the
// tab shows how far they are on the Level: the weeks, the hours, and each
// unit as a chapter (Kitchen Quest) or a passport page (Chef's Passport),
// with its crest or visa stamp once mastered. Units are the ranks (§12.4).
const PARTS = [['drill', 'Drill'], ['knowledge', 'Knowledge'], ['sabbath', 'Beyond the Recipe']];
const longDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const shortDay = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
// A week counts as done when its recipe is cooked; a practice or capstone
// week, which has no recipe, when its three parts are checked off.
const weekDone = (w) => (w.recipe ? Boolean(w.cooked) : !w.kind ? false : PARTS.every(([k]) => w.parts[k]));

// Kitchen Quest's chapter crest: a hex with the unit's number, gold once mastered.
export function unitCrest(u, cls = '') {
  if (!u.mastered) return `<svg class="${cls}" viewBox="0 0 60 60" aria-hidden="true"><polygon points="${hex(30, 30, 26)}" fill="#232A4E" stroke="#3D4985" stroke-width="3" stroke-dasharray="4 4"/><text x="30" y="37" text-anchor="middle" font-family="Pixelify Sans" font-weight="700" font-size="20" fill="#6A74AE">${u.number}</text></svg>`;
  return `<svg class="${cls}" viewBox="0 0 60 60" aria-hidden="true"><polygon points="${hex(30, 30, 26)}" fill="#F2B640" stroke="#FFE3A0" stroke-width="3.5"/><polygon points="${hex(30, 30, 19)}" fill="none" stroke="#6B4A0C" stroke-width="1.5"/><text x="30" y="37" text-anchor="middle" font-family="Pixelify Sans" font-weight="700" font-size="20" fill="#2B3260">${u.number}</text></svg>`;
}
// Chef's Passport's visa stamp: the unit's number and the day it was mastered.
export function visaStamp(u, cls = '') {
  if (!u.mastered) return `<svg class="${cls}" viewBox="0 0 100 70" aria-hidden="true"><rect x="4" y="4" width="92" height="62" rx="6" fill="none" stroke="#B9AE95" stroke-width="2.5" stroke-dasharray="5 5"/><text x="50" y="42" text-anchor="middle" font-family="Lilita One,Fredoka,sans-serif" font-size="16" fill="#9C927C">UNIT ${u.number}</text></svg>`;
  const col = INKS[(u.number - 1) % INKS.length], rot = ((u.number * 29) % 13) - 6;
  return `<svg class="${cls}" viewBox="0 0 100 70" aria-hidden="true" style="color:${col};transform:rotate(${rot}deg)"><rect x="4" y="4" width="92" height="62" rx="6" fill="none" stroke="currentColor" stroke-width="4"/><rect x="10" y="10" width="80" height="50" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <text x="50" y="27" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="900" font-size="7.5" letter-spacing="1" fill="currentColor">VISA · MASTERED</text>
    <text x="50" y="45" text-anchor="middle" font-family="Lilita One,Fredoka,sans-serif" font-size="17" fill="currentColor">UNIT ${u.number}</text>
    <text x="50" y="56" text-anchor="middle" font-family="Nunito,sans-serif" font-weight="800" font-size="9" fill="currentColor">${esc(shortDay(u.mastered).toUpperCase())}</text></svg>`;
}

// The bar of every week, grouped by unit.
function weeksBar(pr, now) {
  const all = pr.units.flatMap((u) => u.weeks);
  const done = all.filter(weekDone).length;
  return `<div class="k-lvbar" role="img" aria-label="${done} of ${all.length} weeks done">${pr.units.map((u) => `<span>${u.weeks.map((w) => `<i class="${weekDone(w) ? 'done' : w.week === now ? 'now' : ''}"></i>`).join('')}</span>`).join('')}</div>`;
}

// A week's row: its recipe and its three parts, ticked.
function weekRow(w, quest) {
  const what = w.title ?? (w.kind === 'capstone' ? 'Capstone' : w.kind === 'practice' ? 'Practice run' : 'Being written');
  const tick = (on, label) => `<i class="${on ? 'on' : ''}" title="${esc(label)}${on ? ': done' : ''}">${on ? ic('i-check') : ''}</i>`;
  const ticks = [w.recipe ? tick(w.cooked, 'Recipe') : '', ...PARTS.map(([k, label]) => tick(w.parts[k], label))].join('');
  const said = [w.recipe ? `Recipe ${w.cooked ? 'cooked' : 'not cooked yet'}` : null, ...PARTS.map(([k, label]) => `${label} ${w.parts[k] ? 'done' : 'not done yet'}`)].filter(Boolean).join(', ');
  return `<li><span class="wk">${quest ? 'Wk' : 'Week'} ${w.week}</span><span class="t">${esc(what)}${w.mastery ? `<small>${quest ? 'Mastery' : 'Mastery week'}</small>` : ''}</span><span class="tk" role="img" aria-label="${esc(said)}">${ticks}</span></li>`;
}

// What's left of this week: the recipe if it isn't cooked, and each part not checked off.
function leftThisWeek(lv) {
  const w = lv.week;
  if (!w) return [];
  return [w.recipe && !w.recipe_done ? `${w.recipe_title} isn't cooked yet` : null,
    ...w.parts.filter((x) => !x.done_at).map((x) => `${PARTS.find(([k]) => k === x.part)[1]} not done yet`)].filter(Boolean);
}

function certificate(pr, profile, quest) {
  return quest
    ? `<div class="q-panel k-cert"><span class="q-kick">Quest complete</span>${unitCrest({ number: '★', mastered: true }, 'k-cert-ic')}<h3>${esc(pr.name)} — complete</h3><p>${esc(profile.name)} · ${esc(longDay(pr.complete))}</p></div>`
    : `<div class="p-card k-cert"><i class="tape t1"></i><i class="tape t2"></i><span class="rk">Certificate</span><h3>${esc(pr.name)} — complete</h3><p>${esc(profile.name)} · ${esc(longDay(pr.complete))}</p></div>`;
}

function levelHTML(profile, lv, ui) {
  const pr = lv.progress, quest = profile.theme === 'quest';
  const now = lv.week?.week ?? null;
  const at = pr.complete ? `${pr.name} · complete` : `${pr.name} · ${now ? `Week ${now} of ${pr.weeks}` : `${pr.weeks} weeks`}`;
  const top = `<div class="${quest ? 'q-panel' : 'p-card'} k-lvtop">${quest ? '' : '<i class="tape t2"></i>'}<span class="${quest ? 'q-kick' : 'p-lessonno'}">${esc(at)}</span>${weeksBar(pr, now)}<b>${pr.hours_done} of about ${pr.hours} hours</b></div>`;
  const openUnit = lv.week?.unit ?? pr.units.find((u) => !u.mastered)?.number;
  const units = pr.units.map((u) => {
    const done = u.weeks.filter(weekDone).length;
    const head = quest ? `Chapter ${u.number}: ${u.name}` : `Unit ${u.number}: ${u.name}`;
    const note = u.mastered ? `Mastered ${shortDay(u.mastered)}` : `${done} of ${u.weeks.length} weeks`;
    return `<details class="${quest ? 'q-panel' : 'p-page'} k-lvunit ${u.mastered ? 'got' : ''}" data-unit="${u.number}" ${ui.open.has(u.number) || (!ui.touched && u.number === openUnit) ? 'open' : ''}>
      <summary>${quest ? unitCrest(u) : visaStamp(u)}<span><b>${esc(head)}</b><small>${esc(note)}</small></span></summary>
      ${u.goal ? `<p class="k-lvgoal">${esc(u.goal)}</p>` : ''}<p class="k-lvkey">Ticks: recipe, drill, knowledge, Beyond the Recipe</p><ul class="k-lvweeks">${u.weeks.map((w) => weekRow(w, quest)).join('')}</ul></details>`;
  }).join('');
  const left = leftThisWeek(lv);
  return `${pr.complete ? certificate(pr, profile, quest) : ''}${top}
    ${left.length ? `<div class="${quest ? 'q-panel' : 'p-card'} k-lvleft"><span class="${quest ? 'q-kick' : 'p-lessonno'}">Left this week</span><ul>${left.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
    <h3 class="${quest ? 'q-h' : 'p-h'}">${quest ? 'Quest map' : 'Passport pages'} <span>${pr.units.filter((u) => u.mastered).length} of ${pr.units.length} ${quest ? 'crests' : 'stamped'}</span></h3>
    <div class="${quest ? 'k-lvmap' : 'p-book k-lvbook'}">${units}</div>
    <button type="button" class="${quest ? 'q-btn' : 'p-btn'} k-lvcoll" data-coll="1">My cooking collection</button>`;
}

// The Progress tab for a profile on a Level: the Level view, with a toggle to
// the usual skill tree or passport and pins, which every cook keeps earning
// (owner, 2026-10-24), without the dish-count ranks.
export async function levelProgressView(profile, lv, cooks) {
  const box = document.createElement('div');
  box.className = 'k-progress k-lv';
  const ui = { open: new Set(), touched: false };
  let collection = null;
  const draw = async (coll = false) => {
    if (!coll) { box.innerHTML = levelHTML(profile, lv, ui); return; }
    collection ??= await progressView(profile, cooks, { ranks: false });
    box.replaceChildren(collection);
    const back = document.createElement('button');
    back.type = 'button';
    back.className = `${profile.theme === 'quest' ? 'q-btn' : 'p-btn'} k-lvcoll`;
    back.textContent = `Back to ${lv.progress.name}`;
    back.onclick = () => draw(false).then(() => box.querySelector('.k-lvcoll')?.focus());
    box.prepend(back);
    back.focus();
  };
  box.addEventListener('click', (e) => { if (e.target.closest('[data-coll]')) draw(true); });
  box.addEventListener('toggle', (e) => {
    const d = e.target.closest?.('[data-unit]');
    if (!d) return;
    ui.touched = true;
    const n = Number(d.dataset.unit);
    if (d.open) ui.open.add(n); else ui.open.delete(n);
  }, true);
  await draw(false);
  return box;
}

// ---------- celebrations ----------

const SEEN = (pid) => `cpr.seen.${pid}`;
// The Level units mastered and whether it's complete, as this device last showed them.
const LV_SEEN = (pid) => `cpr.level.${pid}`;
function levelNews(pid, pr) {
  let seen = null;
  try { seen = JSON.parse(localStorage.getItem(LV_SEEN(pid))); } catch { /* shown again */ }
  const now = { id: pr.id, units: pr.units.filter((u) => u.mastered).map((u) => u.number), complete: Boolean(pr.complete) };
  try { localStorage.setItem(LV_SEEN(pid), JSON.stringify(now)); } catch { /* shown again next time */ }
  // The first time on this device (or a new Level), nothing pops: it's all on the tab.
  if (!seen || seen.id !== pr.id) return { units: [], complete: false };
  const had = new Set(seen.units ?? []);
  // The last unit is mastered by the capstone: the certificate says it.
  return { units: pr.units.filter((u) => u.mastered && !had.has(u.number) && !(pr.complete && u === pr.units.at(-1))), complete: now.complete && !seen.complete };
}
function readSeen(pid) { try { return JSON.parse(localStorage.getItem(SEEN(pid))); } catch { return null; } }
function writeSeen(pid, v) { try { localStorage.setItem(SEEN(pid), JSON.stringify(v)); } catch { /* shown again next time */ } }

function burst(n, cols, sprinkles) {
  let b = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rr = 140 + (i % 3) * 50;
    b += `<i style="--x:${(Math.cos(a) * rr).toFixed(0)}px;--y:${(Math.sin(a) * rr).toFixed(0)}px;--c:${cols[i % cols.length]};--d:${(i % 5) * 40}ms;--rot:${(i * 47) % 180}deg"></i>`;
  }
  return `<div class="burst ${sprinkles ? 'sp' : ''}" aria-hidden="true">${b}</div>`;
}

// One screen of the celebration: what this cook earned, then (on its own
// screen) a rank up. Each closes with its button; focus goes to it.
function earnedScreen(news, registry, quest, lessons) {
  const st = news.stamps, sk = news.skills;
  const img = (id) => lessons[id]?.image ? `<img src="/${esc(lessons[id].image)}" alt="" width="160" height="160">` : '';
  if (quest) {
    const head = st.length === 1 ? `<span class="k">QUEST CLEARED</span><h2>${esc(st[0].title)}</h2>` : `<span class="k">QUESTS CLEARED</span><h2>${st.length ? st.length : 'New crests'}</h2>`;
    return `<div class="lvlbox cel" role="dialog" aria-modal="true" aria-label="Rewards">${burst(20, ['#F2B640', '#5BD6C8', '#FF7350'])}
      ${st.length === 1 ? `<div class="q-win cel-win">${img(st[0].id)}</div>` : st.length ? `<p>${st.map((s) => esc(s.title)).join(' · ')}</p>` : ''}${head}
      ${st.length ? `<p>${st.length === 1 ? 'Its node on the skill tree is lit.' : 'Their nodes on the skill tree are lit.'}</p>` : ''}
      ${sk.length ? `<div class="cel-crests">${sk.map((s, i) => `<div class="crest cel-pop" style="--d:${300 + i * 200}ms">${crestSVG(s)}<b>New crest</b>${esc(s.name)}</div>`).join('')}</div>` : ''}
      <button type="button" class="q-btn" data-cel="next">${news.rankUp ? 'Next' : 'Keep cooking'}</button></div>`;
  }
  return `<div class="p-rbox cel" role="dialog" aria-modal="true" aria-label="Rewards">${burst(24, ['#D9412B', '#F6C945', '#4E8B3A', '#22406B', '#F28AB2'], true)}<i class="tape t1"></i><i class="tape t2"></i>
    <span class="rk">${st.length ? 'STAMPED' : 'NEW PIN'}</span>
    ${st.length ? `<div class="cel-stamps">${st.map((s, i) => `<div class="p-st cel-slam" style="--d:${200 + i * 250}ms">${stampSVG(registry, s.cuisine, s.date)}<span>${esc(s.title)}</span></div>`).join('')}</div>` : ''}
    ${st.length ? `<p>${st.length === 1 ? `A ${esc(registry.cuisines[st[0].cuisine]?.name ?? '')} stamp for your passport.` : 'New stamps for your passport.'}</p>` : ''}
    ${sk.length ? `<div class="cel-pins">${sk.map((s, i) => `<div class="p-pin cel-pop" style="--d:${400 + i * 200}ms">${pinSVG(s)}${esc(s.name)}</div>`).join('')}</div>${sk.length === 1 ? '<p>A new pin for your apron.</p>' : '<p>New pins for your apron.</p>'}` : ''}
    <button type="button" class="p-btn" data-cel="next">${news.rankUp ? 'Next' : 'Keep cooking'}</button></div>`;
}

// A Level unit mastered: the level-up for a Level learner (§12.4).
function unitScreen(u, pr, quest, more) {
  const btn = more ? 'Next' : 'Keep cooking';
  if (quest) {
    return `<div class="lvlbox" role="dialog" aria-modal="true" aria-label="Chapter cleared">${burst(28, ['#F2B640', '#5BD6C8', '#FF7350', '#EEF0FF'])}
      ${unitCrest(u, 'cr')}<span class="k">CHAPTER CLEARED</span><h2>${esc(u.name)}</h2><p>Unit ${u.number} of ${pr.units.length} on ${esc(pr.name)} is mastered. A new crest on your quest map.</p>
      <button type="button" class="q-btn" data-cel="next">${btn}</button></div>`;
  }
  return `<div class="p-rbox" role="dialog" aria-modal="true" aria-label="Unit mastered">${burst(34, ['#D9412B', '#F6C945', '#4E8B3A', '#22406B', '#FFF8E7', '#F28AB2'], true)}<i class="tape t1"></i><i class="tape t2"></i>
    <span class="rk">UNIT MASTERED</span><div class="cel-slam k-visa">${visaStamp(u)}</div><h2>${esc(u.name)}</h2><p>Unit ${u.number} of ${pr.units.length} on ${esc(pr.name)}. A new visa stamp in your passport.</p>
    <button type="button" class="p-btn" data-cel="next">${btn}</button></div>`;
}

// The Level's certificate, for finishing the capstone: the top of its ranks.
function certScreen(pr, profile, quest) {
  if (quest) {
    return `<div class="lvlbox" role="dialog" aria-modal="true" aria-label="Level complete">${burst(36, ['#F2B640', '#5BD6C8', '#FF7350', '#EEF0FF'])}
      ${unitCrest({ number: '★', mastered: true }, 'cr')}<span class="k">QUEST COMPLETE</span><h2>${esc(pr.name)}</h2><p>${esc(profile.name)} finished every chapter and the capstone. ${esc(longDay(pr.complete))}.</p>
      <button type="button" class="q-btn" data-cel="next">Keep cooking</button></div>`;
  }
  return `<div class="p-rbox k-certbox" role="dialog" aria-modal="true" aria-label="Certificate">${burst(40, ['#D9412B', '#F6C945', '#4E8B3A', '#22406B', '#FFF8E7', '#F28AB2'], true)}<i class="tape t1"></i><i class="tape t2"></i>
    <span class="rk">CERTIFICATE</span><h2>${esc(pr.name)} — complete</h2><p>Awarded to ${esc(profile.name)} for every unit and the capstone. ${esc(longDay(pr.complete))}.</p>
    <button type="button" class="p-btn" data-cel="next">Keep cooking</button></div>`;
}

function rankScreen(r, quest) {
  const { rank, dishes } = r;
  if (quest) {
    return `<div class="lvlbox" role="dialog" aria-modal="true" aria-label="Level up">${burst(28, ['#F2B640', '#5BD6C8', '#FF7350', '#EEF0FF'])}
      ${levelBadge(rank.index, 'cr')}<span class="k">LEVEL UP</span><h2>${esc(rank.name)}</h2><p>${dishes} quests cleared. ${rank.index === 5 ? 'The whole kitchen is yours.' : 'Your hat just got taller.'}</p>
      <button type="button" class="q-btn" data-cel="next">Keep cooking</button></div>`;
  }
  return `<div class="p-rbox" role="dialog" aria-modal="true" aria-label="Rank up">${burst(34, ['#D9412B', '#F6C945', '#4E8B3A', '#22406B', '#FFF8E7', '#F28AB2'], true)}<i class="tape t1"></i><i class="tape t2"></i>
    <span class="rk">RANK UP</span>${chefAv(rank.index)}<h2>${esc(rank.name)}</h2><p>${dishes} dishes cooked. ${rank.index === 5 ? 'The whole kitchen is yours.' : 'Your hat just got taller.'}</p>
    <button type="button" class="p-btn" data-cel="next">Keep cooking</button></div>`;
}

// Shows anything this profile earned since this device last showed its
// rewards: the stamp or lit node, new skills, then a rank up. Resolves when
// it's closed (at once if there's nothing new).
// level: the profile's Level progress (12e), when it's on one. Its units are
// its ranks, so it gets a level-up for each unit mastered and the certificate
// for the capstone, never a dish-count rank up.
export async function celebrate(profile, cooks, level = null) {
  let r, registry;
  try { ({ r, registry } = await profileRewards(cooks)); } catch { return; }
  const seen = readSeen(profile.id);
  const news = newSince(seen, r);
  writeSeen(profile.id, news.now);
  if (level) news.rankUp = false;
  const lv = level ? levelNews(profile.id, level) : { units: [], complete: false };
  if (!news.stamps.length && !news.skills.length && !news.rankUp && !lv.units.length && !lv.complete) return;
  const quest = profile.theme === 'quest';
  const lessons = Object.fromEntries(registry.lessons.map((L) => [L.id, L]));
  const screens = [];
  const more = (i) => i < screens.length - 1;
  if (news.stamps.length || news.skills.length) screens.push(() => { thunk(); if (news.skills.length) setTimeout(chime, 450); return earnedScreen({ ...news, rankUp: more(0) }, registry, quest, lessons); });
  if (news.rankUp) screens.push(() => { fanfare(); return rankScreen(r, quest); });
  for (const u of lv.units) { const i = screens.length; screens.push(() => { fanfare(); return unitScreen(u, level, quest, more(i)); }); }
  if (lv.complete) screens.push(() => { fanfare(); return certScreen(level, profile, quest); });
  const back = document.activeElement;
  const ov = document.createElement('div');
  ov.className = `lvlup ${quest ? '' : 'pp'}`;
  ov.dataset.kt = profile.theme;
  document.body.append(ov);
  await new Promise((done) => {
    let i = 0;
    const show = () => {
      ov.innerHTML = screens[i]();
      ov.querySelector('[data-cel]').focus();
    };
    ov.addEventListener('click', (e) => {
      if (!e.target.closest('[data-cel]')) return;
      i += 1;
      if (i < screens.length) show(); else { ov.remove(); done(); }
    });
    ov.addEventListener('keydown', (e) => { if (e.key === 'Escape') { ov.remove(); done(); } });
    show();
  });
  back?.focus?.();
}
