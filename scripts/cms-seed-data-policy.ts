/**
 * Privacy, refund, terms, and B2B landing CMS seed data.
 */

import type { CmsPageSeed } from './cms-seed-types';
import { policyBlock } from './cms-seed-types';

export const PRIVACY_PAGE: CmsPageSeed = {
  slug: 'privacy',
  title: 'Privacy Policy',
  sections: [
    {
      sectionKey: 'header',
      sortOrder: 0,
      titleId: 'Kebijakan Privasi',
      titleEn: 'Privacy Policy',
      bodyId: 'Terakhir diperbarui: Mei 2026 — Sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP)',
      bodyEn: 'Last updated: May 2026 — In accordance with Law No. 27 of 2022 on Personal Data Protection (UU PDP)',
    },
    policyBlock(
      'data_collected',
      1,
      'Data yang Kami Kumpulkan',
      'Data We Collect',
      'Dapur Dekaka mengumpulkan data pribadi berikut untuk memproses pesanan dan memberikan layanan terbaik:\n\n• Nama lengkap — untuk identitas pengiriman dan faktur\n• Alamat email — untuk konfirmasi pesanan dan komunikasi\n• Nomor telepon — untuk koordinasi pengiriman via WhatsApp/SMS\n• Alamat pengiriman — untuk mengirim produk ke lokasi kamu\n• Data pembayaran — diproses oleh Midtrans, tidak disimpan di server kami\n• Riwayat pesanan — untuk layanan pelanggan dan loyalty points',
      'Dapur Dekaka collects the following personal data to process orders and provide the best service:\n\n• Full name — for shipping identity and invoices\n• Email address — for order confirmation and communication\n• Phone number — for shipping coordination via WhatsApp/SMS\n• Shipping address — to ship products to your location\n• Payment data — processed by Midtrans, not stored on our servers\n• Order history — for customer service and loyalty points'
    ),
    policyBlock(
      'purpose',
      2,
      'Tujuan Pengumpulan Data',
      'Purpose of Data Collection',
      'Data kamu digunakan untuk:\n\n1. Memproses dan mengirim pesanan frozen food\n2. Mengirim notifikasi status pesanan via WhatsApp dan email\n3. Memberikan loyalty points dan promo personal\n4. Memenuhi kewajiban hukum dan regulasi perpajakan (PPN)\n5. Meningkatkan layanan pelanggan',
      'Your data is used for:\n\n1. Processing and shipping frozen food orders\n2. Sending order status notifications via WhatsApp and email\n3. Providing loyalty points and personal promotions\n4. Fulfilling legal obligations and tax regulations (VAT)\n5. Improving customer service'
    ),
    policyBlock(
      'protection',
      3,
      'Perlindungan Data',
      'Data Protection',
      'Kami melindungi data kamu dengan:\n\n• Enkripsi SSL/TLS untuk semua transmisi data\n• Penyimpanan di database Neon PostgreSQL yang aman\n• Akses terbatas hanya untuk staff yang berwenang\n• Tidak menjual atau membagikan data ke pihak ketiga untuk tujuan marketing',
      'We protect your data with:\n\n• SSL/TLS encryption for all data transmission\n• Secure storage in Neon PostgreSQL database\n• Limited access only for authorized staff\n• Not selling or sharing data to third parties for marketing purposes'
    ),
    policyBlock(
      'retention',
      4,
      'Retensi Data',
      'Data Retention',
      'Data pribadi disimpan selama akun aktif dan selama diperlukan untuk keperluan hukum. Kamu dapat meminta penghapusan data kapan saja — semua data pribadi akan dianonimisasi atau dihapus dari sistem, kecuali data yang wajib disimpan untuk keperluan hukum/perpajakan (faktur, bukti transaksi minimal 10 tahun).',
      'Personal data is stored as long as the account is active and as long as needed for legal purposes. You can request data deletion at any time — all personal data will be anonymized or deleted from the system, except data that must be stored for legal/tax purposes (invoices, transaction records for a minimum of 10 years).'
    ),
    policyBlock(
      'rights',
      5,
      'Hak kamu (UU PDP Pasal 5-13)',
      'Your Rights (UU PDP Articles 5-13)',
      '• Mendapatkan akses ke data pribadi kamu\n• Meminta perbaikan data yang tidak akurat\n• Meminta penghapusan data dalam kondisi tertentu\n• Menarik persetujuan kapan saja\n• Mengajukan keberatan atas pemrosesan tertentu\n• Mengajukan komplain ke otoritas perlindungan data',
      '• Access your personal data\n• Request correction of inaccurate data\n• Request deletion of data under certain conditions\n• Withdraw consent at any time\n• Object to certain processing\n• File a complaint with the data protection authority'
    ),
    policyBlock(
      'cookies',
      6,
      'Cookies',
      'Cookies',
      'Situs dapurdekaka.com menggunakan cookies untuk:\n\n• Fungsional — mengingat item keranjang dan preferensi bahasa\n• Analytics — memahami cara pengunjung menggunakan situs\n• Marketing — menayangkan iklan yang relevan (jika berlaku)\n\nKamu dapat menonaktifkan cookies melalui pengaturan browser.',
      'The dapurdekaka.com website uses cookies for:\n\n• Functional — remembering cart items and language preferences\n• Analytics — understanding how visitors use the site\n• Marketing — serving relevant advertisements (if applicable)\n\nYou can disable cookies through your browser settings.'
    ),
    policyBlock(
      'whatsapp',
      7,
      'WhatsApp Business',
      'WhatsApp Business',
      'Saat kamu menghubungi kami via WhatsApp, chat akan tercatat di WhatsApp Business untuk keperluan customer service. Data percakapan ditangani sesuai kebijakan privasi WhatsApp Business. Kami tidak menggunakan data WhatsApp untuk tujuan marketing.',
      'When you contact us via WhatsApp, chats are recorded on WhatsApp Business for customer service purposes. Conversation data is handled according to WhatsApp Business privacy policy. We do not use WhatsApp data for marketing purposes.'
    ),
    policyBlock(
      'changes',
      8,
      'Perubahan Kebijakan',
      'Policy Changes',
      'Kebijakan privasi ini dapat diperbarui sewaktu-waktu. Perubahan signifikan akan diumumkan melalui situs web dan/atau email. Penggunaan berkelanjutan atas layanan kami setelah perubahan merupakan persetujuan atas kebijakan terbaru.',
      'This privacy policy may be updated from time to time. Significant changes will be announced through the website and/or email. Continued use of our services after changes constitutes acceptance of the latest policy.'
    ),
    policyBlock(
      'contact',
      9,
      'Hubungi Kami',
      'Contact Us',
      'Untuk pertanyaan tentang kebijakan privasi atau mengajukan permintaan penghapusan data, hubungi:\n\nEmail: privasi@dapurdekaka.com\nWhatsApp: tersedia di footer situs\nAlamat: Jl. Sinom V No. 7, Turangga, Bandung 40261, Indonesia',
      'For questions about privacy policy or to request data deletion, contact:\n\nEmail: privasi@dapurdekaka.com\nWhatsApp: available in site footer\nAddress: Jl. Sinom V No. 7, Turangga, Bandung 40261, Indonesia'
    ),
  ],
};

