// Shopping (plan §6.3), optional (owner, 2026-10-22): nothing a learner does
// waits on it. "What you'll need" shows the ingredients for the upcoming
// lessons week by week. A parent can make a shopping list for the next few
// uncooked lessons, tick what's on hand, and check the rest off in the store.
// Every query is scoped by the session's family_id, as in api.js.
import { fail, now } from './lib/http.js';
import { randomHex } from './lib/crypto.js';
import { requireParent } from './auth.js';
import { CONTENT } from './content-data.js';
import { LIBRARY } from './library-data.js';
import { liveLesson } from './lessons.js';
import { servingOptions } from '../content/scale.js';
import { shoppingList, SECTIONS } from '../content/shop.js';
import { family, syncQueue, queueProfiles, today, tzOf } from './plan.js';
import { weekOf } from './schedule.js';

const id = () => randomHex(8);
const placeholders = (list) => list.map(() => '?').join(', ');
// The full ingredient records: package sizes, conversions, and store sections.
const REGISTRY = Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i]));
const written = new Set(LIBRARY.lessons.map((L) => L.id));
const LIST_MAX = 20; // lessons on one list
const nearestSize = (lid, n) => {
  const options = servingOptions(LIBRARY.lessons.find((L) => L.id === lid));
  return options.includes(n) ? n : options.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
};

// Every uncooked lesson coming up, in order: ones queued by hand with no date
// first, then week by week (a course's lessons in its schedule's order, then
// lessons queued by hand for that week). A lesson queued once for several
// profiles is one cook, and one entry.
async function upcoming(env, fam, day, tz) {
  const thisWeek = weekOf(day);
  const states = await syncQueue(env, fam, day, tz);
  const { results: rows } = await env.DB.prepare("SELECT * FROM queue WHERE family_id = ? AND status IN ('assigned', 'shopped') ORDER BY created_at, id").bind(fam.id).all();
  const who = await queueProfiles(env, fam.id, rows.map((r) => r.id));
  const out = [];
  const entry = (lid, week, extra) => ({ lesson_id: lid, title: LIBRARY.lessons.find((L) => L.id === lid)?.title ?? lid, week, ...extra });
  for (const st of states) {
    const weeks = [
      { week: st.sched.this_week.week, ids: st.sched.this_week.lessons.filter((x) => !x.done).map((x) => x.id) },
      { week: st.sched.next_week.week, ids: st.sched.next_week.lessons.map((x) => x.id) },
      ...st.sched.ahead.map((w) => ({ week: w.week, ids: w.lessons })),
    ];
    for (const w of weeks) {
      for (const lid of w.ids) {
        const q = rows.find((r) => r.course_id === st.course.id && r.lesson_id === lid);
        out.push(entry(lid, w.week < thisWeek ? thisWeek : w.week, {
          key: q ? q.id : `${st.course.id}:${lid}`, queue_id: q?.id ?? null, course_id: st.course.id,
          servings: q?.servings ?? nearestSize(lid, fam.default_servings), profile_ids: st.profiles,
        }));
      }
    }
  }
  for (const r of rows) {
    if (r.course_id || !written.has(r.lesson_id)) continue;
    const week = r.planned_date ? (weekOf(r.planned_date) < thisWeek ? thisWeek : weekOf(r.planned_date)) : null;
    out.push(entry(r.lesson_id, week, { key: r.id, queue_id: r.id, course_id: null, servings: r.servings, profile_ids: who[r.id] ?? [], planned_date: r.planned_date }));
  }
  // Stable sort: no date first, then by week.
  return out.map((x, i) => [x, i]).sort(([a, i], [b, j]) => (a.week ?? '') < (b.week ?? '') ? -1 : (a.week ?? '') > (b.week ?? '') ? 1 : i - j).map(([x]) => x);
}

const staplesOf = async (env, fid) => (await env.DB.prepare('SELECT ingredient_id FROM pantry WHERE family_id = ?').bind(fid).all()).results.map((r) => r.ingredient_id);

async function needs(env, fam, entries, { staples = [], skip = [] } = {}) {
  const lessons = [];
  for (const e of entries) {
    const L = await liveLesson(env.DB, e.lesson_id);
    if (L) lessons.push({ lesson: L, servings: e.servings });
  }
  return shoppingList({ lessons, registry: REGISTRY, filters: JSON.parse(fam.diet_filters), staples, skip });
}

