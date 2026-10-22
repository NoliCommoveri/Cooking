-- Phase 2c: voice step control (plan §6.12). Off until a parent turns it on
-- for the family, because the browser usually sends what the mic hears to
-- Google to recognize it.
ALTER TABLE families ADD COLUMN voice_enabled INTEGER NOT NULL DEFAULT 0;
