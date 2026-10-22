// The ordered migration list. Each .sql file is bundled into the Worker as text
// (the [[rules]] block in wrangler.toml). A schema change is a new numbered
// file added here; an applied file is never edited, or /ops reports it drifted.
import m0001 from './0001_families.sql';
import m0002 from './0002_attempts.sql';
import m0003 from './0003_voice.sql';
import m0004 from './0004_fixes.sql';
import m0005 from './0005_lesson_ids.sql';
import m0006 from './0006_queue.sql';
import m0007 from './0007_shopping.sql';

export const MIGRATIONS = [
  { id: '0001', name: 'families', sql: m0001 },
  { id: '0002', name: 'attempts', sql: m0002 },
  { id: '0003', name: 'voice', sql: m0003 },
  { id: '0004', name: 'fixes', sql: m0004 },
  { id: '0005', name: 'lesson ids', sql: m0005 },
  { id: '0006', name: 'queue and courses', sql: m0006 },
  { id: '0007', name: 'shopping', sql: m0007 },
];
