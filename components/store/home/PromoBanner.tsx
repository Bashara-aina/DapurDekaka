import Link from 'next/link';

export function PromoBanner() {
  return (
    <section className="py-6 px-4 container mx-auto">
      <div className="bg-brand-red rounded-card p-6 md:p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-[radial-gradient(circle,_var(--tw-gradient-stops))]from-white/20_at_50%_50%,_transparent]" />
        </div>
        <div className="relative z-10">
          <span className="inline-block px-4 py-1 bg-white/20 text-white rounded-pill text-sm font-semibold mb-4">
            PROMO 10% OFF
          </span>
          <h3 className="font-display text-xl md:text-2xl font-bold text-white mb-2">
            Untuk pembelian pertama kamu
          </h3>
          <p className="text-white/80 mb-4">Gunakan kode:</p>
          <span className="inline-block px-6 py-2 bg-white text-brand-red font-mono font-bold rounded-lg text-lg md:text-xl mb-6">
            SELAMATDATANG
          </span>
          <br />
          <Link
            href="/products"
            className="inline-flex items-center h-11 px-6 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            Klaim Sekarang
          </Link>
        </div>
      </div>
    </section>
  );
}