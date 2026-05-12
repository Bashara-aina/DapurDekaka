export default function NotFound() {
  return (
    <div className="min-h-screen bg-brand-cream flex flex-col items-center justify-center px-4">
      <div className="text-8xl mb-6">🥟</div>
      <h1 className="font-display text-4xl font-bold text-text-primary mb-2">404</h1>
      <h2 className="font-display text-xl font-semibold text-text-primary mb-4">
        Halaman Tidak Ditemukan
      </h2>
      <p className="text-text-secondary text-center max-w-md mb-8">
        Maaf, halaman yang kamu cari tidak tersedia. Mungkin sudah dipindahkan atau dihapus.
      </p>
      <a
        href="/"
        className="inline-flex items-center h-12 px-6 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
      >
        Kembali ke Beranda
      </a>
    </div>
  );
}