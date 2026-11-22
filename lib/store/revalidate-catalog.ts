import { revalidateTag } from 'next/cache';

/**
 * Bust store catalog caches after admin product/category mutations.
 */
export function revalidateCatalog(): void {
  revalidateTag('products');
  revalidateTag('categories');
}
