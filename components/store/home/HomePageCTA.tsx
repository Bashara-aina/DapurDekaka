'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';

export function HomePageCTA() {
  const { data: session } = useSession();
  const hydrated = false;

  // We need to handle hydration safely
  const [mounted, setMounted] = useState(false);
  const getTotalItems = useCartStore((s) => s.getTotalItems);

  useEffect(() => {
    setMounted(true);
  }, []);

  const totalItems = mounted ? getTotalItems() : 0;

  if (!mounted) {
    return (
      <section className="py-12 px-4 bg-brand-red">
        <div className="container mx-auto text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-4">
            Siap Mencicipi Kelezatan Dapur Dekaka?
          </h2>
          <p className="text-white/80 mb-6 max-w-md mx-auto">
            Pesan sekarang dan nikmati dimsum, siomay, dan bakso premium langsung di rumahmu
          </p>
          <Link
            href="/products"
            className="inline-flex items-center h-12 px-8 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            Jelajahi Produk
          </Link>
        </div>
      </section>
    );
  }

  // Logged in user
  if (session?.user) {
    return (
      <section className="py-12 px-4 bg-brand-red">
        <div className="container mx-auto text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-4">
            {totalItems > 0 ? 'Lanjutkan Belanja?' : 'Mau Pesan Lagi?'}
          </h2>
          <p className="text-white/80 mb-6 max-w-md mx-auto">
            {totalItems > 0
              ? `Kamu punya ${totalItems} item di keranjang. Lanjutkan belanja dan kumpulkan poin!`
              : 'Mau pesan lagi? Yuk jelajahi produk favoritmu.'}
          </p>
          <Link
            href="/products"
            className="inline-flex items-center h-12 px-8 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            {totalItems > 0 ? 'Lihat Keranjang' : 'Mulai Belanja'}
          </Link>
        </div>
      </section>
    );
  }

  // Guest user
  return (
    <section className="py-12 px-4 bg-brand-red">
      <div className="container mx-auto text-center">
        <h2 className="font-display text-2xl font-bold text-white mb-4">
          Siap Mencicipi Kelezatan Dapur Dekaka?
        </h2>
        <p className="text-white/80 mb-6 max-w-md mx-auto">
          Pesan sekarang dan nikmati dimsum, siomay, dan bakso premium langsung di rumahmu
        </p>
        <Link
          href="/products"
          className="inline-flex items-center h-12 px-8 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
        >
          Jelajahi Produk
        </Link>
      </div>
    </section>
  );
}