// Lessons as they are live (plan §6.11): the lesson files with the owner's
// patches on top, and the checks a patch must pass before it goes live. The
// checks are the content linter itself (§7.4), run on the patched lesson, plus
// the food-safety rule that a thermometer target never drops.
import { CONTENT } from './content-data.js';
import { lint } from '../content/lint.js';
import { applyPatches } from '../content/patch.js';

// A Level's own recipes (§12.4) are lesson files too, in levels/recipes/.
const isLevelLesson = (id) => (CONTENT.levelLessons ?? []).some((x) => x.data.id === id);
export const fileLesson = (id) => [...CONTENT.lessons, ...(CONTENT.levelLessons ?? [])].find((x) => x.data.id === id)?.data ?? null;

// { lesson id: { version, patches: [{ id, path, value }] } } for every lesson
// with a patch (or one lesson). Each apply and each revert raises the version.
export async function livePatches(db, lessonId = null) {
  const stmt = lessonId
    ? db.prepare('SELECT id, lesson_id, field_path, new_value, reverted_at FROM lesson_patches WHERE lesson_id = ? ORDER BY applied_at, id').bind(lessonId)
    : db.prepare('SELECT id, lesson_id, field_path, new_value, reverted_at FROM lesson_patches ORDER BY applied_at, id');
  const out = {};
  for (const r of (await stmt.all()).results) {
    const f = fileLesson(r.lesson_id);
    if (!f) continue;
    const e = (out[r.lesson_id] ??= { version: f.version, patches: [] });
    e.version += r.reverted_at ? 2 : 1;
    if (!r.reverted_at) e.patches.push({ id: r.id, path: r.field_path, value: JSON.parse(r.new_value) });
  }
  return out;
}

export async function liveLesson(db, id) {
  const f = fileLesson(id);
  if (!f) return null;
  return applyPatches(f, (await livePatches(db, id))[id]);
}

// What's wrong with a lesson as a patch would leave it. Empty means it can go live.
export function patchProblems(after) {
  const where = `${isLevelLesson(after.id) ? 'levels/recipes' : 'lessons'}/${after.id}.json`;
  const swap = (list) => list?.map((x) => (x.data.id === after.id ? { file: x.file, data: after } : x));
  const content = { ...CONTENT, lessons: swap(CONTENT.lessons), levelLessons: swap(CONTENT.levelLessons) };
  // A fix to a step a variation shares reaches the variation too (§6.21), so its problems count.
  const out = lint(content).errors.filter((e) => e.startsWith(`${where}: `) || e.startsWith(`${where} variation `))
    .map((e) => (e.startsWith(`${where}: `) ? e.slice(where.length + 2) : e.slice(where.length + 1)));
  // The lesson files set each doneness target at its safe minimum (§3), so a
  // fix can raise a target but never lower it.
  for (const orig of fileLesson(after.id).steps) {
    if (!orig.target?.temp) continue;
    const now = after.steps.find((s) => s.id === orig.id);
    if (!(now?.target?.temp >= orig.target.temp)) {
      out.push(`step "${orig.id}": the thermometer target can't go below ${orig.target.temp}°F, the safe minimum for this dish`);
    }
  }
  return out;
}
