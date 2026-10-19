-- Oct 2026 audit — checkout/money safety + points ledger hardening.
-- Idempotent: safe to run multiple times.

-- 1. Idempotent checkout initiation (M10): a client UUID makes retries safe.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(64);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_orders_idempotency_key" ON "orders" ("idempotency_key");

-- 2. Partial FIFO (P2): earn rows track their unspent remainder.
ALTER TABLE "points_history" ADD COLUMN IF NOT EXISTS "points_remaining" integer NOT NULL DEFAULT 0;
UPDATE "points_history"
SET "points_remaining" = GREATEST("points_amount", 0)
WHERE "type" = 'earn'
  AND "is_expired" = false
  AND "consumed_at" IS NULL
  AND "points_amount" > 0
  AND "points_remaining" = 0;

-- 3. Expire-candidate index now keys on the remaining balance.
DROP INDEX IF EXISTS "idx_points_expire_candidates";
CREATE INDEX IF NOT EXISTS "idx_points_expire_candidates"
  ON "points_history" ("user_id", "expires_at", "created_at")
  WHERE "type" = 'earn' AND "is_expired" = false AND "points_remaining" > 0;

-- 4. Refund reasons for auto-created obligations.
ALTER TYPE "refund_reason_enum" ADD VALUE IF NOT EXISTS 'late_settlement';
ALTER TYPE "refund_reason_enum" ADD VALUE IF NOT EXISTS 'payment_cancelled';
ALTER TYPE "refund_reason_enum" ADD VALUE IF NOT EXISTS 'oversell';

-- 5. BLOCKER 4/W1: Biteship origin + store settings must exist. Values are
-- seed defaults; admins can edit them in Settings. Never overwrites existing.
INSERT INTO "system_settings" ("key", "value", "type")
VALUES
  ('biteship_origin_lat', '-6.958', 'string'),
  ('biteship_origin_lng', '107.636', 'string'),
  ('biteship_origin_address', 'Jl. Sinom V No. 7, Turangga, Bandung, Jawa Barat', 'string'),
  ('biteship_origin_postal_code', '40264', 'string'),
  ('store_address', 'Jl. Sinom V No. 7, Turangga, Bandung, Jawa Barat', 'string')
ON CONFLICT ("key") DO NOTHING;
