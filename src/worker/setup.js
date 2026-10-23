// Chef Ruth's Getting started (plan §6.9). Each answer saves through the
// pages' own routes (the PIN, family settings, profiles, kid logins, courses,
// the queue), so these routes only keep the family's place in it and find the
// first lesson she offers a family with no course.
import { fail, now } from './lib/http.js';
import { requireParent } from './auth.js';
import { LIBRARY } from './library-data.js';
import { dietView } from '../content/diet.js';
import { numberCourse } from '../content/course.js';
import { SETUP_STEPS, STARTERS, starterLessons } from '../content/getting-started.js';

const dishOf = Object.fromEntries(LIBRARY.course.map((d) => [d.id, d]));

export function register(on) {
  // The last part finished, so she picks up at the next one if the app closes.
  // Once Getting started is done, running it again doesn't move anything.
  on('POST', '/api/setup/step', async (req, env, body) => {
    const s = await requireParent(env, req);
    const step = SETUP_STEPS.includes(body.step) ? body.step : fail(400, 'invalid', `step must be one of: ${SETUP_STEPS.join(', ')}.`);
    await env.DB.prepare('UPDATE families SET setup_step = ? WHERE id = ? AND setup_done_at IS NULL').bind(step, s.family_id).run();
    return { ok: true };
  });

  // The lockers and parent screens open from here on.
  on('POST', '/api/setup/done', async (req, env) => {
    const s = await requireParent(env, req);
    await env.DB.prepare('UPDATE families SET setup_step = ?, setup_done_at = COALESCE(setup_done_at, ?) WHERE id = ?')
      .bind(SETUP_STEPS.at(-1), now(), s.family_id).run();
    return { ok: true };
  });

  // The lessons she offers for chicken, beef, fish, or vegetarian, best first:
  // written core lessons in the suggested course order that the family's diet
  // filters allow, meals only (§6.9).
  on('GET', '/api/setup/starters', async (req, env) => {
    const s = await requireParent(env, req);
    const kind = new URL(req.url).searchParams.get('kind');
    if (!STARTERS[kind]) fail(400, 'invalid', `kind must be one of: ${Object.keys(STARTERS).join(', ')}.`);
    const fam = await env.DB.prepare('SELECT diet_filters FROM families WHERE id = ?').bind(s.family_id).first();
    const filters = JSON.parse(fam.diet_filters);
    const { labels } = numberCourse(LIBRARY.course);
    const can = LIBRARY.lessons
      .filter((L) => L.track === 'core' && dishOf[L.id] && dietView(L, LIBRARY.ingredients, filters).visible)
      .map((L) => ({ ...L, meal: dishOf[L.id].meal }));
    return {
      lessons: starterLessons(kind, can).map((L) => ({
        id: L.id, label: labels[L.id], title: L.title, about: dishOf[L.id].about, image: L.image, totalMinutes: L.totalMinutes,
      })),
    };
  });
}
