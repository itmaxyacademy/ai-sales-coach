/**
 * prisma/seed.ts
 * Massive Seed: 3 Companies, 12 Teams per Company, 6 Sales per Team, 5 Unassigned Sales
 * Password semua user: password123
 */
import { PrismaClient, Difficulty, UserRole, SubscriptionPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const firstNames = ["Budi", "Ratna", "Wahyu", "Siska", "Andi", "Maya", "Raka", "Siti", "Hendra", "Diana", "Fajar", "Lina", "Reza", "Sari", "Dedi", "Ayu", "Joko", "Tika", "Ivan", "Clara", "Dimas", "Nadia", "Faisal", "Surya", "Daniel"];
const lastNames = ["Pratama", "Wijaya", "Kusuma", "Saputra", "Setiawan", "Haryanto", "Ananda", "Prabowo", "Firmansyah", "Amelia", "Sidiq", "Kartika", "Anggara", "Sinta", "Mulyana", "Wiguna", "Susilo", "Rahmawati", "Hakim", "Putri"];

let globalCounter = 1;
let nameIndex = 0;
function generateName() {
  const first = firstNames[nameIndex % firstNames.length];
  const last = lastNames[(nameIndex * 3) % lastNames.length]; // *3 for some mix
  nameIndex++;
  return `${first} ${last}`;
}

function generateEmail(name: string, domain: string) {
  const first = name.toLowerCase().split(' ')[0];
  return `${first}${globalCounter++}@${domain}`;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development seed is disabled in production.');
  console.log('🌱 Seeding Massive B2B Database...');
  const hash = await bcrypt.hash('password123', 10);

  console.log('🧹 Cleaning old data...');
  await prisma.auditLog.deleteMany({});
  await prisma.userBadge.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.trainingProfile.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.trainingAssignment.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.leaderboardConfig.deleteMany({});
  await prisma.scoringRubric.deleteMany({});
  await prisma.courseDocument.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.teamLeader.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.company.deleteMany({});

  console.log('🌱 Seeding badges...');
  const badgeDefs = [
    { key: "first_session", name: "Langkah Pertama", icon: "🎯", description: "Selesaikan sesi pertama" },
    { key: "first_close", name: "Deal Pertama", icon: "🤝", description: "Dapatkan outcome 'closed' pertama" },
    { key: "perfect_score", name: "Sempurna", icon: "💯", description: "Raih skor 100" },
    { key: "streak_3", name: "On Fire", icon: "🔥", description: "Latihan 3 hari berturut-turut" },
  ];
  for (const b of badgeDefs) {
    await prisma.badge.upsert({
      where: { key: b.key },
      update: b,
      create: b
    });
  }

  await prisma.leaderboardConfig.create({
    data: { c1Weight: 30, c2Weight: 30, c3Weight: 20, c4Weight: 15, c5Weight: 5 }
  });

  console.log('🌱 Seeding Super Admin...');
  await prisma.user.create({
    data: { name: 'Super Admin', email: 'superadmin@salescoach.ai', passwordHash: hash, role: UserRole.super_admin }
  });

  const companiesData = [
    { 
      name: 'PT Indotrack Alat Berat', domain: 'indotrack.co.id', industry: 'Heavy Equipment', adminEmail: 'hr@indotrack.co.id',
      description: 'Distributor utama alat berat kelas menengah dan berat untuk industri pertambangan dan konstruksi skala besar.',
      coreProducts: 'Excavator XT-900, Buldoser D8, Suku Cadang Orisinal',
      targetAudience: 'Direktur Operasional Tambang, Manajer Pengadaan Konstruksi',
      usp: 'Garansi purna jual 5 tahun dan layanan perbaikan on-site 24/7 di seluruh pelosok Indonesia.',
      commonObjections: 'Harga beli yang lebih mahal dibanding brand China, waktu inden produk yang cukup lama.',
      brandTone: 'Profesional, teknis, dan sangat menekankan keamanan (safety) serta daya tahan (durability).'
    },
    { 
      name: 'PT Medika Persada Sakti', domain: 'medikasakti.co.id', industry: 'Medical Devices', adminEmail: 'hr@medikasakti.co.id',
      description: 'Pemasok peralatan medis berteknologi tinggi untuk rumah sakit swasta dan laboratorium klinis.',
      coreProducts: 'Mesin MRI, Alat USG 4D, Monitor Pasien',
      targetAudience: 'Direktur Rumah Sakit, Kepala Instalasi Gawat Darurat, Dokter Spesialis',
      usp: 'Sertifikasi FDA & Kemenkes, akurasi alat 99.9%, dan training gratis untuk perawat selama 1 bulan.',
      commonObjections: 'Rumah sakit sudah terikat kontrak eksklusif dengan vendor lain, budget tahunan rumah sakit sudah habis.',
      brandTone: 'Empatik, ilmiah, dan berbasis data medis (evidence-based).'
    },
    { 
      name: 'PT Pangan Nusantara Grosir', domain: 'pangannusantara.co.id', industry: 'FMCG B2B', adminEmail: 'hr@pangannusantara.co.id',
      description: 'Distributor bahan baku makanan pokok grosir untuk jaringan supermarket, restoran, dan hotel (Horeca).',
      coreProducts: 'Beras Premium 50kg, Minyak Goreng Curah 100L, Tepung Terigu Industri',
      targetAudience: 'Purchasing Manager Hotel, Pemilik Jaringan Restoran, Kepala Logistik Supermarket',
      usp: 'Kepastian pasokan walau panen gagal, sistem pembayaran tempo (Term of Payment) hingga 90 hari.',
      commonObjections: 'Margin keuntungan yang sangat tipis, supplier lokal bisa memberi harga lebih miring Rp 500/kg.',
      brandTone: 'Agresif dalam negosiasi harga, praktis, dan berorientasi pada volume penjualan.'
    }
  ];

  const allCompanies = [];
  const allManagers = [];
  const allReps = [];

  for (const c of companiesData) {
    console.log(`🌱 Seeding Company: ${c.name}...`);
    const company = await prisma.company.create({
      data: { 
        name: c.name, 
        industry: c.industry, 
        website: `https://${c.domain}`, 
        subscriptionPlan: SubscriptionPlan.pro, 
        maxSeats: 500,
        description: c.description,
        coreProducts: c.coreProducts,
        targetAudience: c.targetAudience,
        usp: c.usp,
        commonObjections: c.commonObjections,
        brandTone: c.brandTone
      }
    });
    allCompanies.push(company);

    await prisma.user.create({
      data: { companyId: company.id, name: `Admin ${c.name}`, email: c.adminEmail, passwordHash: hash, role: UserRole.company_admin }
    });

    for (let t = 1; t <= 12; t++) {
      const team = await prisma.team.create({
        data: { companyId: company.id, name: `Tim Sales Regional ${t}`, description: `Tim penjualan wilayah ${t}` }
      });

      const mName = generateName();
      const manager = await prisma.user.create({
        data: { companyId: company.id, name: mName, email: generateEmail(mName, c.domain), passwordHash: hash, role: UserRole.manager }
      });
      allManagers.push(manager);

      await prisma.teamLeader.create({
        data: { userId: manager.id, teamId: team.id }
      });

      const salesData = [];
      for (let s = 1; s <= 6; s++) {
        const sName = generateName();
        salesData.push({
          companyId: company.id, teamId: team.id, name: sName, email: generateEmail(sName, c.domain), passwordHash: hash, role: UserRole.karyawan
        });
      }
      await prisma.user.createMany({ data: salesData });
      
      const createdSales = await prisma.user.findMany({ where: { teamId: team.id, role: UserRole.karyawan } });
      allReps.push(...createdSales);
    }

    const unassignedData = [];
    for (let u = 1; u <= 5; u++) {
      const uName = generateName();
      unassignedData.push({
        companyId: company.id, teamId: null, name: uName, email: generateEmail(uName, c.domain), passwordHash: hash, role: UserRole.karyawan
      });
    }
    await prisma.user.createMany({ data: unassignedData });
  }

  console.log('🌱 Seeding Courses & Sessions...');
  
  const c1 = allCompanies[0];
  const m1 = allManagers[0];
  
  const course = await prisma.course.create({
    data: {
      id: '00000000-0000-0000-0000-000000000001', companyId: c1.id, createdById: m1.id,
      title: 'Menjual Alat Berat ke Tambang', description: 'Pitching ke direktur tambang',
      difficulty: Difficulty.Advanced, category: 'Heavy Equipment',
      personaName: 'Pak Dono', personaRole: 'Direktur Tambang', personaBackground: 'Skeptis',
      personaPainPoints: 'Alat sering rusak', personaObjections: 'Mahal', personaBuyingSignals: 'Minat garansi',
      personaPersonality: 'Tegas', personaGender: 'M',
      productName: 'Excavator XT-900', productDescription: 'Alat berat tangguh',
      productStrengths: 'Garansi 5 tahun', competitorNotes: 'Lebih irit', scenarioContext: 'Meeting di site',
      idealOutcome: 'Berhasil mengatur jadwal kunjungan lapangan dan demo alat'
    }
  });

  await prisma.scoringRubric.create({
    data: {
      courseId: course.id,
      passingScore: 75,
      categories: [
        { name: "Opening", weight: 20, description: "Basa-basi dan sopan santun awal" },
        { name: "Discovery", weight: 40, description: "Menggali rasa sakit dan budget" },
        { name: "Closing", weight: 40, description: "Mengarahkan ke garansi dan komitmen" }
      ]
    }
  });

  console.log('🎉 Massive Seed selesai!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('CREDENTIALS (password semua: password123)');
  console.log('👑 superadmin@salescoach.ai');
  for (const c of companiesData) {
    console.log(`🏢 ${c.adminEmail} (HRD ${c.name})`);
  }
  
  // Menulis otomatis ke userDummy.txt dengan struktur TREE
  let dummyText = `========================================================\n    DUMMY CREDENTIALS FOR TESTING (MASSIVE SCALE)\n========================================================\nSemua password: password123\n\n`;
  dummyText += `👑 Super Admin: superadmin@salescoach.ai\n\n`;
  
  for (const c of companiesData) {
    dummyText += `========================================================\n`;
    dummyText += `🏢 ${c.name} (${c.industry})\n`;
    dummyText += `   HR / Admin : ${c.adminEmail}\n`;
    dummyText += `========================================================\n`;
    
    // Ambil 2 manager pertama saja untuk contoh di tree
    const companyReps = allReps.filter(r => r.email.includes(c.domain));
    const companyManagers = allManagers.filter(mgr => mgr.email.includes(c.domain)).slice(0, 2);
    
    for (let i = 0; i < companyManagers.length; i++) {
      const mgr = companyManagers[i];
      dummyText += `├── 👔 Manager ${i + 1} (${mgr.name})\n`;
      dummyText += `│   ✉️ ${mgr.email}\n`;
      dummyText += `│\n`;
      
      // Ambil 3 sales pertama dari manager ini
      const reps = companyReps.filter(r => r.teamId === mgr.teamId).slice(0, 3);
      for (let j = 0; j < reps.length; j++) {
        const rep = reps[j];
        const isLast = (j === reps.length - 1);
        dummyText += `│   ${isLast ? '└──' : '├──'} 👤 Sales Rep (${rep.name})\n`;
        dummyText += `│   ${isLast ? ' ' : '│'}       ✉️ ${rep.email}\n`;
      }
      dummyText += `│\n`;
    }
    dummyText += `└── ... (Total 12 Manager & 77 Sales per Perusahaan)\n\n`;
  }
  
  fs.writeFileSync(path.join(process.cwd(), 'prisma', 'userDummy.txt'), dummyText, 'utf8');
  console.log('📄 File prisma/userDummy.txt telah di-generate otomatis dengan list email aktual!');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });