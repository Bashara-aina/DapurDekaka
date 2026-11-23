# Soft-launch env gaps (local audit 2026-11-23)

Keep Midtrans sandbox + Biteship test. Fill these on **Vercel Production** before announce:

| Key | Local `.env` | Action |
|-----|--------------|--------|
| `MIDTRANS_IS_PRODUCTION` | `false` | Keep false |
| `BITESHIP_API_KEY` | `biteship_test.*` | Keep test |
| `BITESHIP_WEBHOOK_SECRET` | SET | Confirm dedicated secret in Biteship dashboard webhook |
| `UPSTASH_REDIS_*` | SET | Confirm Production also set (past runtime errors when missing) |
| `CRON_SECRET` / `AUTH_SECRET` | SET | Confirm Production |
| `TOTP_ENCRYPTION_KEY` | SET (local + Vercel Prod 2026-11-23) | Redeploy after add so runtime picks it up |
| `FONNTE_API_KEY` | **MISSING** | Required for customer/owner WA |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | **MISSING** | Recommended for webhook 5xx alerts |
| `RESEND_API_KEY` | SET | Confirm domain SPF/DKIM/DMARC verified |
| `DATABASE_URL` | pooler ✅ | Confirm Production uses `-pooler` |

## Store settings still seed-like
- `store_whatsapp_number` = `6289673737886` — replace with real business line if different
- `admin_email` = `admin@dapurdekaka.com` — confirm mailbox exists
