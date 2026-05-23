export const ORDER_STATUS_LABELS = {
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Sudah Dibayar',
  processing: 'Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
} as const;

export const ORDER_STATUS_LABELS_SHORT = {
  pending_payment: 'Menunggu',
  paid: 'Dibayar',
  processing: 'Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Selesai',
  cancelled: 'Dibatalkan',
  refunded: 'Dikembalikan',
} as const;

export const ORDER_STATUS_COLORS = {
  pending_payment: 'bg-warning-light text-warning',
  paid: 'bg-info-light text-info',
  processing: 'bg-purple-100 text-purple-700',
  packed: 'bg-cyan-100 text-cyan-700',
  shipped: 'bg-info-light text-info',
  delivered: 'bg-success-light text-success',
  cancelled: 'bg-gray-100 text-gray-600',
  refunded: 'bg-gray-100 text-gray-600',
} as const;

export type OrderStatus = keyof typeof ORDER_STATUS_LABELS;