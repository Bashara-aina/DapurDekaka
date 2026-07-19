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
 */
export interface MidtransSignatureInput {
  readonly orderId: unknown;
  readonly statusCode: unknown;
  readonly grossAmount: unknown;
  readonly signatureKey: unknown;
}

/**
 * Compute the expected Midtrans signature for a notification.
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
