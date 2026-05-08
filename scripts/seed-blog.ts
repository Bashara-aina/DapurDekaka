import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../shared/schema";
import { eq } from "drizzle-orm";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool, schema });

const AUTHOR_ID = 1;

const articles = [
  {
    title: "5 Dim Sum Favorit yang Wajib Kamu Coba di Dapur Dekaka",
    slug: "5-dim-sum-favorit-wajib-coba-dapur-dekaka",
    excerpt: "Dari siomay gurih sampai lumpia renyah, ini dia 5 dim sum terbaik yang bikin ketagihan. Cocok untuk makan siang atau celebrate moment spesial.",
    content: `<p>Dim sum bukan sekadar makanan — ini adalah tradisi kuliner yang udah dijalin selama ratusan tahun di budaya Tionghoa. Dan di <strong>Dapur Dekaka</strong>, kami bawa autentik taste itu ke meja kamu dengan sentuhan halal yang pas.</p>

<p>Berikut 5 dim sum favorit yang jadi andalan:</p>

<h2>1. Siomay Kepiting (Crabstick Dim Sum)</h2>
<p>Lembut, gurih, dan punya tekstur yang unik. Siomay kepiting di Dapur Dekaka dibungkus rapi dengan kulit translucent yang bikin kamu bisa ngeliat isian orange kemerahan di dalamnya. Disantap pas anget sama saus chili oil, mantap.</p>

<h2>2. Dim Sum Mozarella</h2>
<p>Ini yang paling rame di meja kami — keju mozarella yang melt sempurna di dalam adonan udang. Setiap gigitan menarik dengan cheese stretch yang satisfying. Pas banget buat yang penasaran sama fusion dim sum.</p>

<h2>3. Lumpia Kulit Tahu</h2>
<p>Lumpia versi ini pake kulit tahu yang crispy di luar, isian vegetables dan udang yang segar di dalam. Satu pack gak cukup — percaya deh.</p>

<h2>4. Dim Sum Pedas (Spicy Dim Sum)</h2>
<p>Buat yang suka heat, versi ini kasih tantangan yang pas. Bumbupedas yang meresap ke daging ayam, nambahin kompleksitas rasa yang bikin mata melek.</p>

<h2>5. Ekado Mayo</h2>
<p>Ekado pake isian ayam dan sayuran, diselimutin saus mayo yang creamy. Kontras rasa ini yang bikin penasaran — manis, gurih, dan segar dalam satu gigitan.</p>

<p>Semua dim sum di Dapur Dekaka dijamin halal dan dibuat fresh setiap hari. Jadi kalau kamu order, tau deh kenapa antriannya panjang.</p>

<h3>Tips dari Kami</h3>
<p>Kalau kamu mau makan dim sum yang paling fresh, dateng pas jam 11 pagi — baru buka. Atau kalau mau santai, booking dulu lewat WhatsApp biar gak nunggu lama.</p>`,
    category: "dim sum",
    imageUrl: "/image/1. Dimsum Crabstick.png",
    published: 1,
    featured: 1,
  },
  {
    title: "Resep Siomay Homemade: Semudah Itu Membuat Dim Sum Sendiri di Rumah",
    slug: "resep-siomay-homemade-dim-sum-sendiri-rumah",
    excerpt: "Gak harus ke restoran buat ngerasain siomay enak. Dengan bahan sederhana dan sedikit sabar, kamu bisa bikin siomay yang gak kalah sama restoran.",
    content: `<p>Siomay mungkin jadi salah satu dim sum paling dikenal di Indonesia. Lembut, gurih, dan versatile — bisa dikukus, digoreng, atau ditambahin kuah. Nah, sekarang kamu bisa bikin sendiri di rumah, gak ribet.</p>

<h2>Bahan-Bahan</h2>
<ul>
<li>250 gram udang kupas, cincang kasar</li>
<li>150 gram daging ayam giling</li>
<li>100 gram jamur kuping, iris tipis</li>
<li>2 sdm tepung maizena</li>
<li>1 butir putih telur</li>
<li>2 sdm minyak wijen</li>
<li>1 sdm kecap asin</li>
<li>1 sdt gula</li>
<li>1/2 sdt merica bubuk</li>
<li>Kulit pangsit/wonton untuk bungkus</li>
</ul>

<h2>Cara Membuat</h2>

<h3>Step 1: Buat Isian</h3>
<p>Campur udang, ayam giling, jamur, tepung maizena, putih telur, minyak wijen, kecap asin, gula, dan merica. Aduk rata pakai tangan sampai teksturnya sticky. Kalau mau lebih smooth, bisa pake food processor — tapi kami suka tekstur chunky.</p>

<h3>Step 2: Bentuk Siomay</h3>
<p>Ambil selembar kulit pangsit, taruh 1 sdm isian di tengah. Basahin tepian kulit dengan air, lipat formsemifinal dan jepit. Ulangi sampai isian habis.</p>

<h3>Step 3: Kukus</h3>
<p>Siapkan dandang dengan air mendidih. Alasi sarangan dengan daun cabbage atau baking paper biar siomay gak lengket. Kukus 15-20 menit sampai matang.</p>

<h3>Step 4: Saus Cocolan</h3>
<p>Campur kecap asin, cuka, chili oil, dan sedikit gula. Saus ini yang bikin siomay makin enh.</p>

<h2>Tips Agar Siomay Gak Garing</h2>
<p>Kuncinya di tekstur isian — harus ada sedikit lemak dan kelembaban. Gak boleh terlalu kering. Kalau isian terasa keras waktu diuleni, tambahin sedikit air atau minyak wijen. Dan yang paling penting: jangan overmix. Campuran yang agak uneven justru kasih tekstur yang lebih interesting.</p>

<p>Selamat mencoba, dan jangan kaget kalau keluarga kamu langsung minta bikin lagi.</p>`,
    category: "recipes",
    imageUrl: "/image/1. Dimsum Crabstick.png",
    published: 1,
    featured: 0,
  },
  {
    title: "Kenapa Dapur Dekaka Pakai Tagline 'Dim Sum Halal'? Cerita di Baliknya",
    slug: "kenapa-dapur-dekaka-dim-sum-halal-tagline",
    excerpt: "Tagline bukan cuma kata-kata marketing. Ini adalah komitmen kami untuk menyajikan dim sum berkualitas dengan kehalalan yang terjamin untuk seluruh keluarga Indonesia.",
    content: `<p>Setiap restoran punya cerita. Cerita di balik <strong>Dapur Dekaka</strong> dimulai dari sebuah pertanyaan sederhana: kenapa dim sum yang enak harus jadi barang mewah yang cuma bisa dinikmatin sebagian orang?</p>

<h2>Awal Mula</h2>
<p>Dapur Dekaka lahir dari kecintaan keluarga kami terhadap kuliner Tionghoa-Indonesia. Makan bersama keluarga besar, nongkrong di cafe chinese food — itu yang kita grew up dengan. Tapi kami notice sesuatu: banyak banget teman-teman Muslim yang ragu atau bahkan skip makan di tempat chinese food karena kekhawatiran soal kehalalan.</p>

<p>Dari keresahan itu, muncul tekad: kita bikin tempat yang orang Muslim bisa makan dengan tenang, tanpa kompromi soal rasa.</p>

<h2>Berarti Gak Enak Dong Kalau Halal?</h2>
<p>Ini yang sering disalahpahami. Halal bukan berarti rasa dikorbankan. Sebaliknya, standar halal itu justru bikin kita lebih cermat soal bahan — yang pada akhirnya malah提升 rasa.</p>

<p>Contoh simpel: kamu pasti pernah ngerasain chili oil yang terlalu amis? Itu biasanya karena cara extraction yang gak proper atau bahan yang gak fresh. Dengan kontrol yang lebih ketat, kami bisa保证 setiap sauces dan isian dim sum terasa clean dan rich.</p>

<h2>Standar Kami</h2>
<p>Semua bahan baku yang masuk ke dapur Dapur Dekaka melewati verifikasi. Dari daging, ayam, udang — semuanya bersertifikat halal. Vegetable dan bahan kering juga diproses terpisah dari produk non-halal. Gak ada kompromi.</p>

<h2>Tidak Hanya untuk Muslim</h2>
<p>Fakta интересный: sebagian besar pelanggan reguler kami justru non-Muslim. Mereka bilang, sertifikasi halal itu semacam "quality assurance" — bukti bahwa restoran ini serius soal standar. Dan rasa yang dihasilkan? udah speak for itself.</p>

<p>Karena pada dasarnya, makan enak itu universal.</p>`,
    category: "food culture",
    imageUrl: "/image/5. Dimsum Golden.png",
    published: 1,
    featured: 1,
  },
  {
    title: "10 minutes Lunch? Ini 5 Menu Dapur Dekaka yang Bisa Dibungkus dan Dibawa",
    slug: "5-menu-dapur-dekaka-bisa-dibungkus-dibawa-kantor",
    excerpt: "Lunch break sebentar gak jadi masalah. Lima menu ini cocok buat dimakan di kantor atau di perjalanan — tanpa kehilangan rasa.",
    content: `<p>Jakarta weekday lunch itu challenge sendiri. Waktu mepet, tapi perut laper, dan standar makan enak tetap harus dijaga. Nah, lima menu ini udah tested — bisa dibawa, tetap enak meskipun udah dingin sebentar.</p>

<h2>1. Ekado Mayo</h2>
<p>Ukuran mini, flavor maxi. Ekado itu bite-sized comfort food yang gak bikin berantakan. Sekali masuk ke mulut, cheese-nya melt — gak butuh waktu lama buat realize bahwa kamu udah habis lima biji.</p>

<h2>2. Lumpia Kulit Tahu</h2>
<p>Crispy, gurih, dan ada crunch yang satisfying. Ini jadi menu favorit buat yang pengen ngemil ringan tapi tetap filling. Kulit tahunya crispy di luar, isian vegetables dan udang di dalam — perfect balance.</p>

<h2>3. Siomay Kepiting (Crabstick)</h2>
<p>Ini yang paling versatile. Kalau dihangatin pakai microwave 1 menit, rasanya balik lagi kayak fresh dari kukusan. Saus chili oil yang kita kasih terpisah biar kamu bisa adjust sendiri level pedasnya.</p>

<h2>4. Dim Sum Nori</h2>
<p>Dibungkus nori sheet — jadi makin gampang grab-and-go. Aku biasanya taruh di lunchbox, padenin sama rice.너지 Balanced lunch yang gak berat di perut tapi tetap ngenyangin.</p>

<h2>5. Pangsit Ayam</h2>
<p>Kalau kamu belum coba pangsit ayam versi kami, kamu miss out. Isian ayam yang juicy, kulit yang lembut tapi gak mudah sobek, dan yang paling penting — gak dry sama sekali.</p>

<h2>Packing Tips</h2>
<p>Kalau bisa, pisahkan sauces dari dim sum pas packing. Bungkus sauces di container kecil. Jadi waktu makan, kamu bisa ngeluarin dan cocol langsung — dim sum-nya tetap crispy/kenyal, gak lembek karena rendam di saus.</p>

<p>Semua menu di atas bisa kamu order via WhatsApp buat pick-up. Biasanya 15 menit udah ready.</p>`,
    category: "reviews",
    imageUrl: "/image/11. Pangsit Ayam.png",
    published: 1,
    featured: 0,
  },
  {
    title: "Spicy Dim Sum: Menu Pedas yang Jadi Favorit Anak Muda",
    slug: "spicy-dim-sum-favorit-anak-muda-dapur-dekaka",
    excerpt: "Versi spicy dari dim sum classic yang kita semua tau. Level pedas yang bikin ketagihan — dan ini yang lagi viral di kalangan foodies muda Indonesia.",
    content: `<p>Trend makanan pedas di Indonesia gak ada matinya. Dari micin, ke lava, ke目前在流行的 level pedas yang bikin melek — selalu ada innovation. Nah, Spicy Dim Sum ini muncul sebagai response ke demand itu: comfort food yang kasih heat yang proper.</p>

<h2>Apa yang Beda?</h2>
<p>Bukan sekadar nambahin cabai. Spicy Dim Sum di Dapur Dekaka pakai bumbu yang di-developed selama berminggu-minggu. Chili oil yang kita pake punya depth — bukan heat doang, tapi ada rasa aromatik dari Sichuan pepper dan chinese herbs yang nbalancing.</p>

<p>Jadi waktu kamu makan, yang pertama nge-hit itu aroma herbs yang harum. Baru depois, warmth dimulai dari perut dan naik ke kepala. That kind of burn yang satisfying, bukan yang bikin kamu nyesel.</p>

<h2>Level Available</h2>
<p>Kita ada tiga level:</p>
<ul>
<li><strong>Mild</strong> — almost indistinguishable dari versi original, hint of heat buat yang baru mulai</li>
<li><strong>Medium</strong> — yang paling popular, heat yang keliatan tapi gak overpowering</li>
<li><strong>Hot</strong> — buat yang confident. Awas, ini bukan joke.</li>
</ul>

<h2>Best Paired With</h2>
<p>Spicy Dim Sum paling enak dimakan sama:</p>
<ul>
<li>White rice — biar netralisin heat</li>
<li>Iced jasmine tea — minuman paling classic buat n counterpart spice</li>
<li>Mozarella Dim Sum — kombinasi creamy dan spicy yang gak obvious tapi actually works</li>
</ul>

<h2>Viral Factor</h2>
<p>Sebenernya gak sengaja, tapi Spicy Dim Sum jadi viral di TikTok dan Instagram karena "Spicy Challenge" yang dilakukan beberapa food reviewers. Orang datang spezific buat coba level Hot, terus dokumentasi reaksinya. Jokes on them — yang mild aja udh enak banget.</p>

<p>Coba deh, mulai dari Medium dulu. Baru kalian decide.</p>`,
    category: "dim sum",
    imageUrl: "/image/6. Dimsum Pedas.png",
    published: 1,
    featured: 0,
  },
  {
    title: "Sejarah Dim Sum: Dari Ritual Teh ke Comfort Food Sejuta umat",
    slug: "sejarah-dim-sum-dari-ritual-teh-ke-comfort-food",
    excerpt: "Makanan kecil yang kita cintai hari ini punya sejarah panjang. Dim sum bukan asal ada — dia datang dari tradisi tea ceremony yang bermula di China ratusan tahun lalu.",
    content: `<p>Setiap gigitan dim sum yang kamu nikmati hari ini punya sejarah yang panjang — bermula dari tradisi tea ceremony di China kuno, bukan dari restoran Chinese foodmodern. Mari kita telusuri.</p>

<h2>Awal Mula: Tea Houses di Guangdong</h2>
<p>Sekitar Dinasti Tang (618-907 M), tea houses mulai bermunculan di province Guangdong. Orang-orang biasa nongkrong di tea houses ini buat ngobrol, negosiasi bisnis, atau sekadar santai. Tapi ada masalah: perut laper, dan teh doang gak cukup.</p>

<p>Dari situlah ide muncul: kenapa gak serve makanan kecil bareng teh? small bites yang bisa dimakan sambil ngobrol, gak perlu utensils复杂, dan ringan di perut. Inilah cikal bakal dim sum.</p>

<h2>Yam Cha: Mari Minum Teh</h2>
<p>Istilah "yum cha" (arti harfiah: "mari minum teh") muncul di Cantonese culture. Ini bukan sekadar makan — ini ritual sosial. Keluarga besar akan gather di tea house setiap weekend, order puluhan dim sum different, dan ngobrol berjam-jam.</p>

<p>Tradisi ini eventually spread ke seluruh China dan kemudian ke seluruh dunia, termasuk Indonesia.</p>

<h2>Evolution Lewat Zaman</h2>
<p>Di tahun 1950-an, dim sum mulai served di restoran khusus — bukan lagi di tea houses aja. Variety makin banyak: dari cuma 5-10 jenis jadi dozens. Setiap region di China punya signature:</p>
<ul>
<li><strong>Cantonese</strong> — siomay, har gow, char siu bao</li>
<li><strong>Shanghainese</strong> — xiaolongbao, shengjianbao</li>
<li><strong>Vegetarian</strong> — pilihan tanpa daging yang equally delicious</li>
</ul>

<h2>Dim Sum di Indonesia</h2>
<p>Kedatangan komunitas Tionghoa ke Indonesia bawa tradisi ini. Tapi adaptasi terjadi: bahan baku menyesuaikan sama availability lokal, bumbu dimodifikasi biar sesuai sama palate Indonesia yang cenderung sweeter dan less greasy. Halal certification juga jadi concern utama buat segment Muslim.</p>

<p>Dapur Dekaka ambil peran ini — jaga autentisitas rasa Cantonese dim sum, tapi dengan aksesibilitas halal yang bikin semua orang bisa nikmatin.</p>

<h2>Fun Fact</h2>
<p>Di Hong Kong, ada istilah "dim sum police" — tunggu, bukan polisi beneran. Ini julukan buat orang-orang yang judge kamu kalau kamu take dim sum dari cart yang udah lewat meja kamu. Cart yang lewat depan kamu itu kesempatan yang gak bakal回来 — pilih dengan bijak.</p>`,
    category: "food culture",
    imageUrl: "/image/2. Dimsum Jamur.png",
    published: 1,
    featured: 0,
  },
  {
    title: "5 Tips Memilih Dim Sum Segar yang Bakal Bikin Kamu Look Like a Pro",
    slug: "5-tips-memilih-dim-sum-segar-look-like-pro",
    excerpt: "Gak harus ke restaurant buat dapet dim sum fresh. Dengan mata yang tajam, kamu bisa pilih dim sum terbaik di supermarket atau pasar tradisional.",
    content: `<p>Beli dim sum frozen atau fresh di supermarket itu challenge tersendiri. Tanpa chef yang bisa nanya, kamu harus rely on mata dan pengalaman. Berikut tips dari dapur kami yang bisa kamu pakai下次.</p>

<h2>1. Check the Color</h2>
<p>Dim sum yang fresh punya warna yang vibrant. Kalau udang — harus pinkish-orange, bukan abu-abu atau kehijauan. Kalau ayam — flesh color yang natural, bukan pink pucat yangindicates undercooked atau sebaliknya brown yang overcooked.</p>

<h2>2. Smell Test</h2>
<p>Bau dim sum yang fresh itu subtle — savory, slightly sweet dari bahan protein. Bau amis yang kuat atau bau yang asam? Skip. Kalau mau lebih objective: kalau kamu lagi di supermarket, take the package out of the freezer dan sniff. Fresh dim sum gak akan emanate strong odor.</p>

<h2>3. Texture Kulit</h2>
<p>Kulit dim sum yang bagus itu slightly translucent, moist tapi gak soggy, dan elastic — kalau kamu tekan pelan, harus balik ke bentuk semula. Kalau ada white spots atau crystallization di permukaan, itu tanda freezer burn — artinya udah lama di freezer.</p>

<h2>4. Check the Filling Through the Skin</h2>
<p>Untuk siomay dan ekado, kamu bisa evaluate isi through the wrapper. Ambil terhadap cahaya atau held up ke light. Filling harus terlihat even distributed, gak ada big chunks yang push the skin out unevenly.</p>

<h2>5. Ask About the Production Date</h2>
<p>Ini yang orang suka forget. Production date itu penting banget. Target yang dibuat maximal 2-3 hari sebelumnya kalo frozen, atau same day kalo fresh dari refrigerator section.Production date yang lebih dari seminggu = downgrade quality meskipun still edible.</p>

<h2>Pro Tips: Reheating</h2>
<p>Biarpun dim sum dari supermarket gak se-fresh restaurant, dengan cara reheat yang bener, bisa dekat dengan original:</p>
<ul>
<li><strong>Kukus</strong> — best method. 5-7 menit dari frozen, 2-3 menit dari thawed.</li>
<li><strong>Air fryer</strong> — 180C buat 6-8 menit, kasih crispy texture.</li>
<li><strong>Microwave</strong> — last resort. Add splash of water, cover, 2-3 mins. Gak ideal tapi acceptable.</li>
</ul>

<p>Dengan tips ini, kamu bakal lebih confident pilih dim sum yang worth every rupiah.</p>`,
    category: "cooking tips",
    imageUrl: "/image/3. Dimsum Mozarella.png",
    published: 1,
    featured: 0,
  },
  {
    title: "Kuliner Dapur Dekaka Di Review oleh 3 Food Reviewers Berbeda — Hasilnya?",
    slug: "kuliner-dapur-dekaka-di-review-food-reviewers",
    excerpt: "Tiga food reviewers dengan gaya berbeda mencicipi menu Andalan Dapur Dekaka. Semua results positive — tapi ada satu dish yang bikin mereka semua agree.",
    content: `<p>Kami ngajak tiga food reviewers dengan latar belakang dan taste preference berbeda buat coba menu Andalan Dapur Dekaka tanpa disclosure. Berikut hasil yang jujur.</p>

<h2>Reviewer 1: @MakanBareng_Ani (Comfort Food Enthusiast)</h2>
<p><em>"Biasanya aku skeptis sama chinese food yang claim halal. Rasanya pasti compromised, gitu asumsi awal aku. Tapi waktu masuk Siomay Kepiting, aku shut up. Udang-nya kenyal dan gak overcooked. Kulitnya tepat — translucent tapi gak sobek pas dikunyah. Saus chili oil-nya jujur — aromatik, bukan cuma pedas. Untuk Rp 28k per porsi, ini value for money."</em></p>

<h2>Reviewer 2: @RickyMakan (Street Food Purist)</h2>
<p><em>"Aku prefer street food authenticity. Nah, yang menarik dari Dapur Dekaka adalah mereka maintain that hawker food feeling tapi dengan consistency restaurant. Lumpia Kulit Tahu di sini crispy even after 20 minutes since served — which is rare. Biasanya lumpia kulit tahu langsung soggy. Pros: texture on point. Cons: kalau boleh minta, lebihin porsi biar aku bisa satu box buat myself."</em></p>

<h2>Reviewer 3: @Vivi_FoodieDairy (Visual Content Creator)</h2>
<p><em>"Dari sisi plating dan presentation, Dapur Dekaka gak perlu malu-maluin. Dim Sum Nori itu photogenic — warna hijau nori контра sama isi orange dari carrot dan pink dari udang. Sangat Instagram-worthy. Flavor-wise: fresh, clean, dan gak overwhelming. Cocok buat yang suka aesthetic food tapi tetep看重 taste."</em></p>

<h2>The Consensus</h2>
<p>Ketiganya agree pada satu hal: <strong>Dim Sum Mozarella</strong> adalah standout dish. Chees yang stretch sempurna, udang yang gak kalah sama cheese — balance yang rarely found di chinese food Indonesia. Semua planned untuk kembali specifically buat this dish.</p>

<h2>Constructive Criticism</h2>
<p>Semua reviewers juga notice area yang bisa improvement:</p>
<ul>
<li>Spacing di tempat makan agak sempit pas weekend — more tables but also more crowd</li>
<li>Menu printed card would help — sometimes aku Mau tahu details ingredients dari setiap dish</li>
<li>Online order system masih basic — hope they invest in better platform</li>
</ul>

<p>Overall, three thumbs up. Dapur Dekaka udah establish diri sebagai go-to spot buat dim sum halal yang gak compromise on taste.</p>`,
    category: "reviews",
    imageUrl: "/image/3. Dimsum Mozarella.png",
    published: 1,
    featured: 1,
  },
  {
    title: "Perbedaan Kulit Pangsit, Kulit Tahu, dan Kulit Wonton: Guide Singkat",
    slug: "perbedaan-kulit-pangsit-kulit-tahu-kulit-wonton-guide",
    excerpt: "Tiga jenis wrapper yang sering bikin bingung. Kami jelasin beda texture, use case, dan bagaimana memilih yang tepat untuk setiap jenis dim sum.",
    content: `<p>Udah sering makan dim sum tapi penasaran kenapa tekstur luar kadang crispy, kadang lembut, kadang translucent? Jawabannya ada di wrapper. Tiga jenis yang paling sering dipake: kulit pangsit, kulit tahu, dan kulit wonton. Yuk dijelasin.</p>

<h2>Kulit Pangsit (Dumpling Skin)</h2>
<p>Kulit pangsit dibuat dari adonan tepung terigu yang digiling tipis. Warnanya putih, texture-nya chewy dan slightly thick. Karena struktur glutennya, kulit pangsit lebih kuat — hold shape better under filling weight dan gak gampang sobek.</p>
<p><strong>Best for:</strong> Siomay, gwoca (jiaozi), hidangan yang dikukus atau direbus. Karena kulit pangsit absorbs flavors dari filling dan kuah — bikin setiap gigitan juicy.</p>

<h2>Kulit Tahu (Bean Curd Skin / Toufu Skin)</h2>
<p>Kulit tahu sebenarnya adalah permukaan luar dari tahu yang dikeringkan. Warnanya kekuningan, texture-nya crispy dan lightweight. Karena pori-porinya ada di permukaan, ini yang bikin crispy banget pas digoreng.</p>
<p><strong>Best for:</strong> Lumpia, egg rolls, fried dim sum. Gak bisa dikukus —到时候 bakal soggy dan lose identity. Kulit tahu is all about that crunch.</p>

<h2>Kulit Wonton (Wonton Skin)</h2>
<p>Kulit wonton paling tipis dari ketiganya. Terbuat dari adonan tepung dan telur, digiling sampai transparency. Warnanya translucent, hampir bisa baca huruf di baliknya.</p>
<p><strong>Best for:</strong> Har Gow (shrimp dumplings), hidangan yang dikukus dan mau keliatan isiannya. Karena tipis, kulit wonton butuh filling yang cohesive — otherwise will tear.</p>

<h2>Dapur Dekaka Combo</h2>
<p>Di restoran, biasanya ketiganya dipake untuk dish yang berbeda — karena masing-masing punya karakter yang beda. Di Dapur Dekaka:</p>
<ul>
<li>Siomay → kulit pangsit</li>
<li>Lumpia → kulit tahu</li>
<li>Har Gow-style → kulit wonton</li>
<li>Dim sum classsic → varies based on dish</li>
</ul>

<h2>Can You Substitute?</h2>
<p>Technically bisa, tapi hasilnya bakal beda. Replacing kulit tahu with kulit pangsit buat lumpia? Texture won't match — kulit pangsit gak akan crispy seperti kulit tahu. Each wrapper was chosen for a reason. Trust the process.</p>

<p>Understanding wrapper differences adalah step fundamental buat appreciate dim sum lebih dalam. Next time makan, notice kulitnya — you'll taste the difference that wrapper choice makes.</p>`,
    category: "cooking tips",
    imageUrl: "/image/7. Lumpia (Kulit Tahu).png",
    published: 1,
    featured: 0,
  },
  {
    title: "Chinese Food Indonesia: Bagaimana Dim Sum Beradaptasi dengan Selera Lokal",
    slug: "chinese-food-indonesia-dim-sum-adaptasi-selera-lokal",
    excerpt: "Dim sum yang kita makan di Indonesia beda sama yang di China. Bukan error — ini adalah hasil adaptasi budaya yang bikin kuliner jadi lebih kaya.",
    content: `<p>Kalau kamu pernah makan dim sum di China atau Hong Kong dan bandingin sama yang di Indonesia, pasti notice ada taste difference. Bukan soal better or worse — ini soal adaptation dan local taste profile yang naturally berkembang.</p>

<h2>Kenapa Beda?</h2>
<p>Chinese food di Indonesia udah undergo process yang kita sebut "localization" — adaptasi bahan, bumbu, dan teknik biar sesuai sama palate dan budaya makan Indonesia. Beberapa factor utama:</p>

<h3>1. Availability Bahan</h3>
<p>Beberapa Cantonese ingredients susah dapet di Indonesia. Shrimp paste yang authentic misalnya — biasanya substituted dengan kecap asin atau bahan lain yang lebih accessible. Gak 100% authentic, tapi flavor profile tetap recognizable.</p>

<h3>2. Sweetener Preference</h3>
<p>Cantonese cuisine emang slightly sweet, tapi palate Indonesia cenderung lebih sweet dari itu. Chinese Indonesian dishes sering nambahin gula atau kecap manis lebih banyak — see: babi kecap, ayam kecap. Di dim sum, kamu bakal notice sauce yang slightly sweeter dari original.</p>

<h3>3. Spice Adaptation</h3>
<p>Original Cantonese dim sum biasanya mild. Tapi Indonesian market expect variety — hence, Spicy Dim Sum dan Chili Oil yang lebih vibrant. Bukan adaptation yang disrespectful, tapi responsive to market demand.</p>

<h3>4. Halal Consideration</h3>
<p>Ini yang unique di Indonesia. Kalau di China kehalalan bukan concern, di Indonesia ini mandatory requirement. Restoran halal harus lebih careful soal stock, cross-contamination, dan certification. Ini无形中 affect menu selection dan preparation method.</p>

<h2>Is It Less Authentic?</h2>
<p>Depends on how you define authenticity. If authenticity = historical accuracy from Guangdong circa 1950, then yes, Chinese Indonesian dim sum is "less authentic."</p>
<p>But if authenticity = honest representation of how a food culture evolves when it moves to new environment, then Chinese Indonesian dim sum IS authentic — just different tradition.</p>

<h2>Contoh Nyata di Dapur Dekaka</h2>
<p>Dim Sum Mozarella adalah dish yang gak ada di Cantonese dim sum traditional. Tapi ini bukan Chinese food yang "salah" — ini Chinese Indonesian food yang "benar" dalam konteksnya. Cheese sebagai ingredient menunjukkan how local cooks adapt and experiment.</p>

<p>Same thing with Ekado Mayo — fusion yang gak pretending to be traditional, tapi owning its identity as local innovation. And honestly? Itu yang bikin Chinese Indonesian food so interesting to explore.</p>

<h2>The Bigger Picture</h2>
<p>Every cuisine that migrates undergoes adaptation. Italian food di Amerika beda dari Italia. Mexican food di US beda dari Mexico. Chinese food di Indonesia gak akan sama dengan China — dan that's perfectly fine. Food is living culture, not museum artifact.</p>

<p>Yang penting: whether traditional atau adapted, dim sum yang good tetap good. Gak harus choose between authentic dan delicious — sometimes you get both.</p>`,
    category: "food culture",
    imageUrl: "/image/9. Dimsum Rambutan.png",
    published: 1,
    featured: 0,
  },
];

