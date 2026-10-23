// Backups and the destructive controls on /ops (plan §8.5). Every destructive
// control has its restore beside it:
//   - Download export.json  ↔  Restore from export.json (into an empty database)
//   - Clear everything      ↔  Apply pending, then Restore from export.json
//   - Remove a family       ↔  Restore a family (from that family's own export)
// Approach and limits follow the MCCE repo's src/restore.js.
import { schemaVersion } from './migrate.js';

export const CLEAR_PHRASE = 'DELETE EVERYTHING';
export const REMOVE_PHRASE = 'REMOVE';

// Refused before anything was written. The database is untouched.
export class Refused extends Error {}

// Our tables only: D1 keeps its own (_cf_*, d1_*) beside them and refuses reads.
export async function tableNames(db) {
  const { results } = await db.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'`,
  ).all();
  return results.map((r) => r.name).sort();
}

const columns = async (db, t) => (await db.prepare(`PRAGMA table_info("${t}")`).all()).results.map((c) => c.name);

// Tables ordered so every table comes after the tables it references. Inserts
// run in this order; deletes and drops run in reverse.
export async function parentFirst(db, tables) {
  const deps = new Map();
  for (const t of tables) {
    const { results } = await db.prepare(`PRAGMA foreign_key_list("${t}")`).all();
    deps.set(t, new Set(results.map((r) => r.table).filter((p) => p !== t && tables.includes(p))));
  }
  const out = [], left = new Set(tables);
  while (left.size) {
    const ready = [...left].filter((t) => [...deps.get(t)].every((p) => !left.has(p)));
    if (!ready.length) return [...out, ...left]; // a cycle: nothing in the schema has one
    for (const t of ready.sort()) { out.push(t); left.delete(t); }
  }
  return out;
}

// ---------- whole database ----------

export async function exportAll(db) {
  const out = { kind: 'clean-plate-backup', exported_at: new Date().toISOString(), schema_version: await schemaVersion(db), tables: {} };
  for (const t of await tableNames(db)) {
    const { results } = await db.prepare(`SELECT * FROM "${t}"`).all();
    if (results.length) out.tables[t] = results;
  }
  return out;
}

// The migration ledger is rebuilt by Apply pending, not by the restore.
const SKIPPED = new Set(['_migrations']);

// Restores; never merges. Every table in the file must exist here and be empty.
export async function importAll(db, payload) {
  if (payload?.kind === 'clean-plate-family') throw new Refused('That is one family\'s export. Use Restore a family for it.');
  const tables = await checkPayload(db, payload, 'clean-plate-backup');
  for (const t of Object.keys(tables)) {
    const n = (await db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).first()).n;
    if (n) throw new Refused(`"${t}" already has ${n} row(s). Restore only fills an empty database: Clear everything, Apply pending, then restore.`);
  }
  return await insertAll(db, tables);
}

export async function clearEverything(db) {
  const tables = await tableNames(db);
  const order = (await parentFirst(db, tables)).reverse();
  if (order.length) await db.batch(order.map((t) => db.prepare(`DROP TABLE IF EXISTS "${t}"`)));
  return order;
}

// ---------- one family ----------

// Every table with a family_id column holds a family's rows. Sessions (a
// parent's or a kid's) and reset links are left out of a family's export:
// they're removed with the family and not worth putting back (everyone just
// logs in again).
const NOT_EXPORTED = new Set(['sessions', 'kid_sessions', 'password_resets']);

async function familyTables(db) {
  const out = [];
  for (const t of await tableNames(db)) if (t !== 'families' && (await columns(db, t)).includes('family_id')) out.push(t);
  return out;
}

export async function exportFamily(db, familyId) {
  const fam = await db.prepare('SELECT * FROM families WHERE id = ?').bind(familyId).first();
  if (!fam) throw new Refused('No such family.');
  const out = { kind: 'clean-plate-family', exported_at: new Date().toISOString(), schema_version: await schemaVersion(db), family_id: familyId, tables: { families: [fam] } };
  for (const t of await familyTables(db)) {
    if (NOT_EXPORTED.has(t)) continue;
    const { results } = await db.prepare(`SELECT * FROM "${t}" WHERE family_id = ?`).bind(familyId).all();
    if (results.length) out.tables[t] = results;
  }
  return out;
}

