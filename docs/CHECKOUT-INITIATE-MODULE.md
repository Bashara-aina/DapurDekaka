# Checkout initiate route — module map

`app/api/checkout/initiate/route.ts` exceeds the 300-line project limit (~1200 lines).
It is intentionally kept as a single transactional orchestration surface for soft-launch
reviewability. Do **not** casually split without a dedicated PR that preserves:

1. Zod input validation
2. DB price/stock re-fetch
3. Coupon + points caps
4. Biteship quote revalidation + phase gates
5. Order + order_items snapshots
6. Midtrans Snap create + token persist
7. Maintenance mode + same-origin + rate limit

## Suggested future extraction (post soft-launch)

| Helper | Responsibility |
|--------|----------------|
| `lib/checkout/validate-cart.ts` | Stock/price re-fetch |
| `lib/checkout/apply-discounts.ts` | Coupon + points |
| `lib/checkout/build-midtrans-items.ts` | Snap item_details |
| `lib/checkout/create-order-tx.ts` | DB transaction |

Until extracted, treat this file as a money-path critical module in every code review.
