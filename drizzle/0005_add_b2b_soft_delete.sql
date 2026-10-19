-- Add missing soft-delete columns to B2B tables.
-- Schema declares deletedAt on b2bInquiries/b2bQuotes/b2bQuoteItems but the
-- columns were never created in the prod DB. Drizzle generates
-- SELECT ..., "deleted_at" FROM ... so any page that calls
-- db.query.b2bInquiries.findMany/findFirst throws 42703 (column does not
-- exist). This migration brings the DB in line with the schema.
--
-- Already applied to prod on 2026-06-21. Re-running is safe thanks to
-- IF NOT EXISTS.

ALTER TABLE "b2b_inquiries"   ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "b2b_quotes"      ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "b2b_quote_items" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
