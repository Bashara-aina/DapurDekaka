import { z } from 'zod';

export const CheckoutSchema = z.object({
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().positive().max(99),
  })).min(1),
  shippingAddress: z.object({
    recipientName: z.string().min(2).max(100),
    phone: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, 'Format nomor HP tidak valid'),
    province: z.string().min(1),
    provinceId: z.string().min(1),
    city: z.string().min(1),
    cityId: z.string().min(1),
    district: z.string().min(1),
    postalCode: z.string().regex(/^\d{5}$/, 'Kode pos harus 5 digit'),
    fullAddress: z.string().min(10).max(300),
    label: z.enum(['rumah', 'kantor', 'lainnya']).default('rumah'),
  }),
  courierCode: z.enum(['sicepat', 'jne', 'anteraja']),
  courierService: z.enum(['FROZEN', 'YES']),
  couponCode: z.string().optional(),
  pointsToRedeem: z.number().int().min(0).default(0),
  notes: z.string().max(300).optional(),
});

export type CheckoutInput = z.infer<typeof CheckoutSchema>;