const ownList = async (env, fid, lid) => (await env.DB.prepare('SELECT * FROM shopping_lists WHERE id = ? AND family_id = ?').bind(lid, fid).first())
  ?? fail(404, 'not_found', 'No such shopping list.');

async function listOut(env, fam, list) {
  const lessons = (await env.DB.prepare('SELECT * FROM list_lessons WHERE list_id = ? AND family_id = ? ORDER BY position').bind(list.id, fam.id).all()).results;
  const onHand = (await env.DB.prepare('SELECT ingredient_id FROM list_on_hand WHERE list_id = ? AND family_id = ?').bind(list.id, fam.id).all()).results.map((r) => r.ingredient_id);
  const checked = (await env.DB.prepare('SELECT ingredient_id FROM list_checks WHERE list_id = ? AND family_id = ?').bind(list.id, fam.id).all()).results.map((r) => r.ingredient_id);
  const staples = await staplesOf(env, fam.id);
  const full = await needs(env, fam, lessons, { staples });
  const all = [...full.sections.flatMap((x) => x.items), ...full.may_have];
  const left = await needs(env, fam, lessons, { staples, skip: onHand });
  return {
    id: list.id, created_at: list.created_at, done_at: list.done_at,
    lessons: lessons.map((l) => ({ lesson_id: l.lesson_id, title: LIBRARY.lessons.find((L) => L.id === l.lesson_id)?.title ?? l.lesson_id, servings: l.servings })),
    sections: left.sections, may_have: left.may_have,
    on_hand: all.filter((x) => onHand.includes(x.id)),
    checked,
  };
}

