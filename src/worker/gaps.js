// Phase 11e: Recipe gaps (plan §6.21), a page in the owner screens. From what
// families rated, which pick-one groups leave families
// with nothing that fits, or only a poor fit, and why; the variation or dish
// that would help most of them, opened in the manager with its tags filled
// in; a coverage grid of each group against protein and heat; and what people
// cook. Counts only: no family, profile, or name is ever in it.
import { requireOwner } from './auth.js';
import { CONTENT } from './content-data.js';
import { LIBRARY } from './library-data.js';
import { releaseState, releaseOf } from './release.js';
import { tasteContext, cookCtx, dishFit } from './picks.js';
import { courseEntries } from '../content/course.js';
import { dietView } from '../content/diet.js';
import { ratingItems } from '../content/tastes.js';

const lessonById = Object.fromEntries(LIBRARY.lessons.map((L) => [L.id, L]));
const dishById = Object.fromEntries(LIBRARY.course.map((d) => [d.id, d]));
const skillName = Object.fromEntries(CONTENT.skills.map((x) => [x.id, x.name]));
const ITEMS = ratingItems(CONTENT.tastes);
const itemName = (kind, id) => ITEMS[kind].find((x) => x.id === id)?.name ?? id;
const toolName = Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e.name]));
const GROUP_MAX = 3;
const missingTable = (err) => /no such table/i.test(String(err?.message));
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const orList = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs.at(-1)}`);

// The slots: each pick-one group in the course (Level weeks join in phase 12).
const SLOTS = courseEntries(LIBRARY.course).filter((e) => e.pickOne).map((e) => ({ key: e.key, pick: e.pickOne, ids: e.ids }));

// A reason, in words, from score.js's name-free codes.
function reasonText(code) {
  const [kind, id] = code.split(':');
  if (kind === 'protein' || kind === 'ingredient') return `${itemName(kind, id)} 1 star`;
  if (kind === 'time') return 'Over the time limit';
  if (kind === 'budget') return 'Over the budget';
  if (kind === 'tool') return `No ${lower(toolName[id] ?? id)}`;
  if (kind === 'diet') return 'Diet settings hide every dish';
  return code;
}

// The people a family cooks for together: each active course's profiles,
// and everyone on no course as one more group.
async function cookGroups(env, fam, tc) {
  const { results } = await env.DB.prepare(`SELECT cp.course_id, cp.profile_id FROM course_profiles cp JOIN courses c ON c.id = cp.course_id
      WHERE cp.family_id = ? AND c.archived_at IS NULL`).bind(fam.id).all();
  const byCourse = {};
  for (const r of results) (byCourse[r.course_id] ??= []).push(r.profile_id);
  const onCourse = new Set(results.map((r) => r.profile_id));
  const rest = tc.profiles.map((p) => p.id).filter((id) => !onCourse.has(id));
  return [...Object.values(byCourse), ...(rest.length ? [rest] : [])];
}

// Whether a family has told the app anything to score with.
const hasTastes = (tc) => tc.profiles.some((p) => Object.values(p.ratings ?? {}).some((x) => Object.keys(x).length) || Object.values(p.learned ?? {}).some((x) => Object.keys(x).length))
  || tc.limits.max_minutes || tc.limits.budget || tc.limits.missing_tools.length || tc.limits.adventurous;

// How one group of profiles does on a slot: null when something fits well,
// else { kind: 'none' | 'low', reasons: [codes] }.
function slotFor(tc, pids, slot) {
  const ctx = cookCtx(tc, pids);
  const ready = slot.ids.filter((id) => lessonById[id]);
  const allowed = ready.filter((id) => dietView(lessonById[id], LIBRARY.ingredients, tc.filters).visible);
  if (ready.length && !allowed.length) return { kind: 'none', reasons: ['diet'] };
  if (!allowed.length) return null;
  const fits = allowed.map((id) => ({ id, ...dishFit(tc, ctx, id) }));
  const best = [...fits].sort((a, b) => (Number(b.fits) - Number(a.fits)) || (b.score - a.score))[0];
  if (best.fits && best.fit !== 'poor') return null;
  // Why: every 1 star across the group's dishes, and the best one's limits.
  const reasons = new Set(fits.flatMap((f) => f.hated ?? []));
  for (const o of best.over ?? []) reasons.add(o);
  return { kind: best.fits ? 'low' : 'none', reasons: [...reasons] };
}

// Average stars across the profiles affected, for picking target tags:
// { id: average } for one list, leaving out anything one of them hates.
function liked(people, kind) {
  const sum = {}, n = {}, hated = new Set();
  for (const p of people) {
    for (const [id, stars] of Object.entries(p.ratings?.[kind] ?? {})) {
      if (stars == null) continue;
      if (stars === 1) hated.add(id);
      sum[id] = (sum[id] ?? 0) + stars;
      n[id] = (n[id] ?? 0) + 1;
    }
  }
  return Object.entries(sum).filter(([id]) => !hated.has(id)).map(([id, s]) => [id, s / n[id]]).sort((a, b) => b[1] - a[1]);
}
const commonest = (xs) => {
  const c = {};
  for (const x of xs) if (x != null) c[x] = (c[x] ?? 0) + 1;
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

// What to write next for a slot: a variation first when one protein or
// ingredient is the problem, else a new dish for the group (or, in a full
// group, a variation of its best dish). With its target tags and the link
// that opens it in the manager, filled in.
function writeNext(slot, top, affected) {
  const people = affected.flatMap((a) => a.people);
  const protein = liked(people, 'protein')[0]?.[0] ?? null;
  const flavors = liked(people, 'flavor').filter(([id, avg]) => id !== 'veggie-heavy' && avg >= 3).slice(0, 2).map(([id]) => id);
  const budget = commonest(affected.map((a) => a.limits.budget));
  const minutes = commonest(affected.map((a) => a.limits.max_minutes));
  const skill = lower(skillName[slot.pick] ?? slot.pick);
  const written = slot.ids.filter((id) => lessonById[id]);
  const link = (kind, id, tags, note) => `/manage/#/gap/${kind}/${id}?${encodeURIComponent(JSON.stringify({ tags, note }))}`;
  const [kind, item] = (top ?? '').split(':');
  if (kind === 'protein') {
    const of = written.find((id) => lessonById[id].tags?.protein === item) ?? written[0];
    if (of) {
      const L = lessonById[of];
      const tags = { ...L.tags, ...(protein ? { protein } : {}) };
      const text = protein ? `A ${lower(itemName('protein', protein))} variation of ${L.title}` : `A variation of ${L.title} with another protein`;
      return { kind: 'variation', lesson_id: of, text, tags, link: link('variation', of, tags, text) };
    }
  }
  if (kind === 'ingredient') {
    const of = written.find((id) => lessonById[id].tasteItems?.required.includes(item)) ?? written[0];
    if (of) {
      const L = lessonById[of];
      const text = `A version of ${L.title} without ${lower(itemName('ingredient', item))}`;
      return { kind: 'variation', lesson_id: of, text, tags: L.tags, link: link('variation', of, L.tags, text) };
    }
  }
  const full = slot.ids.length >= GROUP_MAX;
  // Over a limit in a full group: a quicker, cheaper, or tool-free version of
  // the dish closest to it.
  if (full && written.length && ['time', 'budget', 'tool'].includes(kind)) {
    const BUDGETS = ['$', '$$', '$$$'];
    const by = kind === 'time' ? (id) => lessonById[id].totalMinutes : kind === 'budget' ? (id) => BUDGETS.indexOf(lessonById[id].tags?.budget) : (id) => Number(lessonById[id].tools?.includes(item));
    const L = lessonById[[...written].sort((a, b) => by(a) - by(b))[0]];
    const text = kind === 'time' ? `A quicker version of ${L.title}${minutes ? `, under ${minutes} minutes` : ''}`
      : kind === 'budget' ? `A cheaper version of ${L.title}${budget ? `, ${budget} a serving` : ''}`
        : `A version of ${L.title} without a ${lower(toolName[item] ?? item)}`;
    const tags = kind === 'budget' && budget ? { ...L.tags, budget } : L.tags;
    return { kind: 'variation', lesson_id: L.id, text, tags, link: link('variation', L.id, tags, text) };
  }
  // A side, bread, or dessert group stays one: no protein, its own flavors.
  const meatless = written.length && written.every((id) => lessonById[id].tags?.protein === 'none');
  const tags = meatless
    ? { ...lessonById[written[0]].tags, ...(budget ? { budget } : {}) }
    : { ...(protein ? { protein } : {}), ...(flavors.length ? { flavors } : {}), heat: 'mild', budget: budget ?? '$$', familiar: 'everyday' };
  const spec = [tags.protein && tags.protein !== 'none' ? lower(itemName('protein', tags.protein)) : null,
    tags.flavors?.length ? orList(tags.flavors.map((f) => lower(itemName('flavor', f)))) : null,
    tags.heat, minutes ? `under ${minutes} minutes` : null, tags.budget].filter(Boolean).join(', ');
  if (full && written.length) {
    const L = lessonById[written[0]];
    const text = `The group has ${GROUP_MAX} dishes: a version of ${L.title} (${spec})`;
    return { kind: 'variation', lesson_id: L.id, text, tags: { ...L.tags, ...tags }, link: link('variation', L.id, { ...L.tags, ...tags }, text) };
  }
  const text = `A new ${skill} dish: ${spec}`;
  return { kind: 'dish', pick: slot.pick, text, tags, minutes, link: link('dish', slot.pick, tags, text) };
}

