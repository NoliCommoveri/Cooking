-- Delete our family (plan §6.14): the family disappears at once and its rows
-- are erased 30 days later by the Worker's daily job. Until then the owner can
-- bring it back from /ops. Empty means the family is live.
ALTER TABLE families ADD COLUMN deleted_at TEXT;
