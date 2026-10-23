-- Chef Ruth's Getting started (plan §6.9). setup_step is the last part a family
-- finished, so she picks up at the next one; setup_done_at is when it was all
-- done. A family that set its PIN before Chef Ruth was built is already set up.
ALTER TABLE families ADD COLUMN setup_step TEXT;
ALTER TABLE families ADD COLUMN setup_done_at TEXT;
UPDATE families SET setup_done_at = created_at WHERE parent_pin_hash IS NOT NULL;
