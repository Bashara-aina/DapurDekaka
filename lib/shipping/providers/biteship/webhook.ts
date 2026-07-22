import crypto from 'crypto';

export interface BiteshipWebhookPayload {
  event?: string;
  order_id?: string;
  status?: string;
  courier_tracking_id?: string;
  courier_waybill_id?: string;
  courier_company?: string;
  courier_type?: string;
  courier_driver_name?: string;
  courier_driver_phone?: string;
  courier_driver_photo_url?: string;
  courier_driver_plate_number?: string;
  courier_link?: string;
  order_price?: number;
  price?: number;
  reference_id?: string;
}

/**
 * Verify Biteship webhook HMAC signature.
 */
export function verifyBiteshipSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret =
    process.env.BITESHIP_WEBHOOK_SECRET ?? process.env.BITESHIP_API_KEY;
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return signature === expected;
  }
}

/** @deprecated Use verifyBiteshipSignature */
export const verifyBiteshipWebhookSignature = verifyBiteshipSignature;

/**
 * Parse webhook body from raw string or object.
 */
export function parseBiteshipWebhook(
  input: string | unknown
): BiteshipWebhookPayload | null {
  try {
    const payload =
      typeof input === 'string' ? (JSON.parse(input) as BiteshipWebhookPayload) : (input as BiteshipWebhookPayload);
    if (!payload.status) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Map Biteship status to internal order status action.
 */
export function mapBiteshipStatusToOrder(
  biteshipStatus: string | undefined
): 'shipped' | 'delivered' | 'failed' | null {
  if (!biteshipStatus) return null;
  const s = biteshipStatus.toLowerCase();

  if (['confirmed', 'allocated', 'picking_up', 'picked', 'dropping_off'].includes(s)) {
    return 'shipped';
  }
  if (['delivered', 'completed'].includes(s)) {
    return 'delivered';
  }
  if (['cancelled', 'rejected', 'failed'].includes(s)) {
    return 'failed';
  }
  return null;
}

export function biteshipEventId(payload: BiteshipWebhookPayload): string {
  return `${payload.order_id ?? 'unknown'}:${payload.status ?? 'unknown'}`;
}
