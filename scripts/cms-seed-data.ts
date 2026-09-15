/**
 * CMS page seed definitions migrated from i18n/messages (id + en).
 * Consumed by scripts/seed-cms.ts — not imported by runtime app code.
 */

export type { CmsPageSeed, CmsSectionSeed } from './cms-seed-types';
export { featureSections } from './cms-seed-types';

import type { CmsPageSeed } from './cms-seed-types';
import { featureSections } from './cms-seed-types';
import { TRUST_PAGE } from './cms-seed-data-trust';
import {
  PRIVACY_PAGE,
  REFUND_PAGE,
  TERMS_PAGE,
  B2B_LANDING_PAGE,
} from './cms-seed-data-policy';

const HOME_WHY: CmsPageSeed = {
  slug: 'home-why',
  title: 'Home — Why Dekaka',
  sections: [
    { sectionKey: 'header', sortOrder: 0, titleId: 'Kenapa Dapur Dekaka?', titleEn: 'Why Dapur Dekaka?' },
    ...featureSections('feature', [
      {
        titleId: '100% Halal',
        titleEn: '100% Halal',
        bodyId: 'Bersertifikat dan terjamin kehalalannya',
        bodyEn: 'Certified and guaranteed halal',
      },
      {
        titleId: 'Dikemas Frozen Fresh',
        titleEn: 'Frozen Fresh Packaging',
        bodyId: 'Kualitas terjaga sampai tujuan',
        bodyEn: 'Quality maintained to destination',
      },
      {
        titleId: 'Kirim ke Seluruh Indonesia',
        titleEn: 'Ship Across Indonesia',
        bodyId: 'Dari Bandung untuk Nusantara',
        bodyEn: 'From Bandung to the Nation',
      },
    ]),
  ],
};

const HOME_CTA: CmsPageSeed = {
  slug: 'home-cta',
  title: 'Home — CTA Blocks',
  sections: [
    {
      sectionKey: 'hero',
      sortOrder: 0,
      titleId: 'Siap Mencicipi Kelezatan Dapur Dekaka?',
      titleEn: 'Ready to Taste Dapur Dekaka\'s Finest?',
      bodyId: 'Pesan sekarang dan nikmati dimsum, siomay, dan bakso premium langsung di rumahmu',
      bodyEn: 'Order now and enjoy premium dimsum, siomay, and bakso right at your home',
      ctaLabelId: 'Jelajahi Produk',
      ctaLabelEn: 'Explore Products',
      ctaHref: '/products',
    },
    {
      sectionKey: 'continue_shopping',
      sortOrder: 1,
      titleId: 'Lanjutkan Belanja?',
      titleEn: 'Continue Shopping?',
      bodyId: 'Kamu punya {totalItems} item di keranjang. Lanjutkan belanja dan kumpulkan poin!',
      bodyEn: 'You have {totalItems} items in your cart. Continue shopping and collect points!',
      ctaLabelId: 'Lihat Keranjang',
      ctaLabelEn: 'View Cart',
      ctaHref: '/cart',
    },
    {
      sectionKey: 'retry_shopping',
      sortOrder: 2,
      titleId: 'Mau Pesan Lagi?',
      titleEn: 'Want to Order Again?',
      bodyId: 'Mau pesan lagi? Yuk jelajahi produk favoritmu.',
      bodyEn: 'Want to order again? Let\'s explore your favorite products.',
      ctaLabelId: 'Mulai Belanja',
      ctaLabelEn: 'Start Shopping',
      ctaHref: '/products',
    },
  ],
};

