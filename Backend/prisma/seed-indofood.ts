import { PrismaClient, Difficulty, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const firstNames = ["Budi", "Ratna", "Wahyu", "Siska", "Andi", "Maya", "Raka", "Siti", "Hendra", "Diana", "Fajar", "Lina", "Reza", "Sari", "Dedi", "Ayu", "Joko", "Tika", "Ivan", "Clara", "Dimas", "Nadia", "Faisal", "Surya", "Daniel"];
const lastNames = ["Pratama", "Wijaya", "Kusuma", "Saputra", "Setiawan", "Haryanto", "Ananda", "Prabowo", "Firmansyah", "Amelia", "Sidiq", "Kartika", "Anggara", "Sinta", "Mulyana", "Wiguna", "Susilo", "Rahmawati", "Hakim", "Putri"];

let nameIndex = 0;
function generateName() {
  const first = firstNames[nameIndex % firstNames.length];
  const last = lastNames[(nameIndex * 3) % lastNames.length];
  nameIndex++;
  return `${first} ${last}`;
}

const div1Courses = [
  {
    title: "Indomie Varian Baru ke Minimarket Lokal",
    description: "Menawarkan Indomie varian rasa lokal baru ke minimarket independen.",
    difficulty: Difficulty.Beginner,
    category: "FMCG Retail",
    personaName: "Pak Anton",
    personaRole: "Pemilik Minimarket",
    personaBackground: "Pemilik toko kelontong modern yang sensitif harga.",
    personaPainPoints: "Rak sudah penuh, margin mie instan tipis.",
    personaObjections: "Varian baru jarang laku dibanding rasa original.",
    personaBuyingSignals: "Menanyakan apakah ada promo beli putus atau konsinyasi.",
    personaPersonality: "Praktis dan to-the-point.",
    productName: "Indomie Rasa Seblak Hot Jeletot",
    productDescription: "Varian baru Indomie dengan target anak muda pencinta pedas.",
    productStrengths: "Viral di sosmed, margin lebih tinggi 15% dari varian biasa.",
    scenarioContext: "Kunjungan rutin bulanan ke toko Pak Anton.",
    idealOutcome: "Pak Anton setuju mengambil 5 karton sebagai trial."
  },
  {
    title: "Negosiasi Diskon Volume Indomie Grosir",
    description: "Menghadapi agen grosir yang meminta diskon ekstra untuk pembelian 1000 karton.",
    difficulty: Difficulty.Intermediate,
    category: "B2B Wholesale",
    personaName: "Bu Siska",
    personaRole: "Pemilik Agen Grosir",
    personaBackground: "Distributor lokal yang memasok puluhan warung kecil.",
    personaPainPoints: "Kompetisi harga dengan agen lain sangat ketat.",
    personaObjections: "Kalau tidak ada diskon tambahan 5%, saya kurangi order bulan ini.",
    personaBuyingSignals: "Mengeluh stok di gudangnya mulai menipis.",
    personaPersonality: "Keras dan suka menawar tajam.",
    productName: "Indomie Goreng & Kari Ayam (Grosir)",
    productDescription: "Produk fast-moving yang menjadi tulang punggung agen.",
    productStrengths: "Permintaan pasar selalu tinggi, barang pasti habis.",
    scenarioContext: "Pertemuan akhir bulan untuk kejar target sales.",
    idealOutcome: "Bu Siska tetap ambil 1000 karton dengan diskon standar + bonus merchandise."
  },
  {
    title: "Pitching Indomie Export Quality ke Hotel",
    description: "Menawarkan Indomie varian premium untuk breakfast buffet hotel.",
    difficulty: Difficulty.Advanced,
    category: "Horeca",
    personaName: "Chef Junaedi",
    personaRole: "Executive Chef",
    personaBackground: "Chef di hotel bintang 3 yang ingin menekan food cost.",
    personaPainPoints: "Tamu sering komplain makanan kurang variasi.",
    personaObjections: "Mie instan merusak citra hotel kami.",
    personaBuyingSignals: "Tertarik dengan ide 'live cooking station' mie instan.",
    personaPersonality: "Kritis terhadap kualitas dan presentasi.",
    productName: "Indomie Premium Collection (Real Meat)",
    productDescription: "Indomie dengan daging asli, kemasan khusus horeca.",
    productStrengths: "Cepat disajikan, food cost rendah, rasa konsisten.",
    scenarioContext: "Meeting presentasi produk di dapur hotel.",
    idealOutcome: "Chef Junaedi setuju membuka live cooking station Indomie saat sarapan."
  },
  {
    title: "Penawaran Indomie Soto Lamongan ke Warkop",
    description: "Mengganti mie kompetitor di Warkop dengan Indomie Soto Lamongan.",
    difficulty: Difficulty.Beginner,
    category: "Horeca Kecil",
    personaName: "Cak Slamet",
    personaRole: "Pemilik Warkop",
    personaBackground: "Pemilik 2 cabang warkop 24 jam.",
    personaPainPoints: "Pengunjung bosan dengan menu mie soto biasa.",
    personaObjections: "Pelanggan sudah terbiasa dengan merk S.",
    personaBuyingSignals: "Mencicipi sampel dan mengakui kuahnya lebih kental.",
    personaPersonality: "Ramah tapi sangat loyal pada merk lama.",
    productName: "Indomie Soto Lamongan",
    productDescription: "Varian soto lamongan asli dengan koya.",
    productStrengths: "Rasa autentik, bumbu koya meningkatkan nilai jual warkop.",
    scenarioContext: "Ngopi santai sore hari di warkop Cak Slamet.",
    idealOutcome: "Cak Slamet pesan 3 dus untuk dicoba jual seminggu."
  },
  {
    title: "Kerjasama Sponsorship Indomie Hype Abis di Kampus",
    description: "Pitching sponsorship acara festival musik BEM Universitas.",
    difficulty: Difficulty.Advanced,
    category: "Event B2B",
    personaName: "Nanda",
    personaRole: "Ketua Panitia Festival",
    personaBackground: "Mahasiswa tingkat akhir yang butuh dana sponsor cepat.",
    personaPainPoints: "Acara bulan depan tapi dana sponsor makanan masih kurang.",
    personaObjections: "Brand sebelah berani kasih uang tunai lebih besar.",
    personaBuyingSignals: "Bertanya apakah Indomie bisa pasang booth free-tasting.",
    personaPersonality: "Dinamis, ambisius, dan negosiator yang cerdik.",
    productName: "Indomie Hype Abis Seblak Macaroni",
    productDescription: "Seri Indomie pedas kekinian.",
    productStrengths: "Pasti disukai anak muda, brand hype kuat.",
    scenarioContext: "Meeting via Zoom dengan tim panitia inti.",
    idealOutcome: "Deal buka booth eksklusif dengan sistem bagi hasil tiket."
  },
  {
    title: "Retensi Pelanggan Supermarket - Keluhan Mie Hancur",
    description: "Menangani keluhan manajer supermarket terkait kiriman Indomie yang remuk.",
    difficulty: Difficulty.Intermediate,
    category: "Customer Retention",
    personaName: "Ibu Lani",
    personaRole: "Store Manager",
    personaBackground: "Manager Supermarket lokal menengah.",
    personaPainPoints: "Pelanggan komplain saat beli mie ternyata di dalamnya hancur.",
    personaObjections: "Kalau begini terus, saya tidak mau restock dari distributor Anda lagi.",
    personaBuyingSignals: "Mereda setelah ditawari penggantian barang rusak (retur).",
    personaPersonality: "Emosional saat ada masalah, tapi loyal jika dilayani baik.",
    productName: "Indomie Goreng Original",
    productDescription: "Produk mie goreng terlaris.",
    productStrengths: "Garansi retur barang cacat pengiriman tanpa biaya tambahan.",
    scenarioContext: "Kunjungan mendadak untuk menangani komplain di ruang manager.",
    idealOutcome: "Ibu Lani setuju barang diretur hari ini dan tetap lanjut PO bulan depan."
  },
  {
    title: "Penetrasi Sarimi Isi 2 ke Kantin Pabrik",
    description: "Meyakinkan pengelola kantin pabrik untuk menggunakan Sarimi Isi 2.",
    difficulty: Difficulty.Intermediate,
    category: "B2B Institution",
    personaName: "Pak Yanto",
    personaRole: "Ketua Koperasi Kantin",
    personaBackground: "Mengelola makan siang 2000 buruh pabrik.",
    personaPainPoints: "Porsi mie biasa kurang mengenyangkan untuk buruh.",
    personaObjections: "Harga Sarimi Isi 2 masih kemahalan untuk standar kantin buruh.",
    personaBuyingSignals: "Tertarik saat ditunjukkan perhitungan porsi (cost per piring).",
    personaPersonality: "Sangat fokus pada efisiensi biaya per kepala.",
    productName: "Sarimi Isi 2 Rasa Kari Ayam",
    productDescription: "Mie porsi jumbo untuk pekerja keras.",
    productStrengths: "1 bungkus bisa untuk porsi kuli, lebih hemat daripada masak 2 bungkus mie biasa.",
    scenarioContext: "Presentasi di koperasi pabrik saat jam istirahat.",
    idealOutcome: "Pak Yanto setuju ganti menu dari 2 bungkus merk lain ke 1 bungkus Sarimi Isi 2."
  },
  {
    title: "Upselling Supermi Nutrimi ke Supermarket Premium",
    description: "Menjual Supermi varian sehat ke supermarket segmen menengah ke atas.",
    difficulty: Difficulty.Intermediate,
    category: "Modern Trade",
    personaName: "Miss Celine",
    personaRole: "Purchasing Manager",
    personaBackground: "Bertugas memilih produk sehat/organik untuk supermarket premium.",
    personaPainPoints: "Permintaan mie sehat organik naik, tapi pilihannya sedikit.",
    personaObjections: "Konsumen kami tidak menganggap produk Indofood sebagai 'makanan sehat'.",
    personaBuyingSignals: "Membaca komposisi brokoli dan tanpa MSG di kemasan.",
    personaPersonality: "Teliti dan sangat health-conscious.",
    productName: "Supermi Nutrimi Steak Ayam",
    productDescription: "Mie instan tanpa MSG, diwarnai dengan brokoli.",
    productStrengths: "Lulus uji BPOM pilihan lebih sehat, bebas penguat rasa.",
    scenarioContext: "Pitching produk baru di kantor pusat supermarket.",
    idealOutcome: "Listing 2 SKU Supermi Nutrimi di rak 'Healthy Food'."
  },
  {
    title: "Distribusi Pop Mie Kuah Pedas ke Kolam Renang",
    description: "Memasukkan Pop Mie varian kuah pedas dower ke kantin wahana wisata air.",
    difficulty: Difficulty.Beginner,
    category: "Recreational Retail",
    personaName: "Mas Danar",
    personaRole: "Pengelola Kantin Wahana",
    personaBackground: "Mengelola Food Court di waterboom terkenal.",
    personaPainPoints: "Habis renang, pengunjung pasti cari makanan hangat dan cepat.",
    personaObjections: "Sampah cup plastik dari Pop Mie susah dikelola wahana.",
    personaBuyingSignals: "Mengakui profit dari jualan mie cup sangat tinggi.",
    personaPersonality: "Santai, tapi peduli kebersihan area wisata.",
    productName: "Pop Mie Kuah Pedas Dower",
    productDescription: "Mie seduh praktis dengan rasa ekstra pedas.",
    productStrengths: "Praktis, langsung seduh tanpa kompor, margin sangat besar.",
    scenarioContext: "Survei lapangan dan negosiasi di pinggir kolam.",
    idealOutcome: "Deal order Pop Mie rutin mingguan plus Indofood meminjamkan tong sampah khusus cup."
  },
  {
    title: "Meyakinkan Agen Keliling (Starling) Jual Indomie Cup",
    description: "Pitching Pop Mie Mini ke komunitas pedagang kopi keliling.",
    difficulty: Difficulty.Intermediate,
    category: "Micro Retail",
    personaName: "Bang Ocid",
    personaRole: "Ketua Paguyuban Starling",
    personaBackground: "Memimpin 50 pedagang kopi sepeda keliling.",
    personaPainPoints: "Termos air panas cepat habis kalau dipakai nyeduh Pop Mie besar.",
    personaObjections: "Pop Mie biasa itu butuh air banyak, jualan kopi jadi tersendat.",
    personaBuyingSignals: "Penasaran saat melihat Pop Mie ukuran mini (seduh cepat).",
    personaPersonality: "Solidaritas tinggi dengan sesama pedagang.",
    productName: "Pop Mie Mini Sapi",
    productDescription: "Pop Mie ukuran kecil yang airnya sedikit.",
    productStrengths: "Cepat matang, hemat air panas, harga jual sangat terjangkau anak sekolah.",
    scenarioContext: "Ngobrol di pangkalan sepeda starling.",
    idealOutcome: "Paguyuban setuju beli 50 karton Pop Mie Mini setiap minggu."
  }
];

const div2Courses = [
  {
    title: "Menjual Tepung Cakra Kembar ke Pabrik Roti",
    description: "Meyakinkan pabrik roti untuk beralih menggunakan Cakra Kembar.",
    difficulty: Difficulty.Advanced,
    category: "Industrial Sales",
    personaName: "Ko Hasan",
    personaRole: "Pemilik Pabrik Roti",
    personaBackground: "Pabrik roti tawar yang memproduksi 10.000 bungkus/hari.",
    personaPainPoints: "Sering retur karena roti cepat bantat.",
    personaObjections: "Harga Bogasari terlalu mahal, margin saya tipis.",
    personaBuyingSignals: "Mengeluhkan tepung merk X yang kualitasnya tidak stabil.",
    personaPersonality: "Sangat perhitungan soal biaya produksi.",
    productName: "Bogasari Cakra Kembar 25kg",
    productDescription: "Tepung terigu protein tinggi untuk roti berkualitas.",
    productStrengths: "Kualitas sangat stabil, daya serap air tinggi (hasil roti lebih banyak).",
    scenarioContext: "Sales call ke pabrik setelah mereka mengalami retur besar-besaran.",
    idealOutcome: "Ko Hasan bersedia mencoba 1 ton Cakra Kembar untuk trial produksi."
  },
  {
    title: "Edukasi Segitiga Biru ke Komunitas UMKM Kue",
    description: "Menjual dan mengedukasi ibu-ibu UMKM untuk pakai Segitiga Biru.",
    difficulty: Difficulty.Intermediate,
    category: "B2C / Community",
    personaName: "Bu Ningsih",
    personaRole: "Ketua Koperasi UMKM",
    personaBackground: "Koperasi pembuat kue basah tradisional.",
    personaPainPoints: "Hasil kue kadang gagal karena salah pilih tepung.",
    personaObjections: "Anggota kami biasa beli tepung curah tanpa merk.",
    personaBuyingSignals: "Tertarik dengan program pelatihan baking gratis dari Bogasari.",
    personaPersonality: "Kompak dan sangat dipengaruhi diskon kelompok.",
    productName: "Bogasari Segitiga Biru 1kg",
    productDescription: "Tepung terigu protein sedang serbaguna.",
    productStrengths: "Hasil kue pasti jadi, aman dan higienis.",
    scenarioContext: "Presentasi di balai desa acara PKK/UMKM.",
    idealOutcome: "Koperasi berkomitmen membeli 50 karton per bulan secara kolektif."
  },
  {
    title: "Tepung Lencana Merah untuk Pabrik Kerupuk",
    description: "Meyakinkan produsen kerupuk kaleng untuk beralih ke Lencana Merah.",
    difficulty: Difficulty.Intermediate,
    category: "Industrial Sales",
    personaName: "Haji Ujang",
    personaRole: "Pemilik Pabrik Kerupuk",
    personaBackground: "Juragan kerupuk kaleng terbesar di kabupaten.",
    personaPainPoints: "Tepung tapioka campurannya sering membuat kerupuk tidak mekar sempurna.",
    personaObjections: "Terigu murah biasanya banyak kutunya kalau disimpan lama.",
    personaBuyingSignals: "Menanyakan sistem pembayaran tempo.",
    personaPersonality: "Konservatif, lebih percaya omongan sesama pengusaha.",
    productName: "Bogasari Lencana Merah",
    productDescription: "Tepung terigu protein rendah ekonomis.",
    productStrengths: "Harga terjangkau, mekar sempurna untuk gorengan/kerupuk, bebas kutu.",
    scenarioContext: "Duduk di pabrik kerupuk yang bising.",
    idealOutcome: "Haji Ujang setuju order perdana 5 ton dengan TOP (Term of Payment) 14 hari."
  },
  {
    title: "Pitching Kunci Biru ke Toko Kue Artis (Premium Bakery)",
    description: "Menjual tepung khusus pastry/cake ke toko kue yang viral.",
    difficulty: Difficulty.Advanced,
    category: "Premium Horeca",
    personaName: "Chef Renata",
    personaRole: "Head Pastry Chef",
    personaBackground: "Lulusan Le Cordon Bleu yang perfeksionis.",
    personaPainPoints: "Sponge cake sering turun (kempes) kalau pakai tepung biasa.",
    personaObjections: "Saya biasa pakai tepung impor dari Jepang untuk kue kami.",
    personaBuyingSignals: "Terkejut melihat hasil lab Bogasari Kunci Biru Premium.",
    personaPersonality: "Sangat teknis, kritis soal spesifikasi abu (ash) dan protein.",
    productName: "Bogasari Kunci Biru Premium",
    productDescription: "Tepung protein rendah spesifikasi tinggi untuk pastry/cake.",
    productStrengths: "Hasil cake super lembut, setara tepung impor dengan harga 40% lebih murah.",
    scenarioContext: "Demo baking langsung di dapur uji coba (test kitchen) toko kue.",
    idealOutcome: "Chef Renata beralih 100% menggunakan Kunci Biru Premium."
  },
  {
    title: "Upselling La Fonte Pasta ke Restoran Italia",
    description: "Menawarkan pasta La Fonte kemasan 1 kg ke restoran keluarga Italia.",
    difficulty: Difficulty.Intermediate,
    category: "Horeca",
    personaName: "Pak Mario",
    personaRole: "Pemilik Restoran",
    personaBackground: "Mantan chef kapal pesiar yang buka restoran Italia lokal.",
    personaPainPoints: "Biaya impor pasta sangat mencekik margin saat dolar naik.",
    personaObjections: "Pelanggan kami tahu bedanya pasta Italia asli dan pasta lokal.",
    personaBuyingSignals: "Meminta sampel untuk diolah menjadi Spaghetti Aglio Olio.",
    personaPersonality: "Ramah namun sangat bangga dengan keaslian masakannya.",
    productName: "La Fonte Spaghetti 1kg (Food Service)",
    productDescription: "Pasta kering dari gandum durum pilihan kualitas ekspor.",
    productStrengths: "Al dente persis seperti pasta impor, harga sangat hemat untuk horeca.",
    scenarioContext: "Pertemuan di sela-sela waktu istirahat restoran (jam 3 sore).",
    idealOutcome: "Pak Mario setuju melakukan blind test dengan pelanggannya besok."
  },
  {
    title: "Penawaran Chesa (Premix) ke Kafe Pemula",
    description: "Menjual tepung premix instan Bogasari Chesa ke pemilik kafe yang tidak punya chef pastry.",
    difficulty: Difficulty.Beginner,
    category: "Horeca Kecil",
    personaName: "Mbak Tiara",
    personaRole: "Owner Kafe Kekinian",
    personaBackground: "Anak muda yang baru buka coffee shop tapi bingung cari menu dessert.",
    personaPainPoints: "Gaji pastry chef mahal, kue sering sisa dan basi.",
    personaObjections: "Premix instan rasanya pasti ketahuan murahan.",
    personaBuyingSignals: "Matanya berbinar saat tahu Chesa Brownies cuma butuh tambah telur & mentega.",
    personaPersonality: "Praktis, butuh solusi cepat dan instagramable.",
    productName: "Chesa Brownies & Chesa Pancake",
    productDescription: "Tepung premix instan anti gagal.",
    productStrengths: "Siapapun bisa membuat, konsisten setiap saat, hemat biaya SDM.",
    scenarioContext: "Meeting sambil ngopi di kafenya yang sepi karena belum ada dessert.",
    idealOutcome: "Mbak Tiara pesan 2 karton Chesa untuk menu 'Fresh Baked Brownies'."
  },
  {
    title: "Distribsi Segitiga Biru ke Pasar Tradisional",
    description: "Meyakinkan grosir pasar untuk menambah stok kemasan 1 kg dibanding eceran karungan.",
    difficulty: Difficulty.Intermediate,
    category: "Traditional Trade",
    personaName: "Koh Atek",
    personaRole: "Grosir Sembako Pasar",
    personaBackground: "Pemain lama di pasar basah yang menguasai suplai tepung se-pasar.",
    personaPainPoints: "Banyak tepung karung yang susut karena dimakan tikus atau tumpah.",
    personaObjections: "Pembeli pasar maunya beli kiloan plastik curah, kemasan 1kg kurang laku.",
    personaBuyingSignals: "Mengeluh capek nimbang tepung dari karung 25kg tiap pagi.",
    personaPersonality: "Pelit tapi pintar hitung-hitungan susut.",
    productName: "Bogasari Segitiga Biru 1kg (Kemasan Ritel)",
    productDescription: "Kemasan praktis 1kg anti tumpah dan anti kutu.",
    productStrengths: "Nol penyusutan, tidak perlu repot nimbang, higienis.",
    scenarioContext: "Berdiri di lorong toko Koh Atek yang padat.",
    idealOutcome: "Koh Atek setuju menambah porsi stok kemasan 1kg jadi 30% dari total order."
  },
  {
    title: "Program 'Bogasari Mitra Card' (BMC) ke Penjual Mie Ayam",
    description: "Mengajak juragan mie ayam untuk daftar BMC agar loyal pakai Cakra Kembar.",
    difficulty: Difficulty.Intermediate,
    category: "Customer Loyalty",
    personaName: "Pak Kumis",
    personaRole: "Pemilik Depot Mie Ayam",
    personaBackground: "Bikin mie basah sendiri, produksi 50kg mie/hari.",
    personaPainPoints: "Butuh modal mesin giling mie baru.",
    personaObjections: "Daftar member ribet, buat apa kumpulin poin lama-lama?",
    personaBuyingSignals: "Tertarik saat dengar poin bisa ditukar dengan mesin giling mie.",
    personaPersonality: "Pragmatis, hanya peduli untung rugi real.",
    productName: "Bogasari Cakra Kembar (Member BMC)",
    productDescription: "Tepung khusus mie + Program Loyalitas BMC.",
    productStrengths: "Kenyal maksimal, poin bisa ditukar alat usaha, ada asuransi kesehatan.",
    scenarioContext: "Kunjungan malam hari setelah depot tutup.",
    idealOutcome: "Pak Kumis mendaftar BMC dan komitmen beli 20 sak/bulan."
  },
  {
    title: "Penanganan Krisis - Terigu Berjamur di Gudang Distributor",
    description: "Menangani distributor besar yang ngamuk karena stok tepungnya berjamur.",
    difficulty: Difficulty.Advanced,
    category: "Conflict Resolution",
    personaName: "Bapak Surya",
    personaRole: "Pemilik Distributor Utama",
    personaBackground: "Distributor penyumbang 40% penjualan area tersebut.",
    personaPainPoints: "Gudangnya baru bocor saat hujan, membuat puluhan sak tepung rusak.",
    personaObjections: "Ini pasti kemasannya yang bocor dari pabrik, saya minta retur semua!",
    personaBuyingSignals: "Terlihat ragu saat ditunjukkan bukti foto atap gudangnya yang bocor.",
    personaPersonality: "Keras kepala dan suka menyalahkan orang lain (defensif).",
    productName: "Semua Varian Bogasari 25kg",
    productDescription: "Penyelesaian masalah penyimpanan (Good Warehousing Practice).",
    productStrengths: "Bogasari bersedia bantu retur 50% sebagai 'goodwill', sisanya tanggung jawab gudang.",
    scenarioContext: "Inspeksi langsung ke gudang Bapak Surya yang lembab.",
    idealOutcome: "Surya menerima edukasi paletisasi, setuju patungan kerugian 50-50, hubungan tetap terjaga."
  },
  {
    title: "Pitching Tepung Taj Mahal ke Pabrik Roti India",
    description: "Mempromosikan tepung gandum utuh (whole wheat) Bogasari ke produsen roti canai.",
    difficulty: Difficulty.Intermediate,
    category: "Niche B2B",
    personaName: "Mr. Raj",
    personaRole: "Pemilik Pabrik Roti Canai/Prata",
    personaBackground: "Ekspatriat yang memproduksi roti canai frozen untuk supermarket.",
    personaPainPoints: "Tepung gandum utuh lokal teksturnya terlalu kasar untuk canai.",
    personaObjections: "Tepung Taj Mahal mahal, saya pakai campuran terigu biasa saja.",
    personaBuyingSignals: "Menanyakan apakah warna tepungnya cukup gelap untuk Roti Prata asli.",
    personaPersonality: "Menuntut kualitas autentik, suka berdebat teknis.",
    productName: "Bogasari Taj Mahal",
    productDescription: "Tepung gandum utuh (Whole Wheat) premium.",
    productStrengths: "Tekstur pas, serat tinggi, aroma gandum utuh kuat.",
    scenarioContext: "Pabrik canai yang sedap berbau mentega (ghee).",
    idealOutcome: "Mr. Raj bersedia mensubstitusi 30% tepung biasanya dengan Taj Mahal."
  }
];

const div3Courses = [
  {
    title: "Indomilk UHT untuk Program Susu Sekolah",
    description: "Melakukan B2B pitching ke Yayasan Sekolah untuk suplai susu bulanan.",
    difficulty: Difficulty.Intermediate,
    category: "B2B Institution",
    personaName: "Bapak Kepala Sekolah",
    personaRole: "Ketua Yayasan",
    personaBackground: "Mengelola SD swasta premium dengan 1000 siswa.",
    personaPainPoints: "Anak-anak sering bosan dengan rasa susu yang monoton.",
    personaObjections: "Kami sedang mempertimbangkan kompetitor (U*tra).",
    personaBuyingSignals: "Menanyakan apakah ada program CSR atau sponsorship pensi.",
    personaPersonality: "Berwibawa dan fokus pada gizi anak.",
    productName: "Indomilk Kids UHT",
    productDescription: "Susu UHT dengan kalsium tinggi dan rendah gula.",
    productStrengths: "Pilihan rasa banyak (Korea varian), gizi terjamin, kemasan ramah lingkungan.",
    scenarioContext: "Meeting di ruang kepala sekolah.",
    idealOutcome: "Deal suplai eksklusif 1000 kotak susu per bulan."
  },
  {
    title: "Menjual Indomilk SKM ke Jaringan Franchise Kopi Susu",
    description: "Negosiasi dengan owner franchise kopi kekinian untuk ganti susu kental manis.",
    difficulty: Difficulty.Advanced,
    category: "Horeca (Franchise)",
    personaName: "Raka",
    personaRole: "CEO Franchise Kopi",
    personaBackground: "Membawahi 50 outlet es kopi susu gula aren.",
    personaPainPoints: "Konsistensi rasa dari outlet ke outlet sering berbeda karena barista salah takar.",
    personaObjections: "Kompetitor T*ga Sapi harganya lebih murah Rp 500 per kaleng.",
    personaBuyingSignals: "Tertarik dengan format pouch besar yang mudah dipencet (pump).",
    personaPersonality: "Sangat analitis, hitung-hitungan cost per cup.",
    productName: "Indomilk SKM Pouch 2Kg",
    productDescription: "Kental manis format industri/Horeca.",
    productStrengths: "Aroma susu lebih gurih menonjolkan rasa espresso, kemasan anti semut.",
    scenarioContext: "Tasting session di R&D lab kantor pusat kopi.",
    idealOutcome: "Raka setuju trial di 5 outlet terbaiknya bulan ini."
  },
  {
    title: "Distribusi Susu Pasteurisasi Indomilk ke Supermarket Premium",
    description: "Memasukkan susu segar (Fresh Milk) ke rak pendingin supermarket.",
    difficulty: Difficulty.Intermediate,
    category: "Modern Trade (Cold Chain)",
    personaName: "Ibu Vanya",
    personaRole: "Category Manager Fresh Food",
    personaBackground: "Bertanggung jawab atas chiller susu dan daging di supermarket.",
    personaPainPoints: "Susu pasteurisasi cepat basi, tingkat retur tinggi.",
    personaObjections: "Chiller kami sudah penuh oleh G*eenfields dan D*amond.",
    personaBuyingSignals: "Menyukai rasa Fresh Milk Indomilk varian Cokelat yang lebih bold.",
    personaPersonality: "Pemilih dan sangat mementingkan tampilan rak.",
    productName: "Indomilk Fresh Milk (Pasteurisasi) 1L",
    productDescription: "Susu segar murni dengan umur simpan pendek.",
    productStrengths: "Pengiriman cold chain terjamin, garansi retur untuk barang expired (bad stock).",
    scenarioContext: "Meeting di lorong chiller supermarket.",
    idealOutcome: "Diberi slot 2 facing untuk rasa Plain dan Cokelat."
  },
  {
    title: "Upselling Mentega Orchid (Orchid Butter) ke Toko Roti",
    description: "Menggabungkan penjualan tepung Bogasari dengan Orchid Butter milik Indofood.",
    difficulty: Difficulty.Intermediate,
    category: "Cross-Selling",
    personaName: "Bunda Ayu",
    personaRole: "Owner Toko Roti",
    personaBackground: "Pelanggan setia Bogasari yang memakai margarin murah untuk rotinya.",
    personaPainPoints: "Ingin naik kelas ke roti premium tapi takut harga jual terlalu mahal.",
    personaObjections: "Orchid Butter harganya 3x lipat margarin biasa.",
    personaBuyingSignals: "Tergoda dengan wangi Orchid Butter saat demo.",
    personaPersonality: "Ibu-ibu sosialita yang suka bereksperimen dengan resep.",
    productName: "Orchid Butter Unsalted 1Kg",
    productDescription: "Mentega murni dari lemak susu (Indofood Dairy).",
    productStrengths: "Aroma wangi mentega asli, membuat roti lebih moist dan lumer.",
    scenarioContext: "Kunjungan rutin, membawa sampel roti yang dibuat pakai Orchid Butter.",
    idealOutcome: "Bunda Ayu membeli 5 blok Orchid Butter untuk seri 'Roti Premium'."
  },
  {
    title: "Promosi Susu Bubuk Indomilk Opti Nutri ke Toko Sembako",
    description: "Menjual susu bubuk kemasan sachet untuk keluarga menengah ke bawah.",
    difficulty: Difficulty.Beginner,
    category: "Traditional Trade",
    personaName: "Ko Liang",
    personaRole: "Pemilik Toko Sembako",
    personaBackground: "Toko di area padat penduduk yang menjual produk ketengan (sachet).",
    personaPainPoints: "Susu bubuk box harganya mahal, jarang laku.",
    personaObjections: "Pelanggan saya mampunya beli susu kental manis sachet, bukan susu bubuk.",
    personaBuyingSignals: "Melihat rentengan Indomilk sachet dan menanyakan isi 1 renteng.",
    personaPersonality: "Pedagang yang suka barang fast-moving.",
    productName: "Indomilk Opti Nutri Sachet (Rentengan)",
    productDescription: "Susu bubuk bernutrisi harga ekonomis.",
    productStrengths: "Lebih sehat dari SKM, harga ecer Rp 2.000, gampang dipajang.",
    scenarioContext: "Sales datang membawa gantungan (hanger) promosi.",
    idealOutcome: "Ko Liang bersedia menggantung 5 renteng di depan toko."
  },
  {
    title: "Mengatasi Isu Botol Penyok di Minimarket",
    description: "Menangani keluhan Indomilk Susu Botol Cair yang kemasannya rusak.",
    difficulty: Difficulty.Intermediate,
    category: "Retail Maintenance",
    personaName: "Fajar",
    personaRole: "Kepala Minimarket",
    personaBackground: "Pramuniaga minimarket waralaba (Indo**ret).",
    personaPainPoints: "Susu botol sering bocor mengotori chiller.",
    personaObjections: "Kepala toko bilang jangan display Indomilk botol lagi sampai masalah ini selesai.",
    personaBuyingSignals: "Senang saat ditawarkan bantuan pembersihan chiller oleh tim merchaindiser Indofood.",
    personaPersonality: "Anak muda yang malas berdebat tapi butuh solusi praktis.",
    productName: "Indomilk Botol Cair (Liquid)",
    productDescription: "Susu steril kemasan botol plastik.",
    productStrengths: "Botol baru lebih tebal, dan tim sales akan mengganti penuh barang rusak.",
    scenarioContext: "Membantu Fajar merapikan chiller yang lengket.",
    idealOutcome: "Produk kembali didisplay di rak utama, Fajar lapor ke Kepala Toko bahwa masalah beres."
  },
  {
    title: "Pitching Es Krim Indofood (Indoeskrim) ke Restoran All-You-Can-Eat",
    description: "Memasukkan es krim ember (bulk) 8 liter ke restoran buffet.",
    difficulty: Difficulty.Advanced,
    category: "Horeca (Food Service)",
    personaName: "Pak Teddy",
    personaRole: "Manager Restoran AYCE",
    personaBackground: "Restoran BBQ Korea yang butuh hidangan penutup murah.",
    personaPainPoints: "Pengunjung mengambil es krim terlalu banyak, cost bengkak.",
    personaObjections: "Es krim C*mpina harganya bersaing, dan freezer mereka lebih bagus.",
    personaBuyingSignals: "Tertarik dengan Indoeskrim rasa Neapolitan (3 rasa 1 ember).",
    personaPersonality: "Sangat menekan HPP (Harga Pokok Penjualan).",
    productName: "Indoeskrim Bulk 8 Liter",
    productDescription: "Es krim ukuran industri untuk katering/restoran.",
    productStrengths: "Tekstur tidak cepat cair, harga per scoop sangat murah.",
    scenarioContext: "Membawa sampel es krim di dalam cooler box ke kantor restoran.",
    idealOutcome: "Deal 10 ember per minggu, Indofood meminjamkan freezer display."
  },
  {
    title: "Menjual Susu Indomilk Kaleng Evaporasi ke Tukang Martabak",
    description: "Upselling Tiga Sapi Evaporasi untuk olesan martabak manis.",
    difficulty: Difficulty.Beginner,
    category: "Micro Horeca",
    personaName: "Bang Tono",
    personaRole: "Pedagang Martabak Manis Bangka",
    personaBackground: "Pedagang kaki lima martabak premium.",
    personaPainPoints: "Martabaknya kurang wangi kalau cuma pakai mentega biasa.",
    personaObjections: "Evaporasi merk C*rnation lebih terkenal.",
    personaBuyingSignals: "Mencium aroma wangi susu Tiga Sapi Evaporasi.",
    personaPersonality: "Friendly, suka mencoba resep baru di depan pelanggan.",
    productName: "Susu Evaporasi Tiga Sapi (Indofood)",
    productDescription: "Susu evaporasi untuk olesan kue dan campuran minuman.",
    productStrengths: "Membuat martabak lebih gurih dan wangi, tidak terlalu manis, harga ekonomis.",
    scenarioContext: "Nongkrong di gerobak martabak jam 5 sore.",
    idealOutcome: "Bang Tono beli 1 karton untuk dipakai olesan martabak kelas 'Spesial'."
  },
  {
    title: "B2B Indomilk Good-To-Go untuk Perkantoran",
    description: "Memasukkan produk minuman sereal ke vending machine gedung kantor.",
    difficulty: Difficulty.Intermediate,
    category: "Vending Machine Operator",
    personaName: "Mas Dito",
    personaRole: "Operator Vending Machine",
    personaBackground: "Mengelola 100 vending machine di SCBD.",
    personaPainPoints: "Produk yang dijual sering itu-itu saja (kopi dan air), margin stuck.",
    personaObjections: "Orang kantoran kalau pagi maunya kopi, bukan minuman sereal pisang.",
    personaBuyingSignals: "Mencatat bahwa minuman sereal bisa jadi pengganti sarapan yang telat.",
    personaPersonality: "Inovatif, mencari produk baru yang potensial.",
    productName: "Indomilk Good-To-Go",
    productDescription: "Minuman susu sereal multi-grain.",
    productStrengths: "Kemasan pas untuk vending, mengenyangkan untuk sarapan praktis.",
    scenarioContext: "Meeting di lobi kantor gedung pencakar langit.",
    idealOutcome: "Dimasukkan ke dalam 20 mesin vending sebagai trial 1 bulan."
  },
  {
    title: "Distribusi Milkuat Botol Tiger ke Grosir Mainan/Snack Anak",
    description: "Menjual Milkuat ke grosir yang biasa jual jajanan anak SD.",
    difficulty: Difficulty.Beginner,
    category: "Traditional Wholesale",
    personaName: "Bapak Tardi",
    personaRole: "Bos Grosir Jajanan SD",
    personaBackground: "Grosir yang melayani pedagang asongan dan kantin SD.",
    personaPainPoints: "Anak-anak cepat bosan dengan desain minuman yang itu-itu saja.",
    personaObjections: "Susu botol berat dibawa oleh pedagang asongan.",
    personaBuyingSignals: "Tergoda dengan promo hadiah mainan gratis di setiap pembelian 1 karton.",
    personaPersonality: "Fokus pada apa yang disukai anak-anak dan hadiah promo.",
    productName: "Milkuat Botol Tiger 90ml",
    productDescription: "Minuman susu rasa buah dengan kemasan botol gambar macan.",
    productStrengths: "Ukuran kecil pas di kantong asongan, harga pas uang saku SD (Rp 2000).",
    scenarioContext: "Demonstrasi di gudang grosir Bapak Tardi.",
    idealOutcome: "Beli 50 karton karena mengejar hadiah sepeda lipat dari poin Milkuat."
  }
];

const div4Courses = [
  {
    title: "Chitato untuk Acara Konser Musik",
    description: "Sponsorship dan jualan booth Chitato di konser besar.",
    difficulty: Difficulty.Advanced,
    category: "Event & B2B",
    personaName: "Mbak Event Organizer",
    personaRole: "Project Manager",
    personaBackground: "Mengelola konser dengan estimasi 10.000 penonton.",
    personaPainPoints: "Butuh tambahan dana sponsor dan tenant f&b yang cepat.",
    personaObjections: "Uang sponsorship dari Indofood kurang besar.",
    personaBuyingSignals: "Tertarik dengan usulan bagi hasil penjualan booth.",
    personaPersonality: "Sibuk, agresif, dan target-oriented.",
    productName: "Chitato Sapi Panggang & Club Water",
    productDescription: "Paket snack dan minuman segar untuk konser.",
    productStrengths: "Brand awareness tinggi, pasti laku keras di konser.",
    scenarioContext: "Negosiasi alot via telepon mendekati hari H.",
    idealOutcome: "Deal buka 3 booth eksklusif dengan target penjualan Rp 50 juta."
  },
  {
    title: "Memasukkan Qtela ke Toko Oleh-Oleh Daerah",
    description: "Meyakinkan toko pusat oleh-oleh untuk menjual Qtela Singkong Balado.",
    difficulty: Difficulty.Intermediate,
    category: "Tourism Retail",
    personaName: "Bu Made",
    personaRole: "Pemilik Toko Oleh-Oleh",
    personaBackground: "Toko suvenir dan jajanan khas daerah di jalur wisata.",
    personaPainPoints: "Keripik singkong lokal (tanpa merk) sering melempem jika tutupnya tidak rapat.",
    personaObjections: "Wisatawan carinya keripik buatan UMKM lokal, bukan produk pabrik (Indofood).",
    personaBuyingSignals: "Setuju bahwa Qtela kemasannya jauh lebih rapi dan expired date-nya jelas.",
    personaPersonality: "Sangat peduli citra lokal namun lelah menghadapi retur barang rusak.",
    productName: "Qtela Keripik Singkong Balado",
    productDescription: "Keripik singkong higienis standar pabrik.",
    productStrengths: "Renyah tahan lama, kemasan premium, cocok untuk camilan di perjalanan mobil.",
    scenarioContext: "Meeting di ruang belakang toko oleh-oleh yang sibuk.",
    idealOutcome: "Qtela mendapat 1 rak khusus berlabel 'Jajanan Perjalanan'."
  },
  {
    title: "Jualan Air Mineral Club ke Event Lari (Marathon)",
    description: "Pitching suplai air minum Club untuk water station lomba lari.",
    difficulty: Difficulty.Advanced,
    category: "Event B2B",
    personaName: "Mas Rio",
    personaRole: "Race Director",
    personaBackground: "Menyelenggarakan event lari 10K dengan 5.000 peserta.",
    personaPainPoints: "Butuh ribuan cup air minum dengan distribusi yang efisien di rute.",
    personaObjections: "Aqua menawarkan branding yang lebih kuat di dunia olahraga.",
    personaBuyingSignals: "Tertarik dengan harga Club yang lebih hemat 20% untuk jumlah masif.",
    personaPersonality: "Sangat detail soal logistik dan ketepatan waktu pengiriman.",
    productName: "Air Mineral Club Cup 240ml & Botol 600ml",
    productDescription: "Air mineral grup Indofood (Indotirta).",
    productStrengths: "Distribusi sangat kuat, armada truk siap stand-by di titik water station.",
    scenarioContext: "Presentasi di kantor EO Sport event.",
    idealOutcome: "Menjadi Official Hydration Partner dengan suplai 10.000 cup Club."
  },
  {
    title: "Menjual Maxicorn ke Supermarket Kalangan Ekspatriat",
    description: "Meyakinkan supermarket premium agar Maxicorn disejajarkan dengan snack impor (Doritos).",
    difficulty: Difficulty.Intermediate,
    category: "Premium Retail",
    personaName: "Mr. Smith",
    personaRole: "Store Manager",
    personaBackground: "Supermarket di area elit Jakarta Selatan.",
    personaPainPoints: "Snack impor sering kosong karena masalah bea cukai.",
    personaObjections: "Maxicorn itu brand lokal, ekspatriat kurang familiar.",
    personaBuyingSignals: "Mencicipi Maxicorn Nacho Cheese dan kaget rasanya sama persis dengan Doritos.",
    personaPersonality: "Sangat logis, memprioritaskan rasa dan ketersediaan barang.",
    productName: "Maxicorn Roasted Corn & Nacho Cheese",
    productDescription: "Keripik tortilla jagung rasa premium.",
    productStrengths: "Pengganti sempurna snack impor dengan pasokan 100% aman dan margin retail besar.",
    scenarioContext: "Tasting blind-test di kantor Mr. Smith.",
    idealOutcome: "Maxicorn diletakkan di rak 'Imported Snacks' (upscaling brand)."
  },
  {
    title: "Distribusi Chitato Lite (Lays) ke Minimarket Stasiun",
    description: "Fokus menjual Chitato Lite ukuran kecil ke minimarket transit.",
    difficulty: Difficulty.Beginner,
    category: "Transit Retail",
    personaName: "Bapak Hadi",
    personaRole: "Kepala Cabang Minimarket Stasiun",
    personaBackground: "Minimarket dengan traffic pejalan kaki sangat cepat.",
    personaPainPoints: "Orang di stasiun tidak mau beli snack ukuran besar yang susah masuk tas.",
    personaObjections: "Rak depan sudah penuh dengan roti.",
    personaBuyingSignals: "Suka ide rak gantung mini (clip strip) di dekat kasir.",
    personaPersonality: "Pragmatis, fokus pada impulse buying (pembelian spontan).",
    productName: "Chitato Lite Rasa Nori Seaweed (Kemasan Kecil)",
    productDescription: "Keripik kentang tipis (dulu Lays) yang ringan.",
    productStrengths: "Camilan cepat habis, disukai anak muda, pas masuk tas selempang.",
    scenarioContext: "Kunjungan di tengah keramaian stasiun kereta.",
    idealOutcome: "Pasang 5 clip strip Chitato Lite di lorong kasir."
  },
  {
    title: "Penawaran Chiki Balls ke Koperasi SD",
    description: "Menghidupkan kembali nostalgia Chiki Balls di kantin/koperasi Sekolah Dasar.",
    difficulty: Difficulty.Beginner,
    category: "School Retail",
    personaName: "Ibu guru Wati",
    personaRole: "Pengurus Koperasi SD",
    personaBackground: "Guru SD yang menjaga koperasi saat istirahat.",
    personaPainPoints: "Banyak jajanan luar sekolah yang tidak sehat.",
    personaObjections: "Anak-anak sekarang lebih suka snack pedas-pedas (makaroni).",
    personaBuyingSignals: "Melihat kemasan Chiki Balls Cokelat dan bernostalgia zaman dia kecil.",
    personaPersonality: "Keibuan, memprioritaskan camilan pabrik yang ada BPOM daripada jajanan tanpa merk.",
    productName: "Chiki Balls Cokelat & Keju",
    productDescription: "Snack ekstrudat legendaris anak-anak.",
    productStrengths: "Aman dikonsumsi anak, halal, merk terpercaya puluhan tahun.",
    scenarioContext: "Ngobrol di koperasi sekolah setelah jam bel pulang.",
    idealOutcome: "Koperasi bersedia nyetok Chiki Balls sebagai jajanan sehat yang direkomendasikan guru."
  },
  {
    title: "Jualan Jetz Chocofiesta ke Warnet & Game Center",
    description: "Memasukkan snack manis ke area bermain anak muda.",
    difficulty: Difficulty.Intermediate,
    category: "Entertainment Retail",
    personaName: "Koh Afung",
    personaRole: "Pemilik Game Center (Warnet Esports)",
    personaBackground: "Membuka warnet 24 jam dengan 100 PC.",
    personaPainPoints: "Anak warnet main 10 jam, lapar tapi malas makan berat.",
    personaObjections: "Snack chiki bikin keyboard warnet saya jadi berminyak dan kotor.",
    personaBuyingSignals: "Tertarik karena Jetz berbentuk stik sehingga gampang dimakan pakai dua jari.",
    personaPersonality: "Galak soal kebersihan alat gaming-nya.",
    productName: "Jetz Stick Chocofiesta",
    productDescription: "Snack manis berbentuk stik.",
    productStrengths: "Cokelatnya menempel kuat tidak rontok, tangan tidak sekotor makan keripik.",
    scenarioContext: "Demo makan snack sambil main mouse di meja warnet.",
    idealOutcome: "Buka kulkas/etalase khusus snack Indofood di dekat meja kasir."
  },
  {
    title: "Upselling Fruitamin CocoBit ke Jaringan Futsal",
    description: "Menjual minuman rasa buah segar dengan Nata de Coco ke tempat olahraga.",
    difficulty: Difficulty.Intermediate,
    category: "Sports Venue",
    personaName: "Mas Dedi",
    personaRole: "Pengelola Lapangan Futsal",
    personaBackground: "Punya 3 lapangan futsal yang selalu penuh malam hari.",
    personaPainPoints: "Pemain futsal bosan cuma minum air mineral atau isotonik.",
    personaObjections: "Minuman manis bikin tenggorokan sakit habis olahraga.",
    personaBuyingSignals: "Suka sensasi mengunyah nata de coco yang segar (ada tekstur).",
    personaPersonality: "Sporty, suka minuman dingin menyegarkan.",
    productName: "Fruitamin CocoBit Leci",
    productDescription: "Minuman jus buah dengan potongan nata de coco.",
    productStrengths: "Menyegarkan, menghilangkan dahaga dan lapar (karena nata de coco), disajikan sangat dingin.",
    scenarioContext: "Menunggu shift main futsal berikutnya di pinggir lapangan.",
    idealOutcome: "Dedi memasukkan CocoBit ke dalam chiller futsal sebanyak 3 karton."
  },
  {
    title: "Distribusi Ichi Ocha ke Katering Pabrik",
    description: "Meyakinkan pengusaha katering pabrik untuk memberi bonus Ichi Ocha teh botol plastik.",
    difficulty: Difficulty.Advanced,
    category: "B2B Catering",
    personaName: "Ibu Hartini",
    personaRole: "Pemilik Katering Industri",
    personaBackground: "Menyuplai 5000 box nasi per hari ke pabrik otomotif.",
    personaObjections: "Teh pucuk harganya murah, kalau saya ganti Ichi Ocha HPP saya naik.",
    personaPainPoints: "Sering ada komplain teh tumpah di dalam kardus nasi.",
    personaBuyingSignals: "Melihat bahwa botol Ichi Ocha lebih kokoh dan tutupnya rapat.",
    personaPersonality: "Detail-oriented dan perhitungan ketat perak-demi-perak.",
    productName: "Ichi Ocha Botol Plastik 350ml",
    productDescription: "Teh melati dalam kemasan botol siap minum.",
    productStrengths: "Kemasan anti tumpah, harga B2B khusus untuk katering (potongan grosir besar).",
    scenarioContext: "Presentasi di dapur katering yang sibuk memasak.",
    idealOutcome: "Deal eksklusif Ichi Ocha untuk 5000 box katering setiap Jumat."
  },
  {
    title: "Trenchio Wafer untuk Snack Box Hajatan",
    description: "Meyakinkan toko bahan kue (TBK) grosir agar merekomendasikan Trenz/Trenchio untuk snack box pernikahan.",
    difficulty: Difficulty.Beginner,
    category: "Wholesale (TBK)",
    personaName: "Cik Susi",
    personaRole: "Pemilik Toko Bahan Kue (TBK)",
    personaBackground: "Toko yang jadi rujukan ibu-ibu pembuat snack box hajatan.",
    personaPainPoints: "Wafer merk T*ngo kemasan kecilnya sering kosong dari pabrik.",
    personaObjections: "Orang kampung gak kenal merk Trenchio, maunya merk yang udah biasa di TV.",
    personaBuyingSignals: "Suka karena kemasan Trenchio terlihat elegan dan isinya banyak.",
    personaPersonality: "Penjual yang persuasif ke pelanggannya (Opinion Leader).",
    productName: "Trenchio Wafer Cokelat",
    productDescription: "Wafer renyah isi cokelat.",
    productStrengths: "Harga grosir murah, penampilan premium, menaikkan gengsi snack box.",
    scenarioContext: "Kunjungan pagi hari saat toko baru buka.",
    idealOutcome: "Cik Susi setuju merekomendasikan Trenchio dan ambil 10 dus."
  }
];

const div5Courses = [
  {
    title: "Edukasi Produk Promina ke Bidan Praktek",
    description: "Meyakinkan Bidan untuk merekomendasikan Promina sebagai MPASI.",
    difficulty: Difficulty.Advanced,
    category: "Medical Channel",
    personaName: "Bidan Sumarni",
    personaRole: "Pemilik Klinik Bersalin",
    personaBackground: "Bidan senior yang sangat dipercaya warga sekitar.",
    personaPainPoints: "Banyak ibu muda bingung memilih makanan pendamping ASI.",
    personaObjections: "Saya biasanya sarankan ibu bikin bubur sendiri dari bahan segar.",
    personaBuyingSignals: "Khawatir ibu pekerja tidak punya waktu masak bubur.",
    personaPersonality: "Keibuan, konservatif, butuh bukti ilmiah.",
    productName: "Promina Bubur Tim",
    productDescription: "Makanan Pendamping ASI (MPASI) fortifikasi bergizi.",
    productStrengths: "Gizi terukur, bebas pengawet, praktis untuk ibu bekerja.",
    scenarioContext: "Kunjungan edukasi ke klinik bersalin.",
    idealOutcome: "Bidan bersedia membagikan sample Promina ke pasiennya."
  },
  {
    title: "Penawaran SUN Bubur Bayi ke Apotek Jaringan",
    description: "Memasukkan SUN ke rak baby care di apotek K*mia Farma / lokal.",
    difficulty: Difficulty.Intermediate,
    category: "Pharmacy Retail",
    personaName: "Apoteker Reza",
    personaRole: "Manager Pengadaan Apotek",
    personaBackground: "Apoteker muda di apotek jaringan lokal (5 cabang).",
    personaPainPoints: "Margin obat generik sangat tipis, butuh produk konsumer penambah profit.",
    personaObjections: "Apotek kami fokus di obat-obatan, jualan bubur bayi makan tempat.",
    personaBuyingSignals: "Tertarik melihat data bahwa 40% pengunjung apotek adalah ibu-ibu yang beli vitamin anak.",
    personaPersonality: "Sangat rasional, digerakkan oleh data penjualan dan margin untung.",
    productName: "SUN Bubur Sereal Susu",
    productDescription: "Bubur bayi ekonomis dengan nutrisi lengkap.",
    productStrengths: "Margin apotek mencapai 20%, menciptakan cross-selling dengan vitamin anak.",
    scenarioContext: "Meeting presentasi bisnis di kantor manajemen apotek.",
    idealOutcome: "SUN didisplay di rak khusus 'Ibu & Anak' dekat kasir di ke-5 cabang."
  },
  {
    title: "Sampling Promina Puffs di Baby Spa",
    description: "Bekerjasama dengan Baby Spa premium untuk membagikan sampel snack bayi Promina Puffs.",
    difficulty: Difficulty.Intermediate,
    category: "Premium Service (B2B2C)",
    personaName: "Mbak Siska",
    personaRole: "Owner Baby Spa",
    personaBackground: "Pemilik klinik pijat dan renang bayi (Baby Spa) di ruko elit.",
    personaPainPoints: "Bayi sering menangis atau rewel saat dipijat/berenang.",
    personaObjections: "Kalau bayinya tersedak snack di sini, klinik saya yang disalahkan.",
    personaBuyingSignals: "Melihat demo bahwa Promina Puffs langsung lumer di mulut (lumer di air).",
    personaPersonality: "Protektif terhadap keselamatan bayi, sangat peduli standar premium.",
    productName: "Promina Puffs Rasa Pisang & Blueberry",
    productDescription: "Snack bayi berbentuk bintang yang mudah digenggam (finger food) dan langsung lumer.",
    productStrengths: "Melatih motorik anak untuk memegang, aman tidak bikin tersedak, rasa enak.",
    scenarioContext: "Demonstrasi produk dengan meneteskan air ke Puffs agar terlihat lumernya.",
    idealOutcome: "Baby Spa setuju memberikan 1 bungkus gratis untuk setiap treatment 'Premium Package'."
  },
  {
    title: "Penjualan SUN Kacang Hijau ke Minimarket Pinggiran",
    description: "Meyakinkan pemilik toko untuk stok bubur bayi SUN yang murah.",
    difficulty: Difficulty.Beginner,
    category: "Traditional Trade",
    personaName: "Pak Haji Somad",
    personaRole: "Pemilik Toko Grosir/Minimarket",
    personaBackground: "Toko di desa pinggiran kota yang banyak keluarga mudanya.",
    personaPainPoints: "Barang mahal susah laku karena daya beli warga sedang turun.",
    personaObjections: "Ibu-ibu di sini biasa bikin bubur tajin sendiri.",
    personaBuyingSignals: "Mengangguk saat diberitahu harga jual sachet SUN sangat murah.",
    personaPersonality: "Tradisional, tapi ingin membantu warga sekitar mendapat gizi murah.",
    productName: "SUN Kacang Hijau Sachet",
    productDescription: "Bubur bayi ekonomis dalam kemasan sekali seduh.",
    productStrengths: "Harga ecer hanya Rp 2.500, rasa legendaris turun temurun.",
    scenarioContext: "Ngobrol santai siang hari di depan toko.",
    idealOutcome: "Pak Haji ambil 5 dus SUN Kacang Hijau."
  },
  {
    title: "Pitching Promina Marie Susu ke Rumah Sakit Ibu & Anak (RSIA)",
    description: "Menjadikan biskuit Promina Marie sebagai snack di nampan makanan pasien bersalin.",
    difficulty: Difficulty.Advanced,
    category: "Hospitality (Medical)",
    personaName: "Ibu Dina",
    personaRole: "Ahli Gizi RSIA",
    personaBackground: "Menyusun menu harian untuk ibu melahirkan dan anak balita yang dirawat.",
    personaPainPoints: "Anak balita yang sakit sering mogok makan nasi rumah sakit.",
    personaObjections: "Biskuit komersial biasanya tinggi gula, tidak sesuai standar RS kami.",
    personaBuyingSignals: "Membaca label komposisi gizi dan sertifikasi BPOM khusus MPASI.",
    personaPersonality: "Sangat teliti, berbasis sains klinis.",
    productName: "Promina Biskuit Marie Susu",
    productDescription: "Biskuit marie khusus bayi yang difortifikasi zat besi dan kalsium.",
    productStrengths: "Rendah gula dibanding marie dewasa, tekstur lembut bisa diseduh susu, menaikkan selera makan balita sakit.",
    scenarioContext: "Meeting formal di ruang rapat Instalasi Gizi RSIA.",
    idealOutcome: "Promina Marie masuk sebagai menu snack sore (jam 15.00) pasien balita."
  },
  {
    title: "Distribusi Govit (Snack Vitamin) ke Koperasi Sekolah",
    description: "Menjual sereal Govit ke kantin sekolah sebagai alternatif jajanan sehat.",
    difficulty: Difficulty.Beginner,
    category: "School Retail",
    personaName: "Bapak Herman",
    personaRole: "Ketua Koperasi SMP",
    personaBackground: "Mengawasi kantin sekolah menengah.",
    personaPainPoints: "Dinas Pendidikan sering razia jajanan yang pakai pewarna tekstil.",
    personaObjections: "Anak SMP malu makan Govit karena dikira snack anak TK.",
    personaBuyingSignals: "Melihat bahwa kemasan baru Govit berkonsep gaming/esports.",
    personaPersonality: "Kaku, patuh pada aturan sekolah.",
    productName: "Govit Sereal Bantal Rasa Cokelat",
    productDescription: "Camilan sereal kaya 11 vitamin.",
    productStrengths: "Aman dari sidak BPOM, harga murah Rp 1000/sachet, kemasan keren.",
    scenarioContext: "Pertemuan setelah upacara bendera hari Senin.",
    idealOutcome: "Diizinkan jualan Govit di 3 kios kantin sekolah."
  },
  {
    title: "Penjualan Milna (Kompetitor) Switch ke Promina di Toko Baby Shop",
    description: "Membujuk Baby Shop besar untuk menonjolkan (display) Promina daripada Milna.",
    difficulty: Difficulty.Advanced,
    category: "Specialty Store",
    personaName: "Cici Merry",
    personaRole: "Owner Baby Shop Premium",
    personaBackground: "Toko perlengkapan bayi yang lengkap dari dot sampai stroller.",
    personaPainPoints: "Milna sering kosong stok karena pengiriman pabrik telat.",
    personaObjections: "Brand awareness Milna lebih kuat di pelanggan VIP saya.",
    personaBuyingSignals: "Tertarik dengan program display: Indofood memberikan rak akrilik gratis yang mewah.",
    personaPersonality: "Fokus pada estetika toko dan kelancaran pasokan barang.",
    productName: "Promina (All Variants)",
    productDescription: "Range lengkap makanan bayi dari bubur, biskuit, puff, hingga crunchies.",
    productStrengths: "Pasokan selalu aman (Indofood logistics), margin lebih besar untuk toko dibanding kompetitor.",
    scenarioContext: "Berdiri di depan rak makanan bayi yang kosong melompong.",
    idealOutcome: "Cici Merry setuju meletakkan Promina di rak eye-level menggantikan kompetitor."
  },
  {
    title: "Edukasi SUN Ibu Hamil ke Puskesmas Desa",
    description: "Meyakinkan Bidan Desa Puskesmas untuk memberikan susu SUN Ibu kepada ibu hamil kurang gizi.",
    difficulty: Difficulty.Intermediate,
    category: "Medical / Government",
    personaName: "Bidan Tanti",
    personaRole: "Kepala Bidan Puskesmas Desa",
    personaBackground: "Bertugas menurunkan angka stunting di desanya.",
    personaPainPoints: "Anggaran Puskesmas kecil, susu hamil merk Pr*nagen terlalu mahal untuk warga.",
    personaObjections: "Kami biasanya hanya kasih biskuit bantuan pemerintah, tidak ada dana beli susu.",
    personaBuyingSignals: "Terkejut bahwa susu SUN Ibu sangat murah dan mengandung Asam Folat tinggi.",
    personaPersonality: "Penuh pengabdian, berjiwa sosial tinggi, tapi terkendala birokrasi anggaran.",
    productName: "Susu SUN Ibu Hamil",
    productDescription: "Susu nutrisi ibu hamil kelas ekonomis.",
    productStrengths: "Harga sangat terjangkau rakyat kecil, mencegah stunting sejak dalam kandungan.",
    scenarioContext: "Duduk di teras Puskesmas yang ramai antrean.",
    idealOutcome: "Puskesmas mengajukan dana desa untuk membeli 50 karton Susu SUN Ibu bulan depan."
  },
  {
    title: "Cross-Selling Kecap Piring Lombok ke Tukang Bubur Ayam",
    description: "Menggabungkan penjualan tepung dengan Kecap Manis Indofood ke pedagang bubur.",
    difficulty: Difficulty.Beginner,
    category: "Micro Horeca",
    personaName: "Mang Ujang",
    personaRole: "Tukang Bubur Ayam Keliling",
    personaBackground: "Pedagang bubur ayam laris manis di perumahan.",
    personaPainPoints: "Kecap manis eceran kadang terlalu encer, bikin bubur jadi berair.",
    personaObjections: "Saya udah turun-temurun pakai kecap B*ngo, pelanggan suka.",
    personaBuyingSignals: "Merasakan kecap Indofood (Piring Lombok) yang lebih pekat dan kental.",
    personaPersonality: "Sunda pituin, suka bercanda tapi susah diajak ganti kebiasaan.",
    productName: "Kecap Manis Piring Lombok (Indofood)",
    productDescription: "Kecap manis kental yang cocok untuk makanan berkuah/bubur.",
    productStrengths: "Lebih kental, warna hitam legam, harga lebih ekonomis dari pemimpin pasar.",
    scenarioContext: "Sarapan pagi bubur mang Ujang sambil ngobrol.",
    idealOutcome: "Mang Ujang setuju beli 1 jerigen kecil kecap Piring Lombok untuk dicoba 2 hari."
  },
  {
    title: "Upselling Promina Sup Mi Daging & Sayur ke Ibu Milenial",
    description: "Direct selling (SPG / Sales Event) Promina Mie Bayi di pameran Mother & Baby.",
    difficulty: Difficulty.Intermediate,
    category: "B2C Event",
    personaName: "Mama Jessica",
    personaRole: "Pengunjung Pameran (Ibu Muda)",
    personaBackground: "Ibu rumah tangga beranak 1 (usia 14 bulan).",
    personaPainPoints: "Anaknya lagi fase GTM (Gerakan Tutup Mulut), nolak makan nasi.",
    personaObjections: "Mie instan kan gak bagus buat bayi, banyak MSG-nya.",
    personaBuyingSignals: "Melihat anak balita lain di pameran lahap makan sampel Promina Sup Mi.",
    personaPersonality: "Protektif, sering membaca forum parenting, mudah fomo (fear of missing out).",
    productName: "Promina Sup Mi Daging Sayur",
    productDescription: "Mie khusus batita (bayi 1 tahun ke atas).",
    productStrengths: "Tanpa MSG, tekstur mie halus aman dicerna, mengandung sayuran asli (wortel).",
    scenarioContext: "Di booth pameran Indofood Nutrition yang bising.",
    idealOutcome: "Mama Jessica memborong promo 'Buy 2 Get 1 Free' (total 3 box)."
  }
];

const allCourseSets = [div1Courses, div2Courses, div3Courses, div4Courses, div5Courses];
const managerEmails = [
  "mgr.indomie@indofood.co.id",
  "mgr.bogasari@indofood.co.id",
  "mgr.indomilk@indofood.co.id",
  "mgr.snack@indofood.co.id",
  "mgr.nutrisi@indofood.co.id"
];
const teamNames = [
  "Divisi Indomie (Noodles)",
  "Divisi Bogasari (Flour)",
  "Divisi Indomilk (Dairy)",
  "Divisi Snack & Beverages",
  "Divisi Nutrisi & Baby Food"
];

async function main() {
  console.log('🧹 Cleaning old Indofood data...');
  // Delete existing Indofood companies to prevent duplicate seeding
  await prisma.company.deleteMany({
    where: { name: "PT Indofood Sukses Makmur Tbk" }
  });
  
  const indofoodUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@indofood.co.id" } }
  });
  const userIds = indofoodUsers.map((u: any) => u.id);

  if (userIds.length > 0) {
    const courses = await prisma.course.findMany({ where: { createdById: { in: userIds } } });
    const courseIds = courses.map((c: any) => c.id);

    if (courseIds.length > 0) {
      await prisma.scoringRubric.deleteMany({ where: { courseId: { in: courseIds } } });
      await prisma.courseDocument.deleteMany({ where: { courseId: { in: courseIds } } });
      await prisma.session.deleteMany({ where: { courseId: { in: courseIds } } });
      await prisma.trainingAssignment.deleteMany({ where: { courseId: { in: courseIds } } });
      await prisma.course.deleteMany({ where: { id: { in: courseIds } } });
    }

    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.message.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userBadge.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    
    // Also delete managers (team leaders)
    await prisma.teamLeader.deleteMany({ where: { userId: { in: userIds } } });

    // Delete users by domain
    await prisma.user.deleteMany({
      where: { id: { in: userIds } }
    });
  }

  console.log('🌱 Seeding PT Indofood Sukses Makmur Tbk Data...');
  const hash = await bcrypt.hash('indofood123', 10);

  // 1. Create Company
  const company = await prisma.company.create({
    data: {
      name: "PT Indofood Sukses Makmur Tbk",
      industry: "FMCG",
      website: "indofood.com",
      description: "Perusahaan Total Food Solutions terkemuka di Indonesia.",
      coreProducts: "Indomie, Bogasari, Indomilk, Chitato, Promina",
      targetAudience: "B2B Distributor, Retail, Horeca, Medical",
      usp: "Jaringan distribusi terluas dan brand heritage yang kuat.",
      commonObjections: "Harga sedikit lebih mahal dari kompetitor lapis dua.",
      brandTone: "Profesional, merakyat, dan inovatif."
    }
  });

  // 2. Create Company Admin
  await prisma.user.create({
    data: {
      name: "Admin Indofood",
      email: "admin@indofood.co.id",
      passwordHash: hash,
      role: UserRole.company_admin,
      companyId: company.id
    }
  });

  let globalSalesCount = 1;

  for (let i = 0; i < 5; i++) {
    // 3. Create Team
    const team = await prisma.team.create({
      data: {
        name: teamNames[i],
        companyId: company.id,
      }
    });

    // 4. Create Manager
    const manager = await prisma.user.create({
      data: {
        name: `Manager ${teamNames[i]}`,
        email: managerEmails[i],
        passwordHash: hash,
        role: UserRole.manager,
        companyId: company.id,
        teamId: team.id
      }
    });

    await prisma.teamLeader.create({
      data: {
        userId: manager.id,
        teamId: team.id
      }
    });

    // 5. Create 5 Sales Reps (Karyawan)
    for (let j = 0; j < 5; j++) {
      const salesName = generateName();
      const email = `${salesName.toLowerCase().replace(/\s+/g, '')}${globalSalesCount++}@indofood.co.id`;
      await prisma.user.create({
        data: {
          name: salesName,
          email: email,
          passwordHash: hash,
          role: UserRole.karyawan,
          companyId: company.id,
          teamId: team.id
        }
      });
    }

    // 6. Create 10 Courses for this Manager
    const coursesToInsert = allCourseSets[i];
    for (const cData of coursesToInsert) {
      const course = await prisma.course.create({
        data: {
          title: cData.title,
          description: cData.description,
          difficulty: cData.difficulty,
          category: cData.category,
          companyId: company.id,
          createdById: manager.id,
          personaName: cData.personaName,
          personaRole: cData.personaRole,
          personaBackground: cData.personaBackground,
          personaPainPoints: cData.personaPainPoints,
          personaObjections: cData.personaObjections,
          personaBuyingSignals: cData.personaBuyingSignals,
          personaPersonality: cData.personaPersonality,
          productName: cData.productName,
          productDescription: cData.productDescription,
          productStrengths: cData.productStrengths,
          scenarioContext: cData.scenarioContext,
          idealOutcome: cData.idealOutcome,
          aiModelSize: "7b",
          maxTurns: 15
        }
      });

      // Add basic rubric
      await prisma.scoringRubric.create({
        data: {
          courseId: course.id,
          passingScore: 70,
          categories: [
            { category: "Opening & Building Rapport", weight: 20 },
            { category: "Discovery & Needs Analysis", weight: 30 },
            { category: "Objection Handling", weight: 30 },
            { category: "Closing", weight: 20 }
          ]
        }
      });
    }
  }

  console.log('✅ Berhasil membuat 1 Admin, 5 Manager, 25 Sales, dan 50 Courses UNIK untuk Indofood!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
