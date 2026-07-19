import { MIN_WEIGHT_GRAM } from './constants';
import type { ShippingItemInput } from './types';

export interface CartDimensions {
  totalWeightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

/**
 * Compute billable weight and stacked box dimensions from cart items.
 */
export function computeCartDimensions(items: ShippingItemInput[]): CartDimensions {
  let totalWeightGram = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let stackedHeight = 0;

  for (const item of items) {
    totalWeightGram += item.weightGram * item.quantity;
    maxLength = Math.max(maxLength, item.lengthCm);
    maxWidth = Math.max(maxWidth, item.widthCm);
    stackedHeight += item.heightCm * item.quantity;
  }

  return {
    totalWeightGram: Math.max(totalWeightGram, MIN_WEIGHT_GRAM),
    lengthCm: maxLength || 30,
    widthCm: maxWidth || 22,
    heightCm: Math.min(stackedHeight || 12, 120),
  };
}
