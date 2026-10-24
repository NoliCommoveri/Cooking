// Phase 11b: tastes (plan §6.21). Each profile rates proteins, flavors, and key
// ingredients from 1 star (hate) to 5 (absolute favorite), or Haven't tried,
// with at most one favorite per list; the family sets its limits once (time,
// budget, tools, how adventurous). Part of the next release (§8.6): only a
// family that has it sees any of this. Parents only, behind the PIN.
import { fail, now } from './lib/http.js';
import { requireParent } from './auth.js';
import { CONTENT } from './content-data.js';
import { nextReleaseOn } from './release.js';
import {
  STARS, FAVORITE, RATING_KINDS, MAX_MINUTES, BUDGET, ADVENTUROUS, TOOL_CHOICES, HEAT, ratingItems,
} from '../content/tastes.js';

const ITEMS = ratingItems(CONTENT.tastes);

async function parentWithRelease(env, req) {
  const s = await requireParent(env, req);
  if (!(await nextReleaseOn(env.DB, s.family_id))) fail(404, 'not_available', 'Not available yet.');
  return s;
}

const itemName = (kind, id) => ITEMS[kind].find((x) => x.id === id)?.name ?? id;

// Every rating a profile has, as { kind: { item: stars | null } }.
async function ratingsOf(env, fid, pids) {
  const out = Object.fromEntries(pids.map((p) => [p, Object.fromEntries(RATING_KINDS.map((k) => [k, {}]))]));
  if (!pids.length) return out;
  const { results } = await env.DB.prepare(`SELECT profile_id, kind, item, stars FROM profile_ratings WHERE family_id = ? AND profile_id IN (${pids.map(() => '?').join(',')})`)
    .bind(fid, ...pids).all();
  for (const r of results) if (out[r.profile_id]?.[r.kind]) out[r.profile_id][r.kind][r.item] = r.stars;
  return out;
}

async function limitsOf(env, fid) {
  const r = await env.DB.prepare('SELECT * FROM family_limits WHERE family_id = ?').bind(fid).first();
  return { max_minutes: r?.max_minutes ?? null, budget: r?.budget ?? null, missing_tools: JSON.parse(r?.missing_tools ?? '[]'), adventurous: r?.adventurous ?? null };
}

async function profileOf(env, fid, pid) {
  return await env.DB.prepare('SELECT id, name FROM profiles WHERE id = ? AND family_id = ?').bind(pid, fid).first()
    ?? fail(404, 'not_found', 'No such profile.');
}

