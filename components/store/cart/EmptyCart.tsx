import Link from 'next/link';
import { EmptyState } from '@/components/store/common/EmptyState';

export function EmptyCart() {
  return (
    <EmptyState
      variant="cart"
      title="Keranjangmu masih kosong"
      description="Yuk, temukan dimsum favoritmu!"
      action={{ label: 'Mulai Belanja', href: '/products' }}
    />
  );
}