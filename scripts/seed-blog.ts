import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../lib/db/schema';

if (process.env.NODE_ENV === 'production') {
  console.error('ABORT: Cannot run seed script in production.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seedBlog() {
  console.log('Starting blog seed...');

  // Get or create admin user
  const adminUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.role, 'superadmin'),
  });

  if (!adminUser) {
    throw new Error('Superadmin user not found. Run scripts/seed.ts first.');
  }

  // Check if blog posts already exist (idempotent guard)
  const existingPosts = await db.query.blogPosts.findMany({ limit: 1 });
  if (existingPosts.length > 0) {
    console.log(`Blog already has ${existingPosts.length} posts — skipping blog seed.`);
    console.log('To re-seed, first delete existing blog_posts and blog_categories from the DB.');
    return;
  }

  // 1. Create blog categories
  console.log('Creating blog categories...');
  const blogCats = [
    { nameId: 'Tips Memasak', nameEn: 'Cooking Tips', slug: 'tips-memasak', sortOrder: 1 },
    { nameId: 'Cerita Dapur', nameEn: 'Kitchen Stories', slug: 'cerita-dapur', sortOrder: 2 },
    { nameId: 'Promo & Offer', nameEn: 'Promo & Offers', slug: 'promo-offer', sortOrder: 3 },
    { nameId: 'Tentang Dimsum', nameEn: 'About Dimsum', slug: 'tentang-dimsum', sortOrder: 4 },
  ];
  const insertedBlogCats = await db.insert(schema.blogCategories).values(
    blogCats.map(c => ({ ...c }))
  ).returning();
  console.log(`Created ${insertedBlogCats.length} blog categories`);

  // 2. Create blog posts
  console.log('Creating blog posts...');
  const tipsCat = insertedBlogCats.find(c => c.slug === 'tips-memasak')!;
  const ceritaCat = insertedBlogCats.find(c => c.slug === 'cerita-dapur')!;
  const promoCat = insertedBlogCats.find(c => c.slug === 'promo-offer')!;
  const tentangCat = insertedBlogCats.find(c => c.slug === 'tentang-dimsum')!;

  const now = new Date();
  const blogPosts = [
    {
      blogCategoryId: tipsCat.id,
      authorId: adminUser.id,
      titleId: '5 Tips Mudah Memasak Dimsum yang Sempurna di Rumah',
      titleEn: '5 Easy Tips for Perfect Dimsum Cooking at Home',
      slug: '5-tips-memasak-dimsum-sempurna',
      excerptId: 'Keluarkan cita rasa terbaik dari dimsum frozen Anda dengan lima tips sederhana ini.',
      excerptEn: 'Bring out the best flavor from your frozen dimsum with these five simple tips.',
      contentId: `<p>Memasak dimsum frozen yang lezat sebenarnya sangat mudah. Berikut lima tips yang akan membantu Anda mendapatkan hasil sempurna setiap kali:</p>

<h2>1. Kukus dengan Suhu yang Tepat</h2>
<p>Gunakan kukusan dengan air mendidih yang sudah dipanaskan sebelumnya. Kukus dimsum selama 15-20 menit pada api sedang. Jangan terlalu sering membuka tutup agar uap tidak keluar.</p>

<h2>2. Gunakan Daun Bawang sebagai Alas</h2>
<p>Letakkan daun bawang atau daun pisang di dasar kukusan sebelum meletakkan dimsum. Ini memberi aroma segar dan mencegah dimsum menempel.</p>

<h2>3. Jangan Kukus Berlebihan</h2>
<p>Periksa kematangan setelah 15 menit. Terlalu lama mengukus membuat kulit menjadi keras dan isian kering.</p>

<h2>4. Sajikan dengan Saus yang Tepat</h2>
<p>Sajikan hangat dengan saus cuka dan irisan jahe untuk rasa autentik. Hindari mencampurkan saus langsung saat masih panas.</p>

<h2>5. Simpan dengan Benar</h2>
<p>Jika tidak segera dimasak, simpan di freezer segera setelah membeli. Jangan refreeze setelah dicairkan.</p>`,
      contentEn: `<p>Cooking delicious frozen dimsum is actually very easy. Here are five tips that will help you get perfect results every time:</p>

<h2>1. Steam at the Right Temperature</h2>
<p>Use a steamer with pre-heated boiling water. Steam dimsum for 15-20 minutes on medium heat. Don't open the lid too often to keep the steam in.</p>

<h2>2. Use Green Onions as a Base</h2>
<p>Place green onions or banana leaves at the base of the steamer before placing dimsum. This adds a fresh aroma and prevents sticking.</p>

<h2>3. Don't Over-Steam</h2>
<p>Check doneness after 15 minutes. Over-steaming makes the skin hard and the filling dry.</p>

<h2>4. Serve with the Right Sauce</h2>
<p>Serve warm with vinegar sauce and sliced ginger for an authentic taste. Avoid mixing sauce directly while still hot.</p>

<h2>5. Store Properly</h2>
<p>If not cooked immediately, store in the freezer right after purchasing. Don't refreeze after thawing.</p>`,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      isAiAssisted: false,
    },
    {
      blogCategoryId: ceritaCat.id,
      authorId: adminUser.id,
      titleId: 'Kisah Warisan Resep Dimsum Keluarga德卡 yang Tak Terbantahkan',
      titleEn: 'The Unbeatable Story of the 德卡 Family Dimsum Recipe Heritage',
      slug: 'warisan-resep-dimsum-keluarga-dekaka',
      excerptId: 'Bagaimana resep rahasia tiga generasi menjadi fondasi cita rasa Dapur Dekaka.',
      excerptEn: 'How a three-generation secret recipe became the foundation of Dapur Dekaka flavor.',
      contentId: `<p>Di balik setiap收起 dimensi Dapur Dekaka, terdapat cerita yang dimulai lebih dari 40 tahun lalu di kota Bandung yang cerah.</p>

<h2>Awal dari Segalanya</h2>
<p>Semuanya dimulai ketika kakek saya, seorang koki di sebuah restoran China kuno di Bandung, mulai bereksperimen dengan adonan dan isian. Selama bertahun-tahun, ia menyempurnakan rasio sempurna antara udang, daging babi, dan rempah-rempah rahasia yang sekarang dikenal sebagai ciri khas kami.</p>

<h2>Resep yang Dilewatkan dari Generasi ke Generasi</h2>
<p>Setiap generasi menambahkan sentuhan mereka sendiri — sebuah rahasia kecil, sebuah teknik baru. Paman saya memperkenalkan penggunaan nori untuk sentuhan umami. Sementara bibik saya menyempurnakan tekstur kulit yang tepat, cukup tipis untuk merasakannya, cukup kuat untuk menahan isian yang kaya.</p>

<h2>Warisan di Era Modern</h2>
<p>Sekarang, di tangan kami, resep itu tidak hanya dilestarikan — ia berinovasi. Dengan teknologi pembekuan modern, kami dapat mengirim cita rasa warisan ke seluruh Indonesia tanpa mengorbankan kesegaran atau rasa.</p>

<p>Setiap lipat di setiap收起 adalah penghormatan untuk mereka yang datang sebelumnya dan janji untuk generasi yang akan datang.</p>`,
      contentEn: `<p>Behind every piece of Dapur Dekaka dimsum lies a story that began over 40 years ago in the sunny city of Bandung.</p>

<h2>The Beginning</h2>
<p>It all started when my grandfather, a chef at an old Chinese restaurant in Bandung, began experimenting with doughs and fillings. Over years, he perfected the perfect ratio of shrimp, pork, and secret spices that now defines our signature.</p>

<h2>Recipe Passed Through Generations</h2>
<p>Each generation added their own touch — a small secret, a new technique. My uncle introduced the use of nori for an umami twist. While my grandmother perfected the exact skin texture, thin enough to taste, strong enough to hold the rich filling.</p>

<h2>Heritage in the Modern Era</h2>
<p>Now, in our hands, the recipe isn't just preserved — it's innovated. With modern freezing technology, we can send the taste of heritage across Indonesia without sacrificing freshness or flavor.</p>

<p>Every fold in every dumpling is a tribute to those who came before and a promise to generations to come.</p>`,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      isAiAssisted: false,
    },
    {
      blogCategoryId: promoCat.id,
      authorId: adminUser.id,
      titleId: 'Promo Spesial: Diskon 10% untuk Pembelian Pertama di DapurDekaka.com',
      titleEn: 'Special Promo: 10% Discount on First Purchase at DapurDekaka.com',
      slug: 'promo-diskon-10-pembelian-pertama',
      excerptId: 'Yuk, cobai cita rasa warisan dengan harga spesial untuk pembeli pertama!',
      excerptEn: 'Try our heritage flavors at a special price for first-time buyers!',
      contentId: `<p>Kami ingin mengundang Anda untuk mencicipi warisan cita rasa keluarga kami. Gunakan kode <strong>SELAMATDATANG</strong> saat checkout untuk mendapatkan diskon 10% untuk pembelian pertama Anda!</p>

<h2>Syarat & Ketentuan:</h2>
<ul>
<li>Minimal pembelian Rp 50.000</li>
<li>Berlaku untuk pelanggan baru</li>
<li>Kode hanya dapat digunakan sekali per akun</li>
<li>Berlaku hingga 31 Desember 2026</li>
</ul>

<p>Jangan lewatkan kesempatan ini untuk merasakan dimsum, lumpia, dan ekado segar kualitas premium — sekarang di kenyamanan rumah Anda sendiri!</p>`,
      contentEn: `<p>We'd like to invite you to taste our family heritage of flavors. Use code <strong>SELAMATDATANG</strong> at checkout to get a 10% discount on your first purchase!</p>

<h2>Terms & Conditions:</h2>
<ul>
<li>Minimum purchase Rp 50,000</li>
<li>Valid for new customers</li>
<li>Code can only be used once per account</li>
<li>Valid until December 31, 2026</li>
</ul>

<p>Don't miss this opportunity to experience fresh, premium quality dimsum, lumpia, and ekado — now in the comfort of your own home!</p>`,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      isAiAssisted: false,
    },
    {
      blogCategoryId: tipsCat.id,
      authorId: adminUser.id,
      titleId: 'Cara Menyimpan Dimsum Frozen Agar Tetap Segar dan Lezat',
      titleEn: 'How to Store Frozen Dimsum to Keep It Fresh and Delicious',
      slug: 'cara-menyimpan-dimsum-frozen',
      excerptId: 'Simpan dengan benar, masak dengan sempurna. Berikut panduan lengkapnya.',
      excerptEn: 'Store correctly, cook perfectly. Here is the complete guide.',
      contentId: `<p>Pelajaran penting dalam memasak dimsum frozen adalah bukan hanya tentang cara memulainya — tetapi juga tentang cara menyimpannya dengan benar.</p>

<h2>Penyimpanan yang Benar</h2>
<p>Segera setelah tiba, masukkan ke dalam freezer pada suhu -18°C atau lebih rendah. Jangan pernah letakkan di suhu ruangan dalam waktu lama.</p>

<h2>Jangan Daur Ulang!</h2>
<p>Jika Anda sudah mencairkan dimsum, jangan bekukan kembali. Ini mengubah tekstur dan rasa secara signifikan.</p>

<h2>Lama Penyimpanan</h2>
<p>Dimsum frozen dari Dapur Dekaka dapat disimpan hingga 6 bulan tanpa kehilangan kualitas jika disimpan dengan benar.</p>

<h2>Tips Cepat</h2>
<ul>
<li>Gunakan wadah kedap udara untuk menghindari burn freezer</li>
<li>Label setiap wadah dengan tanggal pembelian</li>
<li>Atur agar yang paling dulu dibeli digunakan lebih dulu (FIFO)</li>
</ul>`,
      contentEn: `<p>The important lesson in cooking frozen dimsum is not just about how to cook it — but also how to store it properly.</p>

<h2>Proper Storage</h2>
<p>As soon as it arrives, put it in the freezer at -18°C or below. Never leave it at room temperature for long.</p>

<h2>Never Refreeze!</h2>
<p>If you have thawed the dimsum, don't refreeze it. This significantly changes texture and flavor.</p>

<h2>Storage Duration</h2>
<p>Frozen dimsum from Dapur Dekaka can be stored for up to 6 months without losing quality if stored properly.</p>

<h2>Quick Tips</h2>
<ul>
<li>Use airtight containers to avoid freezer burn</li>
<li>Label each container with the purchase date</li>
<li>Arrange so that the earliest purchased is used first (FIFO)</li>
</ul>`,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      isAiAssisted: false,
    },
    {
      blogCategoryId: tentangCat.id,
      authorId: adminUser.id,
      titleId: 'Mengapa Dimsum adalah Pilihan Makanan Sehat untuk Keluarga Indonesia',
      titleEn: 'Why Dimsum is a Healthy Food Choice for Indonesian Families',
      slug: 'dimsum-pilihan-makanan-sehat-keluarga',
      excerptId: 'Rendah lemak, tinggi protein, dan penuh rasa — Inilah mengapa dimsum adalah pilihan tepat.',
      excerptEn: 'Low in fat, high in protein, and full of flavor — Here is why dimsum is the right choice.',
      contentId: `<p>Ketika berbicara tentang makanan yang menyehatkan dan lezat, dimsum sering diabaikan. Namun, fakta bahwa dimsum adalah pilihan yang sangat baik untuk keluarga Indonesia tidak bisa disangkal.</p>

<h2>Nutrisi yang Kaya</h2>
<p>Dimsum tradisional yang dibuat dengan benar kaya akan protein dari udang dan daging. Ditambah dengan sayuran yang sering menjadi bagian dari isian, Anda mendapatkan makanan yang seimbang.</p>

<h2>Proses Pengukusan = Sehat</h2>
<p>Tidak seperti makanan goreng, dimsum dikukus. Ini berarti tidak ada minyak berlebih dan Anda mendapatkan nutrisi yang lebih baik dari isian.</p>

<h2>Perbedaan Dapur Dekaka</h2>
<p>Kami menggunakan bahan-bahan berkualitas premium dan proses produksi yang higienis. Tanpa pengawet, tanpa pewarna buatan — hanya cita rasa warisan yang murni.</p>

<h2>Cocok untuk Semua Usia</h2>
<p>Dari anak-anak hingga orang tua, dimsum adalah makanan yang sempurna untuk semua usia. Teksturnya lembut dan rasanya yang tidak terlalu pedas cocok untuk perut sensitif.</p>`,
      contentEn: `<p>When talking about healthy and delicious food, dimsum is often overlooked. However, the fact that dimsum is an excellent choice for Indonesian families cannot be denied.</p>

<h2>Rich in Nutrition</h2>
<p>Traditional dimsum made properly is rich in protein from shrimp and meat. Combined with vegetables often part of the filling, you get a balanced meal.</p>

<h2>Steaming = Healthy</h2>
<p>Unlike fried foods, dimsum is steamed. This means no excess oil and you get better nutrition from the filling.</p>

<h2>The Dapur Dekaka Difference</h2>
<p>We use premium quality ingredients and hygienic production processes. No preservatives, no artificial colors — just pure heritage flavor.</p>

<h2>Suitable for All Ages</h2>
<p>From children to the elderly, dimsum is the perfect food for all ages. Its soft texture and not-too-spicy flavor is suitable for sensitive stomachs.</p>`,
      isPublished: true,
      publishedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      isAiAssisted: false,
    },
  ];

  await db.insert(schema.blogPosts).values(blogPosts);
  console.log(`Created ${blogPosts.length} blog posts`);

  console.log('Blog seed completed successfully!');
}

seedBlog().catch(console.error);