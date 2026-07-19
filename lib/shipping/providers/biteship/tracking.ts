import { biteshipFetch } from './client';

export interface BiteshipTrackingStatus {
  status: string;
  courier?: {
    waybill_id?: string;
    link?: string;
    name?: string;
    phone?: string;
    vehicle_number?: string;
  };
  history?: Array<{
    status: string;
    note?: string;
    updated_at?: string;
  }>;
}

/**
 * Fetch live tracking status from Biteship.
 */
export async function fetchBiteshipTracking(
  biteshipOrderId: string
): Promise<BiteshipTrackingStatus | null> {
  try {
    return await biteshipFetch<BiteshipTrackingStatus>(`/orders/${biteshipOrderId}`);
  } catch {
    return null;
  }
}

/**
 * Map Biteship status to internal order status.
 */
export function mapBiteshipStatusToOrder(
  biteshipStatus: string
): 'shipped' | 'delivered' | 'failed' | null {
  const s = biteshipStatus.toLowerCase();
  if (['delivered', 'completed'].includes(s)) return 'delivered';
  if (['cancelled', 'rejected', 'returned'].includes(s)) return 'failed';
  if (['confirmed', 'allocated', 'picking_up', 'picked', 'dropping_off', 'shipped'].includes(s)) {
    return 'shipped';
  }
  return null;
}
