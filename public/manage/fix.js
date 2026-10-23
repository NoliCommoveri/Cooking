// A fix request opened from the owner screens (plan §6.11): the suggestion is
// filled into the lesson in the editor, staged like any change, and saving
// marks the request fixed.
import { D, api, cur, exists, lessonFile, stageLesson, go } from './manage.js';
import { setAt, cleanValue } from '/lib/patch.js';

export async function fixPage(fid) {
  const { fix } = await api('GET', `/fixes/${fid}`);
  if (!exists(lessonFile(fix.lesson_id))) throw new Error(`The lesson "${fix.lesson_id}" isn't in the library any more.`);
  if (fix.status !== 'open') throw new Error('That fix request is already closed.');
  const parse = (v) => { try { return JSON.parse(v); } catch { return v; } };
  const suggested = parse(fix.suggested_value);
  D.fix = { id: fix.id, lesson: fix.lesson_id, field: fix.field, current: parse(fix.current_value), suggested, note: fix.note, reply: '' };
  if (fix.field) {
    const L = cur(lessonFile(fix.lesson_id));
    try {
      stageLesson(setAt(L, fix.field, cleanValue(fix.field, suggested)), `Fix request: ${fix.note.slice(0, 80)}`);
    } catch {
      // The part it names is gone or the value doesn't fit: the owner edits by hand.
    }
  }
  go(`#/lesson/${fix.lesson_id}`);
}
