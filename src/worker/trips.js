// Phase 3b: shopping trips and the pantry (plan §6.3). A parent starts a trip
// by picking queued lessons; the trip keeps its lessons, their serving counts,
// and its own check-offs. Ending it marks its lessons shopped. Every query is
// scoped by the session's family_id, as in api.js.
import { fail, now } from './lib/http.js';
import { randomHex } from './lib/crypto.js';
import { requireParent } from './auth.js';
import { CONTENT } from './content-data.js';
import { liveLesson } from './lessons.js';
import { shoppingList, SECTIONS } from '../content/shop.js';
import { family, syncQueue, queueProfiles, itemOut, today, tzOf } from './plan.js';

const id = () => randomHex(8);
const placeholders = (list) => list.map(() => '?').join(', ');
// The full ingredient records: package sizes, conversions, and store sections.
const REGISTRY = Object.fromEntries(CONTENT.ingredients.map((i) => [i.id, i]));
const PERISH_MAX = 60;

const openTrip = (env, fid) => env.DB.prepare('SELECT * FROM shopping_trips WHERE family_id = ? AND ended_at IS NULL AND cancelled_at IS NULL').bind(fid).first();
const ownTrip = async (env, fid, tid) => (await env.DB.prepare('SELECT * FROM shopping_trips WHERE id = ? AND family_id = ?').bind(tid, fid).first())
  ?? fail(404, 'not_found', 'No such shopping trip.');

const perishDays = (v, fallback = 7) => {
  if (v == null) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > PERISH_MAX) fail(400, 'invalid', `Perishables can look 1 to ${PERISH_MAX} days ahead.`);
  return n;
};

// The lessons that can go on a trip: queued and not shopped for yet.
async function shoppable(env, fid, ids) {
  const list = Array.isArray(ids) ? [...new Set(ids.map(String))] : [];
  if (list.length < 1 || list.length > 40) fail(400, 'invalid', 'Pick 1 to 40 lessons to shop for.');
  const { results } = await env.DB.prepare(`SELECT id, servings FROM queue WHERE family_id = ? AND status = 'assigned' AND id IN (${placeholders(list)})`).bind(fid, ...list).all();
  if (results.length !== list.length) fail(400, 'invalid', 'A lesson picked is not in your queue, or is already shopped for.');
  return results;
}

// The day a lesson is planned for: its planned date, or its course week's Sunday.
const planned = (q) => q.planned_date ?? q.week_start ?? null;

async function tripOut(env, fam, trip, day) {
  const { results: rows } = await env.DB.prepare(`SELECT q.*, tl.servings AS trip_servings FROM trip_lessons tl JOIN queue q ON q.id = tl.queue_id
      WHERE tl.trip_id = ? AND tl.family_id = ? ORDER BY q.week_start IS NULL, q.week_start, q.planned_date, q.created_at`).bind(trip.id, fam.id).all();
  const who = await queueProfiles(env, fam.id, rows.map((r) => r.id));
  const lessons = [];
  for (const r of rows) {
    const L = await liveLesson(env.DB, r.lesson_id);
    if (L) lessons.push({ lesson: L, servings: r.trip_servings, date: planned(r) });
  }
  const pantry = (await env.DB.prepare('SELECT ingredient_id FROM pantry WHERE family_id = ?').bind(fam.id).all()).results.map((r) => r.ingredient_id);
  const checks = (await env.DB.prepare('SELECT ingredient_id FROM shopping_checks WHERE trip_id = ? AND family_id = ? AND checked = 1').bind(trip.id, fam.id).all()).results;
  return {
    id: trip.id, created_at: trip.created_at, ended_at: trip.ended_at, cancelled_at: trip.cancelled_at, perish_days: trip.perish_days,
    open: !trip.ended_at && !trip.cancelled_at,
    lessons: rows.map((r) => ({ ...itemOut(r, who), servings: r.trip_servings, date: planned(r) })),
    list: shoppingList({ lessons, registry: REGISTRY, filters: JSON.parse(fam.diet_filters), pantry, today: day, perishDays: trip.perish_days }),
    checked: checks.map((c) => c.ingredient_id),
  };
}

