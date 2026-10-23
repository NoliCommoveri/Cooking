-- Phase 4c: Swap for an Appointed Time meal instead (plan §6.19).

-- A queued item that a swap put in: swap_of is "q:<queue id>" for a lesson
-- queued by hand (taken off the queue, and put back by Undo) or
-- "c:<course id>:<lesson id>" for a course lesson (which goes first next week).
ALTER TABLE queue ADD COLUMN swap_of TEXT;

-- How many of a week's course lessons were swapped. Each takes a place at the
-- pace, so the planned finish moves back and nothing counts as behind.
ALTER TABLE course_weeks ADD COLUMN swapped INTEGER NOT NULL DEFAULT 0;