export function register(on) {
  // What you'll need, week by week; the next uncooked lessons for a new list;
  // and the family's lists.
  on('GET', '/api/shopping', async (req, env) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const day = today(req);
    const list = await upcoming(env, fam, day, tzOf(req));
    const staples = await staplesOf(env, s.family_id);
    const weeks = [];
    for (const e of list) {
      const last = weeks.at(-1);
      if (last && last.week === e.week) last.lessons.push(e); else weeks.push({ week: e.week, lessons: [e] });
    }
    for (const w of weeks) w.needs = await needs(env, fam, w.lessons, { staples });
    const lists = (await env.DB.prepare('SELECT * FROM shopping_lists WHERE family_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id LIMIT 6').bind(s.family_id).all()).results;
    return {
      today: day, this_week: weekOf(day), weeks, upcoming: list, list_max: LIST_MAX,
      lists: await Promise.all(lists.map(async (l) => {
        const o = await listOut(env, fam, l);
        const items = [...o.sections.flatMap((x) => x.items), ...o.may_have];
        return { id: l.id, created_at: l.created_at, done_at: l.done_at, lessons: o.lessons.map((x) => x.title), total: items.length, checked: items.filter((x) => o.checked.includes(x.id)).length };
      })),
    };
  });

  // The preview: everything the next `count` uncooked lessons need.
  on('POST', '/api/shopping/preview', async (req, env, body) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const list = await upcoming(env, fam, today(req), tzOf(req));
    const count = Number(body.count);
    if (!Number.isInteger(count) || count < 1 || count > Math.min(LIST_MAX, list.length)) fail(400, 'invalid', `Pick 1 to ${Math.min(LIST_MAX, list.length)} lessons.`);
    const picked = list.slice(0, count);
    return { lessons: picked, ...(await needs(env, fam, picked, { staples: await staplesOf(env, s.family_id) })) };
  });

  // Create shopping list: the previewed lessons, minus what's on hand.
  on('POST', '/api/shopping/lists', async (req, env, body) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const list = await upcoming(env, fam, today(req), tzOf(req));
    const keys = Array.isArray(body.keys) ? body.keys.map(String) : [];
    if (keys.length < 1 || keys.length > LIST_MAX) fail(400, 'invalid', `A list is for 1 to ${LIST_MAX} lessons.`);
    const picked = keys.map((k) => list.find((x) => x.key === k) ?? fail(409, 'changed', 'The upcoming lessons changed. Pick again.'));
    const onHand = Array.isArray(body.on_hand) ? [...new Set(body.on_hand.map(String))] : [];
    for (const x of onHand) if (!REGISTRY[x]) fail(400, 'invalid', `"${x}" is not an ingredient.`);
    const lid = id();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO shopping_lists (id, family_id, created_at) VALUES (?, ?, ?)').bind(lid, s.family_id, now()),
      ...picked.map((e, i) => env.DB.prepare('INSERT INTO list_lessons (list_id, family_id, position, lesson_id, servings, queue_id, course_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(lid, s.family_id, i, e.lesson_id, e.servings, e.queue_id, e.course_id)),
      ...onHand.map((x) => env.DB.prepare('INSERT INTO list_on_hand (list_id, family_id, ingredient_id) VALUES (?, ?, ?)').bind(lid, s.family_id, x)),
    ]);
    return { ok: true, id: lid };
  });

  on('GET', '/api/shopping/lists/([0-9a-f]{16})', async (req, env, body, [lid]) => {
    const s = await requireParent(env, req);
    const list = await ownList(env, s.family_id, lid);
    if (list.deleted_at) fail(404, 'not_found', 'No such shopping list.');
    return { list: await listOut(env, await family(env, s.family_id), list) };
  });

  // A tap in the store, saved as it's tapped.
  on('POST', '/api/shopping/lists/([0-9a-f]{16})/check', async (req, env, body, [lid]) => {
    const s = await requireParent(env, req);
    const list = await ownList(env, s.family_id, lid);
    const ing = String(body.ingredient_id ?? '');
    if (!REGISTRY[ing]) fail(400, 'invalid', 'No such ingredient.');
    if (typeof body.checked !== 'boolean') fail(400, 'invalid', 'checked must be true or false.');
    await env.DB.prepare(body.checked
      ? 'INSERT OR IGNORE INTO list_checks (list_id, family_id, ingredient_id) VALUES (?, ?, ?)'
      : 'DELETE FROM list_checks WHERE list_id = ? AND family_id = ? AND ingredient_id = ?').bind(list.id, s.family_id, ing).run();
    return { ok: true };
  });

  // On hand after all, or back on the list.
  on('POST', '/api/shopping/lists/([0-9a-f]{16})/on-hand', async (req, env, body, [lid]) => {
    const s = await requireParent(env, req);
    const list = await ownList(env, s.family_id, lid);
    const ing = String(body.ingredient_id ?? '');
    if (!REGISTRY[ing]) fail(400, 'invalid', 'No such ingredient.');
    if (typeof body.on_hand !== 'boolean') fail(400, 'invalid', 'on_hand must be true or false.');
    await env.DB.prepare(body.on_hand
      ? 'INSERT OR IGNORE INTO list_on_hand (list_id, family_id, ingredient_id) VALUES (?, ?, ?)'
      : 'DELETE FROM list_on_hand WHERE list_id = ? AND family_id = ? AND ingredient_id = ?').bind(list.id, s.family_id, ing).run();
    return { ok: true };
  });

  // Done shopping (optional), and its undo; Delete, and its undo.
  const stamp = (col, value) => async (req, env, body, [lid]) => {
    const s = await requireParent(env, req);
    const list = await ownList(env, s.family_id, lid);
    await env.DB.prepare(`UPDATE shopping_lists SET ${col} = ? WHERE id = ? AND family_id = ?`).bind(value ? now() : null, list.id, s.family_id).run();
    return { ok: true };
  };
  on('POST', '/api/shopping/lists/([0-9a-f]{16})/done', stamp('done_at', true));
  on('POST', '/api/shopping/lists/([0-9a-f]{16})/not-done', stamp('done_at', false));
  on('POST', '/api/shopping/lists/([0-9a-f]{16})/delete', stamp('deleted_at', true));
  on('POST', '/api/shopping/lists/([0-9a-f]{16})/restore', stamp('deleted_at', false));

  // ---------- kitchen staples ----------

  on('GET', '/api/pantry', async (req, env) => {
    const s = await requireParent(env, req);
    return {
      pantry: await staplesOf(env, s.family_id),
      sections: SECTIONS.map(([sid, name]) => ({ id: sid, name, items: CONTENT.ingredients.filter((i) => i.section === sid).map((i) => ({ id: i.id, name: i.name })) }))
        .filter((x) => x.items.length),
    };
  });

  on('PUT', '/api/pantry', async (req, env, body) => {
    const s = await requireParent(env, req);
    const ids = Array.isArray(body.ingredient_ids) ? [...new Set(body.ingredient_ids.map(String))] : fail(400, 'invalid', 'ingredient_ids must be a list.');
    for (const x of ids) if (!REGISTRY[x]) fail(400, 'invalid', `"${x}" is not an ingredient.`);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM pantry WHERE family_id = ?').bind(s.family_id),
      ...ids.map((x) => env.DB.prepare('INSERT INTO pantry (family_id, ingredient_id) VALUES (?, ?)').bind(s.family_id, x)),
    ]);
    return { ok: true };
  });
}
