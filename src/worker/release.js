// The Next release switch (plan §8.6). The next release is built into the live
// app switched off: a family sees it once the owner turns on its preview on
// /ops, or once it's launched for everyone. Undo launch puts every family back
// as it was before launch, previews included, and nothing anyone entered is
// lost. Kept in settings, so the switch itself needs no migration.
const KEY = 'next_release';

export async function releaseState(db) {
  try {
    const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(KEY).first();
    const v = row ? JSON.parse(row.value) : {};
    return { launched: Boolean(v.launched), preview: Array.isArray(v.preview) ? v.preview : [] };
  } catch {
    // Before the settings table exists (migrations not applied), it's off.
    return { launched: false, preview: [] };
  }
}

const save = (db, state) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  .bind(KEY, JSON.stringify(state)).run();

// Whether this family sees the next release.
export async function nextReleaseOn(db, familyId) {
  const st = await releaseState(db);
  return st.launched || st.preview.includes(familyId);
}

// For the app (/api/me): on, and whether it's on only as a preview, so the
// parent screens can say so.
export async function releaseFor(db, familyId) {
  const st = await releaseState(db);
  return { next_release: st.launched || st.preview.includes(familyId), next_release_preview: !st.launched && st.preview.includes(familyId) };
}

export async function setPreview(db, familyId, on) {
  const st = await releaseState(db);
  const preview = st.preview.filter((id) => id !== familyId);
  if (on) preview.push(familyId);
  await save(db, { ...st, preview });
}

export async function setLaunched(db, launched) {
  await save(db, { ...(await releaseState(db)), launched });
}
