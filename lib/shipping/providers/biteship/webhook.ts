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
 * Verify a Biteship webhook.
 *
 * Biteship's dashboard supports two modes:
 *  1. HMAC-SHA256 of the raw body in a chosen header (this is what we generate).
 *  2. A static "signature key": the header value IS the configured secret.
 *
 * W4: support both so deliveries never silently 401 out of the tracking flow.
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

  const safeEqual = (a: string, b: string): boolean => {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  };

  // HMAC mode (hex digest), then static-key mode.
  if (safeEqual(signature, expected)) return true;
  return safeEqual(signature, secret);
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
    // W6: `order.price` events carry no `status` — accept any identifying field.
    if (!payload || (!payload.status && !payload.event && !payload.order_id)) return null;
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
