-- DapurDekaka Database Fixes & Constraints
-- Run these after verifying no existing violations exist for each constraint

-- Prevent negative stock at DB level
ALTER TABLE product_variants ADD CONSTRAINT stock_non_negative CHECK (stock >= 0);

-- Ensure midtransOrderId is unique across orders (idempotency safety)
ALTER TABLE orders ADD CONSTRAINT orders_midtrans_order_id_unique UNIQUE (midtrans_order_id);

-- Index for FIFO points expire query (candidate selection for expiry processing)
CREATE INDEX idx_points_history_expire_candidates
ON points_history (user_id, type, is_expired, consumed_at, expires_at)
WHERE type = 'earn' AND is_expired = false AND consumed_at IS NULL;

-- Case-insensitive email unique index for auth queries
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));