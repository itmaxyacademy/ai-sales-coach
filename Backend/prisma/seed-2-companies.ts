import { PrismaClient } from '@prisma/client';

import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to hash password
const hashPwd = (p: string) => bcrypt.hashSync(p, 10);

async function main() {
  console.log('🚀 Starting Seed for 2 Companies (Indofood & Djarum)...');

  const defaultPassword = hashPwd('password123');

  // Definitions for Companies
  const ptData = [
    {
      name: "PT Indofood Sukses Makmur Tbk",
      industry: "FMCG",
      domain: "indofood.co.id",
      managers: [
        { name: "Indomie Division", products: ["Indomie Goreng", "Indomie Kuah", "Pop Mie"] },
        { name: "Bogasari Division", products: ["Segitiga Biru", "Cakra Kembar", "Kunci Biru"] },
        { name: "Indomilk Division", products: ["Indomilk UHT", "Susu Kental Manis", "Indomilk Kids"] },
        { name: "Snack Division", products: ["Chitato", "Qtela", "Lays"] },
        { name: "Nutrition Division", products: ["Promina", "SUN", "Govita"] }
      ]
    },
    {
      name: "PT Djarum",
      industry: "Conglomerate",
      domain: "djarum.com",
      managers: [
        { name: "Djarum Super Team", products: ["Djarum Super", "Djarum Super MLD"] },
        { name: "Polytron Electronics", products: ["AC Polytron", "TV LED Polytron", "Kulkas Belleza"] },
        { name: "Tiket.com Division", products: ["Tiket Pesawat B2B", "Corporate Hotel Booking", "Event Ticketing"] },
        { name: "Blibli B2B", products: ["Blibli for Business", "E-Procurement", "Corporate Gifts"] },
        { name: "Mola TV Corporate", products: ["Mola TV Commercial License", "Mola Sports Bar Package", "Corporate Subs"] }
      ]
    }
  ];

  for (const pt of ptData) {
    console.log(`\n🏢 Setting up ${pt.name}...`);
    
    // Create Company
    const company = await prisma.company.create({
      data: {
        name: pt.name,
        industry: pt.industry,
        subscriptionPlan: 'enterprise',
      }
    });

    // Create Company Admin
    const adminEmail = `admin@${pt.domain}`;
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: `Admin ${pt.name}`,
        passwordHash: defaultPassword,
        role: 'company_admin',
        companyId: company.id,
        isActive: true,
      }
    });

    // Create Managers
    for (let m = 0; m < pt.managers.length; m++) {
      const mgrDef = pt.managers[m];
      const mgrEmail = `manager${m+1}@${pt.domain}`;
      const managerUser = await prisma.user.create({
        data: {
          email: mgrEmail,
          name: `Manager ${mgrDef.name}`,
          passwordHash: defaultPassword,
          role: 'manager',
          companyId: company.id,
          isActive: true,
        }
      });

      const team = await prisma.team.create({
        data: {
          name: mgrDef.name,
          companyId: company.id,
        }
      });

      await prisma.teamLeader.create({
        data: {
          teamId: team.id,
          userId: managerUser.id,
        }
      });

      // Create 5 Sales Karyawan for this manager
      for (let s = 1; s <= 5; s++) {
        await prisma.user.create({
          data: {
            email: `sales${m+1}_${s}@${pt.domain}`,
            name: `Sales ${s} - ${mgrDef.name}`,
            passwordHash: defaultPassword,
            role: 'karyawan',
            companyId: company.id,
            teamId: team.id,
            isActive: true,
          }
        });
      }

      // Generate 10 Distinct Courses for this manager
      console.log(`   📚 Generating 10 courses for ${mgrDef.name}...`);
      for (let c = 1; c <= 10; c++) {
        const product = mgrDef.products[c % mgrDef.products.length];
        const personas = ["Budi Santoso", "Andi Wijaya", "Siti Aminah", "Dewi Lestari", "Tono Hartono"];
        const roles = ["Purchasing Manager", "Direktur Operasional", "Pemilik Toko", "Kepala Cabang", "Distributor Utama"];
        const objections = ["Harga terlalu mahal", "Sudah ada supplier lain", "Margin keuntungan tipis", "Kurang laku di daerah kami", "Term of payment kurang panjang"];
        
        const personaName = personas[c % personas.length];
        const personaRole = roles[c % roles.length];
        const objection = objections[c % objections.length];

        const personaGenderMap: Record<string, 'M' | 'F'> = {
          "Budi Santoso": "M",
          "Andi Wijaya": "M",
          "Siti Aminah": "F",
          "Dewi Lestari": "F",
          "Tono Hartono": "M",
        };
        const personaGender = personaGenderMap[personaName] || 'M';

        const personalities = [
          "Skeptis, teliti, sangat berhati-hati dengan anggaran, membandingkan harga dengan kompetitor.",
          "Tegas, profesional, berfokus pada efisiensi biaya dan ketersediaan barang.",
          "Ramah, praktis, mengutamakan kepastian barang cepat laku dan margin keuntungan langsung.",
          "Santai namun perhitungan, membandingkan kemudahan pembayaran tempo (Term of Payment).",
          "Agresif dalam negosiasi harga, berorientasi volume skala besar, menuntut skema diskon eksklusif."
        ];
        const personaPersonality = personalities[c % personalities.length];

        const course = await prisma.course.create({
          data: {
            title: `Strategi Penjualan ${product} ke ${personaRole} (V${c})`,
            description: `Pelatihan skenario menawarkan ${product} dengan menghadapi keberatan: ${objection}.`,
            difficulty: c % 3 === 0 ? 'Advanced' : (c % 2 === 0 ? 'Intermediate' : 'Beginner'),
            category: 'B2B Sales',
            personaName,
            personaRole,
            personaGender,
            personaBackground: `${personaName} adalah seorang ${personaRole} yang sangat detail.`,
            personaPainPoints: "Butuh barang cepat laku dan margin besar.",
            personaObjections: objection,
            personaBuyingSignals: "Menanyakan diskon pengambilan banyak.",
            personaPersonality,
            productName: product,
            productDescription: `Produk unggulan dari divisi ${mgrDef.name}.`,
            productStrengths: "Brand awarness tinggi dan perputaran cepat.",
            competitorNotes: "Supplier lokal sering banting harga.",
            scenarioContext: `Anda sedang meeting dengan ${personaName} untuk negosiasi kontrak baru.`,
            idealOutcome: "Deal 100 karton/unit pertama.",
            aiModelSize: '7b',
            aiTemperature: 0.7,
            maxTurns: 15,
            createdById: managerUser.id,
          }
        });

        // Add Module
        const moduleContent = `
# 📚 Course Module: Strategi Penjualan ${product} ke ${personaRole} (V${c})

Selamat datang di materi persiapan Roleplay Sales! Sebelum Anda memulai simulasi obrolan dengan pelanggan AI, pastikan Anda memahami dengan seksama seluruh informasi di bawah ini.

---

## 🏢 1. Pengetahuan Produk (Product Knowledge)

- **Nama Produk**: **${product}**
- **Deskripsi Produk**: Produk unggulan dari divisi ${mgrDef.name}.
- **Keunggulan Utama (Key Strengths)**: Brand awarness tinggi dan perputaran cepat.

---

## 👤 2. Profil Pelanggan (Customer Persona)

- **Nama Prospek**: **${personaName}**
- **Jabatan / Posisi**: ${personaRole}
- **Karakter & Sifat**: Tegas dan analitis.

### 📋 Latar Belakang & Situasi Saat Ini
${personaName} adalah seorang ${personaRole} yang sangat detail.

### ⚠️ Masalah Utama (Pain Points)
> "Butuh barang cepat laku dan margin besar."

### 🛡️ Keberatan Umum (Common Objections)
Bersiaplah! Pelanggan kemungkinan besar akan menolak Anda dengan alasan-alasan ini:
> "${objection}"

### 💡 Sinyal Beli (Buying Signals)
> "Menanyakan diskon pengambilan banyak."

---

## 🎯 3. Skenario & Target Roleplay

- **Konteks Pertemuan**: Anda sedang meeting dengan ${personaName} untuk negosiasi kontrak baru.
- **Target Utama (Ideal Outcome)**: Deal 100 karton/unit pertama.

---

## 🚀 4. Strategi & Tips Penjualan (Action Plan)

1. **Fase Pembukaan (Building Rapport)**: Jangan langsung berjualan! Sapalah ${personaName} dengan sopan.
2. **Fase Penggalian Kebutuhan (Discovery)**: Ajukan pertanyaan terbuka.
3. **Fase Presentasi Solusi**: Kaitkan keunggulan ${product} secara langsung dengan masalah mereka.
4. **Fase Penanganan Keberatan (Objection Handling)**: Jika mereka menolak karena "${objection}", gunakan teknik Feel-Felt-Found.
5. **Fase Penutupan (Closing)**: Arahkan menuju target: Deal 100 karton/unit pertama.
        `;

        await prisma.courseDocument.create({
          data: {
            courseId: course.id,
            content: moduleContent,
            category: 'module'
          }
        });
      }
    }
  }

  console.log('\n✅ All data successfully seeded!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
