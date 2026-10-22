// Per-family diet filters (plan §2.1). A family's filters are diet tags. A
// lesson that needs an ingredient carrying one of them is hidden from that
// family, unless the lesson lists a diet-reason substitution whose replacement
// carries none of them; then it's shown with that substitution applied. An
// optional ingredient carrying one is left out instead (owner, 2026-10-22).
// The hard block on unclean foods is not a filter and isn't handled here: the
// linter keeps unclean foods out of the content entirely.

// Returns { visible, applied: [{ for, use }], leftOut: [ids], blockedBy: [ids] }.
export function dietView(lesson, ingredients, filters) {
  const tags = new Set(filters || []);
  if (!tags.size) return { visible: true, applied: [], leftOut: [], blockedBy: [] };
  const conflicts = (id) => (ingredients[id]?.contains || []).some((t) => tags.has(t));
  const applied = [], leftOut = [], blockedBy = [];
  for (const line of lesson.ingredients) {
    if (!conflicts(line.ingredient)) continue;
    const sub = (lesson.substitutions || []).find((s) => s.for === line.ingredient
      && s.reason !== 'availability' && ingredients[s.use] && !conflicts(s.use));
    const list = sub ? applied : line.optional ? leftOut : blockedBy;
    const entry = sub ? { for: sub.for, use: sub.use } : line.ingredient;
    if (!list.some((x) => JSON.stringify(x) === JSON.stringify(entry))) list.push(entry);
  }
  return { visible: blockedBy.length === 0, applied, leftOut, blockedBy };
}
