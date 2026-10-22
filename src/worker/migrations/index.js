// The ordered migration list. Each .sql file is bundled into the Worker as text
// (the [[rules]] block in wrangler.toml). A schema change is a new numbered
// file added here; an applied file is never edited, or /ops reports it drifted.
import m0001 from './0001_families.sql';
import m0002 from './0002_attempts.sql';

export const MIGRATIONS = [
  { id: '0001', name: 'families', sql: m0001 },
  { id: '0002', name: 'attempts', sql: m0002 },
];
