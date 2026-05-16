/**
 * Generate a tracking URL for a given courier code and tracking number.
 * Returns null if no URL template exists for the courier.
 */
const COURIER_TRACKING_URLS: Record<string, string> = {
  sicepat: 'https://www.sicepat.com/check/waybill/{{trackingNumber}}',
  jne: 'https://www.jne.co.id/tracking/trace/{{trackingNumber}}',
  anteraja: 'https://anteraja.id/trace/{{trackingNumber}}',
  jnt: 'https://www.j-express.id/lacak/',
  pos: 'https://www.posindonesia.co.id/id/tracking/',
  tiki: 'https://www.tiki.id/id/tracking?awb=',
};

export function getTrackingUrl(courierCode: string, trackingNumber: string): string | null {
  const template = COURIER_TRACKING_URLS[courierCode.toLowerCase()];
  if (!template || !trackingNumber) return null;
  return template.replace('{{trackingNumber}}', trackingNumber);
}