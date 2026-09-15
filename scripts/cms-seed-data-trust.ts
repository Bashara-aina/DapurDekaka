/**
 * Trust / Customer Promise Charter CMS seed.
 */

import type { CmsPageSeed } from './cms-seed-types';
import { listSections } from './cms-seed-types';

const WE_PROMISE_ID = [
  'Semua produk halal dan diproduksi Dapur Dekaka Bandung — produk sama dengan offline/Shopee.',
  'Setiap paket dikemas beku dengan ice gel dan kemasan insulasi, difoto sebelum kirim.',
  'Pesanan pickup siap sesuai jam operasional; kode pickup = nomor pesanan.',
  'Kilat (Bandung): dikemas dan dijemput kurir di hari yang sama jika dibayar sebelum cut-off (jam cut-off tayang di checkout).',
  'Frozen Same-Day (Paxel/AnterAja): diserahkan ke kurir cold-chain hari yang sama/H+1 sebelum jam cut-off.',
  'Frozen Express (antar kota): dikirim H+1 maksimal, dengan packing khusus perjalanan 1–2 hari.',
  'Nomor resi dan link tracking dikirim via WA + email begitu kurir dibooking.',
  'Jika produk tiba tidak layak (basi/cair karena kegagalan kirim kami), kami ganti atau refund penuh — langsung.',
  'Semua pembayaran diproses Midtrans; kami tidak pernah minta transfer manual di luar sistem.',
  'Pertanyaan WA dijawab dalam jam operasional, maksimal H+1.',
  'Harga website selalu di bawah harga Shopee untuk produk yang sama.',
  'Pembatalan sebelum dikirim = refund penuh (diproses 1–7 hari kerja).',
] as const;

const WE_PROMISE_EN = [
  'All products are halal and made in our Bandung facility — the same product as in our offline store and Shopee.',
  'Every order is packed frozen with ice gel and insulated packaging, photographed before dispatch.',
  'Pickup orders are ready during operating hours; your pickup code is your order number.',
  'Kilat (Bandung): packed and picked up by the courier the same day when paid before the cut-off (visible at checkout).',
  'Frozen Same-Day (Paxel/AnterAja): handed to the cold-chain courier same day or next day before the cut-off.',
  'Frozen Express (intercity): dispatched by next day at the latest, with packing rated for 1–2 day travel.',
  'Tracking number and link are sent via WhatsApp and email as soon as the courier is booked.',
  'If your order arrives damaged or thawed due to our shipping failure, we replace or refund in full — no debate.',
  'All payments are processed by Midtrans; we never ask for manual transfers outside the system.',
  'WhatsApp questions are answered within operating hours, by the next business day at the latest.',
  'Our website price is always below Shopee for the same product.',
  'Cancellations before dispatch = full refund (processed within 1–7 business days).',
] as const;

const WE_DO_NOT_ID = [
  'Jam tiba spesifik — hanya rentang estimasi kurir.',
  'Produk "tetap beku" saat tiba via kurir motor (Kilat) — kami jamin metode packing, bukan suhu saat tiba.',
  'Gratis ongkir atau subsidi ongkir ala marketplace.',
  'Ongkir sama dengan tarif publik kurir — ongkir kami termasuk penanganan frozen.',
  'Pengiriman ke daerah di luar cakupan layanan kami.',
  'Same-day di hari libur/di luar jam operasional.',
  'COD di luar area pengiriman lokal yang mendukung.',
  'Kompensasi untuk keterlambatan murni di sisi kurir (kami bantu eskalasi, refund case-by-case).',
  'Perubahan alamat setelah kurir dibooking.',
  'Stok selalu tersedia — stok real-time bisa habis.',
  'Respon WA 24 jam.',
  'Harga sama dengan toko offline.',
] as const;

const WE_DO_NOT_EN = [
  'Specific arrival times — only courier-provided estimates.',
  'Products arriving "still frozen" via motorcycle couriers (Kilat) — we guarantee the packing method, not the arrival temperature.',
  'Free shipping or marketplace-style shipping subsidies.',
  'Shipping rates that match public courier lists — our rate covers frozen handling on top.',
  'Shipping to destinations outside our coverage area (hard block, not "try anyway").',
  'Same-day delivery on public holidays or outside operating hours.',
  'Cash on delivery (COD) outside eligible local delivery areas.',
  'Compensation for courier-only delays (we escalate; refund decisions are case-by-case).',
  'Address changes after the courier has been booked.',
  'Permanent stock availability — real-time stock can sell out.',
  '24/7 WhatsApp response.',
  'Website price matching the offline store (offline stays cheapest — by design).',
] as const;

