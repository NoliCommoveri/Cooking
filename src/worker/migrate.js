// The migration runner (plan §8.5), following the MCCE repo's src/migrate.js.
// Migrations are .sql files bundled into the Worker; /ops lists each one and
// Apply pending runs them in order.
import { MIGRATIONS } from './migrations/index.js';
import { splitStatements } from './lib/sql.js';
import { sha256Hex } from './lib/crypto.js';

export async function ensureMigrationsTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL, checksum TEXT NOT NULL)`).run();
}

// Every migration with its state: applied, pending, drifted (the file changed
// after it was applied), or orphaned (applied, but the file is gone). Drift is
// reported, never fixed on its own.
export async function migrationStatus(db, list = MIGRATIONS) {
  await ensureMigrationsTable(db);
  const { results } = await db.prepare('SELECT id, name, applied_at, checksum FROM _migrations').all();
  const applied = new Map(results.map((r) => [r.id, r]));
  const rows = [];
  for (const m of list) {
    const checksum = await sha256Hex(m.sql);
    const row = applied.get(m.id);
    rows.push({
      id: m.id, name: m.name, checksum, applied_at: row?.applied_at ?? null,
      state: !row ? 'pending' : row.checksum === checksum ? 'applied' : 'drifted',
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
    try {
      await db.batch([
        ...statements.map((s) => db.prepare(s)),
        db.prepare('INSERT INTO _migrations (id, name, applied_at, checksum) VALUES (?, ?, ?, ?)')
          .bind(m.id, m.name, new Date().toISOString(), await sha256Hex(m.sql)),
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