export const REFUND_PAGE: CmsPageSeed = {
  slug: 'refund',
  title: 'Refund Policy',
  sections: [
    {
      sectionKey: 'header',
      sortOrder: 0,
      titleId: 'Kebijakan Pengembalian',
      titleEn: 'Refund Policy',
      bodyId: 'Terakhir diperbarui: Mei 2026',
      bodyEn: 'Last updated: May 2026',
    },
    policyBlock(
      'no_refund',
      1,
      'Makanan Frozen Tidak Dapat Dikembalikan',
      'Frozen Food Cannot Be Returned',
      'Mengingat sifat produk kami yang berupa makanan frozen (beku), semua produk Dapur Dekaka tidak dapat dikembalikan setelah diterima. Ini sesuai dengan regulasi keamanan pangan Indonesia yang tidak mengizinkan makanan beku yang telah meninggalkan rantai pendingin untuk dikembalikan ke peredaran perdagangan.',
      'Given the nature of our products as frozen food, all Dapur Dekaka products cannot be returned after receipt. This is in accordance with Indonesian food safety regulations that do not allow frozen food that has left the cold chain to be returned to trade.'
    ),
    policyBlock(
      'claimable',
      2,
      'Kondisi yang Dapat Diklaim',
      'Claimable Conditions',
      'Kami menerima klaim dalam kondisi berikut:\n\n• Produk yang diterima salah atau tidak sesuai pesanan\n• Kemasan rusak atau tidak kedap yang menyebabkan produk mencair\n• Produk yang diterima tidak lengkap dari yang dipesan\n\nBukti foto wajib dilampirkan saat mengklaim: foto kemasan luar, foto produk, dan foto label pengiriman.',
      'We accept claims under the following conditions:\n\n• Product received is wrong or not as ordered\n• Packaging is damaged or not airtight causing the product to thaw\n• Product received is incomplete from what was ordered\n\nPhoto evidence is required when claiming: outer packaging photo, product photo, and shipping label photo.'
    ),
    policyBlock(
      'how_to_claim',
      3,
      'Cara Mengajukan Klaim',
      'How to Submit a Claim',
      '1. Hubungi kami via WhatsApp dalam 24 jam setelah produk diterima\n2. Lampirkan foto-foto yang diperlukan (kemasan, produk, label pengiriman)\n3. Tim kami akan memverifikasi dalam 1x24 jam kerja\n4. Jika klaim disetujui, refund atau pengiriman ulang akan diproses',
      '1. Contact us via WhatsApp within 24 hours after product is received\n2. Attach the necessary photos (packaging, product, shipping label)\n3. Our team will verify within 1x24 business hours\n4. If the claim is approved, refund or reshipping will be processed'
    ),
    policyBlock(
      'timeline',
      4,
      'Timeline Refund',
      'Refund Timeline',
      'Setelah klaim disetujui, refund akan diproses dalam 1-7 hari kerja ke rekening pelanggan atau melalui metode pembayaran semula. Jika pembayaran dilakukan via Midtrans (kartu kredit, VA, dll), refund akan masuk sesuai kebijakan Midtrans (3-14 hari kerja).',
      'After the claim is approved, refund will be processed within 1-7 business days to the sender\'s account or through the original payment method. If payment is made via Midtrans (credit card, VA, etc.), refund will be credited according to Midtrans policy (3-14 business days).'
    ),
    policyBlock(
      'wrong_address',
      5,
      'Produk Tidak Diterima karena Alamat Salah',
      'Product Not Received Due to Wrong Address',
      'Jika paket dikembalikan karena alamat penerima tidak valid atau tidak dapat dijangkau, kami akan menghubungi kamu untuk konfirmasi ulang. Ongkos kirim kedua ditanggung oleh pembeli.',
      'If the package is returned because the recipient\'s address is invalid or unreachable, we will contact you for re-confirmation. Second shipping costs are borne by the buyer.'
    ),
  ],
};