export async function removeFamily(db, familyId) {
  const fam = await db.prepare('SELECT name FROM families WHERE id = ?').bind(familyId).first();
  if (!fam) throw new Refused('No such family.');
  const order = (await parentFirst(db, [...(await familyTables(db)), 'families'])).reverse();
  await db.batch(order.map((t) => db.prepare(`DELETE FROM "${t}" WHERE ${t === 'families' ? 'id' : 'family_id'} = ?`).bind(familyId)));
  return fam.name;
}

export async function restoreFamily(db, payload) {
  if (payload?.kind === 'clean-plate-backup') throw new Refused('That is a whole-database export. Use Restore from export.json for it.');
  const tables = await checkPayload(db, payload, 'clean-plate-family');
  const fam = tables.families?.[0];
  if (!fam || tables.families.length !== 1 || fam.id !== payload.family_id) throw new Refused('That file has no family in it.');
  for (const [t, rows] of Object.entries(tables)) {
    for (const r of rows) {
      if ((t === 'families' ? r.id : r.family_id) !== fam.id) throw new Refused(`"${t}" in that file has rows from another family.`);
    }
  }
  if (await db.prepare('SELECT 1 FROM families WHERE id = ?').bind(fam.id).first()) {
    throw new Refused(`"${fam.name}" is already here. Remove it first if you mean to put back the older copy.`);
  }
  for (const p of tables.parents ?? []) {
    if (await db.prepare('SELECT 1 FROM parents WHERE email = ?').bind(p.email).first()) {
      throw new Refused(`${p.email} already has an account in another family, so this family can't come back as it was.`);
    }
  }
  return await insertAll(db, tables);
}

// ---------- shared ----------

async function checkPayload(db, payload, kind) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || payload.kind !== kind) {
    throw new Refused('That file is not an export from this ops page.');
  }
  const current = await schemaVersion(db);
  if (current === null) throw new Refused('No schema is applied yet. Press Apply pending first.');
  if (String(payload.schema_version) !== String(current)) {
    throw new Refused(`That export is schema version ${payload.schema_version ?? 'none'} and this database is at ${current}. Apply the matching migrations first.`);
  }
  const existing = new Set(await tableNames(db));
  const tables = {};
  for (const [t, rows] of Object.entries(payload.tables ?? {})) {
    if (SKIPPED.has(t)) continue;
    if (!existing.has(t)) throw new Refused(`The export has a table "${t}" that this database doesn't.`);
    if (!Array.isArray(rows)) throw new Refused(`"${t}" in the export is not a list of rows.`);
    const known = new Set(await columns(db, t));
    for (const [i, r] of rows.entries()) {
      if (!r || typeof r !== 'object' || Array.isArray(r)) throw new Refused(`Row ${i + 1} of "${t}" is not an object.`);
      for (const [c, v] of Object.entries(r)) {
        if (!known.has(c)) throw new Refused(`"${t}" in the export has a column "${c}" that this database doesn't.`);
        if (v !== null && !['string', 'number'].includes(typeof v)) throw new Refused(`"${t}".${c} in row ${i + 1} isn't a value the database stores.`);
      }
    }
    if (rows.length) tables[t] = rows;
  }
  return tables;
}

// The whole restore is one batch, so it lands whole or not at all. D1 allows
// 100 bound values per statement, so rows are packed several to a statement,
// which also keeps the count of queries low.
const PARAM_BUDGET = 90;

async function insertAll(db, tables) {
  const order = await parentFirst(db, Object.keys(tables));
  const statements = [];
  for (const t of order) {
    const groups = new Map();
    for (const r of tables[t]) {
      const key = Object.keys(r).join(',');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    for (const [key, rows] of groups) {
      const cols = key.split(',');
      const per = Math.max(1, Math.floor(PARAM_BUDGET / cols.length));
      for (let i = 0; i < rows.length; i += per) {
        const slice = rows.slice(i, i + per);
        const tuple = `(${cols.map(() => '?').join(', ')})`;
        statements.push(db.prepare(`INSERT INTO "${t}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${slice.map(() => tuple).join(', ')}`)
          .bind(...slice.flatMap((r) => cols.map((c) => r[c]))));
      }
    }
  }
  if (statements.length) await db.batch(statements);
  return order.map((t) => ({ table: t, rows: tables[t].length }));
}
