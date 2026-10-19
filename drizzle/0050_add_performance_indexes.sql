-- Performance indexes for DapurDekaka

-- Coupon usage lookups (per-user)
CREATE INDEX IF NOT EXISTS idx_coupon_usages_coupon_user
ON coupon_usages(coupon_id, user_id);

-- Order status history by order
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
ON order_status_history(order_id);

-- Admin activity logs by entity
CREATE INDEX IF NOT EXISTS idx_admin_activity_entity
ON admin_activity_logs(entity_type, entity_id);

-- B2B inquiries by status
CREATE INDEX IF NOT EXISTS idx_b2b_inquiries_status
ON b2b_inquiries(status);

-- Orders by order number (for search)
CREATE INDEX IF NOT EXISTS idx_orders_order_number
ON orders(order_number);

-- Sessions by user (for invalidation)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
ON sessions(user_id);