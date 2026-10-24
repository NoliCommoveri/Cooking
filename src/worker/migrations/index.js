// The ordered migration list. Each .sql file is bundled into the Worker as text
// (the [[rules]] block in wrangler.toml). A schema change is a new numbered
// file added here; an applied file is never edited, or /ops reports it drifted.
// The exception is a draft (draft: true, plan §8.6): the one migration a big
// build edits in place until /ops finalizes it at launch.
import m0001 from './0001_schema.sql';

export const MIGRATIONS = [
  { id: '0001', name: 'schema', sql: m0001 },
];

// Schema versions folded into a later migration when the migrations were
// squashed (2026-10-24: 0002 and 0003 into 0001). An export taken at one of
// them restores into the squashed schema: its tables and columns are all
// still there.
export const SQUASHED = { '0002': '0001', '0003': '0001' };
