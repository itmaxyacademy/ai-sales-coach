/**
 * prisma/setup-prod.ts
 * Script khusus untuk Production: Hanya membuat akun Super Admin pertama jika belum ada.
 * Tidak ada data dummy.
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Checking Production Environment...');

  const adminEmail = process.env.SUPERADMIN_EMAIL;
  const adminPassword = process.env.SUPERADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 12) {
    throw new Error('SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD (at least 12 characters) are required.');
  }

  // Cek apakah super_admin sudah ada
  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.super_admin },
  });

  if (existingAdmin) {
    console.log(`✅ Super Admin already exists: ${existingAdmin.email}`);
    console.log('Skipping setup.');
    return;
  }

  console.log('🌱 Seeding initial Super Admin for Production...');
  const hash = await bcrypt.hash(adminPassword, 10);

  const superadmin = await prisma.user.create({
    data: {
      name: 'System Owner',
      email: adminEmail,
      passwordHash: hash,
      role: UserRole.super_admin,
      isActive: true,
    },
  });

  console.log('🎉 Production Setup Complete!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Email    : ${superadmin.email}`);
  console.log('Password set from SUPERADMIN_PASSWORD (value omitted).');
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Setup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
