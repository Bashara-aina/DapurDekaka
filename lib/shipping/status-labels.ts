import type { DispatchStatus } from './types';

export interface CustomerStatusLabel {
  readonly id: string;
  readonly en: string;
}

/**
 * Honest customer-facing status copy (P4 Decision 2 / conflict C5).
 * Maps internal dispatch + order status to language that never over-promises.
 */
export function getCustomerDispatchLabel(
  orderStatus: string,
  dispatchStatus: DispatchStatus | null | undefined,
  deliveryMethod: string
): CustomerStatusLabel {
  if (deliveryMethod === 'pickup') {
    if (orderStatus === 'paid') {
      return { id: 'Siap diambil — tunggu konfirmasi WA', en: 'Ready for pickup — await WA confirmation' };
    }
    if (orderStatus === 'delivered') {
      return { id: 'Sudah diambil', en: 'Picked up' };
    }
  }

  if (dispatchStatus === 'failed') {
    return {
      id: 'Penjemputan kurir dijadwalkan ulang — paket tetap kami jaga beku',
      en: 'Courier pickup rescheduled — your order stays cold-packed',
    };
  }

  if (dispatchStatus === 'booking' || dispatchStatus === 'retrying') {
    return { id: 'Sedang membooking kurir…', en: 'Booking courier…' };
  }

  if (orderStatus === 'shipped') {
    return { id: 'Dalam perjalanan', en: 'In transit' };
  }

  if (orderStatus === 'delivered') {
    return { id: 'Terkirim', en: 'Delivered' };
  }

  if (orderStatus === 'packed' || orderStatus === 'processing') {
    return { id: 'Sedang dikemas', en: 'Being packed' };
  }

  if (orderStatus === 'paid') {
    return { id: 'Pembayaran diterima — menunggu packing', en: 'Payment received — awaiting packing' };
  }

  return { id: orderStatus, en: orderStatus };
}
