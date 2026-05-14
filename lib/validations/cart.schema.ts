import { z } from 'zod';

export const CartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(99),
});

export const ValidateCartSchema = z.object({
  items: z.array(CartItemSchema),
});

export type CartItemInput = z.infer<typeof CartItemSchema>;
export type ValidateCartInput = z.infer<typeof ValidateCartSchema>;