function calculateReadTime(content: string): number {
  const stripped = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = stripped.split(" ").filter(Boolean).length;
  return Math.ceil(wordCount / 200);
}

async function slugExists(slug: string): Promise<boolean> {
  const result = await db
    .select()
    .from(schema.blogPosts)
    .where(eq(schema.blogPosts.slug, slug))
    .limit(1);
  return result.length > 0;
}

async function seed() {
  console.log("Starting blog seeding...\n");

  // Check if articles already exist
  const existingPosts = await db.select().from(schema.blogPosts);
  if (existingPosts.length > 0) {
    console.log(
      `Blog table already has ${existingPosts.length} posts. Skipping seed to avoid duplicates.\n` +
      `Delete existing posts first if you want to reseed.`
    );
    console.log("Existing posts:");
    existingPosts.forEach((p) =>
      console.log(`  - [${p.id}] ${p.title} (published: ${p.published})`)
    );
    process.exit(0);
  }

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const readTime = calculateReadTime(article.content);

    // Ensure slug uniqueness
    let finalSlug = article.slug;
    let suffix = 1;
    while (await slugExists(finalSlug)) {
      finalSlug = `${article.slug}-${suffix}`;
      suffix++;
    }

    try {
      const [created] = await db
        .insert(schema.blogPosts)
        .values({
          title: article.title,
          slug: finalSlug,
          excerpt: article.excerpt,
          content: article.content,
          imageUrl: article.imageUrl,
          authorId: AUTHOR_ID,
          authorName: "Dapur Dekaka Team",
          category: article.category,
          published: article.published,
          featured: article.featured,
          readTime,
          orderIndex: i,
        })
        .returning();

      console.log(
        `[${i + 1}/${articles.length}] Created: "${created.title}" (slug: ${created.slug})`
      );
    } catch (err) {
      console.error(`Failed to insert "${article.title}":`, err);
    }
  }

  console.log("\nBlog seeding complete!");
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
