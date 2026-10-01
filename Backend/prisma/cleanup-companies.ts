import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const keywords = [
    "sumber alfaria",
    "onitsuka",
    "durex",
    "oasis",
    "anak",
    "tiktok",
    "rohid",
    "KAI",
    "SUSU GEDE",
    "indomie",
    "POS Indonesia"
  ];

  console.log("🔍 Looking for junk companies...");
  const allCompanies = await prisma.company.findMany();
  
  const junkCompanies = allCompanies.filter(c => 
    keywords.some(k => c.name.toLowerCase().includes(k.toLowerCase()))
  );

  if (junkCompanies.length === 0) {
    console.log("✅ No junk companies found.");
    return;
  }

  const companyIds = junkCompanies.map(c => c.id);
  console.log(`🗑️ Found ${companyIds.length} companies to delete:`);
  junkCompanies.forEach(c => console.log(` - ${c.name}`));

  // Find all users in these companies
  const users = await prisma.user.findMany({
    where: { companyId: { in: companyIds } }
  });
  const userIds = users.map(u => u.id);

  if (userIds.length > 0) {
    console.log(`🗑️ Deleting data for ${userIds.length} users...`);
    
    // Find all courses created by these users
    const courses = await prisma.course.findMany({
      where: { createdById: { in: userIds } }
    });
    const courseIds = courses.map(c => c.id);

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
    await prisma.teamLeader.deleteMany({ where: { userId: { in: userIds } } });

    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Delete teams in these companies
  await prisma.team.deleteMany({ where: { companyId: { in: companyIds } } });

  // Delete the companies
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });

  console.log(`✅ Successfully deleted ${companyIds.length} junk companies!`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
