import { auth } from '@/lib/auth';
import type { CartItem } from '@/store/cart.store';

export async function mergeLocalCartToDb(localItems: CartItem[]): Promise<number> {
  const session = await auth();

  if (!session?.user?.id || !localItems.length) {
    return 0;
  }

  return localItems.length;
}