// Each group against protein and heat, by its written versions (each lesson
// and its variations) and its planned dishes, so thin spots show before many
// families have rated anything.
function coverage() {
  const proteins = CONTENT.tastes.proteins.map((p) => ({ id: p.id, name: p.name }));
  const rows = SLOTS.map((slot) => {
    const cells = Object.fromEntries(proteins.map((p) => [p.id, { written: 0, planned: 0 }]));
    const heat = { mild: 0, some: 0, spicy: 0 };
    const flavors = new Set();
    for (const id of slot.ids) {
      const L = lessonById[id];
      const versions = L ? [L.tags, ...(L.variations ?? []).map((v) => v.tags ?? L.tags)] : [dishById[id]?.tags];
      for (const t of versions.filter(Boolean)) {
        if (cells[t.protein]) cells[t.protein][L ? 'written' : 'planned'] += 1;
        if (L && t.heat in heat) heat[t.heat] += 1;
        if (L) (t.flavors ?? []).forEach((f) => flavors.add(f));
      }
    }
    return { key: slot.key, skill: skillName[slot.pick] ?? slot.pick, dishes: slot.ids.length, cells, heat, flavors: flavors.size };
  });
  return { proteins, flavors_total: CONTENT.tastes.flavors.length, rows };
}

const titleOf = (lid, vid) => (vid ? lessonById[lid]?.variations?.find((v) => v.id === vid)?.title : null) ?? lessonById[lid]?.title ?? dishById[lid]?.title ?? lid;
const top = (counts, n = 10) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);

