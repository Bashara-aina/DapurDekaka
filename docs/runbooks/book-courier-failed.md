# Runbook — Book Kurir failed / `needs_attention`

## Symptoms
- Field dashboard Book Kurir errors
- Order `dispatchStatus` failed / `needs_attention=true`
- Customer paid delivery order stuck in packed

## Keep Biteship test
Use `biteship_test.*` until live flip. Wallet/test credits still required for booking.

## Steps
1. Open `/admin/field` → order detail → note error toast / `needs_attention_reason`.
2. Confirm origin settings: `biteship_origin_*` lat/lng/address/postal.
3. Confirm `BITESHIP_API_KEY` is test key and webhook secret dedicated.
4. Retry Book Kurir once.
5. If still fails: `/admin/shipments` → enter manual resi → mark shipped.
6. Notify customer via WA with tracking number.
7. Clear `needs_attention` after customer has a path to delivery.

## Escalate
- Biteship dashboard booking logs
- Vercel `[admin/field/dispatch]` / `[webhooks/biteship]` logs