export function register(on) {
  // The open trip, or what a new one could hold; and the last few trips.
  on('GET', '/api/trips', async (req, env) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    const day = today(req);
    // Next week's course lessons join the queue from Thursday, ready to shop for.
    await syncQueue(env, fam, day, tzOf(req));
    const trip = await openTrip(env, s.family_id);
    const { results: rows } = await env.DB.prepare(`SELECT * FROM queue WHERE family_id = ? AND status = 'assigned'
        AND id NOT IN (SELECT tl.queue_id FROM trip_lessons tl JOIN shopping_trips t ON t.id = tl.trip_id WHERE t.family_id = ? AND t.ended_at IS NULL AND t.cancelled_at IS NULL)
        ORDER BY week_start IS NULL, week_start, planned_date IS NULL, planned_date, created_at`).bind(s.family_id, s.family_id).all();
    const who = await queueProfiles(env, s.family_id, rows.map((r) => r.id));
    const recent = (await env.DB.prepare(`SELECT * FROM shopping_trips WHERE family_id = ? AND (ended_at IS NOT NULL OR cancelled_at IS NOT NULL)
        ORDER BY COALESCE(ended_at, cancelled_at) DESC LIMIT 5`).bind(s.family_id).all()).results;
    return {
      today: day,
      trip: trip ? await tripOut(env, fam, trip, day) : null,
      candidates: rows.map((r) => ({ ...itemOut(r, who), date: planned(r) })),
      recent: recent.map((t) => ({ id: t.id, created_at: t.created_at, ended_at: t.ended_at, cancelled_at: t.cancelled_at })),
    };
  });

  on('POST', '/api/trips', async (req, env, body) => {
    const s = await requireParent(env, req);
    if (await openTrip(env, s.family_id)) fail(409, 'trip_open', 'A shopping trip is already open. End it or cancel it first.');
    const rows = await shoppable(env, s.family_id, body.queue_ids);
    const tid = id();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO shopping_trips (id, family_id, created_at, perish_days) VALUES (?, ?, ?, ?)').bind(tid, s.family_id, now(), perishDays(body.perish_days)),
      ...rows.map((r) => env.DB.prepare('INSERT INTO trip_lessons (trip_id, family_id, queue_id, servings) VALUES (?, ?, ?, ?)').bind(tid, s.family_id, r.id, r.servings)),
    ]);
    return { ok: true, id: tid };
  });

  on('GET', '/api/trips/([0-9a-f]{16})', async (req, env, body, [tid]) => {
    const s = await requireParent(env, req);
    const fam = await family(env, s.family_id);
    return { trip: await tripOut(env, fam, await ownTrip(env, s.family_id, tid), today(req)) };
  });

  // How far ahead perishables look, and lessons added to an open trip.
  on('PUT', '/api/trips/([0-9a-f]{16})', async (req, env, body, [tid]) => {
    const s = await requireParent(env, req);
    const trip = await ownTrip(env, s.family_id, tid);
    if (trip.ended_at || trip.cancelled_at) fail(409, 'closed', 'That trip is over. Reopen it first.');
    const stmts = [env.DB.prepare('UPDATE shopping_trips SET perish_days = ? WHERE id = ? AND family_id = ?').bind(perishDays(body.perish_days, trip.perish_days), trip.id, s.family_id)];
    if (body.add_queue_ids !== undefined) {
      const rows = await shoppable(env, s.family_id, body.add_queue_ids);
      for (const r of rows) stmts.push(env.DB.prepare('INSERT OR IGNORE INTO trip_lessons (trip_id, family_id, queue_id, servings) VALUES (?, ?, ?, ?)').bind(trip.id, s.family_id, r.id, r.servings));
    }
    if (body.remove_queue_id !== undefined) {
      stmts.push(env.DB.prepare('DELETE FROM trip_lessons WHERE trip_id = ? AND family_id = ? AND queue_id = ?').bind(trip.id, s.family_id, String(body.remove_queue_id)));
    }
    await env.DB.batch(stmts);
    return { ok: true };
  });

  // A tap in the store. Saved as it's tapped, so the list survives closing the app.
  on('POST', '/api/trips/([0-9a-f]{16})/check', async (req, env, body, [tid]) => {
    const s = await requireParent(env, req);
    const trip = await ownTrip(env, s.family_id, tid);
    const ing = String(body.ingredient_id ?? '');
    if (!REGISTRY[ing]) fail(400, 'invalid', 'No such ingredient.');
    if (typeof body.checked !== 'boolean') fail(400, 'invalid', 'checked must be true or false.');
    await env.DB.prepare(`INSERT INTO shopping_checks (trip_id, family_id, ingredient_id, checked) VALUES (?, ?, ?, ?)
        ON CONFLICT(trip_id, ingredient_id) DO UPDATE SET checked = excluded.checked`).bind(trip.id, s.family_id, ing, Number(body.checked)).run();
    return { ok: true };
  });

  // End trip: its lessons are shopped for. Reopen undoes it.
  on('POST', '/api/trips/([0-9a-f]{16})/end', async (req, env, body, [tid]) => {
    const s = await requireParent(env, req);
    const trip = await ownTrip(env, s.family_id, tid);
    if (trip.ended_at || trip.cancelled_at) fail(409, 'closed', 'That trip is already over.');
    await env.DB.batch([
      env.DB.prepare('UPDATE shopping_trips SET ended_at = ? WHERE id = ? AND family_id = ?').bind(now(), trip.id, s.family_id),
      env.DB.prepare(`UPDATE queue SET status = 'shopped' WHERE family_id = ? AND status = 'assigned'
          AND id IN (SELECT queue_id FROM trip_lessons WHERE trip_id = ? AND family_id = ?)`).bind(s.family_id, trip.id, s.family_id),
    ]);
    return { ok: true };
  });

  on('POST', '/api/trips/([0-9a-f]{16})/cancel', async (req, env, body, [tid]) => {
    const s = await requireParent(env, req);
    const trip = await ownTrip(env, s.family_id, tid);
    if (trip.ended_at || trip.cancelled_at) fail(409, 'closed', 'That trip is already over.');
    await env.DB.prepare('UPDATE shopping_trips SET cancelled_at = ? WHERE id = ? AND family_id = ?').bind(now(), trip.id, s.family_id).run();
    return { ok: true };
  });

  // The restore for End trip and Cancel. Lessons it marked shopped and not
  // cooked since go back to waiting to be shopped for.
  on('POST', '/api/trips/([0-9a-f]{16})/reopen', async (req, env, body, [tid]) => {
    const s = await requireParent(env, req);
    const trip = await ownTrip(env, s.family_id, tid);
    if (!trip.ended_at && !trip.cancelled_at) return { ok: true };
    const other = await openTrip(env, s.family_id);
    if (other) fail(409, 'trip_open', 'Another trip is open. End it or cancel it first.');
    await env.DB.batch([
      env.DB.prepare('UPDATE shopping_trips SET ended_at = NULL, cancelled_at = NULL WHERE id = ? AND family_id = ?').bind(trip.id, s.family_id),
      ...(trip.ended_at ? [env.DB.prepare(`UPDATE queue SET status = 'assigned' WHERE family_id = ? AND status = 'shopped'
          AND id IN (SELECT queue_id FROM trip_lessons WHERE trip_id = ? AND family_id = ?)`).bind(s.family_id, trip.id, s.family_id)] : []),
    ]);
    return { ok: true };
  });

  // ---------- the pantry ----------

  on('GET', '/api/pantry', async (req, env) => {
    const s = await requireParent(env, req);
    const have = (await env.DB.prepare('SELECT ingredient_id FROM pantry WHERE family_id = ?').bind(s.family_id).all()).results.map((r) => r.ingredient_id);
    return {
      pantry: have,
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
