import { z } from 'zod';

/**
 * Shared coupon validation schema for cart/coupon validation endpoints.
 */
export const CouponValidationSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().nonnegative(),
  userId: z.string().uuid().optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

export type CouponValidationInput = z.infer<typeof CouponValidationSchema>;

/**
 * Checkout-specific coupon validation schema — includes items for
 * product/category-level coupon enforcement.
 */
export const CheckoutCouponValidationSchema = z.object({
  code: z.string().min(1),
  subtotal: z.number().int().positive(),
  userId: z.string().uuid().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).optional(),
});

export type CheckoutCouponValidationInput = z.infer<typeof CheckoutCouponValidationSchema>;