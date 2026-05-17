export function BlogCTA() {
  return (
    <div className="my-8 p-6 bg-gradient-to-r from-brand-red/5 to-brand-cream rounded-xl border border-brand-red/20">
      <h3 className="font-display text-lg font-bold mb-2">
        Mau coba dimsum premium dari Bandung?
      </h3>
      <p className="text-sm text-text-secondary mb-4">
        Pesan sekarang dan nikmati gratis ongkir untuk pembelian pertama. Dikirim ke seluruh Indonesia.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href="/products"
          className="inline-flex items-center px-4 py-2 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark transition-colors"
        >
          Lihat Produk
        </a>
        <a
          href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}?text=Halo! Saya tertarik dengan produk Dapur Dekaka`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-medium rounded-button hover:bg-[#20BD5A] transition-colors"
        >
          <span>💬</span> Chat WhatsApp
        </a>
      </div>
    </div>
  );
}
