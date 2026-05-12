'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function B2BAccountOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/b2b/account/orders');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="bg-brand-cream min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <h1 className="font-display text-xl font-bold">Riwayat Pesanan B2B</h1>
        </div>
      </div>

      {/* Empty State */}
      <div className="px-4 py-16 container mx-auto text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
          <span className="text-3xl">📦</span>
        </div>
        <h2 className="font-display text-lg font-semibold mb-2">
          Belum Ada Pesanan
        </h2>
        <p className="text-text-secondary text-sm mb-6">
          Pesanan B2B Anda akan muncul di sini.
        </p>
      </div>
    </div>
  );
}