import crypto from 'crypto';

/**
 * Midtrans HTTP notification signature verification (P3 P0#1).
 *
 * Midtrans signs every notification with:
 *   signature_key = sha512(order_id + status_code + gross_amount + serverKey)
 * delivered INSIDE the JSON body (there is no `x-midtrans-signature` header).
 *
 * WHY: the previous scheme demanded a header equal to sha512(serverKey + rawBody),
 * which Midtrans never sends — every real webhook 401'd and revenue silently fell
 * back to the reconcile cron. This restores the documented, correct scheme.
 *
 * FRESH-AUDIT-05 / AUDIT-05 #2 hardening: Midtrans sometimes delivers
 * `gross_amount` with decimal places (e.g. "236000.00") and other times as a
 * bare integer string ("236000"). The signature is computed against whatever
 * Midtrans sends, so we must mirror that exactly — but for downstream amount
 * comparisons (see `parseMidtransGrossAmount`) we normalise to an integer.
 */
export interface MidtransSignatureInput {
  readonly orderId: unknown;
  readonly statusCode: unknown;
  readonly grossAmount: unknown;
  readonly signatureKey: unknown;
}

/**
 * Compute the expected Midtrans signature for a notification.
 * `grossAmount` is passed verbatim — Midtrans signs the literal bytes it sends.
 */
export function computeMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string
): string {
  return crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
}

/**
 * Verify a Midtrans notification body against the server key.
 * Returns false on any missing field or mismatch — never throws.
 */
export function verifyMidtransSignature(
  input: MidtransSignatureInput,
  serverKey: string | undefined
): boolean {
  if (!serverKey) return false;

  const { orderId, statusCode, grossAmount, signatureKey } = input;
  if (
    typeof orderId !== 'string' ||
    typeof statusCode !== 'string' ||
    typeof grossAmount !== 'string' ||
    typeof signatureKey !== 'string' ||
    signatureKey.length === 0
  ) {
    return false;
  }

  const expected = computeMidtransSignature(orderId, statusCode, grossAmount, serverKey);

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(signatureKey, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Parse a Midtrans `gross_amount` string into an integer IDR value.
 *
 * Midtrans returns either "236000" or "236000.00". The signature is over the
 * literal string (do not strip decimals before verifying), but for amount
 * comparisons we want the integer cents/piah equivalent.
 *
 * @example parseMidtransGrossAmount("236000.00")  → 236000
 * @example parseMidtransGrossAmount("236000")     → 236000
 * @example parseMidtransGrossAmount("invalid")    → null
 */
export function parseMidtransGrossAmount(raw: string | null | undefined): number | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  // "236000.00" → "236000", "236000" → "236000"
  const normalised = raw.replace(/\.\d+$/, '').replace(/[^\d-]/g, '');
  if (normalised.length === 0) return null;
  const n = Number(normalised);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}
