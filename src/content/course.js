// Lesson numbers (owner, 2026-10-22). Numbers aren't stored on a lesson: they
// come from the order of the course. content/course.json holds the suggested
// order; a family can reorder it and remove dishes in its own course plan, and
// its numbers follow. A pick-one group (§4.0) shares one number, with a letter
// for each dish still in it: 8a, 8b, 8c. A group left with one dish has no
// letter, and one with none has no number.

// The course as entries: a dish on its own (key = its id), or a pick-one group
// (key = "pick:<skill>") of the dishes next to each other with that pickOne.
export function courseEntries(dishes) {
  const out = [];
  for (const d of dishes) {
    const last = out.at(-1);
    if (d.pickOne && last?.key === `pick:${d.pickOne}`) last.ids.push(d.id);
    else out.push({ key: d.pickOne ? `pick:${d.pickOne}` : d.id, ids: [d.id], pickOne: d.pickOne ?? null });
  }
  return out;
}

// The entries in a family's order. plan: { order: [keys], removed: [ids] }, or
// null for the suggested order. An entry the saved order doesn't know (a dish
// added to the course since) goes in after the entry it follows in the
// suggested order.
export function planEntries(dishes, plan = null) {
  const entries = courseEntries(dishes);
  if (!plan?.order?.length) return entries;
  const byKey = new Map(entries.map((e) => [e.key, e]));
  const out = plan.order.filter((k) => byKey.has(k)).map((k) => byKey.get(k));
  const placed = new Set(out.map((e) => e.key));
  entries.forEach((e, i) => {
    if (placed.has(e.key)) return;
    const before = i ? out.indexOf(entries[i - 1]) : -1;
    out.splice(before + 1, 0, e);
    placed.add(e.key);
  });
  return out;
}

// Numbers for every dish still in the plan, labeled with Cook Around the
// World's letter: S8, or S8a in a pick-one group.
// Returns { entries: [{ key, n, ids, removed: [ids], pickOne }], labels: { id: 'S8a' }, total }.
export function numberCourse(dishes, plan = null) {
  const removed = new Set(plan?.removed ?? []);
  const labels = {};
  let n = 0;
  const entries = planEntries(dishes, plan).map((e) => {
    const ids = e.ids.filter((id) => !removed.has(id));
    const out = { key: e.key, pickOne: e.pickOne, ids, removed: e.ids.filter((id) => removed.has(id)), n: null };
    if (!ids.length) return out;
    out.n = ++n;
    ids.forEach((id, i) => { labels[id] = `S${n}${ids.length > 1 ? String.fromCharCode(97 + i) : ''}`; });
    return out;
  });
  return { entries, labels, total: n };
}

// The place in the course a Cook Around the World label counts: "Quest 27 of
// 59" for S27. Any other label (U1, C4a) is returned as it is.
export const courseNo = (label) => (label ? label.replace(/^S(?=\d)/, '') : label);

// A seasonal unit (Appointed Times, §6.19) sits beside the numbered course.
// Its lessons are labeled with its letter and their place in its list: U1, U2.
export function seasonalLabels(units) {
  const labels = {};
  for (const u of units) if (u.seasonal) (u.lessons || []).forEach((id, i) => { labels[id] = `${u.prefix}${i + 1}`; });
  return labels;
}

// Where a plan puts a dish before one it builds on, or leaves out one it needs.
// A prerequisite is a dish id, or "pick:<skill>" for any dish in that group.
export function prereqNotes(dishes, plan = null) {
  const { entries } = numberCourse(dishes, plan);
  const at = {};
  entries.forEach((e, i) => e.ids.forEach((id) => { at[id] = i; }));
  const byId = Object.fromEntries(dishes.map((d) => [d.id, d]));
  const notes = [];
  for (const d of dishes) {
    if (at[d.id] === undefined) continue;
    for (const p of d.prereqs ?? []) {
      const group = p.startsWith('pick:') ? dishes.filter((x) => x.pickOne === p.slice(5)) : [byId[p]].filter(Boolean);
      const name = p.startsWith('pick:') ? `a ${group.map((x) => x.title).join(' / ')} lesson` : byId[p]?.title ?? p;
      const placed = group.filter((x) => at[x.id] !== undefined);
      if (!placed.length) notes.push({ id: d.id, needs: p, text: `${d.title} builds on ${name}, which is removed.` });
      else if (!placed.some((x) => at[x.id] < at[d.id])) notes.push({ id: d.id, needs: p, text: `${d.title} comes before ${name}, which it builds on.` });
    }
  }
  return notes;
}