export const TRUST_PAGE: CmsPageSeed = {
  slug: 'trust',
  title: 'Customer Promise Charter',
  sections: [
    {
      sectionKey: 'header',
      sortOrder: 0,
      titleId: 'Janji Kami ke Pelanggan',
      titleEn: 'Our Customer Promise',
      bodyId:
        'Apa yang Dapur Dekaka janjikan — dan apa yang tidak. Kami percaya janji yang terlalu tinggi lebih merugikan daripada yang terlalu rendah.',
      bodyEn:
        'What Dapur Dekaka promises — and what it doesn\'t. We believe over-promising hurts customers more than under-promising.',
      meta: {
        disclaimerId:
          'Piagam Janji Pelanggan ini berisi komitmen kami, SLA pengiriman, dan cara kami menangani setiap keluhan.',
        disclaimerEn:
          'This Customer Promise Charter outlines our commitments, shipping SLAs, and how we handle concerns.',
      },
    },
    { sectionKey: 'we_promise_header', sortOrder: 1, titleId: 'Kami Berjanji', titleEn: 'Our Promise' },
    ...listSections('we_promise', WE_PROMISE_ID, WE_PROMISE_EN, 2, 'we_promise'),
    {
      sectionKey: 'we_do_not_header',
      sortOrder: 14,
      titleId: 'Kami Tidak Berjanji',
      titleEn: 'What We Don\'t Promise',
    },
    ...listSections('we_do_not', WE_DO_NOT_ID, WE_DO_NOT_EN, 15, 'we_do_not'),
    { sectionKey: 'sla_header', sortOrder: 27, titleId: 'Janji Waktu per-Tier', titleEn: 'SLA by Tier' },
    {
      sectionKey: 'sla_pickup',
      sortOrder: 28,
      titleId: 'Ambil di Toko',
      titleEn: 'Pickup at Store',
      bodyId: 'Siap diambil hari ini selama jam buka setelah pembayaran terkonfirmasi.',
      bodyEn: 'Ready for pickup today during opening hours after payment is confirmed.',
    },
    {
      sectionKey: 'sla_kilat',
      sortOrder: 29,
      titleId: 'Kilat (Bandung, kurir motor)',
      titleEn: 'Kilat (Bandung, motorcycle courier)',
      bodyId:
        'Tiba 1–3 jam setelah kurir pickup (area Bandung). Dikemas cooler bag + ice gel; kurir motor tanpa pendingin aktif — mohon langsung simpan di freezer.',
      bodyEn:
        'Arrives 1–3 hours after courier pickup (Bandung area). Packed in cooler bag + ice gel; motorcycle courier has no active cooling — please store in freezer immediately.',
    },
    {
      sectionKey: 'sla_frozen_same_day',
      sortOrder: 30,
      titleId: 'Frozen Same-Day',
      titleEn: 'Frozen Same-Day',
      bodyId: 'Tiba hari ini/besok via kurir cold-chain (Paxel/AnterAja). Estimasi mengikuti kurir.',
      bodyEn: 'Arrives today or tomorrow via cold-chain courier (Paxel/AnterAja). Estimated by courier.',
    },
    {
      sectionKey: 'sla_frozen_express',
      sortOrder: 31,
      titleId: 'Frozen Express',
      titleEn: 'Frozen Express',
      bodyId: 'Tiba 1–2 hari via layanan frozen antar kota. Dikemas untuk perjalanan hingga 48 jam.',
      bodyEn: 'Arrives within 1–2 days via intercity frozen service. Packed for up to 48 hours of transit.',
    },
    { sectionKey: 'dispute_header', sortOrder: 32, titleId: 'Panduan Penanganan', titleEn: 'Dispute Playbook' },
    {
      sectionKey: 'dispute_spoilage',
      sortOrder: 33,
      titleId: 'Dimsum saya cair/basi',
      titleEn: 'My dimsum arrived melted or spoiled',
      bodyId:
        'Refund-first. Minta foto, jangan debat suhu. Ganti/refund penuh dalam 24 jam + WA personal dari owner. Setiap klaim dicatat dan ditangani segera.',
      bodyEn:
        'Refund-first. Ask for photos — don\'t argue about temperature. Replace or refund in full within 24 hours plus a personal WhatsApp from the owner. Every claim is documented and handled promptly.',
    },
    {
      sectionKey: 'dispute_ongkir',
      sortOrder: 34,
      titleId: 'Kenapa ongkir lebih mahal dari Shopee?',
      titleEn: 'Why is shipping more expensive than Shopee?',
      bodyId:
        'Ongkir kami sudah termasuk packing frozen (ice gel + insulasi) dan hanya pakai layanan yang aman untuk frozen. Total harga produk + ongkir tetap lebih murah dari Shopee.',
      bodyEn:
        'Our shipping includes frozen handling (ice gel + insulation) and only uses couriers proven safe for frozen. Total product + shipping is still below Shopee.',
    },
    {
      sectionKey: 'dispute_lost',
      sortOrder: 35,
      titleId: 'Paket belum sampai, resi tidak jalan',
      titleEn: 'Package hasn\'t arrived, no tracking movement',
      bodyId:
        'Kami eskalasi ke kurir hari itu juga; update tiap hari via WA. Jika hilang: refund/kirim ulang, klaim ke kurir urusan kami, bukan customer.',
      bodyEn:
        'We escalate with the courier the same day; daily WhatsApp updates. If lost: refund or resend, and we handle the courier claim — never push it onto the customer.',
    },
    {
      sectionKey: 'dispute_wrong_item',
      sortOrder: 36,
      titleId: 'Salah item / kurang',
      titleEn: 'Wrong item / shortage',
      bodyId: 'Foto — kirim susulan atau refund selisih, hari itu. Tanpa ribet, tanpa potongan.',
      bodyEn: 'Photos — send replacement or refund the difference, same day. No hassle, no deduction.',
    },
    {
      sectionKey: 'dispute_negotiate',
      sortOrder: 37,
      titleId: 'Bisa nego / harga offline?',
      titleEn: 'Can you negotiate / match offline price?',
      bodyId:
        'Harga offline hanya di toko. Website sudah termurah untuk pesan-antar. Sebagai gantinya ada poin loyalti.',
      bodyEn:
        'Offline pricing is in-store only. The website is the cheapest channel for delivered orders. Loyalty points exist for repeat customers.',
    },
    {
      sectionKey: 'contact_cta',
      sortOrder: 38,
      titleId: 'Kalau Ada Apa-Apa, Hubungi Kami via WhatsApp',
      titleEn: 'Questions? Contact Us on WhatsApp',
      ctaLabelId: 'Chat WhatsApp',
      ctaLabelEn: 'Chat WhatsApp',
    },
  ],
};
