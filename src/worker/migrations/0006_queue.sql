-- Phase 3a: the queue, course plans and the weekly schedule, the casual and
-- homeschool modes, and test-cooked marks (plan §6.2, §6.17, §6.18, §8.4).

-- casual or homeschool (§6.17). plan_weeks is Plan our weeks in casual mode;
-- homeschool mode always plans weeks.
ALTER TABLE families ADD COLUMN mode TEXT NOT NULL DEFAULT 'casual' CHECK (mode IN ('casual', 'homeschool'));
ALTER TABLE families ADD COLUMN plan_weeks INTEGER NOT NULL DEFAULT 0;

-- A course for one or more profiles (§6.18). start_date is a Monday;
-- per_week is the pace. name, code, and school_year feed the transcript
-- (Phase 4b). An ended course has archived_at set and can be put back.
CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,
  family_id   TEXT NOT NULL REFERENCES families(id),
  name        TEXT NOT NULL DEFAULT '',
  code        TEXT,
  school_year TEXT,
  start_date  TEXT NOT NULL,
  per_week    INTEGER NOT NULL CHECK (per_week BETWEEN 1 AND 7),
  created_at  TEXT NOT NULL,
  archived_at TEXT
);
CREATE INDEX IF NOT EXISTS courses_family ON courses(family_id);

-- Who a course is for. A profile is on one active course at most (checked by the API).
CREATE TABLE IF NOT EXISTS course_profiles (
  course_id  TEXT NOT NULL REFERENCES courses(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  PRIMARY KEY (course_id, profile_id)
);
CREATE INDEX IF NOT EXISTS course_profiles_family ON course_profiles(family_id, profile_id);

-- The course plan: every dish in the course outline, in this course's order.
-- removed: 0 kept, 1 taken out of the plan (like the other dishes of a
-- pick-one group), 2 taken out with Skip this recipe. A dish added to the outline later goes in where the
-- suggested order puts it (src/content/course.js).
CREATE TABLE IF NOT EXISTS course_lessons (
  course_id TEXT NOT NULL REFERENCES courses(id),
  family_id TEXT NOT NULL REFERENCES families(id),
  lesson_id TEXT NOT NULL,
  position  INTEGER NOT NULL,
  removed   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, lesson_id)
);

-- A week the parent skipped, or added extra lessons to (Cook another recipe).
-- week_start is the week's Monday.
CREATE TABLE IF NOT EXISTS course_weeks (
  course_id  TEXT NOT NULL REFERENCES courses(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  week_start TEXT NOT NULL,
  skipped    INTEGER NOT NULL DEFAULT 0,
  extra      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (course_id, week_start)
);

-- The one "up next" list (§6.2). source: manual (a parent added it), request
-- (a kid asked, or an adult tapped Cook this), or course (the weekly schedule
-- loaded it; week_start is its week). A declined request or a removed lesson
-- keeps its row, so it can be put back.
CREATE TABLE IF NOT EXISTS queue (
  id                      TEXT PRIMARY KEY,
  family_id               TEXT NOT NULL REFERENCES families(id),
  lesson_id               TEXT NOT NULL,
  servings                INTEGER NOT NULL,
  planned_date            TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('requested', 'assigned', 'shopped', 'cooked', 'declined', 'removed')),
  source                  TEXT NOT NULL CHECK (source IN ('manual', 'request', 'course')),
  requested_by_profile_id TEXT,
  course_id               TEXT,
  week_start              TEXT,
  created_at              TEXT NOT NULL,
  closed_at               TEXT
);
CREATE INDEX IF NOT EXISTS queue_family ON queue(family_id, status);

CREATE TABLE IF NOT EXISTS queue_profiles (
  queue_id   TEXT NOT NULL REFERENCES queue(id),
  family_id  TEXT NOT NULL REFERENCES families(id),
  profile_id TEXT NOT NULL REFERENCES profiles(id),
  PRIMARY KEY (queue_id, profile_id)
);
CREATE INDEX IF NOT EXISTS queue_profiles_profile ON queue_profiles(family_id, profile_id);

-- A parent cooked this lesson themselves (§6.2, §7).
CREATE TABLE IF NOT EXISTS test_cooks (
  family_id      TEXT NOT NULL REFERENCES families(id),
  lesson_id      TEXT NOT NULL,
  lesson_version INTEGER NOT NULL,
  parent_id      TEXT NOT NULL,
  cooked_on      TEXT NOT NULL,
  PRIMARY KEY (family_id, lesson_id)
);
