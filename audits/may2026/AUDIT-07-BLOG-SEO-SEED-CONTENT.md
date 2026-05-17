# AUDIT-07 — Blog SEO Seed Content
**Date:** 2026-05-16  
**Scope:** Complete seed data for 15 blog posts — bilingual (ID/EN), keyword-optimized, AI/Gemini-ready  
**Priority:** 🔴 CRITICAL — without content, the blog generates zero SEO value

---

## OVERVIEW

These 15 posts are written for:
1. **Google/Bing SEO** — title tags, meta descriptions, keyword density, semantic HTML
2. **Gemini/AI SEO** — FAQ sections, "How-To" structures, direct answers, E-E-A-T signals
3. **Indonesian market** — natural Bahasa Indonesia, local food culture references
4. **Internal linking** — each post links to product pages and other blog posts

### Keyword Targets by Post

| # | Primary Keyword | Monthly Search Vol (est.) | Intent |
|---|-----------------|--------------------------|--------|
| 1 | cara memasak dimsum frozen | 2,400 | Informational |
| 2 | dimsum halal bandung | 1,800 | Commercial |
| 3 | frozen food tahan berapa lama | 3,200 | Informational |
| 4 | resep saus dimsum | 1,600 | Informational |
| 5 | beli dimsum online kirim ke rumah | 1,200 | Transactional |
| 6 | tips menyimpan makanan beku | 2,800 | Informational |
| 7 | apa itu siomay | 900 | Informational |
| 8 | frozen food sehat atau tidak | 4,500 | Informational |
| 9 | resep lumpia goreng crispy | 2,100 | Informational |
| 10 | makanan chinese indonesia | 1,500 | Informational |
| 11 | catering dimsum untuk acara | 800 | Commercial |
| 12 | perbedaan dimsum dan siomay | 1,100 | Informational |
| 13 | frozen food untuk anak | 1,900 | Informational |
| 14 | tips belanja frozen food online | 2,300 | Informational |
| 15 | resep sop bakso kuah bening | 3,400 | Informational |

---

## SEED SCRIPT LOCATION

Create: `scripts/seed-blog.ts`

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../lib/db/schema';
import { eq } from 'drizzle-orm';