export const TERMS_PAGE: CmsPageSeed = {
  slug: 'terms',
  title: 'Terms of Service',
  sections: [
    {
      sectionKey: 'header',
      sortOrder: 0,
      titleId: 'Syarat & Ketentuan',
      titleEn: 'Terms of Service',
      bodyId: 'Terakhir diperbarui: Mei 2026',
      bodyEn: 'Last updated: May 2026',
    },
    policyBlock(
      'general',
      1,
      'Ketentuan Umum',
      'General Terms',
      'Dengan menggunakan dapurdekaka.com, kamu setuju dengan syarat dan ketentuan ini. Dapur Dekaka berhak memperbarui syarat sewaktu-waktu; perubahan material akan diumumkan di situs.',
      'By using dapurdekaka.com, you agree to these terms. Dapur Dekaka may update these terms at any time; material changes will be announced on the site.'
    ),
    policyBlock(
      'orders',
      2,
      'Pesanan & Pembayaran',
      'Orders & Payment',
      'Semua pesanan tunduk pada ketersediaan stok. Harga final dikonfirmasi saat checkout. Pembayaran diproses via Midtrans; pesanan diproses setelah pembayaran terkonfirmasi.',
      'All orders are subject to stock availability. Final prices are confirmed at checkout. Payment is processed via Midtrans; orders are processed after payment is confirmed.'
    ),
    policyBlock(
      'shipping',
      3,
      'Pengiriman',
      'Shipping',
      'Produk frozen dikirim dengan kemasan insulasi dan ice gel. Estimasi waktu mengikuti kurir yang dipilih. Lihat halaman Janji Pelanggan (/trust) untuk SLA detail per tier pengiriman.',
      'Frozen products are shipped with insulated packaging and ice gel. Delivery estimates follow the selected courier. See the Customer Promise page (/trust) for detailed SLAs per shipping tier.'
    ),
    policyBlock(
      'liability',
      4,
      'Batas Tanggung Jawab',
      'Limitation of Liability',
      'Dapur Dekaka tidak bertanggung jawab atas keterlambatan di luar kendali kami (cuaca, force majeure, kegagalan kurir). Klaim produk tidak layak ditangani sesuai kebijakan pengembalian.',
      'Dapur Dekaka is not liable for delays beyond our control (weather, force majeure, courier failure). Claims for unfit products are handled per our refund policy.'
    ),
    policyBlock(
      'contact',
      5,
      'Kontak',
      'Contact',
      'Pertanyaan tentang syarat ini: privasi@dapurdekaka.com atau WhatsApp resmi Dapur Dekaka.',
      'Questions about these terms: privasi@dapurdekaka.com or official Dapur Dekaka WhatsApp.'
    ),
  ],
};

