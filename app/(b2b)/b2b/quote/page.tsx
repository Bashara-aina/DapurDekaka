import type { Metadata } from 'next';
import { QuoteForm } from '@/components/b2b/QuoteForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Minta Penawaran - B2B Dapur Dekaka',
  description: 'Formulir permintaan penawaran harga untuk pemesanan bisnis dalam jumlah besar.',
};

export default function B2BQuotePage() {
  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <h1 className="font-display text-xl font-bold">Minta Penawaran</h1>
          <p className="text-text-secondary text-sm mt-1">
            Isi formulir dan tim kami akan menghubungi Anda
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 py-8 container mx-auto max-w-xl">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <QuoteForm />
        </div>
      </div>
    </div>
  );
}