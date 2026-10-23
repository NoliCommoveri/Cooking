-- Delete our family (plan §6.14): the family disappears at once and its rows
-- are erased 30 days later by the Worker's daily job. Until then the owner can
-- bring it back from /ops. Empty means the family is live.
ALTER TABLE families ADD COLUMN deleted_at TEXT;

-- ---------- homeschool mode: grades and the transcript (§6.15, §6.17) ----------

-- The homeschool's own name, printed at the top of every transcript.
ALTER TABLE families ADD COLUMN school_name TEXT;

-- A parent's grade for one profile on one cook: the rubric (each row 1 to 4),
-- a grade in the parent's own words, or both. Parent-only; kids never see it.
-- A cook on the Sabbath can't be graded, and nothing is graded on the Sabbath.
CREATE TABLE IF NOT EXISTS grades (
  attempt_id  TEXT NOT NULL REFERENCES attempts(id),
  profile_id  TEXT NOT NULL REFERENCES profiles(id),
  family_id   TEXT NOT NULL REFERENCES families(id),
  skill       INTEGER CHECK (skill BETWEEN 1 AND 4),
  safety      INTEGER CHECK (safety BETWEEN 1 AND 4),
  recipe      INTEGER CHECK (recipe BETWEEN 1 AND 4),
  result      INTEGER CHECK (result BETWEEN 1 AND 4),
  reflection  INTEGER CHECK (reflection BETWEEN 1 AND 4),
  grade_text  TEXT,
  graded_at   TEXT NOT NULL,
  PRIMARY KEY (attempt_id, profile_id)
);
CREATE INDEX IF NOT EXISTS grades_family ON grades(family_id, profile_id);

-- One profile's transcript details. from_date and to_date (optional) limit
-- it to a school year's cooks. final_grade and credit are the parent's own;
-- the app only shows the rubric average and the hours beside them.
CREATE TABLE IF NOT EXISTS transcripts (
  profile_id   TEXT PRIMARY KEY REFERENCES profiles(id),
  family_id    TEXT NOT NULL REFERENCES families(id),
  student_name TEXT,
  course_name  TEXT,
  course_code  TEXT,
  school_year  TEXT,
  from_date    TEXT,
  to_date      TEXT,
  final_grade  TEXT,
  credit       TEXT,
  updated_at   TEXT NOT NULL
);
