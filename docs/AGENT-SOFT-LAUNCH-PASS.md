# Agent soft-launch pass (2026-11-23)

Implements agent-owned work from Production Readiness Plan 20×10.
**Midtrans stays sandbox. Biteship stays test.**

## Code shipped (needs deploy)

| Area | Change |
|------|--------|
| Checkout pending | Guest email from draft + form; polls `?email=` for VA/total |
| Cart merge | Always `loadFromDb` on login |
| Maintenance | Initiate/retry use DB `isMaintenanceMode()` |
| Coupons | Validate rejects `free_shipping` |
| Pickup page | next-intl |
| Loading | terms/trust/maintenance |
| Refunds | PATCH runs `applyRefundCompletionTx` |
| B2B inquiries | Ungated from portal flag (middleware + sidebar) |
| Settings | Owner can edit store/shipping/promo keys |
| Team dashboard | Owner allowed |
| SEO | `metadataBase` on root layout |
| Inventory export | Audit log |
| Field API | Clearer warehouse forbidden copy |

## Data / ops scripts run

- `scripts/audit-inventory.ts --apply` — soft-launch stock floor 10 + inventory logs
- `scripts/soft-launch-ops-pass.ts` — maintenance off, soft launch on, points multiplier 1, carousel 5000ms
- `scripts/unpublish-seed-blog.ts` — unpublished 5 seed posts
- `npm run smoke:biteship` — 0 hard failures
- Vitest **154** passed; `tsc` clean

## Human residual (cannot finish from agent alone)

See [`ENV-SOFT-LAUNCH-GAPS.md`](ENV-SOFT-LAUNCH-GAPS.md) + [`HUMAN-LAUNCH-CHECKLIST.md`](HUMAN-LAUNCH-CHECKLIST.md):

1. Deploy this branch to production
2. Set `TOTP_ENCRYPTION_KEY`, `FONNTE_*`, Sentry DSNs on Vercel Production
3. Confirm Resend DNS + inbox test
4. Enroll 2FA on all admin accounts
5. Replace seed WA `6289673737886` if not the real line
6. Biteship dashboard webhook registration + one Field Book Kurir click UAT
7. Browser Midtrans Snap sandbox open + email/WA confirmation matrix
8. Lawyer sign-off on legal CMS (pages already published with content)
9. Carousel production images + real testimonials (optional empty)
10. Physical warehouse recount vs soft-launch floor stock

## Runbooks added

- [`docs/runbooks/payment-pending-but-midtrans-paid.md`](runbooks/payment-pending-but-midtrans-paid.md)
- [`docs/runbooks/book-courier-failed.md`](runbooks/book-courier-failed.md)
