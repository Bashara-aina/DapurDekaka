import { z } from 'zod';

export const indonesianPhone = z
  .string()
  .regex(
    /^(\+62|62|0)[0-9]{8,13}$/,
    'Masukkan nomor HP yang valid (contoh: 08123456789)'
  )
  .transform((val) => {
    if (val.startsWith('+62')) return '0' + val.slice(3);
    if (val.startsWith('62')) return '0' + val.slice(2);
    return val;
  });

export const checkoutSchema = z.object({
  recipientName: z.string().min(2, 'Nama minimal 2 karakter'),
  recipientEmail: z.string().email('Format email tidak valid'),
  recipientPhone: indonesianPhone,
  deliveryMethod: z.enum(['delivery', 'pickup']),
  addressLine: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  cityId: z.string().optional(),
  province: z.string().optional(),
  provinceId: z.string().optional(),
  postalCode: z.string().optional(),
  courierCode: z.string().optional(),
  courierService: z.string().optional(),
  customerNote: z.string().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;