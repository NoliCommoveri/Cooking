// Releases (plan §8.6). New work is built into the live app switched off, as a
// numbered release: each feature checks releaseOn() with its release's number.
// A family sees a release once it's launched for everyone, or before that once
// the owner turns on the family's preview on /ops (a preview family sees every
// release built so far). Releases launch in order, one at a time, and Undo
// launch takes back the latest one launched; nothing anyone entered is lost.
// Kept in settings, so the switch itself needs no migration. The key changed
// at the 2026-10-25 reset, when release 1 became the Levels, so a launch
// saved under the old one ('next_release') doesn't carry over.
const KEY = 'releases';

// Every release, in order. The next build adds its own entry here and gates
// its features with that number. A release marked building can be previewed
// but not launched, so a half-built one can't go out to everyone.
export const RELEASES = [
  { n: 1, name: 'The Levels: Level 2 Apprentice, Level 3 Cook, and Level 4 Chef, with a Familiar and an Explore dish each week (plan §12)', building: true },
];
export const LATEST = RELEASES.at(-1).n;
// The release the Levels (§12) come with: their courses, recipes, and public pages.
export const LEVELS_RELEASE = 1;

export async function releaseState(db) {
  try {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first();
    const v = row ? JSON.parse(row.value) : {};
    const live = Number.isInteger(v.live) ? v.live : 0;
    return { live: Math.max(0, Math.min(LATEST, live)), preview: Array.isArray(v.preview) ? v.preview : [] };
  } catch {
    // Before the settings table exists (migrations not applied), nothing is launched.
    return { live: 0, preview: [] };
  }
}

const save = (db, { live, preview }) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  .bind(KEY, JSON.stringify({ live, preview })).run();

// The newest release this family sees.
export const releaseOf = (st, familyId) => (st.preview.includes(familyId) ? LATEST : st.live);
export async function familyRelease(db, familyId) {
  return releaseOf(await releaseState(db), familyId);
}

// Whether this family sees release n.
export async function releaseOn(db, familyId, n) {
  return (await familyRelease(db, familyId)) >= n;
}

// For the app (/api/me): the newest release the family sees, and whether it
// sees one before everyone else, so the parent screens can say so.
export async function releaseFor(db, familyId) {
  const st = await releaseState(db);
  const release = releaseOf(st, familyId);
  return { release, next_release_preview: release > st.live };
}

export async function setPreview(db, familyId, on) {
  const st = await releaseState(db);
  const preview = st.preview.filter((id) => id !== familyId);
  if (on) preview.push(familyId);
  await save(db, { ...st, preview });
}

// Launch the next release for everyone, or undo the latest launch. n is the
// release the owner pressed for, so a resent form does nothing twice.
export async function launch(db, n) {
  const st = await releaseState(db);
  if (n !== st.live + 1 || n > LATEST || RELEASES[n - 1].building) return false;
  await save(db, { ...st, live: n });
  return true;
}
export async function undoLaunch(db, n) {
  const st = await releaseState(db);
  if (n !== st.live || n < 1) return false;
  await save(db, { ...st, live: n - 1 });
  return true;
}
