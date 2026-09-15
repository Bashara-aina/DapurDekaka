import Link from 'next/link';
import { ArrowRight, MessageCircle } from 'lucide-react';

export function BlogCTA() {
  const waNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '6289673737886';

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-brand-red/20 bg-gradient-to-br from-brand-red/[0.07] via-white to-brand-cream">
      <div className="p-6 md:p-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-red">
          Dari blog ke meja makan
        </p>
        <h3 className="font-display text-xl md:text-2xl font-bold text-text-primary mb-2">
          Mau coba dimsum premium dari Bandung?
        </h3>
        <p className="text-sm md:text-base text-text-secondary mb-5 max-w-xl">
          Pesan sekarang — dikirim ke seluruh Indonesia dengan cold chain terjaga.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/products"
            className="inline-flex h-11 items-center gap-2 px-5 bg-brand-red text-white text-sm font-semibold rounded-button shadow-button hover:bg-brand-red-dark transition-colors"
          >
            Lihat Produk
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href={`https://wa.me/${waNumber}?text=${encodeURIComponent('Halo! Saya tertarik dengan produk Dapur Dekaka')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 px-5 bg-whatsapp-green text-white text-sm font-semibold rounded-button hover:bg-whatsapp-green-dark transition-colors"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Chat WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
