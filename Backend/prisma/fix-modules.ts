import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking for courses without modules...');
  const courses = await prisma.course.findMany({
    include: { documents: true }
  });

  const addedCount = 0;

  for (const course of courses) {
    const hasModule = course.documents.some((d: any) => d.category === 'module');
    const moduleContent = `
# 📚 Course Module: ${course.title}

Selamat datang di materi persiapan Roleplay Sales! Sebelum Anda memulai simulasi obrolan dengan pelanggan AI, pastikan Anda memahami dengan seksama seluruh informasi di bawah ini. Keberhasilan Anda dalam menutup penjualan (closing) sangat bergantung pada seberapa baik Anda memahami produk dan kondisi calon pelanggan.

---

## 🏢 1. Pengetahuan Produk (Product Knowledge)

Sebagai seorang Sales Representative, Anda harus menguasai luar dalam produk yang akan Anda tawarkan. Berikut adalah detail produk untuk skenario ini:

- **Nama Produk**: **${course.productName || 'Produk/Layanan Utama'}**
- **Deskripsi Produk**: ${course.productDescription || 'Solusi terbaik untuk menjawab kebutuhan pelanggan Anda dengan efisien.'}

### ⭐ Keunggulan Utama (Key Strengths)
Gunakan poin-poin ini sebagai "senjata utama" Anda saat pelanggan mulai ragu atau membandingkan dengan kompetitor:
1. ${course.productStrengths || 'Produk ini dirancang khusus dengan fitur unggulan.'}
2. Memiliki rasio cost-to-value yang jauh lebih menguntungkan dibandingkan produk sejenis di pasaran.
3. Dukungan purna jual dan garansi penuh yang menjamin keamanan investasi pelanggan.

---

## 👤 2. Profil Pelanggan (Customer Persona)

Anda akan berhadapan dengan AI yang telah diprogram dengan kepribadian dan kondisi bisnis berikut. Kenali siapa yang Anda hadapi!

- **Nama Prospek**: **${course.personaName || 'Calon Pelanggan'}**
- **Jabatan / Posisi**: ${course.personaRole || 'Pengambil Keputusan (Decision Maker)'}
- **Karakter & Sifat**: *${course.personaPersonality || 'Kritis, analitis, dan butuh bukti konkret.'}*

### 📋 Latar Belakang & Situasi Saat Ini
${course.personaBackground || 'Pelanggan saat ini sedang mencari solusi yang bisa meningkatkan efisiensi dan mengurangi biaya operasional harian mereka. Mereka pernah dikecewakan oleh vendor sebelumnya, sehingga sekarang lebih berhati-hati dalam memilih.'}

### ⚠️ Masalah Utama (Pain Points)
Pelanggan sedang pusing memikirkan hal-hal berikut. Tugas Anda adalah menunjukkan bahwa produk Anda bisa menyelesaikan ini:
> "${course.personaPainPoints || 'Biaya operasional membengkak, efisiensi menurun, dan banyak waktu terbuang karena sistem yang lama.'}"

### 🛡️ Keberatan Umum (Common Objections)
Bersiaplah! Pelanggan kemungkinan besar akan menolak Anda dengan alasan-alasan ini:
> "${course.personaObjections || 'Harganya terlalu mahal, kami belum punya budget tahun ini, dan kami sudah nyaman dengan vendor yang sekarang.'}"

### 💡 Sinyal Beli (Buying Signals)
Jika pelanggan mulai menunjukkan gelagat ini, segera arahkan ke *Closing*!
> "${course.personaBuyingSignals || 'Menanyakan detail teknis, menanyakan apakah ada diskon atau masa trial, dan bertanya tentang garansi.'}"

---

## 🎯 3. Skenario & Target Roleplay

- **Konteks Pertemuan**: ${course.scenarioContext || 'Anda sedang melakukan pertemuan langsung (atau via telepon) dengan prospek untuk menawarkan solusi dari perusahaan Anda.'}
- **Target Utama (Ideal Outcome)**: **${course.idealOutcome || 'Prospek setuju untuk melakukan trial produk atau langsung menandatangani kontrak awal.'}**

---

## 🚀 4. Strategi & Tips Penjualan (Action Plan)

Untuk memenangkan skenario ini dan mendapatkan skor tinggi dari AI Coach, ikuti langkah-langkah berikut:

1. **Fase Pembukaan (Building Rapport)**
   - Jangan langsung berjualan! Sapalah **${course.personaName}** dengan sopan.
   - Singgung sedikit tentang latar belakang bisnis mereka untuk menunjukkan bahwa Anda sudah melakukan riset.
2. **Fase Penggalian Kebutuhan (Discovery)**
   - Ajukan pertanyaan terbuka (Open-ended questions).
   - Validasi *Pain Points* mereka. Biarkan pelanggan bercerita tentang keluhan mereka terkait: *${course.personaPainPoints?.substring(0, 50) || 'masalah bisnis mereka'}...*
3. **Fase Presentasi Solusi**
   - Kaitkan keunggulan **${course.productName}** secara langsung dengan masalah yang baru saja mereka ceritakan.
   - Jangan hanya menyebutkan fitur, tapi jelaskan apa *manfaat nyata* (Benefit) bagi mereka.
4. **Fase Penanganan Keberatan (Objection Handling)**
   - Jika mereka menolak dengan alasan *"${course.personaObjections?.substring(0, 50) || 'harga mahal'}..."*, jangan defensif! 
   - Gunakan teknik **Feel-Felt-Found**: *"Saya mengerti apa yang Bapak/Ibu rasakan. Banyak klien kami awalnya juga merasa demikian, tetapi setelah mencoba, mereka menemukan bahwa..."*
5. **Fase Penutupan (Closing)**
   - Perhatikan *Buying Signals*. Jika sudah muncul, beranikan diri untuk melakukan *Call to Action*.
   - Arahkan menuju target: **${course.idealOutcome}**.

---
*Silakan pelajari modul ini. Jika Anda sudah siap, kembali ke halaman course dan klik tombol **"Start"** untuk membuktikan kemampuan sales Anda!*
      `;

      // Update existing module if it was created briefly before
      if (hasModule) {
        await prisma.courseDocument.updateMany({
          where: { courseId: course.id, category: 'module' },
          data: { content: moduleContent }
        });
      } else {
        await prisma.courseDocument.create({
          data: {
            courseId: course.id,
            content: moduleContent,
            category: 'module'
          }
        });
      }
  }

  console.log(`✅ Successfully added dummy modules to ${addedCount} courses.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
