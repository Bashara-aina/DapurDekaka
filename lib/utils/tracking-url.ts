/**
 * Generate a tracking URL for a given courier code and tracking number.
 * Biteship live links are passed through directly.
 */
const COURIER_TRACKING_URLS: Record<string, string> = {
  gojek: 'https://track.gojek.com/',
  grab: 'https://express.grab.com/track/',
  sicepat: 'https://www.sicepat.com/check/waybill/{{trackingNumber}}',
  jne: 'https://www.jne.co.id/tracking/trace/{{trackingNumber}}',
  anteraja: 'https://anteraja.id/trace/{{trackingNumber}}',
  paxel: 'https://paxel.co/track/{{trackingNumber}}',
};

/**
 * Returns tracking URL — prefers Biteship/courier live link when provided.
 */
export function getTrackingUrl(
  courierCode: string,
  trackingNumber: string,
  liveTrackUrl?: string | null
): string | null {
  if (liveTrackUrl) return liveTrackUrl;
  const template = COURIER_TRACKING_URLS[courierCode.toLowerCase()];
  if (!template || !trackingNumber) return null;
  return template.replace('{{trackingNumber}}', trackingNumber);
}
