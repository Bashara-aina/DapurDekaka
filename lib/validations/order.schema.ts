import { z } from 'zod';

const indonesianPhone = z
  .string()
  .regex(/^(\+62|62|0)[0-9]{8,13}$/, 'Masukkan nomor HP yang valid')
  .transform((val) => {
    if (val.startsWith('+62')) return '0' + val.slice(3);
    if (val.startsWith('62')) return '0' + val.slice(2);
    return val;
  });

export const addressSchema = z.object({
  label: z.string().max(100).optional(),
  recipientName: z.string().min(2, 'Nama penerima minimal 2 karakter').max(255),
  recipientPhone: indonesianPhone,
  addressLine: z.string().min(5, 'Alamat minimal 5 karakter'),
  district: z.string().min(1, 'Kecamatan wajib diisi').max(255),
  city: z.string().min(1, 'Kota wajib diisi').max(255),
  cityId: z.string().min(1, 'ID kota wajib diisi').max(10),
  province: z.string().min(1, 'Provinsi wajib diisi').max(255),
  provinceId: z.string().min(1, 'ID provinsi wajib diisi').max(10),
  postalCode: z.string().min(1, 'Kode pos wajib diisi').max(10),
  isDefault: z.boolean().default(false),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    'pending_payment',
    'paid',
    'processing',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ]),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(255).optional(),
  trackingUrl: z.string().url().optional().or(z.literal('')),
});

export const orderFilterSchema = z.object({
  status: z.enum([
    'pending_payment',
    'paid',
    'processing',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ]).optional(),
  isB2b: z.boolean().optional(),
  search: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const cancelOrderSchema = z.object({
  reason: z.string().min(5, 'Alasan pembatalan minimal 5 karakter').max(500).optional(),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;
export type OrderFilterInput = z.infer<typeof orderFilterSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;