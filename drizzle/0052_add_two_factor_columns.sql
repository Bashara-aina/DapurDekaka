-- TOTP 2FA columns on users (otplib v13, RFC 6238, Google Authenticator compatible).
-- two_factor_secret stores the TOTP secret AES-256-GCM encrypted
-- (see lib/auth/two-factor.ts) — never plaintext.
-- two_factor_backup_codes is a JSONB array of bcrypt hashes; each code is
-- consumed (removed) on successful use.
-- Idempotent: safe to run multiple times.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_secret" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_backup_codes" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "two_factor_enabled_at" timestamp with time zone;
