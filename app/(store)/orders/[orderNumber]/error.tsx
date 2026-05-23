'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h2 className="text-xl font-bold text-text-primary mb-2">Terjadi Kesalahan</h2>
      <p className="text-text-secondary mb-4">Maaf, terjadi kesalahan. Silakan coba lagi.</p>
      <button
        onClick={reset}
        className="h-10 px-6 bg-brand-red text-white font-bold rounded-button hover:bg-brand-red-dark transition-colors"
      >
        Coba Lagi
      </button>
    </div>
  );
}