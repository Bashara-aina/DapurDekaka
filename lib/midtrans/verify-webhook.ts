import crypto from 'crypto';

/**
 * Verify Midtrans webhook signature SHA512
 * Signature key = SHA512(order_id + status_code + gross_amount + server_key)
 */
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string
): boolean {
  const hash = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');

  return hash === signatureKey;
}

/**
 * Parse gross_amount string to integer IDR
 */
export function parseGrossAmount(grossAmount: string): number {
  return parseInt(grossAmount.replace(/\D/g, ''), 10);
}