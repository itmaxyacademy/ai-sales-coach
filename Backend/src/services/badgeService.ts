import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

export const BADGE_DEFINITIONS = [
  { key: "first_session",  name: "Langkah Pertama",    icon: "🎯", description: "Selesaikan sesi pertama" },
  { key: "first_close",    name: "Deal Pertama",        icon: "🤝", description: "Dapatkan outcome 'closed' pertama" },
  { key: "perfect_score",  name: "Sempurna",            icon: "💯", description: "Raih skor 100" },
  { key: "streak_3",       name: "On Fire",             icon: "🔥", description: "Latihan 3 hari berturut-turut" },
  { key: "streak_7",       name: "Dedikasi Penuh",      icon: "⚡", description: "Latihan 7 hari berturut-turut" },
  { key: "comeback",       name: "Comeback",            icon: "📈", description: "Naik 20+ poin dari sesi sebelumnya" },
  { key: "top_3",          name: "Top Performer",       icon: "🏆", description: "Masuk top 3 leaderboard" },
  { key: "sessions_10",    name: "Rajin Berlatih",      icon: "🎓", description: "Selesaikan 10 sesi" },
  { key: "sessions_50",    name: "Veteran",             icon: "🌟", description: "Selesaikan 50 sesi" },
  { key: "objection_master", name: "Objection Master",  icon: "🛡️", description: "Handle 5+ objeksi dalam 1 sesi" },
];

export async function seedBadges(): Promise<void> {
  for (const b of BADGE_DEFINITIONS) {
    await prisma.badge.upsert({
      where: { key: b.key },
      update: { name: b.name, icon: b.icon, description: b.description },
      create: { key: b.key, name: b.name, icon: b.icon, description: b.description },
    });
  }
}

export async function checkAndUnlockBadges(
  userId: string,
  sessionResult: {
    totalScore: number;
    outcome: string;
    objectionCount: number;
  }
): Promise<string[]> {
  const newlyUnlockedKeys: string[] = [];

  try {
    // 1. Get all earned badges by this user to avoid checking them again
    const earnedUserBadges = await prisma.userBadge.findMany({
      where: { userId },
      include: { badge: true },
    });
    const earnedKeys = new Set(earnedUserBadges.map(ub => ub.badge.key));

    // Ensure all badges exist in DB
    const dbBadges = await prisma.badge.findMany();
    const dbBadgeMap = new Map(dbBadges.map(b => [b.key, b.id]));

    // Query helper data lazily
    let userSessionsCount: number | null = null;
    const getSessionsCount = async () => {
      if (userSessionsCount === null) {
        userSessionsCount = await prisma.session.count({
          where: { userId, status: "completed" }
        });
      }
      return userSessionsCount;
    };

    let userSessionsList: any[] | null = null;
    const getSessionsList = async () => {
      if (userSessionsList === null) {
        userSessionsList = await prisma.session.findMany({
          where: { userId, status: "completed" },
          orderBy: { completedAt: "desc" },
          select: { totalScore: true, completedAt: true }
        });
      }
      return userSessionsList;
    };

    const unlockBadge = async (key: string, metadata?: any) => {
      const badgeId = dbBadgeMap.get(key);
      if (!badgeId) return;

      await prisma.userBadge.create({
        data: {
          userId,
          badgeId,
          metadata: metadata || null,
        }
      });
      newlyUnlockedKeys.push(key);

      // Create notification
      const def = BADGE_DEFINITIONS.find(b => b.key === key);
      if (def) {
        await prisma.notification.create({
          data: {
            userId,
            title: `Badge Baru Terbuka: ${def.name} ${def.icon}`,
            message: def.description,
            type: "rank_up", // badge notifications
          }
        }).catch((err: unknown) => logger.error({ err }, "Failed to create badge notification"));
      }
    };

    // check key: first_session
    if (!earnedKeys.has("first_session")) {
      const cnt = await getSessionsCount();
      if (cnt >= 1) {
        await unlockBadge("first_session");
      }
    }

    // check key: first_close
    if (!earnedKeys.has("first_close")) {
      if (sessionResult.outcome === "closed") {
        await unlockBadge("first_close");
      }
    }

    // check key: perfect_score
    if (!earnedKeys.has("perfect_score")) {
      if (sessionResult.totalScore === 100) {
        await unlockBadge("perfect_score");
      }
    }

    // check key: sessions_10
    if (!earnedKeys.has("sessions_10")) {
      const cnt = await getSessionsCount();
      if (cnt >= 10) {
        await unlockBadge("sessions_10");
      }
    }

    // check key: sessions_50
    if (!earnedKeys.has("sessions_50")) {
      const cnt = await getSessionsCount();
      if (cnt >= 50) {
        await unlockBadge("sessions_50");
      }
    }

    // check key: objection_master
    if (!earnedKeys.has("objection_master")) {
      if (sessionResult.objectionCount >= 5) {
        await unlockBadge("objection_master", { count: sessionResult.objectionCount });
      }
    }

    // check key: comeback
    if (!earnedKeys.has("comeback")) {
      const list = await getSessionsList();
      if (list.length >= 2) {
        const latest = list[0].totalScore ?? 0;
        const prev = list[1].totalScore ?? 0;
        if (latest - prev >= 20) {
          await unlockBadge("comeback", { delta: latest - prev });
        }
      }
    }

    // check key: streak_3 or streak_7
    if (!earnedKeys.has("streak_3") || !earnedKeys.has("streak_7")) {
      const list = await getSessionsList();
      if (list.length > 0) {
        const uniqueDates = new Set<string>();
        for (const s of list) {
          if (s.completedAt) {
            uniqueDates.add(s.completedAt.toISOString().split("T")[0]);
          }
        }
        const sortedDates = Array.from(uniqueDates).sort().reverse();
        
        let streak = 0;
        const expectedDate = new Date();
        for (let i = 0; i < sortedDates.length; i++) {
          const dateStr = expectedDate.toISOString().split("T")[0];
          if (sortedDates.includes(dateStr)) {
            streak++;
            expectedDate.setDate(expectedDate.getDate() - 1);
          } else {
            if (i === 0) {
              expectedDate.setDate(expectedDate.getDate() - 1);
              const yesterdayStr = expectedDate.toISOString().split("T")[0];
              if (sortedDates.includes(yesterdayStr)) {
                streak++;
                expectedDate.setDate(expectedDate.getDate() - 1);
                continue;
              }
            }
            break;
          }
        }

        if (streak >= 3 && !earnedKeys.has("streak_3")) {
          await unlockBadge("streak_3", { streak });
        }
        if (streak >= 7 && !earnedKeys.has("streak_7")) {
          await unlockBadge("streak_7", { streak });
        }
      }
    }

    // check key: top_3
    if (!earnedKeys.has("top_3")) {
      const { calculateSAW } = await import("./leaderboardService.js");
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true }
      });
      const allKaryawan = await prisma.user.findMany({
        where: {
          role: "karyawan",
          isActive: true,
          ...(currentUser?.companyId ? { companyId: currentUser.companyId } : {})
        },
        select: { id: true }
      });
      const rankings = await calculateSAW(allKaryawan.map(u => u.id), "alltime");
      const userRank = rankings.find(r => r.userId === userId);
      if (userRank && userRank.rank <= 3) {
        await unlockBadge("top_3", { rank: userRank.rank });
      }
    }

  } catch (error) {
    logger.error({ err: error }, "Error in checkAndUnlockBadges");
    return [];
  }

  return newlyUnlockedKeys;
}
