/**
 * Session 2 — Midtrans sandbox payment matrix against production.
 * Guest settle, logged-in points settle, retry, expire/cancel.
 *
 * Run: node --env-file=.env scripts/sandbox-payment-matrix.mjs
 */
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const BASE = process.env.E2E_BASE_URL ?? 'https://www.dapurdekaka.com';
const VARIANT_ID = process.env.UAT_VARIANT_ID ?? '09577835-0519-4b9d-9751-762d749a72ea';
const UNIT_PRICE = Number(process.env.UAT_UNIT_PRICE ?? 65000);
const QTY = 1;
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY ?? '';
const SIG_SECRET = process.env.MIDTRANS_SIGNATURE_SECRET || SERVER_KEY;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SERVER_KEY || !SIG_SECRET) {
  console.error('Missing MIDTRANS_SERVER_KEY / MIDTRANS_SIGNATURE_SECRET');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const db = neon(DATABASE_URL);

function sign(orderId, statusCode, grossAmount, secret) {
  return crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${secret}`)
    .digest('hex');
}

async function initiateGuest({ email, note }) {
  const subtotal = UNIT_PRICE * QTY;
  const body = {
    items: [{ variantId: VARIANT_ID, quantity: QTY }],
    deliveryMethod: 'pickup',
    shippingTier: 'pickup',
    recipientName: 'UAT Sandbox Matrix',
    recipientEmail: email,
    recipientPhone: '081234567890',
    customerNote: note,
    subtotal,
    discountAmount: 0,
    pointsDiscount: 0,
    idempotencyKey: crypto.randomUUID(),
  };

  const res = await fetch(`${BASE}/api/checkout/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(`initiate failed ${res.status}: ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function getOrder(orderNumber) {
  const rows = await db`
    SELECT id, order_number, status, user_id, midtrans_order_id, total_amount,
           payment_retry_count, pickup_code, paid_at, subtotal
    FROM orders WHERE order_number = ${orderNumber} LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getStock(variantId) {
  const rows = await db`SELECT stock FROM product_variants WHERE id = ${variantId}`;
  return rows[0]?.stock ?? null;
}

async function getPoints(userId) {
  const rows = await db`SELECT points_balance FROM users WHERE id = ${userId}`;
  return rows[0]?.points_balance ?? null;
}

async function postWebhook({ midtransOrderId, grossAmount, transactionStatus, paymentType }) {
  const statusCode = '200';
  const gross = String(grossAmount);
  const signature_key = sign(midtransOrderId, statusCode, gross, SIG_SECRET);
  const payload = {
    order_id: midtransOrderId,
    status_code: statusCode,
    gross_amount: gross,
    signature_key,
    transaction_status: transactionStatus,
    fraud_status: 'accept',
    payment_type: paymentType,
    transaction_id: crypto.randomUUID(),
    transaction_time: new Date().toISOString(),
  };

  const res = await fetch(`${BASE}/api/webhooks/midtrans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function retryPayment(orderNumber, email) {
  const res = await fetch(`${BASE}/api/checkout/retry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderNumber, email }),
  });
  const json = await res.json();
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function caseGuestQris() {
  console.log('\n═══ Case A — Guest QRIS settle ═══');
  const stockBefore = await getStock(VARIANT_ID);
  const data = await initiateGuest({
    email: `uat.guest.qris.${Date.now()}@dapurdekaka.com`,
    note: 'UAT Session2 guest QRIS',
  });
  console.log('  order', data.orderNumber, 'snap', Boolean(data.snapToken));
  const before = await getOrder(data.orderNumber);
  assert(before?.status === 'pending_payment', `expected pending_payment got ${before?.status}`);
  assert(before?.user_id == null, 'guest must have null user_id');

  const wh = await postWebhook({
    midtransOrderId: before.midtrans_order_id,
    grossAmount: before.total_amount,
    transactionStatus: 'settlement',
    paymentType: 'qris',
  });
  console.log('  webhook', wh.status, JSON.stringify(wh.json).slice(0, 200));
  assert(wh.status === 200 && wh.json?.success !== false, 'webhook settle failed');

  const after = await getOrder(data.orderNumber);
  const stockAfter = await getStock(VARIANT_ID);
  console.log('  status', after?.status, 'stock', stockBefore, '→', stockAfter, 'pickup', after?.pickup_code);
  assert(after?.status === 'paid', `expected paid got ${after?.status}`);
  assert(stockAfter === stockBefore - QTY, 'stock not decremented');
  assert(after?.pickup_code && after.pickup_code !== after.order_number, 'pickup_code missing/bad');
  return { orderNumber: data.orderNumber, ok: true };
}

async function caseLoggedInVaPoints() {
  console.log('\n═══ Case B — Logged-in VA settle + points ═══');
  const users = await db`
    SELECT id, email, points_balance FROM users
    WHERE email = 'bashara.aina.56@gmail.com' AND deleted_at IS NULL LIMIT 1
  `;
  assert(users[0], 'customer user missing');
  const user = users[0];
  const pointsBefore = Number(user.points_balance ?? 0);
  const stockBefore = await getStock(VARIANT_ID);

  const data = await initiateGuest({
    email: user.email,
    note: 'UAT Session2 logged-in VA points',
  });
  await db`UPDATE orders SET user_id = ${user.id} WHERE order_number = ${data.orderNumber}`;
  const before = await getOrder(data.orderNumber);
  assert(before?.user_id === user.id, 'user_id not attached');

  const wh = await postWebhook({
    midtransOrderId: before.midtrans_order_id,
    grossAmount: before.total_amount,
    transactionStatus: 'settlement',
    paymentType: 'bank_transfer',
  });
  console.log('  webhook', wh.status, JSON.stringify(wh.json).slice(0, 200));
  assert(wh.status === 200, 'webhook settle failed');

  const after = await getOrder(data.orderNumber);
  const pointsAfter = await getPoints(user.id);
  const stockAfter = await getStock(VARIANT_ID);
  console.log('  status', after?.status, 'points', pointsBefore, '→', pointsAfter, 'stock', stockBefore, '→', stockAfter);
  assert(after?.status === 'paid', `expected paid got ${after?.status}`);
  assert(stockAfter === stockBefore - QTY, 'stock not decremented');
  assert(Number(pointsAfter) > pointsBefore, `points not awarded (before=${pointsBefore} after=${pointsAfter})`);
  return { orderNumber: data.orderNumber, ok: true, pointsBefore, pointsAfter };
}

async function caseRetry() {
  console.log('\n═══ Case C — Payment retry ═══');
  const email = `uat.retry.${Date.now()}@dapurdekaka.com`;
  const data = await initiateGuest({
    email,
    note: 'UAT Session2 retry',
  });
  const before = await getOrder(data.orderNumber);
  const prevMid = before.midtrans_order_id;

  await db`
    UPDATE orders
    SET payment_expires_at = NOW() - INTERVAL '1 minute'
    WHERE order_number = ${data.orderNumber}
  `;

  const retried = await retryPayment(data.orderNumber, email);
  console.log('  retry', retried.status, retried.json?.success, retried.json?.data?.snapToken ? 'new-snap' : retried.json?.error);
  assert(retried.status === 200 && retried.json?.success, `retry failed: ${JSON.stringify(retried.json)}`);

  const after = await getOrder(data.orderNumber);
  console.log('  midtrans', prevMid, '→', after?.midtrans_order_id, 'retryCount', after?.payment_retry_count);
  assert(after?.status === 'pending_payment', 'status should stay pending_payment');
  assert(Number(after?.payment_retry_count) >= 1, 'retry count not incremented');
  assert(String(after?.midtrans_order_id).includes('-retry-'), 'midtrans order id missing -retry-N');
  assert(after?.midtrans_order_id !== prevMid, 'midtrans order id unchanged');
  return { orderNumber: data.orderNumber, ok: true };
}

async function caseExpireCancel() {
  console.log('\n═══ Case D — Expire / cancel webhook ═══');
  const data = await initiateGuest({
    email: `uat.expire.${Date.now()}@dapurdekaka.com`,
    note: 'UAT Session2 expire',
  });
  const before = await getOrder(data.orderNumber);

  const wh = await postWebhook({
    midtransOrderId: before.midtrans_order_id,
    grossAmount: before.total_amount,
    transactionStatus: 'expire',
    paymentType: 'qris',
  });
  console.log('  webhook', wh.status, JSON.stringify(wh.json).slice(0, 200));
  assert(wh.status === 200, 'expire webhook failed');

  const after = await getOrder(data.orderNumber);
  console.log('  status', after?.status);
  const ok = after?.status === 'cancelled' || after?.status === 'expired';
  assert(ok, `unexpected status after expire: ${after?.status}`);
  return { orderNumber: data.orderNumber, ok, status: after?.status };
}

async function main() {
  console.log(`Base: ${BASE}`);
  console.log(`Variant: ${VARIANT_ID}`);
  const report = {};
  report.A = await caseGuestQris();
  report.B = await caseLoggedInVaPoints();
  report.C = await caseRetry();
  report.D = await caseExpireCancel();

  console.log('\n═══ REPORT ═══');
  for (const [k, v] of Object.entries(report)) {
    console.log(`  ${k}: ${v.ok ? 'GREEN' : 'BLOCKED'}`, v.orderNumber ?? '', v.status ?? '');
  }
  const allGreen = Object.values(report).every((r) => r.ok);
  process.exit(allGreen ? 0 : 2);
}

main().catch((err) => {
  console.error('\nFATAL', err);
  process.exit(1);
});