export function register(on) {
  // Everything the Our tastes page and Chef Ruth need: the lists, every
  // profile's ratings, and the family's limits.
  on('GET', '/api/tastes', async (req, env) => {
    const s = await parentWithRelease(env, req);
    const profiles = (await env.DB.prepare('SELECT id, name, avatar, people, audience FROM profiles WHERE family_id = ? ORDER BY created_at, id').bind(s.family_id).all()).results
      .map((p) => ({ ...p, people: JSON.parse(p.people) }));
    const equipment = Object.fromEntries(CONTENT.equipment.map((e) => [e.id, e.name]));
    return {
      lists: Object.fromEntries(RATING_KINDS.map((k) => [k, ITEMS[k].map(({ id, name, hint, examples }) => ({ id, name, ...(hint ? { hint } : {}), ...(examples ? { examples } : {}) }))])),
      stars: STARS,
      choices: {
        max_minutes: MAX_MINUTES, budget: BUDGET, adventurous: ADVENTUROUS, heat: HEAT,
        tools: TOOL_CHOICES.filter((id) => equipment[id]).map((id) => ({ id, name: equipment[id] })),
      },
      profiles,
      ratings: await ratingsOf(env, s.family_id, profiles.map((p) => p.id)),
      limits: await limitsOf(env, s.family_id),
    };
  });

  // One rating. stars: 1–5, or null for Haven't tried; clear: true takes it
  // off. A second favorite in the same list is refused unless replace is set,
  // which moves the old favorite to 4 stars.
  on('PUT', '/api/profiles/([0-9a-f]{16})/ratings', async (req, env, body, [pid]) => {
    const s = await parentWithRelease(env, req);
    await profileOf(env, s.family_id, pid);
    const kind = RATING_KINDS.includes(body.kind) ? body.kind : fail(400, 'invalid', `kind must be one of ${RATING_KINDS.join(', ')}.`);
    const item = ITEMS[kind].some((x) => x.id === body.item) ? body.item : fail(400, 'invalid', 'No such item to rate.');
    const t = now();
    if (body.clear) {
      await env.DB.prepare('DELETE FROM profile_ratings WHERE profile_id = ? AND kind = ? AND item = ? AND family_id = ?').bind(pid, kind, item, s.family_id).run();
    } else {
      const stars = body.stars === null ? null : Number.isInteger(body.stars) && body.stars >= 1 && body.stars <= 5 ? body.stars : fail(400, 'invalid', 'stars is 1 to 5, or null for Haven\'t tried.');
      const stmts = [];
      if (stars === FAVORITE) {
        const old = await env.DB.prepare('SELECT item FROM profile_ratings WHERE profile_id = ? AND kind = ? AND stars = ? AND item != ? AND family_id = ?')
          .bind(pid, kind, FAVORITE, item, s.family_id).first();
        if (old && !body.replace) fail(409, 'favorite_taken', `${itemName(kind, old.item)} is already the absolute favorite. Move it to 4 stars?`);
        if (old) stmts.push(env.DB.prepare('UPDATE profile_ratings SET stars = 4, updated_at = ? WHERE profile_id = ? AND kind = ? AND item = ?').bind(t, pid, kind, old.item));
      }
      stmts.push(env.DB.prepare(`INSERT INTO profile_ratings (family_id, profile_id, kind, item, stars, updated_at) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (profile_id, kind, item) DO UPDATE SET stars = excluded.stars, updated_at = excluded.updated_at`).bind(s.family_id, pid, kind, item, stars, t));
      await env.DB.batch(stmts);
    }
    return { ratings: (await ratingsOf(env, s.family_id, [pid]))[pid] };
  });

  // The family's limits. Each field: a value, or null for no limit.
  on('PUT', '/api/tastes/limits', async (req, env, body) => {
    const s = await parentWithRelease(env, req);
    const pick = (v, ok, what) => (v == null || v === '' ? null : ok(v) ? v : fail(400, 'invalid', `That isn't a ${what}.`));
    const maxMinutes = pick(body.max_minutes == null || body.max_minutes === '' ? null : Number(body.max_minutes), (v) => MAX_MINUTES.includes(v), 'time limit');
    const budget = pick(body.budget, (v) => BUDGET.some(([b]) => b === v), 'budget');
    const adventurous = pick(body.adventurous, (v) => ADVENTUROUS.some(([a]) => a === v), 'choice');
    const tools = Array.isArray(body.missing_tools) ? body.missing_tools.filter((x) => TOOL_CHOICES.includes(x)) : [];
    await env.DB.prepare(`INSERT INTO family_limits (family_id, max_minutes, budget, missing_tools, adventurous, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (family_id) DO UPDATE SET max_minutes = excluded.max_minutes, budget = excluded.budget, missing_tools = excluded.missing_tools,
          adventurous = excluded.adventurous, updated_at = excluded.updated_at`)
      .bind(s.family_id, maxMinutes, budget, JSON.stringify(tools), adventurous, now()).run();
    return { limits: await limitsOf(env, s.family_id) };
  });
}

// A deleted profile's ratings go with it. Before the next release's draft is
// applied there's no table, and nothing to delete.
export async function forgetProfile(env, fid, pid) {
  try {
    await env.DB.prepare('DELETE FROM profile_ratings WHERE profile_id = ? AND family_id = ?').bind(pid, fid).run();
  } catch (err) {
    if (!/no such table/i.test(String(err?.message))) throw err;
  }
}
