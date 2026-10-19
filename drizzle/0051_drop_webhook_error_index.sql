-- AI-SLOP AUDIT #58: drop bloat index on webhook_events.error_message (text).
-- A btree on a free-text error column is never used for equality lookups;
-- it only slows writes and bloats storage. Queries filter by source/created_at,
-- which keep their indexes. Idempotent: safe to run multiple times.
DROP INDEX IF EXISTS "idx_webhook_events_error";
