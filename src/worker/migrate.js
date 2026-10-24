// The migration runner (plan §8.5), following the MCCE repo's src/migrate.js.
// Migrations are .sql files bundled into the Worker; /ops lists each one and
// Apply pending runs them in order.
//
// A draft migration (plan §8.6) is the one migration a big build edits in
// place until it launches. It may only create new tables and their indexes, so
// Re-apply draft can drop what it made and build it again from the edited
// file without touching anything that was there before. Finalize freezes it
// into an ordinary migration.
import { MIGRATIONS } from './migrations/index.js';
import { splitStatements } from './lib/sql.js';
import { sha256Hex } from './lib/crypto.js';

export async function ensureMigrationsTable(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS _migrations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL, checksum TEXT NOT NULL)`),
    // The tables each applied draft made, in the order it made them.
    db.prepare(`CREATE TABLE IF NOT EXISTS _drafts (
      id TEXT PRIMARY KEY, tables TEXT NOT NULL, finalized_at TEXT)`),
  ]);
}

const liveTables = async (db) => (await db.prepare(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'",
).all()).results.map((r) => r.name);

const NAME = '["`\\[]?(\\w+)["`\\]]?';
const CREATE_TABLE = new RegExp(`^CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${NAME}`, 'i');
const CREATE_INDEX = new RegExp(`^CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${NAME}\\s+ON\\s+${NAME}`, 'i');

// What a draft creates, and why it can't run. owned: the tables this draft
// made last time, which it may make again; existing: every table now.
export function checkDraft(sql, owned = [], existing = []) {
  const tables = [], problems = [];
  splitStatements(sql).forEach((st, i) => {
    const t = st.match(CREATE_TABLE);
    const x = st.match(CREATE_INDEX);
    if (t) {
      const name = t[1];
      if (tables.includes(name)) problems.push(`Statement ${i + 1} creates "${name}" a second time.`);
      else if (existing.includes(name) && !owned.includes(name)) problems.push(`Statement ${i + 1} creates "${name}", which is already a table. A draft only adds new tables.`);
      tables.push(name);
    } else if (x) {
      if (!tables.includes(x[2])) problems.push(`Statement ${i + 1} adds an index to "${x[2]}". A draft only indexes tables it creates, above the index.`);
    } else {
      problems.push(`Statement ${i + 1} isn't CREATE TABLE or CREATE INDEX. A draft only adds new tables; anything else waits for a migration of its own.`);
    }
  });
  return { tables, problems };
}

// Every migration with its state: applied, pending, drifted (the file changed
// after it was applied), or orphaned (applied, but the file is gone). Drift is
// reported, never fixed on its own.
export async function migrationStatus(db, list = MIGRATIONS) {
  await ensureMigrationsTable(db);
  const { results } = await db.prepare('SELECT id, name, applied_at, checksum FROM _migrations').all();
  const applied = new Map(results.map((r) => [r.id, r]));
  const drafts = new Map((await db.prepare('SELECT id, finalized_at FROM _drafts').all()).results.map((r) => [r.id, r]));
  const rows = [];
  for (const m of list) {
    const checksum = await sha256Hex(m.sql);
    const row = applied.get(m.id);
    // A draft stays editable until it's finalized: an edit reads as
    // draft-edited, for Re-apply draft, not as drift.
    const open = m.draft && !drafts.get(m.id)?.finalized_at;
    const same = row?.checksum === checksum;
    rows.push({
      id: m.id, name: m.name, checksum, applied_at: row?.applied_at ?? null, draft: Boolean(m.draft), finalized_at: drafts.get(m.id)?.finalized_at ?? null,
      state: !row ? 'pending' : open ? (same ? 'draft' : 'draft-edited') : same ? 'applied' : 'drifted',
    });
  }
  const known = new Set(list.map((m) => m.id));
  for (const row of results) if (!known.has(row.id)) rows.push({ ...row, state: 'orphaned' });
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

export async function schemaVersion(db) {
  await ensureMigrationsTable(db);
  return (await db.prepare('SELECT MAX(id) AS v FROM _migrations').first())?.v ?? null;
}

// Each migration's statements and its _migrations row go in one db.batch(), so
// a migration lands whole or not at all. Stops at the first failure.
export async function applyPending(db, list = MIGRATIONS) {
  const status = await migrationStatus(db, list);
  const pending = new Set(status.filter((r) => r.state === 'pending').map((r) => r.id));
  const log = [];
  for (const m of list) {
    if (!pending.has(m.id)) continue;
    const statements = splitStatements(m.sql);
    const extra = [];
    if (m.draft) {
      const { tables, problems } = checkDraft(m.sql, [], await liveTables(db));
      if (problems.length) {
        log.push({ id: m.id, name: m.name, ok: false, error: problems.join(' '), statementList: statements });
        return { log, halted: true };
      }
      extra.push(db.prepare('INSERT OR REPLACE INTO _drafts (id, tables, finalized_at) VALUES (?, ?, NULL)').bind(m.id, JSON.stringify(tables)));
    }
    try {
      await db.batch([
        ...statements.map((s) => db.prepare(s)),
        db.prepare('INSERT INTO _migrations (id, name, applied_at, checksum) VALUES (?, ?, ?, ?)')
          .bind(m.id, m.name, new Date().toISOString(), await sha256Hex(m.sql)),
        ...extra,
      ]);
      log.push({ id: m.id, name: m.name, ok: true, statements: statements.length });
    } catch (err) {
      // D1 doesn't say which statement failed, so /ops prints them numbered.
      log.push({ id: m.id, name: m.name, ok: false, error: String(err?.message ?? err), statementList: statements });
      return { log, halted: true };
    }
  }
  return { log, halted: false };
}

// The tables an applied draft made, for Re-apply's confirm page and its restore.
export async function draftTables(db, id) {
  await ensureMigrationsTable(db);
  const row = await db.prepare('SELECT tables FROM _drafts WHERE id = ?').bind(id).first();
  return row ? JSON.parse(row.tables) : [];
}

const openDraft = async (db, id, list) => {
  const m = list.find((x) => x.id === id && x.draft);
  const st = (await migrationStatus(db, list)).find((x) => x.id === id);
  if (!m || !['draft', 'draft-edited'].includes(st?.state)) return null;
  return m;
};

// Drops the tables the draft made and builds them again from the file as it
// is now, in one batch: it lands whole or not at all. Their rows are lost, so
// /ops offers the backup first and Restore draft tables after.
export async function reapplyDraft(db, id, list = MIGRATIONS) {
  const m = await openDraft(db, id, list);
  if (!m) return { ok: false, error: 'That isn\'t an applied draft that can be re-applied.', statementList: [] };
  const owned = await draftTables(db, id);
  const statements = splitStatements(m.sql);
  const { tables, problems } = checkDraft(m.sql, owned, await liveTables(db));
  if (problems.length) return { ok: false, error: problems.join(' '), statementList: statements };
  try {
    await db.batch([
      ...[...owned].reverse().map((t) => db.prepare(`DROP TABLE IF EXISTS "${t}"`)),
      ...statements.map((s) => db.prepare(s)),
      db.prepare('UPDATE _migrations SET applied_at = ?, checksum = ? WHERE id = ?').bind(new Date().toISOString(), await sha256Hex(m.sql), id),
      db.prepare('UPDATE _drafts SET tables = ? WHERE id = ?').bind(JSON.stringify(tables), id),
    ]);
    return { ok: true, dropped: owned, created: tables };
  } catch (err) {
    return { ok: false, error: String(err?.message ?? err), statementList: statements };
  }
}

// At launch: the draft becomes an ordinary applied migration, and editing it
// afterwards reads as drift. Only an unedited draft can be finalized.
export async function finalizeDraft(db, id, list = MIGRATIONS) {
  const m = await openDraft(db, id, list);
  const st = (await migrationStatus(db, list)).find((x) => x.id === id);
  if (!m || st.state !== 'draft') return false;
  await db.prepare('UPDATE _drafts SET finalized_at = ? WHERE id = ?').bind(new Date().toISOString(), id).run();
  return true;
}