// What people cook, across every family: what's swapped out, skipped, and
// rated low, and average stars by flavor. Family recipes aren't named.
async function whatPeopleCook(env) {
  const swapped = {};
  const { results: swaps } = await env.DB.prepare('SELECT swap_of FROM queue WHERE swap_of IS NOT NULL').all();
  for (const r of swaps) {
    let lid = /^c:[0-9a-f]{16}:(.+)$/.exec(r.swap_of)?.[1];
    const q = /^q:([0-9a-f]{16})$/.exec(r.swap_of)?.[1];
    if (q) lid = (await env.DB.prepare('SELECT lesson_id FROM queue WHERE id = ?').bind(q).first())?.lesson_id;
    if (lid && (lessonById[lid] || dishById[lid])) swapped[lid] = (swapped[lid] ?? 0) + 1;
  }
  const { results: skips } = await env.DB.prepare('SELECT lesson_id, COUNT(*) AS n FROM course_lessons WHERE removed = 2 GROUP BY lesson_id').all();
  let rows;
  const rated = `SELECT a.lesson_id, %V AS variation, ap.rating FROM attempts a JOIN attempt_profiles ap ON ap.attempt_id = a.id %J
      WHERE a.finished_at IS NOT NULL AND a.removed_at IS NULL AND ap.rating IS NOT NULL`;
  try {
    rows = (await env.DB.prepare(rated.replace('%V', 'av.variation').replace('%J', 'LEFT JOIN attempt_variations av ON av.attempt_id = a.id')).all()).results;
  } catch (err) {
    if (!missingTable(err)) throw err;
    rows = (await env.DB.prepare(rated.replace('%V', 'NULL').replace('%J', '')).all()).results;
  }
  const byVersion = {};
  for (const r of rows.filter((x) => lessonById[x.lesson_id])) {
    const k = `${r.lesson_id}|${r.variation ?? ''}`;
    const x = (byVersion[k] ??= { lesson_id: r.lesson_id, variation: r.variation ?? '', ratings: 0, sum: 0, low: 0 });
    x.ratings += 1; x.sum += r.rating; if (r.rating <= 2) x.low += 1;
  }
  let flavors = [];
  try {
    flavors = (await env.DB.prepare("SELECT item, AVG(stars) AS avg, COUNT(*) AS n FROM profile_ratings WHERE kind = 'flavor' AND stars IS NOT NULL GROUP BY item").all()).results;
  } catch (err) {
    if (!missingTable(err)) throw err;
  }
  return {
    swapped: top(swapped).map(([id, n]) => ({ lesson_id: id, title: titleOf(id), n })),
    skipped: skips.filter((r) => lessonById[r.lesson_id] || dishById[r.lesson_id]).sort((a, b) => b.n - a.n).slice(0, 10).map((r) => ({ lesson_id: r.lesson_id, title: titleOf(r.lesson_id), n: r.n })),
    rated_low: Object.values(byVersion).filter((x) => x.low).sort((a, b) => b.low - a.low || a.sum / a.ratings - b.sum / b.ratings).slice(0, 10)
      .map((x) => ({ lesson_id: x.lesson_id, title: titleOf(x.lesson_id, x.variation), low: x.low, ratings: x.ratings, average: Math.round((x.sum / x.ratings) * 10) / 10 })),
    flavor_stars: flavors.map((r) => ({ id: r.item, name: itemName('flavor', r.item), average: Math.round(r.avg * 10) / 10, ratings: r.n })).sort((a, b) => b.average - a.average),
  };
}