const ABOUT: CmsPageSeed = {
  slug: 'about',
  title: 'About Us',
  sections: [
    {
      sectionKey: 'hero',
      sortOrder: 0,
      titleId: 'Cita Rasa Warisan,\nKini di Rumahmu',
      titleEn: 'Heritage Flavors,\nNow at Your Home',
      bodyId:
        'Dapur Dekaka (德卡) adalah produsen frozen food premium Chinese-Indonesia dari Bandung, membawa resep turun-temurun dengan standar halal MUI untuk seluruh Indonesia.',
      bodyEn:
        'Dapur Dekaka (德卡) is a premium Chinese-Indonesian frozen food producer from Bandung, rooted in family recipes passed down for generations with MUI halal standards to all of Indonesia.',
      meta: { taglineId: 'Tentang Kami', taglineEn: 'About Us' },
      imagePublicId: 'dapurdekaka/gallery/gallery-01',
    },
    {
      sectionKey: 'story',
      sortOrder: 1,
      titleId: 'Cerita Dapur Dekaka',
      titleEn: 'The Dapur Dekaka Story',
      bodyId:
        'Berawal dari sebuah dapur kecil di Turangga, Bandung, Dapur Dekaka lahir dari mimpi untuk membawa cita rasa authentic Chinese-Indonesian ke setiap rumah tangga Indonesia.\n\nDengan pengalaman puluhan tahun meracik frozen food berkualitas, kami menyajikan produk-produk seperti dimsum, siomay, bakso, dan lumpia yang dibuat dari bahan-bahan pilihan dan proses produksi higienis.\n\nSetiap produk Dapur Dekaka dilengkapi sertifikasi halal dari MUI, sehingga kamu tidak perlu khawatir tentang kehalalan produk yang kami buat. Kami percaya bahwa kualitas dan keyakinan agama bukanlah pilihan — keduanya adalah standar.',
      bodyEn:
        'Starting from a small kitchen in Turangga, Bandung, Dapur Dekaka was born from a dream to bring authentic Chinese-Indonesian flavors to every Indonesian household.\n\nWith decades of experience crafting quality frozen food, we present products like dimsum, siomay, bakso, and lumpia made from selected ingredients and hygienic production processes.\n\nEvery Dapur Dekaka product carries MUI halal certification, so you never have to question its halal status. We believe quality and religious commitment are not optional — they are the standard.',
    },
    { sectionKey: 'values_header', sortOrder: 2, titleId: 'Nilai-Nilai Kami', titleEn: 'Our Values' },
    ...featureSections(
      'value',
      [
        {
          titleId: 'Bahan Pilihan',
          titleEn: 'Premium Ingredients',
          bodyId:
            'Kami hanya menggunakan bahan-bahan berkualitas tinggi, dipilih langsung oleh tenaga ahli kami untuk memastikan rasa dan tekstur yang sempurna.',
          bodyEn:
            'We only use high-quality ingredients, carefully selected by our experts to ensure perfect taste and texture.',
        },
        {
          titleId: 'Halal Terjamin',
          titleEn: 'Guaranteed Halal',
          bodyId:
            'Semua produk bersertifikat halal MUI. Kehalalan bukan sekadar label, tapi adalah janji kami kepada setiap pelanggan.',
          bodyEn:
            'All products are MUI halal certified. Halal is not just a label, it is our promise to every customer.',
        },
        {
          titleId: 'Cold Chain Terjaga',
          titleEn: 'Cold Chain Maintained',
          bodyId:
            'Dari dapur hingga pintu rumahmu, rantai dingin kami terjaga ketat untuk memastikan kesegaran dan kualitas produk.',
          bodyEn:
            'From our kitchen to your doorstep, our cold chain is strictly maintained to ensure the freshness and quality of our products.',
        },
        {
          titleId: 'Diproduksi di Bandung',
          titleEn: 'Produced in Bandung',
          bodyId:
            'Semua produk Dapur Dekaka diproduksi di fasilitas kami di Jl. Sinom V No. 7, Turangga, Bandung. Bandung dipilih bukan tanpa alasan — kota ini dikenal sebagai pusat kuliner Chinese-Indonesia terbaik di Indonesia, dan kami bangga menjadi bagian dari tradisi kuliner tersebut.',
          bodyEn:
            'All Dapur Dekaka products are produced at our facility at Jl. Sinom V No. 7, Turangga, Bandung. Bandung was chosen for a reason — the city is one of Indonesia\'s finest Chinese-Indonesian culinary centers, and we are proud to be part of that tradition.',
        },
      ],
      3
    ),
    {
      sectionKey: 'halal_cert',
      sortOrder: 7,
      titleId: 'Sertifikasi Halal',
      titleEn: 'Halal Certification',
      bodyId: 'Majelis Ulama Indonesia (MUI)',
      bodyEn: 'Indonesian Ulema Council (MUI)',
    },
    {
      sectionKey: 'cta',
      sortOrder: 8,
      titleId: 'Siap mencicipi frozen food premium kami?',
      titleEn: 'Ready to taste our premium frozen food?',
      bodyId:
        'Pesan sekarang dan nikmati dimsum premium dari Bandung. Dikirim ke seluruh Indonesia dengan cold chain terjaga.',
      bodyEn:
        'Order now and enjoy free shipping on your first purchase. Shipped across Indonesia with maintained cold chain.',
      ctaLabelId: 'Lihat Produk',
      ctaLabelEn: 'View Products',
      ctaHref: '/products',
      meta: { secondaryCtaId: 'Chat WhatsApp', secondaryCtaEn: 'Chat WhatsApp' },
    },
  ],
};

export const CMS_PAGE_SEEDS: readonly CmsPageSeed[] = [
  HOME_WHY,
  HOME_CTA,
  ABOUT,
  TRUST_PAGE,
  PRIVACY_PAGE,
  REFUND_PAGE,
  TERMS_PAGE,
  B2B_LANDING_PAGE,
];

export interface GalleryImageSeed {
  publicId: string;
  altId: string;
  altEn: string;
  sortOrder: number;
  usage: 'instagram_feed' | 'about_hero' | 'og' | 'general';
}

export const GALLERY_IMAGE_SEEDS: readonly GalleryImageSeed[] = [
  ...([1, 2, 3, 4, 5, 6] as const).map((n) => {
    const id = String(n).padStart(2, '0');
    return {
      publicId: `dapurdekaka/gallery/gallery-${id}`,
      altId: `Galeri Dapur Dekaka ${n}`,
      altEn: `Dapur Dekaka gallery ${n}`,
      sortOrder: n,
      usage: 'instagram_feed' as const,
    };
  }),
  {
    publicId: 'dapurdekaka/gallery/gallery-01',
    altId: 'Hero Tentang Kami — Dapur Dekaka',
    altEn: 'About Us hero — Dapur Dekaka',
    sortOrder: 1,
    usage: 'about_hero' as const,
  },
];
