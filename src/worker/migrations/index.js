// The ordered migration list. Each .sql file is bundled into the Worker as text
// (the [[rules]] block in wrangler.toml). A schema change is a new numbered
// file added here; an applied file is never edited, or /ops reports it drifted.
// The exception is a draft (draft: true, plan §8.6): the one migration a big
// build edits in place until /ops finalizes it at launch.
import m0001 from './0001_schema.sql';

export const MIGRATIONS = [
  { id: '0001', name: 'schema', sql: m0001 },
];
