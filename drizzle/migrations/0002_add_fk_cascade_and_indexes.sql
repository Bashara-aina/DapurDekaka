-- Migration: Add foreign key cascade and performance indexes
-- Issue: AUDIT-04 item 7 (inventory_logs.variant_id missing ON DELETE CASCADE)
-- Issue: AUDIT-04 item 6 (coupon_usages missing index for max_uses_per_user check)

-- Fix 1: Add ON DELETE CASCADE to inventory_logs.variant_id foreign key
-- Since we can't alter the FK directly, we recreate the table structure
-- Step 1: Drop existing FK constraint (PostgreSQL names it something like inventory_logs_variant_id_fkey)
ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_variant_id_fkey;

-- Step 2: Add FK with ON DELETE CASCADE
ALTER TABLE inventory_logs
  ADD CONSTRAINT inventory_logs_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

-- Fix 2: Add composite index on coupon_usages(coupon_id, user_id) for max_uses_per_user checks
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user
  ON coupon_usages(coupon_id, user_id)
  WHERE user_id IS NOT NULL;

-- Also add index for points_history for reconcile queries
CREATE INDEX IF NOT EXISTS idx_points_history_user_type
  ON points_history(user_id, type);

CREATE INDEX IF NOT EXISTS idx_points_history_expires_at
  ON points_history(expires_at DESC)
  WHERE expires_at IS NOT NULL;