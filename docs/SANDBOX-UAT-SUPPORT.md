# Sandbox UAT Support (Agent + Bashara)

Use this while running Phases A–B of [`HUMAN-LAUNCH-CHECKLIST.md`](HUMAN-LAUNCH-CHECKLIST.md).

## Env must be sandbox

```bash
MIDTRANS_IS_PRODUCTION=false
# Midtrans SB- server + client keys
BITESHIP_API_KEY=biteship_test.…
BITESHIP_WEBHOOK_SECRET=<dedicated secret, not the API key>
```

## Commands

```bash
npm run type-check
npm run lint
npx vitest run tests/finance/settle-order.test.ts tests/shipping tests/api/checkout
npm run smoke:biteship
```

## After sandbox payments

1. Confirm order `status=paid`, stock decremented, points awarded (logged-in).
2. Pickup orders: `pickup_code` must be a random code from initiate — **not** equal to `order_number`.
3. Purge test orders when done:
   ```bash
   npx tsx --env-file=.env scripts/purge-e2e-orders.ts --dry-run
   npx tsx --env-file=.env scripts/purge-e2e-orders.ts --confirm
   ```

## Webhook debug

- Midtrans sandbox notification URL → `{host}/api/webhooks/midtrans`
- Biteship test webhook → `{host}/api/webhooks/biteship`
- Signature failures: check server logs for `[Midtrans Webhook]` / `[webhooks/biteship]`
- Production without `BITESHIP_WEBHOOK_SECRET` now **throws** (no API-key fallback)

## Sandbox green report template

- [ ] Midtrans QRIS settle → paid
- [ ] Midtrans VA settle → paid + points
- [ ] Retry `-retry-N` works
- [ ] Cancel/expire reverses points
- [ ] Biteship rates cold-chain only
- [ ] Book courier + webhook status updates
- [ ] Pickup code random + handover works
- [ ] No live keys flipped yet