export async function gapsReport(env) {
  const st = await releaseState(env.DB);
  const { results: families } = await env.DB.prepare('SELECT * FROM families WHERE deleted_at IS NULL').all();
  const slots = SLOTS.map((slot) => ({ slot, none: 0, low: 0, reasons: {}, affected: [] }));
  let counted = 0;
  for (const fam of families.filter((f) => releaseOf(st, f.id) >= 1)) {
    const tc = await tasteContext(env, fam);
    if (!tc || !hasTastes(tc)) continue;
    counted += 1;
    const groups = await cookGroups(env, fam, tc);
    for (const s of slots) {
      // A family counts once a slot: its group that does worst.
      let worst = null;
      const reasons = new Set(), people = [];
      for (const pids of groups) {
        const g = slotFor(tc, pids, s.slot);
        if (!g) continue;
        if (!worst || g.kind === 'none') worst = g.kind;
        g.reasons.forEach((r) => reasons.add(r));
        people.push(...tc.profiles.filter((p) => pids.includes(p.id)));
      }
      if (!worst) continue;
      s[worst] += 1;
      for (const r of reasons) s.reasons[r] = (s.reasons[r] ?? 0) + 1;
      s.affected.push({ people, limits: tc.limits });
    }
  }
  const gaps = slots.filter((s) => s.none || s.low).sort((a, b) => (b.none + b.low) - (a.none + a.low) || b.none - a.none).map((s) => {
    const reasons = Object.entries(s.reasons).sort((a, b) => b[1] - a[1]);
    // A protein or ingredient goes first for Write next: a variation fixes it.
    const lead = reasons.find(([code]) => /^(protein|ingredient):/.test(code))?.[0] ?? reasons[0]?.[0] ?? null;
    return {
      key: s.slot.key, skill: skillName[s.slot.pick] ?? s.slot.pick,
      dishes: s.slot.ids.map((id) => ({ id, title: titleOf(id), written: Boolean(lessonById[id]) })),
      families: s.none + s.low, none: s.none, low: s.low,
      reasons: reasons.map(([code, n]) => ({ code, text: reasonText(code), families: n })),
      write_next: writeNext(s.slot, lead, s.affected),
    };
  });
  return { families: counted, slots: SLOTS.length, gaps, coverage: coverage(), cooking: await whatPeopleCook(env), level_requests: await levelRequests(env) };
}

// Level weeks families asked a replacement for (14c): neither dish could be
// cooked with their settings. Each week with its dishes, how many families
// asked, and why, counted. Counts only. Empty before the draft's table exists.
async function levelRequests(env) {
  let rows = [];
  try {
    rows = (await env.DB.prepare('SELECT level, week, reasons FROM level_requests').all()).results;
  } catch (err) {
    if (missingTable(err)) return [];
    throw err;
  }
  const byWeek = {};
  for (const r of rows) {
    const V = LIBRARY.levels?.[r.level];
    const w = V?.weeks.find((x) => x.week === r.week);
    if (!w?.recipe) continue;
    const x = byWeek[`${r.level}:${r.week}`] ??= {
      level: r.level, level_name: V.name, week: r.week, skill: skillName[w.skill] ?? w.skill ?? null,
      dishes: [w.familiar, w.explore].map((id) => ({ id, title: lessonById[id]?.title ?? V.titles[id] ?? id, written: Boolean(lessonById[id]) })),
      families: 0, counts: {}, link: `/manage/#/level/${r.level}`,
    };
    x.families += 1;
    for (const code of JSON.parse(r.reasons)) x.counts[code] = (x.counts[code] ?? 0) + 1;
  }
  return Object.values(byWeek).sort((a, b) => b.families - a.families || a.level.localeCompare(b.level) || a.week - b.week)
    .map(({ counts, ...x }) => ({ ...x, reasons: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([code, n]) => ({ code, text: requestText(code), families: n })) }));
}
const DIET_NAMES = { nuts: 'Tree nuts', peanuts: 'Peanuts', dairy: 'Dairy', egg: 'Eggs', gluten: 'Gluten', fish: 'Fish', meat: 'Meat and poultry' };
const requestText = (code) => {
  const [kind, id] = code.split(':');
  return kind === 'diet' ? `Leaves out ${lower(DIET_NAMES[id] ?? id)}` : kind === 'tool' ? `No ${lower(toolName[id] ?? id)}` : code;
};

export function register(on) {
  on('GET', '/api/owner/gaps', async (req, env) => {
    await requireOwner(env, req);
    return gapsReport(env);
  });
}
