-- AI-SLOP AUDIT #54: widen the points FIFO partial index.
-- The checkout FIFO redeem query filters
--   user_id + type='earn' + consumed_at IS NULL + is_expired=false + points_amount>0
-- and orders by (expires_at, created_at). The old index only keyed
-- (user_id, expires_at), forcing a sort + heap fetches on every redeem.
-- Same index name (drop + recreate) so Drizzle schema stays in sync.
DROP INDEX IF EXISTS "idx_points_expire_candidates";
CREATE INDEX IF NOT EXISTS "idx_points_expire_candidates"
  ON "points_history" ("user_id", "expires_at", "created_at")
  WHERE "type" = 'earn' AND "is_expired" = false AND "consumed_at" IS NULL AND "points_amount" > 0;
