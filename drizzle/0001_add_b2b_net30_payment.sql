-- Migration: Add B2B Net-30 payment columns to orders
-- Created: 2026-05-16

BEGIN;

-- Add paymentMethod column to track how order was paid (midtrans, net30, etc.)
ALTER TABLE orders ADD COLUMN payment_method varchar(50);
COMMENT ON COLUMN orders.payment_method IS 'Payment method used: midtrans, net30, bank_transfer, etc.';

-- Add paymentDueAt for Net-30 orders (when payment is due)
ALTER TABLE orders ADD COLUMN payment_due_at timestamp with time zone;
COMMENT ON COLUMN orders.payment_due_at IS 'Payment due date for Net-30 B2B orders';

-- Add index for B2B orders filtering
CREATE INDEX IF NOT EXISTS idx_orders_is_b2b ON orders(is_b2b);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_payment_due_at ON orders(payment_due_at);

COMMIT;