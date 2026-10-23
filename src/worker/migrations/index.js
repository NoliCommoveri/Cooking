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
import m0008 from './0008_shopping_lists.sql';
import m0009 from './0009_reflect.sql';
import m0010 from './0010_family_recipes.sql';
import m0011 from './0011_sharing.sql';
import m0012 from './0012_swap.sql';
import m0013 from './0013_kid_logins.sql';
import m0014 from './0014_getting_started.sql';
import m0015 from './0015_remove_cook.sql';

export const MIGRATIONS = [
  { id: '0001', name: 'families', sql: m0001 },
  { id: '0002', name: 'attempts', sql: m0002 },
  { id: '0003', name: 'voice', sql: m0003 },
  { id: '0004', name: 'fixes', sql: m0004 },
  { id: '0005', name: 'lesson ids', sql: m0005 },
  { id: '0006', name: 'queue and courses', sql: m0006 },
  { id: '0007', name: 'shopping', sql: m0007 },
  { id: '0008', name: 'shopping lists', sql: m0008 },
  { id: '0009', name: 'reflect and photos switch', sql: m0009 },
  { id: '0010', name: 'family recipes', sql: m0010 },
  { id: '0011', name: 'sharing recipes', sql: m0011 },
  { id: '0012', name: 'swap for an appointed time meal', sql: m0012 },
  { id: '0013', name: 'kid logins', sql: m0013 },
  { id: '0014', name: 'getting started', sql: m0014 },
  { id: '0015', name: 'remove a cook', sql: m0015 },
];
