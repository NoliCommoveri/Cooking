// The ordered migration list. Each .sql file is bundled into the Worker as text
// (the [[rules]] block in wrangler.toml). A schema change is a new numbered
// file added here; an applied file is never edited, or /ops reports it drifted.
// The exception is a draft (draft: true, plan §8.6): the one migration a big
// build edits in place until /ops finalizes it at launch.
import m0001 from './0001_schema.sql';
import m0002 from './0002_delete_and_grades.sql';
import m0003 from './0003_next_release.sql';

export const MIGRATIONS = [
  { id: '0001', name: 'schema', sql: m0001 },
  { id: '0002', name: 'delete_and_grades', sql: m0002 },
  { id: '0003', name: 'next_release', sql: m0003, draft: true },
];
