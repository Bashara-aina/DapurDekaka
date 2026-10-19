-- AI-SLOP AUDIT #62: trigram indexes for admin `%search%` LIKE/ILIKE.
-- Btree indexes cannot serve leading-wildcard LIKE; without these, every
-- admin keystroke search sequential-scans the table. pg_trgm GIN indexes
-- make ILIKE '%x%' index-assisted. Additive-only (no drops) — zero risk.
-- (Neon allowlists pg_trgm; idempotent via IF NOT EXISTS.)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name_id gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_en_trgm
  ON products USING gin (name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_slug_trgm
  ON products USING gin (slug gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_number_trgm
  ON orders USING gin (order_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_orders_recipient_trgm
  ON orders USING gin (recipient_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_name_trgm
  ON users USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_email_trgm
  ON users USING gin (email gin_trgm_ops);
