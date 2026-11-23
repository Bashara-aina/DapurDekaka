# Runbook — Midtrans paid, order still `pending_payment`

## Symptoms
- Customer shows Midtrans success / settlement
- `/admin/orders` still shows `pending_payment`
- Success page keeps polling

## Keep sandbox
Use Midtrans **Sandbox** dashboard while `MIDTRANS_IS_PRODUCTION=false`.

## Steps
1. Copy order number (`DDK-YYYYMMDD-XXXX` or `…-retry-N`).
2. Midtrans dashboard → Transactions → find matching order_id.
3. Confirm status `settlement` / `capture` and gross amount.
4. Check Vercel logs for `[webhooks/midtrans]` — signature fail? amount mismatch?
5. Hit reconcile: wait for hourly cron `/api/cron/hourly` or trigger reconcile with `Authorization: Bearer $CRON_SECRET`.
6. If still stuck: inspect Redis idempotency / duplicate webhook; check Sentry.
7. Last resort (owner): confirm payment via admin only if money is proven settled in Midtrans.

## Do not
- Manually mark paid without Midtrans evidence
- Flip production Midtrans keys to “fix” this
