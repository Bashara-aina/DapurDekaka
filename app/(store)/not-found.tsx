import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center px-4 py-16 text-center">
      <Image
        src="/illustrations/dimsum-sad.svg"
        alt="Halaman tidak ditemukan"
        width={160}
        height={160}
        className="mb-8"
        priority
      />
      <p className="text-text-secondary font-mono text-sm mb-4">404</p>
      <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary mb-3">
        Halaman Tidak Ditemukan
      </h1>
      <p className="text-text-secondary mb-8 max-w-xs">
        Sepertinya dimsum ini sudah habis... atau halamannya memang tidak ada.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/"
          className="h-12 px-6 bg-brand-red text-white font-bold rounded-button flex items-center justify-center hover:bg-brand-red-dark transition-colors"
        >
          ← Kembali ke Beranda
        </Link>
        <Link
          href="/products"
          className="h-12 px-6 border-2 border-brand-red text-brand-red font-bold rounded-button flex items-center justify-center hover:bg-brand-red/5 transition-colors"
        >
          Lihat Produk Kami
        </Link>
      </div>
    </div>
  );
}