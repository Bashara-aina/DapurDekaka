--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.blog_posts (
    id integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    author_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    published integer DEFAULT 0,
    image_url text,
    order_index integer DEFAULT 0
);


ALTER TABLE public.blog_posts OWNER TO neondb_owner;

--
-- Name: blog_posts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.blog_posts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.blog_posts_id_seq OWNER TO neondb_owner;

--
-- Name: blog_posts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.blog_posts_id_seq OWNED BY public.blog_posts.id;


--
-- Name: footer; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.footer (
    id integer NOT NULL,
    address text NOT NULL,
    phone text NOT NULL
);


ALTER TABLE public.footer OWNER TO neondb_owner;

--
-- Name: footer_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.footer_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.footer_id_seq OWNER TO neondb_owner;

--
-- Name: footer_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.footer_id_seq OWNED BY public.footer.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    image_url text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    order_index integer DEFAULT 0,
    price text DEFAULT '0'::text NOT NULL
);


ALTER TABLE public.menu_items OWNER TO neondb_owner;

--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.menu_items_id_seq OWNER TO neondb_owner;

--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: pages; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pages (
    id integer NOT NULL,
    page_name text NOT NULL,
    content text NOT NULL
);


ALTER TABLE public.pages OWNER TO neondb_owner;

--
-- Name: pages_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pages_id_seq OWNER TO neondb_owner;

--
-- Name: pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pages_id_seq OWNED BY public.pages.id;


--
-- Name: sauces; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.sauces (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    image_url text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    order_index integer DEFAULT 0,
    price text DEFAULT '0'::text NOT NULL
);


ALTER TABLE public.sauces OWNER TO neondb_owner;

--
-- Name: sauces_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.sauces_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sauces_id_seq OWNER TO neondb_owner;

--
-- Name: sauces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.sauces_id_seq OWNED BY public.sauces.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    email text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: blog_posts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blog_posts ALTER COLUMN id SET DEFAULT nextval('public.blog_posts_id_seq'::regclass);


