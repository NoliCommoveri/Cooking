// A D1-shaped facade over node:sqlite (copied from the MCCE repo's tests), so
// the migration runner, the API, and the backups are tested against a real
// database instead of a mock that agrees with whatever the code does.
//
// The one behavior that has to match exactly is laziness: D1 prepares a
// statement when it runs, so applyPending() can put "CREATE TABLE" and the
// "CREATE INDEX" that depends on it into a single batch. node:sqlite prepares
// eagerly and would throw on the index, so preparation is deferred here too.
import { DatabaseSync } from 'node:sqlite';

class Stmt {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  // D1 refuses a statement binding more than 100 parameters; node:sqlite
  // allows thousands, so without this a query that fails in production passes.
  bind(...params) {
    if (params.length > 100) throw new Error('D1_ERROR: too many SQL variables: SQLITE_ERROR');
    return new Stmt(this.db, this.sql, params);
  }

  #prepared() {
    return this.db.prepare(this.sql);
  }

  async run() {
    const info = this.#prepared().run(...this.params);
    return { success: true, meta: { changes: Number(info.changes ?? 0), last_row_id: Number(info.lastInsertRowid ?? 0) } };
  }

  async all() {
    const results = this.#prepared().all(...this.params);
    return { success: true, results, meta: {} };
  }

  async first(column) {
    const row = this.#prepared().get(...this.params) ?? null;
    if (row === null) return null;
    return column === undefined ? row : row[column];
  }
}

class D1 {
  constructor() {
    this.raw = new DatabaseSync(':memory:');
    this.raw.exec('PRAGMA foreign_keys = ON');
    this.batches = 0;
  }

  prepare(sql) {
    return new Stmt(this.raw, sql);
  }

  async batch(statements) {
    this.batches++;
    this.raw.exec('BEGIN');
    try {
      const out = [];
      for (const s of statements) out.push(await s.run());
      this.raw.exec('COMMIT');
      return out;
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    }
  }
}

export function makeDb() {
  return new D1();
}