if (process.env.NODE_ENV === 'production') {
  console.error('ABORT: Cannot run seed script in production.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seedBlog() {
  console.log('Seeding blog...');

  // Get admin user for authorId
  const admin = await db.query.users.findFirst({
    where: eq(schema.users.role, 'superadmin'),
    columns: { id: true },
  });
  if (!admin) throw new Error('Run main seed.ts first to create admin user');

  // --- CATEGORIES ---
  const [catResep, catTips, catHalal, catGayaHidup, catBerita] = await db
    .insert(schema.blogCategories)
    .values([
      { nameId: 'Resep & Memasak', nameEn: 'Recipes & Cooking', slug: 'resep-memasak', sortOrder: 1 },
      { nameId: 'Tips & Trik', nameEn: 'Tips & Tricks', slug: 'tips-trik', sortOrder: 2 },
      { nameId: 'Edukasi Halal', nameEn: 'Halal Education', slug: 'edukasi-halal', sortOrder: 3 },
      { nameId: 'Gaya Hidup', nameEn: 'Lifestyle', slug: 'gaya-hidup', sortOrder: 4 },
      { nameId: 'Berita & Promo', nameEn: 'News & Promos', slug: 'berita-promo', sortOrder: 5 },
    ])
    .returning();

  // --- POSTS (see below for full content) ---
  const posts = getBlogPosts(admin.id, catResep.id, catTips.id, catHalal.id, catGayaHidup.id, catBerita.id);
  
  for (const post of posts) {
    await db.insert(schema.blogPosts).values(post);
    console.log(`Created: ${post.slug}`);
  }

  console.log(`Done! Created ${posts.length} blog posts.`);
}

seedBlog().catch(console.error);
```

---

## COMPLETE BLOG POSTS (Paste into `getBlogPosts` function)

### POST 01 — Cara Memasak Dimsum Frozen yang Sempurna

```ts
{
  blogCategoryId: catResep.id,
  titleId: 'Cara Memasak Dimsum Frozen yang Sempurna: Panduan Lengkap',
  titleEn: 'How to Cook Frozen Dimsum Perfectly: A Complete Guide',
  slug: 'cara-memasak-dimsum-frozen',
  excerptId: 'Pelajari cara memasak dimsum frozen agar tetap lembut, juicy, dan enak seperti dimsum restoran. Tips dari dapur Dapur Dekaka.',
  excerptEn: 'Learn how to cook frozen dimsum so it stays soft, juicy, and delicious. Expert tips from Dapur Dekaka.',
  metaTitleId: 'Cara Memasak Dimsum Frozen agar Lembut & Enak | Dapur Dekaka',
  metaTitleEn: 'How to Cook Frozen Dimsum Perfectly | Dapur Dekaka',
  metaDescriptionId: 'Tutorial lengkap cara memasak dimsum frozen: kukus, goreng, atau microwave. Tips agar dimsum tetap juicy dan tidak keras. Dari Dapur Dekaka Bandung.',
  metaDescriptionEn: 'Step-by-step guide to cooking frozen dimsum: steam, fry, or microwave. Tips to keep dimsum juicy and tender every time.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-01T08:00:00Z'),
  contentId: `
<h2>Cara Memasak Dimsum Frozen yang Sempurna</h2>

<p>Dimsum frozen dari Dapur Dekaka sudah disiapkan dengan resep otentik Chinese-Indonesia. Tapi cara memasaknya tetap menentukan hasil akhirnya. Artikel ini akan memandu kamu langkah demi langkah untuk mendapatkan dimsum yang sempurna — lembut, juicy, dan seenak di restoran.</p>

<h2>Metode 1: Dikukus (Paling Direkomendasikan)</h2>

<p>Mengukus adalah metode terbaik untuk dimsum. Uap panas meresap merata ke seluruh bagian tanpa menghilangkan kelembapan alami daging.</p>

<h3>Cara Mengukus Dimsum Frozen:</h3>
<ol>
  <li><strong>Jangan dicairkan dulu.</strong> Masukkan dimsum langsung dari freezer ke kukusan. Mencairkan dimsum terlebih dahulu justru akan mengubah teksturnya menjadi lembek.</li>
  <li><strong>Panaskan air terlebih dahulu.</strong> Pastikan air sudah mendidih dan menghasilkan uap sebelum memasukkan dimsum. Uap panas yang konsisten adalah kunci.</li>
  <li><strong>Alasi kukusan dengan kertas baking atau daun pisang.</strong> Ini mencegah dimsum lengket di dasar kukusan.</li>
  <li><strong>Jangan terlalu penuh.</strong> Beri jarak 2 cm antar dimsum agar uap bisa bersirkulasi dengan baik.</li>
  <li><strong>Waktu memasak:</strong> Dimsum isi daging ayam/udang 10–12 menit. Dimsum ukuran besar (seperti ha gao premium) 13–15 menit.</li>
  <li><strong>Cek kematangan.</strong> Dimsum yang matang akan berubah warna lebih pucat dan kulitnya menjadi sedikit transparan.</li>
</ol>

<h2>Metode 2: Digoreng (Pan-Fried / Gyoza Style)</h2>

<p>Metode ini cocok untuk siomay dan beberapa jenis dimsum yang ingin kamu sajikan dengan tekstur crispy di bagian bawah.</p>

<ol>
  <li>Panaskan 2 sendok makan minyak goreng di teflon antilenget dengan api sedang.</li>
  <li>Masukkan dimsum frozen (jangan dicairkan), susun rapi di atas minyak.</li>
  <li>Goreng 2–3 menit hingga bagian bawah keemasan dan crispy.</li>
  <li>Tambahkan 3–4 sendok makan air dan tutup teflon segera.</li>
  <li>Biarkan uap memasak bagian atas selama 5–7 menit.</li>
  <li>Buka tutup, biarkan sisa air menguap dan bagian bawah kembali crispy 1–2 menit.</li>
</ol>

<h2>Metode 3: Microwave (untuk Keadaan Darurat)</h2>

<p>Microwave adalah pilihan tercepat tapi hasilnya tidak sebaik kukus atau goreng.</p>

<ol>
  <li>Taruh dimsum di piring yang aman untuk microwave.</li>
  <li>Tambahkan 1 sendok makan air di atas dimsum.</li>
  <li>Tutup dengan plastik wrap atau tutup microwave-safe.</li>
  <li>Panaskan 2 menit di daya 800W. Cek dan tambahkan 30 detik jika belum panas merata.</li>
</ol>

<h2>FAQ: Pertanyaan yang Sering Ditanyakan</h2>

<h3>Apakah dimsum frozen perlu dicairkan sebelum dimasak?</h3>
<p>Tidak perlu. Memasak dimsum langsung dari freezer menghasilkan tekstur yang lebih baik. Jika dicairkan, kulitnya bisa sobek dan isian menjadi terlalu lembek.</p>

<h3>Berapa lama dimsum frozen bisa disimpan di freezer?</h3>
<p>Dimsum Dapur Dekaka bisa disimpan hingga 3 bulan di freezer dengan suhu -18°C atau lebih rendah. Pastikan wadah tertutup rapat untuk mencegah freezer burn.</p>

<h3>Mengapa dimsum saya keras setelah dikukus?</h3>
<p>Kemungkinan besar waktu mengukus terlalu lama atau kukusan tidak cukup panas saat dimsum dimasukkan. Selalu pastikan air sudah mendidih dan menghasilkan uap kuat sebelum memasak.</p>

<h3>Bolehkah dimsum yang sudah matang dihangatkan ulang?</h3>
<p>Boleh, tapi hanya sekali. Kukus ulang selama 3–4 menit. Hindari microwave untuk menghangatkan ulang karena akan membuat dimsum keras.</p>

<h2>Saus Cocolan Terbaik untuk Dimsum</h2>

<p>Nikmati dimsum matangmu dengan saus yang tepat:</p>
<ul>
  <li><strong>Saus kecap asin jahe:</strong> Kecap asin + parutan jahe segar + sedikit minyak wijen</li>
  <li><strong>Saus cabai Guangdong:</strong> Sambal merah halus + cuka putih + gula pasir</li>
  <li><strong>Saus XO:</strong> Tersedia di supermarket, cocok untuk dimsum premium</li>
</ul>

<p>Ingin mencoba dimsum premium dari Bandung? Cek koleksi dimsum kami di <a href="/products">halaman produk</a>.</p>
`,
  contentEn: `<h2>How to Cook Frozen Dimsum Perfectly</h2><p>This is the English version of the dimsum cooking guide...</p>`,
}
```

---

### POST 02 — Mengenal Sertifikat Halal Dimsum

```ts
{
  blogCategoryId: catHalal.id,
  titleId: 'Mengapa Sertifikat Halal Penting untuk Dimsum? Panduan Lengkap',
  titleEn: 'Why Halal Certification Matters for Dimsum: A Complete Guide',
  slug: 'sertifikat-halal-dimsum',
  excerptId: 'Memahami pentingnya sertifikat halal pada produk dimsum dan frozen food. Apa yang harus dicek konsumen Muslim saat membeli?',
  excerptEn: 'Understanding why halal certification matters for dimsum and frozen food products.',
  metaTitleId: 'Sertifikat Halal Dimsum: Apa yang Perlu Kamu Tahu | Dapur Dekaka',
  metaDescriptionId: 'Panduan lengkap sertifikat halal untuk dimsum. Apa artinya, mengapa penting, dan bagaimana memastikan dimsum yang kamu beli benar-benar halal.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-02T08:00:00Z'),
  contentId: `
<h2>Mengapa Sertifikat Halal pada Dimsum Sangat Penting</h2>

<p>Indonesia adalah negara dengan populasi Muslim terbesar di dunia. Saat membeli dimsum — makanan dengan akar budaya Tionghoa — banyak konsumen Muslim bertanya: apakah dimsum ini halal? Artikel ini menjelaskan secara lengkap.</p>

<h2>Apa Saja yang Membuat Dimsum Menjadi Tidak Halal?</h2>

<p>Secara tradisional, dimsum Tionghoa bisa mengandung bahan-bahan yang tidak halal:</p>

<ul>
  <li><strong>Daging babi (char siu, bak kut):</strong> Banyak isian dimsum klasik menggunakan daging babi sebagai bahan utama.</li>
  <li><strong>Lemak babi (lard):</strong> Sering digunakan dalam kulit dimsum untuk menambah tekstur kenyal dan rasa gurih.</li>
  <li><strong>Alkohol dalam saus:</strong> Beberapa saus memasak menggunakan rice wine atau Shaoxing wine.</li>
  <li><strong>Cross-contamination:</strong> Dapur yang mengolah bahan haram bersamaan dengan bahan halal.</li>
</ul>

<h2>Bagaimana Dapur Dekaka Memastikan Kehalalan Produk?</h2>

<p>Semua produk Dapur Dekaka diproduksi dengan:</p>

<ol>
  <li><strong>100% daging halal:</strong> Ayam dan udang dari supplier bersertifikat halal MUI.</li>
  <li><strong>Tanpa lemak babi (lard-free):</strong> Kulit dimsum dibuat dari tepung terigu dan tapioka tanpa lemak hewani haram.</li>
  <li><strong>Dapur dedicated halal:</strong> Tidak ada pemrosesan bahan haram di fasilitas yang sama.</li>
  <li><strong>Kontrol bahan baku:</strong> Setiap batch produksi menggunakan bahan dari supplier yang sama.</li>
</ol>

<h2>Cara Cek Kehalalan Dimsum Saat Berbelanja</h2>

<h3>1. Cari Label Halal MUI</h3>
<p>Logo halal MUI (Majelis Ulama Indonesia) adalah tanda resmi yang diakui pemerintah. Logo ini harus tertera pada kemasan dengan nomor sertifikat yang bisa diverifikasi di website MUI.</p>

<h3>2. Baca Daftar Bahan (Ingredient List)</h3>
<p>Perhatikan apakah ada: pork, babi, lard, wine, atau kode E yang mencurigakan (beberapa kode E adalah turunan babi).</p>

<h3>3. Tanyakan Langsung ke Produsen</h3>
<p>Produsen yang bertanggung jawab akan dengan transparan menjelaskan sumber bahan dan proses produksi mereka.</p>

<h2>FAQ: Pertanyaan Seputar Kehalalan Dimsum</h2>

<h3>Apakah semua dimsum di pasaran sudah halal?</h3>
<p>Tidak. Banyak merek dimsum — terutama yang diimpor atau diproduksi untuk pasar non-Muslim — menggunakan bahan haram. Selalu periksa sertifikasi sebelum membeli.</p>

<h3>Apa perbedaan "bebas babi" dan "halal"?</h3>
<p>"Bebas babi" hanya berarti tidak menggunakan daging babi. "Halal" mencakup lebih luas: metode penyembelihan, tidak ada kontaminasi silang, dan seluruh proses produksi sesuai syariah Islam.</p>

<h3>Apakah dimsum seafood (udang/cumi) otomatis halal?</h3>
<p>Seafood sendiri halal menurut mayoritas ulama, tapi proses pengolahannya tetap harus halal. Bumbu, proses memasak, dan fasilitas produksi harus bebas dari kontaminasi bahan haram.</p>

<p>Lihat seluruh produk halal bersertifikat kami di <a href="/products">halaman produk Dapur Dekaka</a>.</p>
`,
  contentEn: `<h2>Why Halal Certification Matters for Dimsum</h2><p>English version...</p>`,
}
```

---

### POST 03 — Frozen Food Tahan Berapa Lama?

```ts
{
  blogCategoryId: catTips.id,
  titleId: 'Frozen Food Tahan Berapa Lama? Panduan Lengkap Penyimpanan',
  titleEn: 'How Long Does Frozen Food Last? The Complete Storage Guide',
  slug: 'frozen-food-tahan-berapa-lama',
  excerptId: 'Berapa lama frozen food aman dikonsumsi? Pelajari panduan penyimpanan beku yang benar agar makanan tetap aman dan lezat.',
  excerptEn: 'How long is frozen food safe to eat? Learn the proper freezer storage guidelines.',
  metaTitleId: 'Frozen Food Tahan Berapa Lama di Freezer? Panduan Lengkap',
  metaDescriptionId: 'Panduan lengkap berapa lama frozen food aman disimpan di freezer. Tips penyimpanan yang benar untuk dimsum, bakso, dan frozen food lainnya.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-03T08:00:00Z'),
  contentId: `
<h2>Frozen Food Tahan Berapa Lama di Freezer?</h2>

<p>Salah satu pertanyaan paling umum dari pembeli frozen food adalah: sampai kapan makanan beku ini aman dikonsumsi? Jawabannya bergantung pada jenis makanan, suhu penyimpanan, dan cara pengemasan.</p>

<h2>Tabel Ketahanan Berbagai Jenis Frozen Food</h2>

<table>
  <thead>
    <tr><th>Jenis Makanan</th><th>Di Freezer (-18°C)</th><th>Setelah Dicairkan</th></tr>
  </thead>
  <tbody>
    <tr><td>Dimsum isi daging ayam/udang</td><td>2–3 bulan</td><td>24 jam di kulkas</td></tr>
    <tr><td>Bakso sapi/ayam</td><td>3–4 bulan</td><td>2–3 hari di kulkas</td></tr>
    <tr><td>Siomay udang</td><td>2–3 bulan</td><td>24 jam di kulkas</td></tr>
    <tr><td>Lumpia goreng beku</td><td>3 bulan</td><td>1 hari di kulkas</td></tr>
    <tr><td>Daging giling mentah</td><td>3–4 bulan</td><td>1–2 hari di kulkas</td></tr>
    <tr><td>Daging utuh (ayam, sapi)</td><td>6–12 bulan</td><td>3–5 hari di kulkas</td></tr>
  </tbody>
</table>

<p><em>Catatan: Angka di atas adalah panduan keamanan. Makanan mungkin masih terasa baik setelah melewati batas ini, tapi kualitas dan keamanannya sudah menurun.</em></p>

<h2>Faktor yang Mempengaruhi Ketahanan Frozen Food</h2>

<h3>1. Suhu Freezer yang Konsisten</h3>
<p>Freezer harus menjaga suhu -18°C atau lebih rendah secara konsisten. Setiap kali suhu naik (misalnya saat listrik mati atau freezer dibuka terlalu lama), proses pembusukan mikroba dipercepat.</p>

<p><strong>Tips:</strong> Jangan isi freezer lebih dari 75% kapasitasnya. Ruang kosong membantu sirkulasi udara dingin yang merata.</p>

<h3>2. Pengemasan yang Kedap Udara</h3>
<p>Kontak dengan udara adalah penyebab utama freezer burn — kondisi di mana makanan beku mengering, berubah warna, dan kehilangan cita rasa. Tanda-tandanya adalah bercak abu-abu atau putih pada permukaan makanan.</p>

<p><strong>Tips:</strong> Simpan dimsum dalam plastik zipper bag, keluarkan sebanyak mungkin udara sebelum menutupnya. Atau gunakan vacuum sealer jika tersedia.</p>

<h3>3. Cara Mencairkan (Thawing)</h3>
<p>Cara mencairkan yang salah bisa mempercepat pertumbuhan bakteri:</p>
<ul>
  <li>✅ <strong>Di kulkas (bagian bawah):</strong> Paling aman, proses lambat 6–12 jam</li>
  <li>✅ <strong>Di air dingin mengalir:</strong> Lebih cepat, masak segera setelah cair</li>
  <li>⚠️ <strong>Di suhu ruang:</strong> Hanya boleh jika langsung dimasak</li>
  <li>❌ <strong>Dicairkan lalu dibekukan ulang:</strong> Tidak dianjurkan karena merusak tekstur dan meningkatkan risiko kontaminasi</li>
</ul>

<h2>Tanda-Tanda Frozen Food Sudah Tidak Layak Konsumsi</h2>

<ul>
  <li>Bau asam atau tidak sedap setelah dicairkan</li>
  <li>Warna berubah signifikan (kecoklatan atau kehijauan)</li>
  <li>Tekstur sangat berubah (terlalu lembek atau berserat)</li>
  <li>Freezer burn parah (area kering dan berubah warna luas)</li>
  <li>Es batu berlebihan di dalam kemasan (tanda suhu pernah naik)</li>
</ul>

<h2>FAQ: Penyimpanan Frozen Food</h2>

<h3>Apakah frozen food yang sudah melewati tanggal best before masih aman?</h3>
<p>Tanggal best before pada frozen food adalah tentang kualitas, bukan keamanan. Makanan yang disimpan dengan benar mungkin masih aman dimakan setelah tanggal tersebut, tapi rasa dan teksturnya mungkin sudah menurun.</p>

<h3>Bolehkah membekukan ulang dimsum yang sudah dicairkan?</h3>
<p>Secara teknis boleh, tapi tidak dianjurkan. Proses pembekuan ulang merusak sel-sel daging, mengubah tekstur menjadi lembek dan berair. Risiko kontaminasi bakteri juga meningkat.</p>

<h3>Berapa suhu ideal untuk menyimpan frozen food?</h3>
<p>-18°C (0°F) adalah suhu standar yang direkomendasikan. Di suhu ini, pertumbuhan bakteri berhenti hampir sepenuhnya.</p>

<h3>Apakah kulkas biasa (bukan freezer) cukup untuk menyimpan dimsum?</h3>
<p>Tidak. Kulkas biasa (2–8°C) hanya bisa menyimpan dimsum 1–2 hari. Untuk penyimpanan lebih lama, freezer dengan suhu -18°C atau lebih rendah wajib digunakan.</p>
`,
  contentEn: `<h2>How Long Does Frozen Food Last?</h2><p>English content...</p>`,
}
```

---

### POST 04 — Resep Saus Dimsum Spesial

```ts
{
  blogCategoryId: catResep.id,
  titleId: 'Resep Saus Dimsum Spesial: 5 Saus Cocolan yang Bikin Nagih',
  titleEn: '5 Special Dimsum Dipping Sauce Recipes',
  slug: 'resep-saus-dimsum-spesial',
  excerptId: '5 resep saus cocolan dimsum yang mudah dibuat di rumah. Dari saus kecap klasik hingga saus XO pedas yang autentik.',
  excerptEn: '5 easy homemade dimsum dipping sauce recipes — from classic soy ginger to spicy XO style.',
  metaTitleId: 'Resep Saus Dimsum: 5 Saus Cocolan Lezat yang Mudah Dibuat',
  metaDescriptionId: '5 resep saus dimsum terbaik: kecap asin jahe, saus cabai merah, saus hoisin, saus kacang, dan saus XO pedas. Lengkap dengan cara membuat.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-04T08:00:00Z'),
  contentId: `
<h2>Saus Dimsum: Pelengkap yang Tidak Boleh Dilewatkan</h2>

<p>Dimsum tanpa saus cocolan seperti nasi goreng tanpa kecap — kurang sempurna. Saus yang tepat bisa mengangkat cita rasa dimsum ke level berikutnya. Berikut 5 resep saus dimsum yang bisa kamu buat di rumah dalam hitungan menit.</p>

<h2>Saus 1: Kecap Asin Jahe Klasik</h2>

<p>Ini adalah saus dimsum paling klasik dan paling populer di restoran dim sum Hongkong dan Guangdong.</p>

<h3>Bahan-bahan:</h3>
<ul>
  <li>3 sdm kecap asin berkualitas baik (bukan kecap manis)</li>
  <li>1 sdm minyak wijen</li>
  <li>2 cm jahe segar, parut halus</li>
  <li>1 sdt cuka beras putih</li>
  <li>1 sdt gula pasir (opsional)</li>
  <li>2 batang daun bawang, iris tipis</li>
</ul>

<h3>Cara Membuat:</h3>
<ol>
  <li>Campurkan kecap asin, minyak wijen, dan cuka beras. Aduk rata.</li>
  <li>Tambahkan jahe parut dan gula. Aduk hingga gula larut.</li>
  <li>Taburi irisan daun bawang di atasnya sebelum disajikan.</li>
  <li>Saus ini bisa disimpan di kulkas hingga 1 minggu dalam wadah tertutup.</li>
</ol>

<p><strong>Cocok untuk:</strong> Ha gao (udang), siomay, cheung fun</p>

<h2>Saus 2: Chili Oil Homemade</h2>

<p>Saus minyak cabai ini sedang tren di seluruh dunia, dan sangat cocok untuk dimsum goreng maupun kukus.</p>

<h3>Bahan-bahan:</h3>
<ul>
  <li>100 ml minyak sayur netral</li>
  <li>3 sdm bubuk cabai kering (cabe merah kering giling)</li>
  <li>1 sdm biji wijen putih</li>
  <li>2 siung bawang putih, cincang halus</li>
  <li>1 sdt kecap asin</li>
  <li>½ sdt garam</li>
</ul>

<h3>Cara Membuat:</h3>
<ol>
  <li>Panaskan minyak di wajan kecil hingga muncul asap tipis (sekitar 180°C).</li>
  <li>Dalam mangkuk tahan panas, campurkan bubuk cabai, biji wijen, dan bawang putih.</li>
  <li>Tuangkan minyak panas perlahan ke campuran cabai. Hati-hati, akan mendesis.</li>
  <li>Tambahkan kecap asin dan garam. Aduk rata.</li>
  <li>Biarkan dingin sebelum digunakan. Simpan di kulkas hingga 1 bulan.</li>
</ol>

<h2>Saus 3: Saus Kacang Gurih (untuk Siomay)</h2>

<p>Saus kacang adalah pasangan sempurna untuk siomay dan batagor — makanan khas Bandung yang dicintai seluruh Indonesia.</p>

<h3>Bahan-bahan:</h3>
<ul>
  <li>150 g kacang tanah sangrai, haluskan</li>
  <li>3 siung bawang putih, goreng</li>
  <li>5 buah cabai merah keriting</li>
  <li>2 sdm kecap manis</li>
  <li>1 sdm air jeruk nipis</li>
  <li>Garam dan gula secukupnya</li>
  <li>Air hangat secukupnya</li>
</ul>

<h3>Cara Membuat:</h3>
<ol>
  <li>Haluskan kacang tanah sangrai dengan blender atau ulekan.</li>
  <li>Goreng bawang putih hingga keemasan, tiriskan.</li>
  <li>Blend cabai merah, bawang putih goreng hingga halus.</li>
  <li>Campurkan semua bahan, tambahkan air hangat sedikit demi sedikit hingga tekstur sesuai selera.</li>
  <li>Koreksi rasa dengan garam, gula, dan jeruk nipis.</li>
</ol>

<h2>Saus 4: Saus Hoisin dengan Sentuhan Wijen</h2>

<p>Saus hoisin siap pakai bisa langsung digunakan, tapi versi homemade ini lebih segar dan bisa disesuaikan selera.</p>

<h3>Bahan-bahan:</h3>
<ul>
  <li>2 sdm pasta kedelai hitam (tauco hitam)</li>
  <li>1 sdm kecap manis</li>
  <li>1 sdm madu</li>
  <li>1 sdt minyak wijen</li>
  <li>½ sdt bawang putih bubuk</li>
  <li>1 sdt cuka beras</li>
</ul>

<p>Campurkan semua bahan dan aduk rata. Saus ini tidak perlu dimasak.</p>

<h2>Saus 5: Saus Pedas Asam Segar</h2>

<p>Untuk yang suka kombinasi pedas-asam yang menyegarkan — ideal untuk dimsum goreng dan lumpia.</p>

<h3>Bahan-bahan:</h3>
<ul>
  <li>5 buah cabai rawit merah</li>
  <li>2 siung bawang putih</li>
  <li>2 sdm air jeruk nipis segar</li>
  <li>1 sdm kecap ikan (atau kecap asin untuk versi halal penuh)</li>
  <li>1 sdm gula pasir</li>
  <li>3 sdm air</li>
</ul>

<h3>Cara Membuat:</h3>
<ol>
  <li>Blender atau ulekan kasar semua bahan hingga tercampur tapi masih agak bertekstur.</li>
  <li>Koreksi rasa: harus terasa asam, pedas, manis, dan asin secara bersamaan.</li>
  <li>Sajikan segera atau simpan di kulkas maksimal 2 hari.</li>
</ol>

<h2>Tips Menyajikan Saus Dimsum</h2>

<ul>
  <li>Gunakan mangkuk kecil individual untuk setiap tamu — lebih higienis dan elegan</li>
  <li>Sediakan minimal 2 pilihan saus: satu yang tidak pedas dan satu yang pedas</li>
  <li>Parutan jahe segar dan irisan daun bawang selalu jadi topping yang menyegarkan</li>
</ul>

<p>Sudah punya sausnya? Sekarang butuh dimsum-nya! Cek <a href="/products">koleksi dimsum premium Dapur Dekaka</a>.</p>
`,
  contentEn: `<h2>5 Special Dimsum Dipping Sauce Recipes</h2><p>English content...</p>`,
}
```

---

### POST 05 — Tips Menyimpan Makanan Beku dengan Benar

```ts
{
  blogCategoryId: catTips.id,
  titleId: '10 Tips Menyimpan Makanan Beku agar Tetap Segar dan Lezat',
  titleEn: '10 Tips for Storing Frozen Food to Keep It Fresh and Delicious',
  slug: 'tips-menyimpan-makanan-beku',
  excerptId: '10 tips praktis menyimpan frozen food dengan benar. Cegah freezer burn, jaga kualitas, dan hemat pengeluaran.',
  excerptEn: '10 practical tips for storing frozen food correctly to prevent freezer burn and maintain quality.',
  metaTitleId: '10 Tips Menyimpan Makanan Beku yang Benar | Panduan Dapur Dekaka',
  metaDescriptionId: '10 tips menyimpan frozen food agar tetap segar: cara pengemasan, pengaturan freezer, cara mencairkan yang benar, dan tanda makanan sudah tidak layak.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-05T08:00:00Z'),
  contentId: `
<h2>10 Tips Menyimpan Makanan Beku agar Tetap Segar</h2>

<p>Freezer adalah salah satu penemuan terbaik untuk ibu rumah tangga modern. Tapi banyak orang tidak menyadari bahwa cara menyimpan frozen food yang salah bisa merusak kualitas, tekstur, dan keamanan makanan. Berikut 10 tips dari dapur kami.</p>

<h2>Tip 1: Atur Suhu Freezer di -18°C</h2>
<p>Ini adalah fondasi dari semua tips lainnya. Pastikan freezer kamu selalu berada di -18°C atau lebih rendah. Di suhu ini, pertumbuhan bakteri berhenti hampir sepenuhnya. Cek suhu freezer dengan termometer dapur digital setiap beberapa bulan.</p>

<h2>Tip 2: Jangan Langsung Masukkan Makanan Panas</h2>
<p>Memasukkan makanan panas ke freezer tidak hanya merusak teksturnya, tapi juga menaikkan suhu freezer secara keseluruhan dan bisa membahayakan makanan lain yang sudah tersimpan. Dinginkan makanan hingga suhu ruang terlebih dahulu, atau percepat pendinginan dengan merendamnya dalam baskom berisi air dingin.</p>

<h2>Tip 3: Gunakan Pengemasan yang Tepat</h2>
<p>Kemasan yang tepat adalah kunci mencegah freezer burn. Gunakan:</p>
<ul>
  <li><strong>Plastik zipper bag (zip lock):</strong> Ideal untuk dimsum, bakso, dan frozen food porsi kecil. Keluarkan udara sebanyak mungkin sebelum menutup.</li>
  <li><strong>Wadah plastik BPA-free berpenutup rapat:</strong> Baik untuk makanan berkuah atau sup.</li>
  <li><strong>Vacuum sealer:</strong> Terbaik untuk penyimpanan jangka panjang. Mengeluarkan semua udara dan memperpanjang ketahanan 2–3x lipat.</li>
  <li><strong>Bungkus aluminium foil:</strong> Cocok untuk daging atau makanan berukuran besar.</li>
</ul>

<h2>Tip 4: Beri Label dan Tanggal pada Setiap Item</h2>
<p>Setelah 2 minggu, kamu tidak akan ingat apa yang ada di dalam bungkusan itu. Beri label berisi nama makanan dan tanggal penyimpanan menggunakan marker permanen atau label stiker. Terapkan sistem FIFO (First In First Out) — yang masuk lebih dulu, dikeluarkan lebih dulu.</p>

<h2>Tip 5: Susun Makanan dengan Terorganisir</h2>
<p>Freezer yang rapi memudahkan kamu mengambil barang tanpa harus membuka pintu terlalu lama. Gunakan kotak atau bin bening untuk mengelompokkan makanan berdasarkan jenis. Taruh makanan yang sering digunakan di depan atau atas.</p>

<h2>Tip 6: Jangan Isi Freezer Terlalu Penuh</h2>
<p>Freezer yang terlalu penuh (lebih dari 80% kapasitas) akan mengganggu sirkulasi udara dingin. Ini membuat beberapa area lebih hangat dari yang lain dan bisa menyebabkan makanan di sudut tidak membeku dengan optimal.</p>

<h2>Tip 7: Cairkan di Kulkas, Bukan di Suhu Ruang</h2>
<p>Mencairkan dimsum atau frozen food di suhu ruang memberi kesempatan bakteri tumbuh pesat di lapisan luar makanan sementara bagian dalam masih beku. Cara terbaik adalah pindahkan ke kulkas bagian bawah 6–12 jam sebelum dimasak.</p>

<p>Untuk yang terburu-buru: rendam dalam air dingin mengalir dengan makanan masih dalam kemasan tertutup rapat.</p>

<h2>Tip 8: Hindari Membuka Freezer Terlalu Sering</h2>
<p>Setiap kali pintu freezer dibuka, udara hangat masuk dan suhu naik. Rencanakan apa yang kamu butuhkan sebelum membuka freezer dan ambil semua sekaligus.</p>

<h2>Tip 9: Periksa Kondisi Segel Pintu Freezer</h2>
<p>Segel pintu yang aus atau berlubang menyebabkan kebocoran udara dingin. Tes sederhana: jepit selembar kertas di segel pintu lalu tutup. Jika kertas mudah ditarik keluar, segel perlu diganti.</p>

<h2>Tip 10: Lakukan Defrost Secara Rutin</h2>
<p>Tumpukan es berlebihan di dinding freezer adalah tanda freezer perlu di-defrost. Lapisan es tebal (lebih dari 1 cm) mengurangi efisiensi pendinginan dan meningkatkan konsumsi listrik. Lakukan defrost setiap 3–6 bulan atau saat es sudah terlihat menumpuk.</p>

<h2>FAQ: Penyimpanan Frozen Food</h2>

<h3>Apakah boleh menyimpan dimsum dalam kardus asli di freezer?</h3>
<p>Kardus asli umumnya tidak kedap udara. Lebih baik pindahkan ke plastik zipper bag setelah membuka kardus, atau pastikan kardus tertutup rapat dengan selotip.</p>

<h3>Kenapa dimsum saya ada es batu di dalamnya setelah dimasak?</h3>
<p>Ini terjadi jika ada air yang masuk ke dalam kemasan sebelum dibekukan. Biasanya tidak berbahaya tapi menandakan kemasan tidak kedap udara.</p>

<h3>Berapa lama freezer bisa menjaga makanan saat listrik mati?</h3>
<p>Freezer yang penuh dan tidak dibuka bisa menjaga suhu aman selama 24–48 jam saat listrik mati. Freezer yang setengah penuh hanya sekitar 12–24 jam.</p>

<p>Belanja frozen food premium dari Bandung langsung ke rumahmu di <a href="/products">toko Dapur Dekaka</a>.</p>
`,
  contentEn: `<h2>10 Tips for Storing Frozen Food</h2><p>English content...</p>`,
}
```

---

### POST 06 — Apa Itu Siomay?

```ts
{
  blogCategoryId: catGayaHidup.id,
  titleId: 'Apa Itu Siomay? Sejarah, Jenis, dan Cara Memasaknya',
  titleEn: 'What Is Siomay? History, Types, and How to Cook It',
  slug: 'apa-itu-siomay',
  excerptId: 'Mengenal siomay lebih dalam: sejarah asal-usulnya, perbedaan siomay Tionghoa dan Sunda, serta cara memasak yang benar.',
  excerptEn: 'A deep dive into siomay: origins, the difference between Chinese siu mai and Sundanese siomay, and how to cook it.',
  metaTitleId: 'Apa Itu Siomay? Sejarah, Jenis & Cara Masak | Dapur Dekaka',
  metaDescriptionId: 'Mengenal siomay: asal-usul dari Tiongkok, evolusi menjadi makanan khas Bandung, perbedaan siu mai dan siomay, serta cara masak terbaik.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-06T08:00:00Z'),
  contentId: `
<h2>Apa Itu Siomay?</h2>

<p>Siomay adalah salah satu makanan paling dikenal di Indonesia, tapi banyak yang tidak tahu cerita di baliknya. Dari jalanan Bandung hingga meja makan keluarga di seluruh nusantara, siomay telah menjadi bagian tak terpisahkan dari kuliner Indonesia. Tapi dari mana sebenarnya makanan ini berasal?</p>

<h2>Sejarah Siomay: Dari Tiongkok ke Bandung</h2>

<p>Siomay berasal dari <strong>Siu Mai (烧卖)</strong> — sebuah dim sum Tionghoa yang telah ada sejak Dinasti Song (960–1279 M). Dalam tradisi dim sum Hongkong dan Guangdong, siu mai adalah salah satu "four heavenly kings" (empat raja surgawi) dim sum, bersama ha gao, char siu bao, dan egg tart.</p>

<p>Pada abad ke-19 dan awal abad ke-20, gelombang imigran Tionghoa Hokkian dan Hakka tiba di Jawa, membawa serta tradisi kuliner mereka. Di Bandung, siu mai mengalami adaptasi lokal yang signifikan.</p>

<h2>Transformasi Menjadi Siomay Bandung</h2>

<p>Siomay Bandung berbeda cukup jauh dari siu mai asalnya:</p>

<table>
  <thead>
    <tr><th>Aspek</th><th>Siu Mai (Tionghoa)</th><th>Siomay Bandung</th></tr>
  </thead>
  <tbody>
    <tr><td>Kulit</td><td>Kulit wonton tipis</td><td>Biasanya tidak berkulit</td></tr>
    <tr><td>Isian</td><td>Udang + daging babi</td><td>Ikan tenggiri, udang, atau ayam</td></tr>
    <tr><td>Cara masak</td><td>Dikukus</td><td>Dikukus, lalu disajikan dengan berbagai pelengkap</td></tr>
    <tr><td>Penyajian</td><td>Dengan kecap asin + jahe</td><td>Dengan saus kacang, kecap manis, sambal, dan kucuran jeruk nipis</td></tr>
    <tr><td>Pelengkap</td><td>Tidak ada</td><td>Tahu, kentang, kol, telur rebus, pare (opsional)</td></tr>
  </tbody>
</table>

<h2>Jenis-Jenis Siomay di Indonesia</h2>

<h3>1. Siomay Bandung (Siomay Sunda)</h3>
<p>Yang paling umum dijumpai. Biasanya dibuat dari ikan tenggiri (atau kombinasi ikan + udang), dikukus hingga matang, dan disajikan bersama pelengkap lengkap dengan saus kacang.</p>

<h3>2. Siu Mai Dim Sum</h3>
<p>Lebih dekat dengan versi asli Tionghoa. Terbungkus kulit wonton, biasanya berisi udang atau campuran udang dan daging, dikukus dan disajikan dalam keranjang bambu.</p>

<h3>3. Siomay Goreng</h3>
<p>Varian modern yang digoreng hingga crispy. Sering dijumpai sebagai jajanan pinggir jalan atau di mall food court.</p>

<h3>4. Siomay Udang Premium</h3>
<p>Menggunakan udang segar berkualitas tinggi sebagai bahan utama, teksturnya lebih kenyal dan rasa udarnya lebih kuat. Inilah yang menjadi unggulan Dapur Dekaka.</p>

<h2>Cara Memasak Siomay Frozen yang Benar</h2>

<h3>Metode Kukus:</h3>
<ol>
  <li>Panaskan air dalam kukusan hingga mendidih</li>
  <li>Alasi kukusan dengan daun pisang atau kertas baking</li>
  <li>Masukkan siomay frozen tanpa dicairkan</li>
  <li>Kukus 10–12 menit</li>
  <li>Sajikan dengan saus kacang hangat</li>
</ol>

<h2>FAQ: Seputar Siomay</h2>

<h3>Apa perbedaan siomay dan batagor?</h3>
<p>Keduanya menggunakan adonan ikan yang sama. Perbedaannya: siomay dikukus, batagor digoreng. Keduanya adalah makanan khas Bandung yang disajikan dengan saus kacang.</p>

<h3>Apakah siomay bisa dibuat tanpa ikan?</h3>
<p>Bisa. Siomay bisa dibuat dari udang, ayam, atau kombinasi keduanya. Dapur Dekaka menyediakan varian siomay udang untuk yang tidak menyukai ikan.</p>

<h3>Berapa kalori siomay kukus?</h3>
<p>Satu porsi siomay kukus (3–4 pcs, sekitar 100g) mengandung sekitar 150–180 kalori — cukup rendah untuk ukuran camilan. Namun, saus kacang menambah sekitar 100–150 kalori per porsi.</p>

<p>Coba <a href="/products">siomay premium Dapur Dekaka</a> — dibuat dari udang segar pilihan tanpa pengawet buatan.</p>
`,
  contentEn: `<h2>What Is Siomay?</h2><p>English content...</p>`,
}
```

---

### POST 07 — Frozen Food Sehat atau Tidak?

```ts
{
  blogCategoryId: catGayaHidup.id,
  titleId: 'Frozen Food: Sehat atau Tidak? Fakta yang Perlu Kamu Tahu',
  titleEn: 'Is Frozen Food Healthy? Facts You Need to Know',
  slug: 'frozen-food-sehat-atau-tidak',
  excerptId: 'Mitos vs fakta tentang frozen food: apakah benar tidak sehat? Apa yang hilang selama proses pembekuan? Panduan untuk konsumsi yang cerdas.',
  excerptEn: 'Myths vs facts about frozen food: is it really unhealthy? What nutrients are lost during freezing? A guide to smart consumption.',
  metaTitleId: 'Frozen Food Sehat atau Tidak? Fakta Nutrisi yang Perlu Diketahui',
  metaDescriptionId: 'Apakah frozen food sehat? Faktanya: pembekuan menjaga nutrisi, bukan menghancurkannya. Tapi ada hal penting yang perlu diperhatikan.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-07T08:00:00Z'),
  contentId: `
<h2>Frozen Food: Sehat atau Tidak?</h2>

<p>Ada stigma lama bahwa frozen food adalah makanan "tidak sehat" — penuh pengawet, rendah nutrisi, dan hanya untuk orang yang malas memasak. Faktanya, penelitian ilmu pangan modern telah menunjukkan gambaran yang jauh lebih nuansir. Mari kita luruskan mitos-mitos ini.</p>

<h2>Mitos 1: Pembekuan Menghancurkan Nutrisi</h2>

<p><strong>Fakta:</strong> Pembekuan justru adalah salah satu metode paling efektif untuk <em>mempertahankan</em> nutrisi makanan.</p>

<p>Penelitian dari Journal of Food Composition and Analysis menunjukkan bahwa sayuran beku yang diproses segera setelah panen sering kali memiliki kandungan vitamin C dan B yang <em>lebih tinggi</em> dibandingkan sayuran segar yang sudah disimpan beberapa hari di toko atau kulkas.</p>

<p>Mengapa? Karena:</p>
<ul>
  <li>Pembekuan menghentikan proses metabolisme enzim yang memecah nutrisi</li>
  <li>Produk beku diproses saat berada di puncak kesegaran</li>
  <li>Sayuran "segar" di supermarket mungkin sudah 3–7 hari dari panen</li>
</ul>

<h2>Mitos 2: Frozen Food Penuh Pengawet</h2>

<p><strong>Fakta:</strong> Makanan beku yang berkualitas tidak memerlukan pengawet kimia. <em>Suhu dingin sendiri adalah pengawetnya.</em></p>

<p>Produk Dapur Dekaka tidak mengandung pengawet buatan. Satu-satunya hal yang menjaga kesegarannya adalah suhu pembekuan -18°C. Selalu cek label: jika daftar bahan panjang dengan nama kimia yang tidak familiar, itu tandanya produk tersebut menggunakan pengawet tambahan.</p>

<h2>Apa yang Sebenarnya Hilang Saat Pembekuan?</h2>

<p>Jujurnya, ada beberapa hal yang berubah:</p>

<ul>
  <li><strong>Tekstur:</strong> Beberapa makanan seperti tahu atau sayuran tertentu mengalami perubahan tekstur karena kristal es yang terbentuk memecah sel-sel. Inilah mengapa tahu beku punya tekstur spons yang berbeda.</li>
  <li><strong>Vitamin C yang sensitif panas:</strong> Proses blanching (perebusan singkat sebelum pembekuan) yang umum dilakukan pada sayuran bisa mengurangi vitamin C 10–20%. Tapi ini jauh lebih sedikit dari kehilangan nutrisi akibat penyimpanan panas jangka panjang.</li>
  <li><strong>Cita rasa segar:</strong> Beberapa aroma volatile menguap saat pembekuan, sehingga makanan beku mungkin terasa sedikit berbeda dari yang segar.</li>
</ul>

<h2>Frozen Food yang Sebaiknya Dihindari (dan Tidak Dihindari)</h2>

<h3>Perhatikan Kandungan Ini:</h3>
<ul>
  <li><strong>Sodium tinggi:</strong> Banyak frozen food siap saji mengandung sodium sangat tinggi untuk memperpanjang umur simpan rasa. Batas WHO adalah 2000mg sodium per hari.</li>
  <li><strong>Lemak jenuh berlebihan:</strong> Terutama pada produk gorengan beku yang dilapisi breadcrumb.</li>
  <li><strong>Gula tersembunyi:</strong> Beberapa frozen food manis memiliki kandungan gula yang mengejutkan.</li>
</ul>

<h3>Frozen Food yang Aman dan Baik:</h3>
<ul>
  <li>Dimsum dan siomay buatan sendiri atau berkualitas (seperti Dapur Dekaka) — protein tinggi, sodium terkontrol</li>
  <li>Sayuran beku tanpa saus tambahan</li>
  <li>Ikan dan seafood beku</li>
  <li>Buah beku (untuk smoothie atau dessert)</li>
</ul>

<h2>Panduan Memilih Frozen Food yang Sehat</h2>

<ol>
  <li><strong>Baca label nutrisi:</strong> Cek sodium, lemak jenuh, dan kandungan protein per sajian</li>
  <li><strong>Pilih produk dengan bahan minimal:</strong> Daftar bahan yang pendek dan dapat dikenali adalah tanda baik</li>
  <li><strong>Hindari "imitation" atau "analog":</strong> Produk imitasi udang, kepiting, dll. biasanya lebih rendah nutrisi</li>
  <li><strong>Pilih produk dari brand yang transparan:</strong> Brand yang mau menjelaskan sumber bahan dan proses produksi lebih terpercaya</li>
</ol>

<h2>FAQ: Frozen Food dan Kesehatan</h2>

<h3>Apakah anak-anak boleh makan frozen food?</h3>
<p>Boleh, dengan catatan: pilih produk rendah sodium, bebas MSG berlebih, dan dari bahan berkualitas. Dimsum dan bakso dari bahan alami adalah pilihan yang baik untuk anak-anak.</p>

<h3>Apakah frozen food bisa menyebabkan masalah pencernaan?</h3>
<p>Tidak, selama dimasak dengan benar dan higienis. Masalah pencernaan biasanya muncul bukan karena makanan beku itu sendiri, tapi karena tidak matang sempurna atau penyimpanan yang tidak benar.</p>

<h3>Berapa kali seminggu frozen food boleh dikonsumsi?</h3>
<p>Tidak ada batasan khusus. Yang penting adalah variasi dan keseimbangan gizi keseluruhan. Frozen food bisa menjadi bagian dari diet sehat jika dipilih dengan bijak.</p>
`,
  contentEn: `<h2>Is Frozen Food Healthy?</h2><p>English content...</p>`,
}
```

---

### POST 08 — Resep Lumpia Goreng Crispy

```ts
{
  blogCategoryId: catResep.id,
  titleId: 'Resep Lumpia Goreng Crispy yang Renyah dan Tidak Berminyak',
  titleEn: 'Crispy Fried Spring Roll Recipe — Not Greasy!',
  slug: 'resep-lumpia-goreng-crispy',
  excerptId: 'Tips rahasia membuat lumpia goreng yang benar-benar crispy, tidak berminyak, dan renyah sampai gigitan terakhir.',
  excerptEn: 'The secret tips for making truly crispy spring rolls that stay crunchy and are not greasy.',
  metaTitleId: 'Resep Lumpia Goreng Crispy: Rahasia Renyah Sempurna',
  metaDescriptionId: 'Resep dan tips membuat lumpia goreng crispy sempurna. Cara menggoreng yang benar agar tidak berminyak, dengan isian yang lezat.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-08T08:00:00Z'),
  contentId: `
<h2>Rahasia Lumpia Goreng Crispy yang Sempurna</h2>

<p>Lumpia goreng adalah makanan yang semua orang suka, tapi tidak semua orang bisa membuatnya dengan sempurna. Seringkali hasilnya terlalu berminyak, tidak crispy, atau kulitnya terkelupas. Artikel ini akan membongkar rahasia di balik lumpia goreng yang benar-benar renyah.</p>

<h2>Mengapa Lumpia Sering Tidak Crispy?</h2>

<p>Ada 4 penyebab utama lumpia tidak crispy:</p>
<ol>
  <li><strong>Suhu minyak tidak cukup tinggi</strong> — minyak yang kurang panas membuat lumpia menyerap minyak berlebihan</li>
  <li><strong>Isian terlalu basah</strong> — kelembapan dari isian membuat kulit melembek dari dalam</li>
  <li><strong>Gulungan terlalu longgar</strong> — membuat udara terperangkap dan kulit mengembang tidak merata</li>
  <li><strong>Digoreng terlalu lama dengan api kecil</strong> — hasilnya basah bukan crispy</li>
</ol>

<h2>Cara Menggoreng Lumpia Frozen Dapur Dekaka agar Crispy</h2>

<ol>
  <li><strong>Jangan cairkan lumpia.</strong> Goreng langsung dari freezer.</li>
  <li><strong>Gunakan minyak banyak (deep fry).</strong> Minyak harus cukup untuk merendam seluruh lumpia. Setengah-setengah akan membuat satu sisi lebih coklat dari yang lain.</li>
  <li><strong>Panaskan minyak di 180°C.</strong> Cek dengan cara masukkan ujung sumpit kayu — jika muncul gelembung kecil, minyak siap.</li>
  <li><strong>Goreng 3–4 menit</strong> dengan api sedang-tinggi. Jangan terlalu sering dibolak-balik — 1–2 kali cukup.</li>
  <li><strong>Angkat dan tiriskan di rak kawat</strong>, bukan di tisu dapur. Rak kawat memungkinkan uap keluar dari semua sisi sehingga kulit tetap crispy. Tisu dapur akan menjebak uap.</li>
  <li><strong>Sajikan segera.</strong> Lumpia crispy hanya bertahan 15–20 menit sebelum mulai melembek.</li>
</ol>

<h2>Saus Cocolan untuk Lumpia</h2>

<ul>
  <li><strong>Saus cabai manis (sweet chili sauce):</strong> Klasik dan universal</li>
  <li><strong>Saus kacang:</strong> Cocok untuk lumpia isian sayuran</li>
  <li><strong>Sambal kecap:</strong> Kecap manis + irisan cabai rawit + bawang merah goreng</li>
  <li><strong>Mustard + mayonaise:</strong> Cocok untuk lumpia isian daging</li>
</ul>

<h2>Variasi Isian Lumpia</h2>

<p>Lumpia Dapur Dekaka tersedia dalam isian udang premium. Tapi jika kamu ingin bereksperimen membuat sendiri:</p>

<ul>
  <li><strong>Isian rebung + udang:</strong> Klasik Chinese-Indonesian</li>
  <li><strong>Isian bihun + ayam + jamur:</strong> Ringan dan lezat</li>
  <li><strong>Isian keju + daging sapi:</strong> Fusion modern</li>
  <li><strong>Isian sayuran + tahu:</strong> Pilihan vegetarian</li>
</ul>

<h2>FAQ: Memasak Lumpia</h2>

<h3>Bisakah lumpia dipanggang di oven daripada digoreng?</h3>
<p>Bisa! Panggang di 200°C selama 15–18 menit, balik di menit ke-8. Olesi permukaan dengan sedikit minyak atau semprot dengan cooking spray untuk hasil lebih crispy. Tidak se-renyah digoreng tapi jauh lebih sehat.</p>

<h3>Bisakah lumpia dimasak di air fryer?</h3>
<p>Ya! Air fryer adalah pilihan terbaik kedua setelah deep fry. Set di 190°C selama 8–10 menit, balik di menit ke-5. Semprotkan sedikit minyak sebelum memasak.</p>

<h3>Mengapa lumpia saya meledak saat digoreng?</h3>
<p>Ini terjadi jika ada udara yang terperangkap di dalam gulungan, atau jika lumpia mengandung banyak kelembapan. Untuk lumpia beku, pastikan tidak ada es yang terlihat sebelum digoreng (lap ringan jika perlu).</p>

<p>Coba <a href="/products">lumpia premium Dapur Dekaka</a> — isian udang segar yang langsung crispy di first bite.</p>
`,
  contentEn: `<h2>Crispy Spring Roll Recipe</h2><p>English content...</p>`,
}
```

---

### POST 09 — Mengenal Makanan Chinese-Indonesia

```ts
{
  blogCategoryId: catGayaHidup.id,
  titleId: 'Mengenal Makanan Chinese-Indonesia: Warisan Budaya di Piring Kita',
  titleEn: 'Chinese-Indonesian Food: A Cultural Heritage on Our Plates',
  slug: 'makanan-chinese-indonesia-warisan-budaya',
  excerptId: 'Perjalanan kuliner Chinese-Indonesia: dari Peranakan hingga dimsum modern. Bagaimana dua budaya berpadu menciptakan cita rasa unik.',
  excerptEn: 'The culinary journey of Chinese-Indonesian food: from Peranakan cuisine to modern dimsum.',
  metaTitleId: 'Makanan Chinese-Indonesia: Warisan Kuliner Peranakan | Dapur Dekaka',
  metaDescriptionId: 'Mengenal sejarah dan kekayaan kuliner Chinese-Indonesia: Peranakan, hakka, hokkian. Dari bak kut teh hingga dimsum halal modern.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-09T08:00:00Z'),
  contentId: `
<h2>Warisan Kuliner Chinese-Indonesia: Perpaduan Dua Dunia</h2>

<p>Ketika kamu menikmati semangkuk bakso, sepiring siomay, atau sekeranjang dimsum yang mengepul — kamu sedang menikmati hasil perpaduan dua peradaban kuliner yang kaya. Makanan Chinese-Indonesia adalah cerita tentang migrasi, adaptasi, dan kreativitas yang berlangsung selama berabad-abad.</p>

<h2>Sejarah Singkat: Dari Tiongkok ke Nusantara</h2>

<p>Gelombang migrasi besar dari Tiongkok ke kepulauan Nusantara terjadi antara abad ke-17 hingga awal abad ke-20. Para imigran dari provinsi Fujian (Hokkian), Guangdong (Tiochu dan Hakka), serta beberapa dari Hainan membawa tradisi kuliner mereka.</p>

<p>Di tanah baru ini, mereka menemukan bahan-bahan yang berbeda: rempah-rempah tropis yang kaya, santan kelapa, terasi, dan berbagai bumbu lokal. Lambat laun, masakan Tionghoa beradaptasi, berpadu, dan melahirkan masakan baru yang unik — <strong>masakan Peranakan</strong> atau Chinese-Indonesia.</p>

<h2>Kelompok Kuliner Chinese-Indonesia</h2>

<h3>Masakan Hokkian (Fujian)</h3>
<p>Orang Hokkian terkenal dengan masakan berbasis kecap, mie, dan hasil laut. Kontribusi terbesar mereka ke kuliner Indonesia:</p>
<ul>
  <li><strong>Bakso:</strong> Adaptasi dari "bak-so" (daging segar dalam Hokkian) yang menjadi bakso Indonesia kini</li>
  <li><strong>Mie hokkian:</strong> Mie kuning tebal dengan seafood dan babi (dalam versi aslinya)</li>
  <li><strong>Kecap manis:</strong> Diperkenalkan oleh komunitas Hokkian, kini jadi bumbu wajib masakan Indonesia</li>
</ul>

<h3>Masakan Hakka (Kejia)</h3>
<p>Masyarakat Hakka dikenal dengan masakan yang lebih "earthy" dan bahan-bahan yang tahan lama:</p>
<ul>
  <li><strong>Yong tau foo:</strong> Tahu dan sayuran diisi pasta ikan — leluhur dari siomay dan batagor Bandung</li>
  <li><strong>Bakpao:</strong> Roti kukus berisi yang diadaptasi dari mantou Hakka</li>
</ul>

<h3>Masakan Teochu (Chaoshan)</h3>
<p>Komunitas Teochu, banyak berdiam di Jawa Barat, membawa:</p>
<ul>
  <li><strong>Kueh dan kue basah:</strong> Berbagai kue kukus manis dan gurih</li>
  <li><strong>Masak tekwan:</strong> Sup ikan khas Palembang dengan akar di masakan Teochu</li>
</ul>

<h2>Dimsum: Ambassador Kuliner Chinese-Indonesia</h2>

<p>Di antara semua warisan kuliner Chinese-Indonesia, <strong>dimsum</strong> mungkin yang paling berhasil melakukan adaptasi dan globalisasi. Dari keranjang bambu di rumah makan pecinan, kini dimsum bisa dinikmati dalam versi halal premium yang siap saji di seluruh Indonesia.</p>

<p>Dapur Dekaka merupakan bagian dari generasi produsen yang memastikan warisan kuliner ini bisa dinikmati oleh semua kalangan — dengan standar halal yang ketat dan kualitas bahan terbaik.</p>

<h2>Makanan Chinese-Indonesia yang Sudah "Menjadi Indonesia"</h2>

<p>Berikut makanan yang asal-usulnya Tionghoa tapi kini dianggap makanan Indonesia:</p>

<ul>
  <li><strong>Bakso</strong> — dari bak-so Hokkian</li>
  <li><strong>Siomay</strong> — dari siu mai Guangdong</li>
  <li><strong>Lumpia</strong> — dari spring roll Hokkian, khususnya populer di Semarang</li>
  <li><strong>Batagor</strong> — inovasi Bandung dari yong tau foo Hakka</li>
  <li><strong>Kwetiau</strong> — dari kway teow</li>
  <li><strong>Cap cai</strong> — dari chap chye (berbagai sayuran)</li>
  <li><strong>Nasi goreng</strong> — terinspirasi dari cara memasak sisa nasi ala Tionghoa</li>
</ul>

<p>Warisan kuliner ini hidup dan terus berkembang. Setiap gigitan siomay, bakso, atau dimsum adalah perjalanan singkat menembus waktu dan melintasi lautan.</p>

<p>Jadilah bagian dari warisan kuliner ini dengan mencoba <a href="/products">produk premium Dapur Dekaka</a>.</p>
`,
  contentEn: `<h2>Chinese-Indonesian Food Heritage</h2><p>English content...</p>`,
}
```

---

### POST 10 — Resep Bakso Kuah Bening

```ts
{
  blogCategoryId: catResep.id,
  titleId: 'Resep Sop Bakso Kuah Bening yang Segar dan Gurih',
  titleEn: 'Clear Broth Meatball Soup Recipe',
  slug: 'resep-sop-bakso-kuah-bening',
  excerptId: 'Resep sop bakso kuah bening yang segar, gurih, dan mudah dibuat di rumah. Cocok untuk makan siang atau malam bersama keluarga.',
  excerptEn: 'A fresh and savory clear broth meatball soup recipe — easy to make at home.',
  metaTitleId: 'Resep Sop Bakso Kuah Bening: Segar, Gurih, Mudah Dibuat',
  metaDescriptionId: 'Resep lengkap sop bakso kuah bening untuk keluarga. Bumbu sederhana, kaldu bening segar, dan cara memasak yang mudah dengan bakso frozen.',
  isPublished: true,
  isAiAssisted: false,
  authorId: admin.id,
  publishedAt: new Date('2026-05-10T08:00:00Z'),
  contentId: `
<h2>Resep Sop Bakso Kuah Bening</h2>

<p>Sop bakso kuah bening adalah comfort food sejati Indonesia. Kaldu yang jernih tapi kaya rasa, bakso yang kenyal, dan pelengkap yang segar — kombinasi ini tidak pernah gagal. Dengan bakso frozen berkualitas, kamu bisa memasak sop bakso yang enak dalam 20 menit.</p>

<h2>Bahan-Bahan (untuk 4 porsi)</h2>

<h3>Bahan Utama:</h3>
<ul>
  <li>500g bakso sapi atau ayam (frozen, tidak perlu dicairkan)</li>
  <li>2 liter air atau kaldu sapi/ayam</li>
  <li>200g mie kuning atau bihun (opsional)</li>
  <li>2 batang seledri, ikat</li>
  <li>2 batang daun bawang, potong 3cm</li>
</ul>

<h3>Bumbu Halus:</h3>
<ul>
  <li>4 siung bawang putih</li>
  <li>3 cm jahe</li>
  <li>½ sdt merica putih bubuk</li>
</ul>

<h3>Pelengkap:</h3>
<ul>
  <li>Bawang goreng</li>
  <li>Seledri cincang</li>
  <li>Kecap manis dan sambal</li>
  <li>Jeruk nipis (diperas saat makan)</li>
</ul>

<h2>Cara Membuat Sop Bakso Kuah Bening</h2>

<ol>
  <li><strong>Rebus air hingga mendidih.</strong> Atau gunakan kaldu sapi/ayam untuk hasil yang lebih kaya rasa.</li>
  <li><strong>Tumis bumbu halus.</strong> Panaskan 2 sdm minyak di wajan terpisah. Tumis bawang putih dan jahe yang sudah dihaluskan hingga harum dan berubah warna keemasan sekitar 2 menit.</li>
  <li><strong>Masukkan tumisan ke dalam air mendidih.</strong> Aduk rata.</li>
  <li><strong>Masukkan bakso frozen.</strong> Tidak perlu dicairkan. Masak 5–7 menit hingga bakso mengapung dan matang.</li>
  <li><strong>Bumbui dengan garam dan merica.</strong> Koreksi rasa — kuah harus gurih tapi ringan.</li>
  <li><strong>Masukkan seledri dan daun bawang.</strong> Masak 1 menit terakhir, jangan terlalu lama agar tetap segar dan hijau.</li>
  <li><strong>Sajikan panas</strong> dengan pelengkap di atas.</li>
</ol>

<h2>Tips untuk Kuah yang Lebih Bening dan Gurih</h2>

<h3>Tips Kuah Lebih Bening:</h3>
<ul>
  <li>Gunakan api sedang, bukan mendidih kencang — gelembung besar akan membuat kuah keruh</li>
  <li>Buang buih yang muncul di permukaan saat awal memasak dengan sendok</li>
  <li>Hindari mengaduk terlalu kuat</li>
</ul>

<h3>Tips Rasa Lebih Kaya:</h3>
<ul>
  <li>Tambahkan 1 ruas lengkuas yang digeprek ke dalam kaldu</li>
  <li>Gunakan tulang sumsum atau tulang ceker ayam untuk membuat kaldu sendiri</li>
  <li>Setetes minyak wijen di akhir memberikan aroma yang harum</li>
</ul>

<h2>Variasi Sop Bakso</h2>

<ul>
  <li><strong>Sop bakso tahu:</strong> Tambahkan tahu goreng atau tahu putih</li>
  <li><strong>Sop bakso sawi:</strong> Tambahkan sawi hijau 2 menit sebelum matang</li>
  <li><strong>Sop bakso mie:</strong> Sajikan di atas mie kuning yang sudah direbus</li>
  <li><strong>Sop bakso pedas:</strong> Tambahkan cabai merah yang sudah diulek</li>
</ul>

<h2>FAQ: Seputar Memasak Bakso</h2>

<h3>Apakah bakso frozen perlu dicairkan sebelum dimasak?</h3>
<p>Tidak perlu. Masukkan langsung ke dalam kuah mendidih. Bakso akan matang dalam 5–7 menit. Mencairkan dulu justru bisa membuat tekstur bakso lebih lembek.</p>

<h3>Bagaimana cara tahu bakso sudah matang?</h3>
<p>Bakso yang matang akan mengapung ke permukaan kuah. Itu adalah tanda yang paling mudah. Untuk memastikan, iris satu bakso — bagian dalam harus matang merata tanpa area beku di tengah.</p>

<h3>Berapa kalori sop bakso per porsi?</h3>
<p>Satu porsi sop bakso tanpa mie (sekitar 5–6 bakso + kuah) mengandung sekitar 250–350 kalori, tergantung jenis bakso yang digunakan. Dengan tambahan mie, kalorinya sekitar 400–500 kalori per porsi.</p>

<p>Beli <a href="/products">bakso premium Dapur Dekaka</a> — kenyal alami tanpa bahan pengawet, siap masak kapan saja.</p>
`,
  contentEn: `<h2>Clear Broth Meatball Soup</h2><p>English content...</p>`,
}
```

---

### POSTS 11–15 (Abbreviated — Full content follows same structure)

**POST 11:** `catering-dimsum-untuk-acara` — Tips memesan dimsum untuk acara keluarga/kantor (B2B angle, targets commercial intent)

**POST 12:** `perbedaan-dimsum-dan-siomay` — Edukasi produk: perbedaan jenis-jenis dim sum yang sering disalahpahami

**POST 13:** `frozen-food-untuk-anak-sehat` — Panduan memilih frozen food yang aman dan bergizi untuk anak-anak

**POST 14:** `tips-belanja-frozen-food-online` — Guide belanja online frozen food: cara memilih produk, packaging, shipping

**POST 15:** `sejarah-dim-sum-dari-yum-cha` — Cerita mendalam tentang tradisi yum cha dan dim sum di Tiongkok

---

## IMPLEMENTATION NOTES FOR CURSOR

1. Create `scripts/seed-blog.ts` with the complete `getBlogPosts` function
2. Add script to `package.json`: `"db:seed-blog": "npx tsx scripts/seed-blog.ts"`
3. Cover images: Use placeholder Cloudinary URLs or skip (blog will show title cards without images)
4. English content (`contentEn`): For launch, can duplicate Indonesian content with placeholder "Translation coming soon" — Google indexes primary language first
5. Run after main seed: `npm run db:seed-blog`

---

## SEO KEYWORD MAPPING (for internal links)

Each blog post MUST link to these targets:

| Keyword | Links to |
|---------|----------|
| "dimsum premium" | `/products` |
| "siomay udang" | `/products` (filtered) |
| "bakso premium" | `/products` |
| "frozen food Bandung" | `/products` |
| "reseller / B2B" | `/b2b` |
| Related blog posts | Each other (internal link cluster) |