--
-- Name: footer id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.footer ALTER COLUMN id SET DEFAULT nextval('public.footer_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: pages id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pages ALTER COLUMN id SET DEFAULT nextval('public.pages_id_seq'::regclass);


--
-- Name: sauces id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sauces ALTER COLUMN id SET DEFAULT nextval('public.sauces_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: blog_posts; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.blog_posts (id, title, content, author_id, created_at, updated_at, published, image_url, order_index) FROM stdin;
17	10 Tips Sukses Reseller Dimsum : Panduan Lengkap Untuk Pemula	<p>Siapa yang nggak suka dimsum? Makanan kecil yang berasal dari Tiongkok ini sekarang lagi hits banget di Indonesia. Dengan rasa yang nikmat dan banyak pilihan, dimsum jadi favorit banyak orang. Nah, ini adalah kesempatan emas buat kamu yang ingin mencoba peruntungan sebagai reseller dimsum yang menguntungkan.</p>\r\n<p>Berikut adalah panduan lengkap untuk kamu yang baru mau mulai jadi reseller dimsum:</p>\r\n<h3>1. Riset Pasar dan Produk</h3>\r\n<ul>\r\n<li><strong>Kenali Target Pasar</strong>: Siapa sih yang bakal jadi pelangganmu? Apakah keluarga, mahasiswa, atau pekerja kantoran?</li>\r\n<li><strong>Pelajari Preferensi Konsumen</strong>: Varian dimsum apa yang paling digemari? Mungkin dimsum ayam, pedas, atau nori?</li>\r\n<li><strong>Cari Supplier Terpercaya</strong>: Pilih supplier yang menawarkan produk berkualitas, harga bersaing, dan pengiriman yang bisa diandalkan.</li>\r\n</ul>\r\n<h3>2. Bangun Kemitraan dengan Supplier</h3>\r\n<p>Supplier yang baik itu penting! Mereka bisa bantu kamu untuk memulai dan mengembangkan bisnismu. Pastikan mereka punya sertifikasi halal. Pilihlah supplier yang menawarkan variasi menu yang lengkap serta mudah diajak berkomunikasi!</p>\r\n<h3>3. Tentukan Strategi Penjualan</h3>\r\n<ul>\r\n<li><strong>Penjualan Online</strong>: Manfaatkan media sosial, marketplace, atau aplikasi pesan antar untuk menjangkau lebih banyak pelanggan.</li>\r\n<li><strong>Penjualan Offline</strong>: Coba tawarkan dimsum di sekitar lingkunganmu, seperti kantor, kampus, atau acara komunitas.</li>\r\n<li><strong>Kombinasi Online dan Offline</strong>: Gabungkan kedua strategi ini untuk maksimalkan penjualan.</li>\r\n</ul>\r\n<h3>4. Promosikan Produk Kamu</h3>\r\n<ul>\r\n<li><strong>Buat Konten Menarik</strong>: Unggah foto atau video dimsum yang menggoda selera di media sosial.</li>\r\n<li><strong>Berikan Promo dan Diskon</strong>: Tawarkan harga spesial untuk menarik pelanggan baru dan menjaga pelanggan lama.</li>\r\n<li><strong>Manfaatkan Testimoni Pelanggan</strong>: Minta pelanggan yang puas untuk memberikan ulasan positif tentang produkmu.</li>\r\n</ul>\r\n<h3>5. Jaga Kualitas dan Pelayanan</h3>\r\n<ul>\r\n<li>Pastikan dimsum selalu segar dan berkualitas. Simpan dengan benar dan perhatikan tanggal kedaluwarsa.</li>\r\n<li>Berikan pelayanan yang ramah dan responsif. Tanggapi pertanyaan dan keluhan pelanggan dengan cepat dan sopan.</li>\r\n<li>Gunakan kemasan yang menarik, profesional, dan aman alias food grade untuk meningkatkan nilai jual produkmu.</li>\r\n</ul>\r\n<h3>6. Kelola Keuangan dengan Baik</h3>\r\n<ul>\r\n<li>Catat setiap pemasukan dan pengeluaran. Buat laporan keuangan secara teratur untuk memantau perkembangan bisnismu.</li>\r\n<li>Tentukan harga jual yang kompetitif. Pertimbangkan biaya produksi dan keuntungan yang ingin kamu dapatkan.</li>\r\n<li>Sisihkan sebagian keuntungan untuk modal pengembangan. Gunakan untuk meningkatkan kualitas produk atau memperluas jangkauan pasar.</li>\r\n</ul>\r\n<h3>7. Manfaatkan Media Sosial</h3>\r\n<p>Media sosial itu alat yang sangat efektif untuk mempromosikan bisnismu. Gunakan platform seperti Instagram, Facebook, dan TikTok untuk menjangkau lebih banyak audiens. Unggah foto dan video menarik dari produk dimsum kamu, dan jangan lupa berinteraksi dengan pengikutmu untuk membangun komunitas online.</p>\r\n<h3>8. Berikan Pelayanan Terbaik kepada Pelanggan</h3>\r\n<p>Pelanggan yang puas pasti akan kembali dan merekomendasikan bisnismu kepada orang lain. Selalu berikan pelayanan yang ramah, responsif, dan profesional. Tanggapi pertanyaan dan keluhan dengan cepat dan sopan.</p>\r\n<h3>9. Berinovasi dan Beradaptasi</h3>\r\n<p>Dunia bisnis itu dinamis, jadi penting untuk terus berinovasi. Cari tahu tren terbaru di pasar dimsum dan tawarkan produk atau layanan baru yang sesuai. Jangan ragu untuk mencoba hal-hal baru dan belajar dari kesalahan.</p>\r\n<h3>10. Evaluasi dan Tingkatkan</h3>\r\n<p>Evaluasi kinerja bisnismu secara berkala. Identifikasi area yang perlu ditingkatkan dan buat rencana tindakan. Teruslah belajar dan mengembangkan diri agar bisnismu semakin sukses.</p>\r\n<p>Dengan mengikuti panduan ini, kamu akan lebih dekat untuk meraih sukses sebagai reseller dimsum. Selanjutnya bagaimana?</p>\r\n<h3>Penuhi Semua Cara Kesuksesanmu dengan Dapur Dekaka!</h3>\r\n<p>Siap memulai perjalanan sukses sebagai reseller dimsum? Dapur Dekaka siap jadi mitra terpercaya kamu dan memenuhi semua poin penting untuk bisnis dimsum yang menguntungkan.</p>\r\n<p>Jangan tunda lagi! Ayo mulai perjalanan suksesmu bersama Dapur Dekaka!</p>	3	2025-02-23 12:38:33.528575	2025-02-23 12:38:33.528575	1	/uploads/image-1740314312391-914066765.jpg	0
20	Kukus Dimsum Frozen Praktis di Rumah dengan Berbagai Metode.	<div class="sticky top-0 z-10 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">&nbsp;</div>\r\n<div class="space-y-6">\r\n<div class="space-y-6">\r\n<div>\r\n<div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6 transition-all duration-200 hover:shadow-lg border-muted/50">\r\n<div class="mb-4 prose-sm prose max-w-none">\r\n<p>Siapa sih yang nggak suka dimsum? Apalagi yang frozen, bisa jadi penyelamat saat pengen camilan enak tanpa ribet. Tapi, gimana sih cara mengukusnya biar tetap lembut dan kenyal? Tenang aja, ada beberapa metode yang bisa kamu coba di rumah, tergantung alat yang kamu punya!</p>\r\n<h3>1. Kukusan Bambu (Metode Tradisional)</h3>\r\n<p><strong>Persiapan:</strong></p>\r\n<ul>\r\n<li>Rendam kukusan bambu dalam air panas selama beberapa menit.</li>\r\n<li>Alasi dengan kertas roti atau daun pisang.</li>\r\n</ul>\r\n<p><strong>Proses:</strong></p>\r\n<ul>\r\n<li>Tata dimsum berjajar, jangan sampai tumpuk-tumpuk ya.</li>\r\n<li>Kukus dengan api sedang selama 10-15 menit (tergantung ukuran dimsum).</li>\r\n<li>Kukusan bambu ini juga bikin dimsum dapat aroma khas yang enak dan menjaga kelembapannya.</li>\r\n</ul>\r\n<h3>2. Kukusan Stainless Steel (Metode Umum)</h3>\r\n<p><strong>Persiapan:</strong></p>\r\n<ul>\r\n<li>Isi panci kukusan dengan air, lalu didihkan.</li>\r\n<li>Alasi wadah kukusan dengan kertas roti atau sayuran.</li>\r\n</ul>\r\n<p><strong>Proses:</strong></p>\r\n<ul>\r\n<li>Tata dimsum di wadah kukusan.</li>\r\n<li>Kukus dengan api sedang selama 10-15 menit.</li>\r\n<li>Pastikan airnya tidak menyentuh dasar wadah dimsum, ya!</li>\r\n</ul>\r\n<h3>3. Panci Biasa (Alternatif Sederhana)</h3>\r\n<p><strong>Persiapan:</strong></p>\r\n<ul>\r\n<li>Siapkan panci dengan air secukupnya.</li>\r\n<li>Letakkan saringan atau wadah tahan panas di atas air.</li>\r\n<li>Alasi saringan dengan kertas roti.</li>\r\n</ul>\r\n<p><strong>Proses:</strong></p>\r\n<ul>\r\n<li>Tata dimsum di atas saringan.</li>\r\n<li>Tutup panci, kukus dengan api sedang selama 10-15 menit.</li>\r\n<li>Ingat, airnya jangan sampai menyentuh dimsum!</li>\r\n</ul>\r\n<h3>4. Microwave (Metode Cepat)</h3>\r\n<p><strong>Persiapan:</strong></p>\r\n<ul>\r\n<li>Tata dimsum dalam wadah tahan microwave.</li>\r\n<li>Tambahkan sedikit air di dasar wadah.</li>\r\n<li>Tutup wadah dengan penutup microwave atau piring tahan panas.</li>\r\n</ul>\r\n<p><strong>Proses:</strong></p>\r\n<ul>\r\n<li>Panaskan dengan daya tinggi selama 2-3 menit.</li>\r\n<li>Cek kematangan, tambahkan waktu jika diperlukan.</li>\r\n<li>Metode ini paling cepat, tapi tekstur dimsum mungkin sedikit berbeda.</li>\r\n</ul>\r\n<h3>Tips Penting (Berlaku untuk Semua Metode)</h3>\r\n<ul>\r\n<li><strong>Periksa Kematangan:</strong>&nbsp;Tusuk dengan garpu; jika lembut dan kenyal, berarti sudah matang.</li>\r\n<li><strong>Sajikan Segera:</strong>&nbsp;Dimsum paling enak disantap selagi hangat.</li>\r\n</ul>\r\n<p>Dengan berbagai cara ini, kamu bisa menikmati dimsum frozen yang lezat kapan saja, sesuai alat yang ada di rumah!</p>\r\n<h3>Nikmati Dimsum Frozen Berkualitas dari Dapur Dekaka!</h3>\r\n<p>Mau menikmati dimsum frozen yang enak dan berkualitas tanpa ribet? Dapur Dekaka punya banyak pilihan dimsum frozen yang siap untuk kamu kukus.</p>\r\n<ul>\r\n<li>Dimsum dari Dapur Dekaka terbuat dari bahan-bahan segar dan berkualitas.</li>\r\n<li>Tersedia berbagai varian rasa yang menggugah selera.</li>\r\n<li>Dikemas secara higienis dan praktis.</li>\r\n</ul>\r\n<p>Jangan ragu untuk mencoba dimsum frozen dari Dapur Dekaka!</p>\r\n<p>Kunjungi <strong>@daprdekaka</strong> untuk melihat menu lengkap dan melakukan pemesanan. Hubungi kami di WhatsApp 082295986407 untuk informasi lebih lanjut.</p>\r\n<p>Rasakan kemudahan membuat dimsum yang lezat di rumah bersama Dapur Dekaka!</p>\r\n</div>\r\n</div>\r\n</div>\r\n</div>\r\n</div>	3	2025-02-23 13:58:00.577844	2025-02-23 13:58:00.577844	1	/uploads/image-1740319895362-88949059.jpg	4
16	Pabrik Dimsum "Dapur Dekaka" Bandung: Kualitas Terbaik Dengan Harga Termurah	<p>Halo, para pencinta kuliner! Siapa yang tidak kenal Bandung? Kota yang terkenal dengan beragam makanan enak ini kini semakin ramai dengan munculnya berbagai pabrik dimsum. Salah satu yang jadi favorit dan terpercaya adalah "Dapur Dekaka" sebagai pabrik dimsum di Bandung. Di sini, kamu bisa menemukan berbagai jenis dimsum yang bukan hanya lezat, tapi juga harganya sangat bersahabat.</p>\r\n<p><strong>Apa Saja Keunggulan Dapur Dekaka?</strong></p>\r\n<p><strong>Bahan Baku Segar dan Berkualitas:</strong> Di pabrik ini, Dapur Dekaka hanya menggunakan bahan-bahan segar dan berkualitas tinggi. Jadi kamu bisa menikmati dimsum yang tidak hanya enak, tapi juga sehat dan pastinya halal.</p>\r\n<ol>\r\n<li>\r\n<p><strong>Variasi Dimsum yang Lengkap:</strong> Mau shumai, ekado, pangsit ayam, lumpia kulit tahu, atau bahkan dimsum pakai mentai yang lagi hits? Semua ada di sini! Pilihan yang bikin kamu bingung mau pilih yang mana.</p>\r\n</li>\r\n<li>\r\n<p><strong>Harga yang Bersaing:</strong>&nbsp;Kualitas dimsum di sini nggak kalah sama restoran mahal, tapi harganya jauh lebih terjangkau. Jadi, kamu bisa puas makan tanpa harus merogoh kocek terlalu dalam.</p>\r\n</li>\r\n<li>\r\n<p><strong>Proses Produksi yang Higienis:</strong> Mereka sangat menjaga kebersihan dan keamanan pangan dalam setiap tahap produksi, jadi kamu bisa tenang menikmati dimsum tanpa khawatir.</p>\r\n</li>\r\n<li>\r\n<p><strong>Melayani Pesanan Besar:</strong> Cocok banget buat kamu yang punya usaha kuliner atau lagi merencanakan acara besar. Pesan dalam jumlah banyak? Gampang dan dapet diskon!</p>\r\n</li>\r\n</ol>\r\n<p><strong>Kenapa Harus Memilih Dimsum "Dapur Dekaka"?</strong></p>\r\n<ul>\r\n<li>Ini adalah pilihan yang pas untuk para pelaku usaha kuliner yang lagi nyari supplier dimsum yang terpercaya dan murah.</li>\r\n<li>Buat kamu yang pengen nikmatin dimsum lezat di rumah tanpa repot-repot bikin sendiri, ini solusinya!</li>\r\n<li>Sangat cocok untuk acara keluarga, arisan, pesta, atau acara lainnya yang butuh makanan enak.</li>\r\n</ul>\r\n<p>Jadi, kalau kamu lagi cari pabrik dimsum di Bandung yang menawarkan kualitas terbaik dengan harga bersaing, "Pabrik Dimsum Bandung" adalah pilihan yang tepat. Yuk, coba dan rasakan sendiri kelezatannya!</p>	3	2025-02-23 12:15:36.659893	2025-02-23 12:15:36.659893	1	/uploads/image-1740315111912-577968089.jpg	2
21	Keuntungan Bisnis Dimsum Frozen: Modal Kecil, Untung Besar!	<p>Bisnis dimsum frozen lagi naik daun, lho! Selain rasanya yang enak dan disukai berbagai kalangan, usaha ini juga menjanjikan keuntungan yang menarik, terutama buat kamu yang punya modal terbatas.</p>\r\n<p>Berikut ini beberapa keuntungan utama dari bisnis dimsum frozen yang perlu kamu tahu:</p>\r\n<ol>\r\n<li><strong>Modal Awal yang Terjangkau</strong></li>\r\n</ol>\r\n<p>Kalau dibandingkan dengan bisnis kuliner lain, modal untuk memulai bisnis dimsum frozen ini cukup bersahabat. Kamu nggak perlu sewa tempat yang besar atau beli peralatan masak yang mahal. Cukup mulai dari rumah dengan freezer yang sudah ada! Selain itu, kamu bisa beli barang jualan sesuai pesanan, jadi risiko kerugian karena barang berlebih bisa diminimalisir.</p>\r\n<ol start="2">\r\n<li><strong>Daya Tahan Produk yang Lama</strong></li>\r\n</ol>\r\n<p>Salah satu keunggulan dimsum frozen adalah daya tahannya yang lama, asalkan disimpan dengan benar di freezer. Ini bikin kamu bisa menyimpan stok tanpa khawatir cepat basi. Daya tahan yang baik juga memberi kamu fleksibilitas dalam mengatur kapan harus produksi dan jual.</p>\r\n<ol start="3">\r\n<li><strong>Pasar yang Luas dan Stabil</strong></li>\r\n</ol>\r\n<p>Dimsum itu makanan yang disukai banyak orang, dari anak-anak sampai orang dewasa. Jadi, pasar untuk dimsum frozen ini sangat luas dan stabil. Apalagi, permintaan dimsum frozen semakin meningkat, terutama dari keluarga yang butuh hidangan praktis dan enak.</p>\r\n<ol start="4">\r\n<li><strong>Kemudahan dalam Pemasaran</strong></li>\r\n</ol>\r\n<p>Dimsum frozen gampang banget dipasarkan, baik secara online maupun offline. Kamu bisa manfaatkan media sosial, marketplace, atau aplikasi pesan antar untuk menjangkau lebih banyak pelanggan. Nggak cuma itu, kamu juga bisa jual dimsum frozen ke toko kelontong, minimarket, atau supermarket.</p>\r\n<ol start="5">\r\n<li><strong>Potensi Keuntungan yang Besar</strong></li>\r\n</ol>\r\n<p>Dengan modal yang terjangkau dan pasar yang luas, bisnis dimsum frozen punya potensi keuntungan yang besar. Kamu bisa menentukan harga jual yang kompetitif untuk menarik pelanggan, tanpa harus mengorbankan keuntungan. Penjualan online juga bisa memperluas jangkauan dan meningkatkan omset.</p>\r\n<p><strong>Tips Sukses Bisnis Dimsum Frozen:</strong></p>\r\n<ul>\r\n<li>Gunakan bahan baku berkualitas untuk menghasilkan dimsum yang lezat dan sehat.</li>\r\n<li>Jaga kualitas dan kebersihan produk agar pelanggan puas.</li>\r\n<li>Lakukan promosi secara rutin untuk menarik pelanggan baru.</li>\r\n<li>Berikan pelayanan yang ramah dan responsif.</li>\r\n</ul>\r\n<p><strong>Mulai Bisnis Dimsum Frozen Kamu Bersama Dapur Dekaka!</strong></p>\r\n<p>Dapur Dekaka siap membantu kamu dengan dimsum frozen berkualitas dan berbagai pilihan rasa yang siap dijual kembali. Dapatkan harga khusus reseller dan dukungan penuh dari tim kami untuk mencapai kesuksesan.</p>\r\n<p>Yuk, kunjungi Instagram <strong>@dapurdekaka </strong>untuk cek menu lengkap dan info kemitraan. Hubungi kami di WhatsApp 082295986407 untuk konsultasi gratis.</p>\r\n<p>Bersama Dapur Dekaka, wujudkan impianmu untuk punya bisnis dimsum frozen yang menguntungkan!</p>	3	2025-02-23 14:22:39.843002	2025-02-23 14:22:39.843002	1	\N	5
18	Resep Dimsum Mentai Viral, Wajib Coba Sendiri di Rumah!	<p>Siapa yang bisa menolak dimsum mentai? Kombinasi antara dimsum klasik yang lezat dengan saus mentai yang creamy ini memang jadi primadona di dunia kuliner. Rasa uniknya pasti bikin kamu ketagihan!</p>\r\n<p>Kalau kamu pengen mencoba bikin dimsum mentai sendiri di rumah, yuk ikuti resep sederhana ini:</p>\r\n<p><strong>Bahan-bahan</strong>:</p>\r\n<ul>\r\n<li>Dimsum (bisa ayam, udang, atau campuran)</li>\r\n<li><strong>Untuk saus mentai</strong>:\r\n<ul>\r\n<li>Mayones</li>\r\n<li>Saus sambal</li>\r\n<li>Telur ikan pollack (mentaiko) / Telur ikan terbang (tobiko)</li>\r\n<li>Saus tomat (opsional)</li>\r\n<li>Sedikit air jeruk nipis</li>\r\n<li>Nori bubuk (opsional)</li>\r\n</ul>\r\n</li>\r\n</ul>\r\n<p><strong>Cara membuat</strong>:</p>\r\n<ol>\r\n<li><strong>Siapkan dimsum</strong>:&nbsp;Kukus atau goreng dimsum sampai matang.</li>\r\n<li><strong>Buat saus mentai</strong>:&nbsp;Campurkan mayones, saus sambal, telur ikan mentaiko / tobiko, dan saus tomat (opsional) dalam wadah. Aduk sampai rata. Tambahkan sedikit air jeruk nipis untuk memberikan rasa segar.</li>\r\n<li><strong>Olesi dimsum</strong>:&nbsp;Susun dimsum di atas piring, lalu olesi dengan saus mentai secara merata.</li>\r\n<li><strong>Bakar atau torch</strong>:&nbsp;Bakar atau torch dimsum mentai sampai permukaan saus sedikit kecoklatan.</li>\r\n<li><strong>Taburi nori bubuk</strong>:&nbsp;Taburi nori bubuk di atas dimsum mentai sebagai hiasan dan tambahan rasa (ini opsional juga, ya!).</li>\r\n<li><strong>Sajikan</strong>:&nbsp;Dimsum mentai siap dinikmati!</li>\r\n</ol>\r\n<p><strong>Tips</strong>:</p>\r\n<ul>\r\n<li>Gunakan telur ikan mentaiko / tobiko yang berkualitas untuk mendapatkan rasa mentai yang autentik.</li>\r\n<li>Sesuaikan jumlah saus sambal sesuai selera pedas kamu.</li>\r\n<li>Gak punya torch? Tenang, kamu bisa pakai oven dengan api atas untuk membakar permukaan saus.</li>\r\n</ul>\r\n<p><strong>Nikmati Dimsum Mentai Autentik dengan Dapur Dekaka!</strong></p>\r\n<p>Mau menikmati dimsum mentai yang lezat tanpa repot memasak? Dapur Dekaka punya solusinya:</p>\r\n<ul>\r\n<li><strong>Dimsum Berkualitas</strong>:&nbsp;Dapur Dekaka menawarkan dimsum dengan berbagai varian rasa, terbuat dari bahan-bahan segar dan berkualitas.</li>\r\n<li><strong>Saus Mentai Asli</strong>:&nbsp;Saus mentai kami menggunakan telur ikan terbang (tobiko) asli, jadi rasanya autentik dan gurih banget!</li>\r\n<li><strong>Praktis dan Higienis</strong>:&nbsp;Dimsum dan saus mentai dari Dapur Dekaka dikemas dengan praktis dan higienis, siap dinikmati kapan saja.</li>\r\n</ul>\r\n<p>Jangan lewatkan kesempatan untuk mencicipi kelezatan dimsum mentai dari Dapur Dekaka!</p>\r\n<p>Kunjungi&nbsp;<strong>@dapurdekaka</strong> di Instagram&nbsp;untuk melihat menu lengkap dan melakukan pemesanan. Hubungi kami di WhatsApp 082295986407 untuk informasi lebih lanjut.</p>\r\n<p>Rasakan sensasi dimsum mentai yang sesungguhnya dengan Dapur Dekaka!</p>	3	2025-02-23 13:07:47.665445	2025-02-23 13:07:47.665445	1	/uploads/image-1740316066675-595825473.jpg	1
19	Berburu Dimsum Murah di Bandung? Simak Tipsnya!	<div id=":1c9" class="Am aiL aO9 Al editable LW-avf tS-tW tS-tY" tabindex="1" role="textbox" contenteditable="true" spellcheck="false" aria-label="Message Body" aria-multiline="true" aria-owns=":1h8" aria-controls=":1h8" aria-expanded="false">\r\n<div dir="ltr">\r\n<p>Halo, para pecinta kuliner!&nbsp;</p>\r\n<p>Bandung, kota yang selalu ramai dengan makanan enak, punya banyak pilihan dimsum yang siap menggoyang lidah. Dimsum, si makanan kecil asal Tiongkok, memang jadi favorit banyak orang, baik buat camilan atau hidangan utama.</p>\r\n<p>Tapi, cari dimsum murah di Bandung itu kadang tricky sih. Dengan banyaknya pilihan dari restoran mewah sampai pedagang kaki lima, kita butuh strategi. Tenang, berikut beberapa tips jitu yang bisa membantu kamu dapatkan dimsum enak tanpa bikin kantong bolong:</p>\r\n<ol>\r\n<li>\r\n<p><strong>Cek Promo dan Diskon</strong></p>\r\n<p>Banyak restoran dan kedai dimsum di Bandung yang sering kasih promo dan diskon, terutama di hari-hari tertentu. Jadi, jangan lupa pantau media sosial atau website restoran favorit kamu untuk info terbaru tentang penawaran menarik. Juga, aplikasi pesan antar makanan sering kali punya promo khusus untuk dimsum, loh!</p>\r\n</li>\r\n<li>\r\n<p><strong>Beli Dimsum Frozen</strong></p>\r\n<p>Mau nikmati dimsum kapan saja tanpa harus keluar rumah? Coba deh beli dimsum frozen. Harganya biasanya lebih murah dan kamu bisa masak sendiri di rumah dengan mudah. Praktis banget, kan?</p>\r\n</li>\r\n<li>\r\n<p><strong>Cari Tempat Dimsum dari Pabrik Langsung</strong></p>\r\n<p>Pabrik atau produsen dimsum biasanya ngambil untung cuma sedikit soalnya dari tangan pertama langsung! Gak heran banyak distributor dan reseller yang beli dari sini buat dijual lagi. Tapi tenang aja, kalau buat stok di rumah juga bisa kok dibeli dengan jumlah satuan aja, harganya tetep lebih murah!&nbsp;</p>\r\n</li>\r\n<li>\r\n<p><strong>Manfaatkan Media Sosial</strong></p>\r\n<p>Media sosial seperti Instagram dan TikTok bisa jadi sumber informasi yang berharga untuk menemukan tempat makan dimsum murah di Bandung. Banyak food blogger dan influencer yang merekomendasikan tempat-tempat enak dan terjangkau, jadi follow mereka untuk update terbaru!</p>\r\n</li>\r\n</ol>\r\n<p><strong>Nikmati Dimsum Lezat dengan Harga Terjangkau di Dapur Dekaka!</strong></p>\r\n<p>Kalau kamu lagi cari dimsum berkualitas dengan harga bersahabat, Dapur Dekaka bisa jadi pilihan yang pas. Sebagai produsen alias tangan pertama, Dapur Dekaka menawarkan berbagai varian dimsum yang dibuat dari bahan-bahan segar dan berkualitas.</p>\r\n<p>Kunjungi <strong>@dapurdekaka</strong> di Instagram untuk lihat menu lengkap dan lakukan pemesanan. Mau tanya-tanya? Hubungi kami di WhatsApp 082295986407.</p>\r\n<p>Yuk, rasakan kelezatan dimsum Dapur Dekaka dan buktikan sendiri!</p>\r\n</div>\r\n</div>	3	2025-02-23 13:36:25.557258	2025-02-23 13:36:25.557258	1	/uploads/image-1740319851759-235802360.jpg	3
\.


--
-- Data for Name: footer; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.footer (id, address, phone) FROM stdin;
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.menu_items (id, name, description, image_url, created_at, order_index, price) FROM stdin;
43	Pangsit Ayam	Olahan daging ayam yang dibalut dengan kulit pangsit berbentuk melengkung. Dapat disajikan dengan cara dikukus/digoreng. Dijual per 50pcs.	/uploads/imageFile-1740317902802-987044168.jpg	2025-02-23 13:38:24.678249	0	105000
42	Dimsum Mix	Shumai dengan dasar olahan daging ayam disertai 5 varian topping, yaitu wortel, jamur, smoked beef, tuna, dan crabstick. Dijual per 50pcs.	/uploads/imageFile-1740317821860-522840222.jpg	2025-02-23 13:37:04.594662	1	105000
44	Lumpia 	Olahan daging ayam yang dibalut dengan kulit tahu berbentuk memanjang. Dapat disajikan dengan cara dikukus/digoreng. Dijual per 50pcs.	/uploads/imageFile-1740317945990-121932197.jpg	2025-02-23 13:39:07.99706	2	115000
45	Dimsum Nori	Olahan daging ayam yang dibalut nori (rumput laut panggang). Dijual per 50pcs.	/uploads/imageFile-1740317969584-491249873.jpg	2025-02-23 13:39:29.995907	3	115000
46	Dimsum Pedas	Shumai dengan dasar olahan daging ayam yang dipadu dengan cita rasa pedas. Dijual per 50pcs.	/uploads/imageFile-1740317998503-768781739.jpg	2025-02-23 13:39:59.001992	4	110000
47	Ekado	Olahan daging ayam dengan isi telur puyuh yang dibalut dengan kulit tahu. Dijual per 50pcs.	/uploads/imageFile-1740318016566-344990835.jpg	2025-02-23 13:40:16.702532	5	140000
49	Dimsum Rambutan	Olahan daging ayam yang dibalut lembaran kulit pangsit sehingga garing ketika digoreng. Dijual per 50pcs.	/uploads/imageFile-1740318069957-626516294.jpg	2025-02-23 13:41:11.552203	6	110000
\.


--
-- Data for Name: pages; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pages (id, page_name, content) FROM stdin;
1	homepage	{"carousel":{"images":["/asset/1.jpg","/asset/2.jpg","/asset/10.jpg","/asset/17.jpg"],"title":"Dapur Dekaka","subtitle":"Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"},"logo":"/logo/logo.png?t=1740808030632","content":{"hero":{"title":"Dapur Dekaka","subtitle":"Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"},"carousel":{"title":"Dapur Dekaka","subtitle":"Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"},"featuredProducts":{"title":"Featured Products","subtitle":"Discover our most loved dim sum selections"},"latestArticles":{"title":"Latest Articles","subtitle":"Discover our latest news and updates"},"customers":{"title":"Our Customers","subtitle":"Trusted by businesses across Indonesia","logos":["/logo/halal.png","/logo/logo.png","/logo/customers/customer-logo-1744038264408-0.png"]}}}
2	about	{"title":"About Dapur Dekaka","description":"","mainImage":"/asset/27.jpg?t=1744028002450","mainDescription":"Dapur Dekaka adalah produsen frozen food dimsum berbagai varian. Berlokasi di Bandung, kami telah mendistribusikan produk sampai ke Jakarta, Bekasi, Tangerang, dan Palembang. Produk kami dibuat dengan resep khas turun temurun yang sudah lebih dari 5 tahun, alur produksinya memperhatikan keamanan pangan, kebersihan terjamin, tidak pakai pengawet, tidak pakai pewarna buatan. Prioritas kami terhadap konsistensi kualitas menjadikan kami selalu dipercaya oleh restoran, kafe, reseller, dan para pengusaha sebagai mitra.123","sections":[{"title":"Di Dapur Dekaka","description":"Di Dapur Dekaka, kami sangat bersemangat untuk menghadirkan cita rasa otentik dim sum buatan tangan ke meja Anda. Berbasis di Bandung, kami bangga memberikan produk berkualitas tinggi yang menonjol karena rasa dan integritasnya. Inilah alasan mengapa Anda harus memilih kami:"}],"features":[{"id":"premium","title":"Bahan-bahan Premium","description":"Kami hanya menggunakan bahan-bahan terbaik untuk memastikan rasa dan kualitas yang luar biasa.","image":"/asset/27.jpg?t=1744028106922"},{"id":"handmade","title":"Keunggulan Buatan Tangan","description":"Setiap potongan dim sum dibuat dengan hati-hati, mempertahankan sentuhan tradisional.","image":"/asset/27.jpg?t=1744028106922"},{"id":"halal","title":"Bersertifikat Halal","description":"Nikmati produk kami dengan tenang, karena telah memenuhi standar halal tertinggi.","image":"/asset/27.jpg?t=1744028106922"},{"id":"preservative","title":"Tanpa Pengawet","description":"Kesegaran dan rasa alami adalah prioritas kami, tanpa bahan pengawet.","image":"/asset/27.jpg?t=1744028106922"}]}
3	footer	{"companyName":"Dapur Dekaka","tagline":"Premium halal dim sum made with love and quality ingredients.","address":"Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264","phone":"082295986407","email":"dapurdekaka@gmail.com","socialLinks":[{"id":"1","platform":"Instagram","url":"https://instagram.com/dapurdekaka","icon":"Instagram"},{"id":"2","platform":"Shopee","url":"https://shopee.co.id/dapurdekaka","icon":"Shopee"}],"copyright":"© 2025 Dapur Dekaka. All rights reserved.","logoUrl":""}
\.


--
-- Data for Name: sauces; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.sauces (id, name, description, image_url, created_at, updated_at, order_index, price) FROM stdin;
2	Saos Mentai Mayo	Saus mayones dan campuran tobiko khas jepang sedang populer dan sangat digemari konsumen sebagai pelengkap dimsum	/public/sauce/Saos Mentai Mayo.jpg	2025-02-20 06:09:08.126605	2025-02-20 06:09:08.126605	0	0
1	Chilli Oil	Dibuat dengan resep Dapur Dekaka yang rasa khas pedas, gurih, dan rempahnya tepat dijadikan pelengkap aneka dimsum	/public/sauce/Chilli Oil.jpg	2025-02-20 06:09:08.126605	2025-02-20 06:09:08.126605	1	0
3	Saos Tartar	Saus mayones yang manis dan gurih berpadu dengan asam dari acar timun melahirkan cita rasa unik sebagai pelengkap dimsum	/public/sauce/Saos Tartar.jpg	2025-02-20 06:09:08.126605	2025-02-20 06:09:08.126605	2	0
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password_hash, email, created_at, updated_at) FROM stdin;
3	nblslsbl	$2b$10$2ou7xbwIWBoagERSiMxX3upNAXdHHPQb5eXE1WYuNQVCTtta.m6t6	enanabila8@gmail.com	2025-02-18 06:14:58.401924	2025-02-18 06:14:58.401924
5	AdminDKK	$2b$10$9VAHSuTlk1uhhJR0JT8ul.7GvJGV0MwUAns.Yn0UE26OCBbDX4.wq	dapurdekaka@gmail.com	2025-04-07 07:51:46.429108	2025-04-07 07:51:46.429108
1	hanifahsyf	$2b$10$dX/zLDbCwJawNJj6zlwKzu6riWuS7FPQwMbvhQn7X75QHPOBR2h2G	zahrabay@gmail.com	2025-02-17 04:09:07.306351	2025-02-17 04:09:07.306351
\.


--
-- Name: blog_posts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.blog_posts_id_seq', 21, true);


--
-- Name: footer_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.footer_id_seq', 1, false);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 55, true);


--
-- Name: pages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pages_id_seq', 3, true);


--
-- Name: sauces_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.sauces_id_seq', 6, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 5, true);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: footer footer_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.footer
    ADD CONSTRAINT footer_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: sauces sauces_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.sauces
    ADD CONSTRAINT sauces_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: blog_posts blog_posts_author_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_users_id_fk FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