export const B2B_LANDING_PAGE: CmsPageSeed = {
  slug: 'b2b-landing',
  title: 'B2B Landing',
  sections: [
    {
      sectionKey: 'hero',
      sortOrder: 0,
      titleId: 'Kerjasama Bisnis\ndengan Dapur Dekaka',
      titleEn: 'Business Partnership\nwith Dapur Dekaka',
      bodyId:
        'Dapur Dekaka menyediakan produk frozen food berkualitas untuk hotel, restoran, catering, dan event organizer di seluruh Indonesia.',
      bodyEn:
        'Dapur Dekaka provides quality frozen food products for hotels, restaurants, caterers, and event organizers across Indonesia.',
      meta: { eyebrowId: 'B2B PARTNERSHIP', eyebrowEn: 'B2B PARTNERSHIP' },
      ctaLabelId: 'Minta Penawaran',
      ctaLabelEn: 'Request Quote',
      ctaHref: '#quote-form',
    },
    {
      sectionKey: 'benefits_header',
      sortOrder: 1,
      titleId: 'Mengapa Bermitra dengan Kami?',
      titleEn: 'Why Partner With Us?',
      bodyId: 'Kami siap menjadi partner bisnis jangka panjang Anda',
      bodyEn: 'We are ready to be your long-term business partner',
    },
    {
      sectionKey: 'benefit_0',
      sortOrder: 2,
      titleId: 'Pengiriman ke Seluruh Indonesia',
      titleEn: 'Nationwide Delivery',
      bodyId:
        'Kami mengirim ke semua kota besar di Indonesia dengan kemasan frozen yang menjaga kualitas produk.',
      bodyEn:
        'We ship to all major cities in Indonesia with frozen packaging that preserves product quality.',
      meta: { icon: 'Truck' },
    },
    {
      sectionKey: 'benefit_1',
      sortOrder: 3,
      titleId: '100% Halal & Berkualitas',
      titleEn: '100% Halal & Quality',
      bodyId: 'Semua produk bersertifikat halal dan dibuat dari bahan-bahan berkualitas tinggi.',
      bodyEn: 'All products are halal certified and made from high-quality ingredients.',
      meta: { icon: 'Shield' },
    },
    {
      sectionKey: 'benefit_2',
      sortOrder: 4,
      titleId: 'Dedicated Account Manager',
      titleEn: 'Dedicated Account Manager',
      bodyId: 'Anda akan mendapat kontak WhatsApp langsung untuk koordinasi pesanan.',
      bodyEn: 'You will receive a direct WhatsApp contact for order coordination.',
      meta: { icon: 'Users' },
    },
    {
      sectionKey: 'benefit_3',
      sortOrder: 5,
      titleId: 'Fleksibel & Responsive',
      titleEn: 'Flexible & Responsive',
      bodyId: 'Kami siap menerima pesanan dalam jumlah besar dengan waktu pengiriman yang fleksibel.',
      bodyEn: 'We are ready to accept large orders with flexible delivery schedules.',
      meta: { icon: 'Clock' },
    },
    {
      sectionKey: 'motion',
      sortOrder: 6,
      titleId: 'Untuk Restoran, Hotel, Catering, & Event',
      titleEn: 'For Restaurants, Hotels, Caterers & Events',
      bodyId:
        'Konsultasi personal, sampel gratis, dan harga spesial untuk volume besar. Chat WhatsApp untuk inquiry.',
      bodyEn:
        'Personal consultation, free samples, and volume pricing. Chat on WhatsApp to inquire.',
      ctaLabelId: 'Chat WhatsApp',
      ctaLabelEn: 'Chat WhatsApp',
      meta: {
        sampleCtaId: 'Minta Sampel',
        sampleCtaEn: 'Request Samples',
        priceSheetCtaId: 'Unduh Price Sheet PDF',
        priceSheetCtaEn: 'Download Price Sheet PDF',
        noteId: 'Untuk saat ini, semua order B2B melalui WhatsApp — belum ada portal self-service.',
        noteEn: 'For now, all B2B orders go through WhatsApp — no self-service portal yet.',
      },
    },
    {
      sectionKey: 'bottom_cta',
      sortOrder: 7,
      titleId: 'Siap Bermitra dengan Dapur Dekaka?',
      titleEn: 'Ready to Partner with Dapur Dekaka?',
      bodyId: 'Hubungi kami sekarang untuk diskusi lebih lanjut tentang kebutuhan bisnis Anda.',
      bodyEn: 'Contact us now to discuss your business needs further.',
      ctaLabelId: 'Chat via WhatsApp',
      ctaLabelEn: 'Chat via WhatsApp',
    },
  ],
};
