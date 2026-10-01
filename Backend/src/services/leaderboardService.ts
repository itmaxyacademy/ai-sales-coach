/**
 * leaderboardService.ts
 * SAW (Simple Additive Weighting) engine untuk ranking karyawan.
 *
 * Kriteria & Bobot Default:
 *   C1 = Avg Score (totalScore)          - 30%
 *   C2 = Outcome Rate (% closed)         - 30%
 *   C3 = Improvement Rate (tren naik)    - 20%
 *   C4 = Completion Rate assignment      - 15%
 *   C5 = Deadline Rate (selesai < dueAt) - 5%
 */
import { prisma } from '../lib/prisma.js';

export interface SAWWeights {
  c1: number; // Avg Score
  c2: number; // Outcome Rate
  c3: number; // Improvement Rate
  c4: number; // Completion Rate
  c5: number; // Deadline Rate
}

export const DEFAULT_WEIGHTS: SAWWeights = {
  c1: 30,
  c2: 30,
  c3: 20,
  c4: 15,
  c5: 5,
};

export interface SAWCriteria {
  c1_avgScore: number;
  c2_outcomeRate: number;
  c3_improvementRate: number;
  c4_completionRate: number;
  c5_deadlineRate: number;
}

export interface RankedUser {
  rank: number;
  userId: string;
  name: string;
  email: string;
  sawScore: number;
  sawBreakdown?: SAWCriteria;
  totalSessions: number;
  avgScore: number;
}

export interface SAWDetail extends RankedUser {
  sawBreakdown: SAWCriteria;
  normalizedScores: SAWCriteria;
}

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'daily':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'alltime':
      return null;
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

async function getWeights(): Promise<SAWWeights> {
  const config = await prisma.leaderboardConfig.findFirst();
  if (!config) return DEFAULT_WEIGHTS;
  return {
    c1: config.c1Weight,
    c2: config.c2Weight,
    c3: config.c3Weight,
    c4: config.c4Weight,
    c5: config.c5Weight,
  };
}

async function computeRawCriteria(
  userIds: string[],
  period: string
): Promise<Map<string, SAWCriteria>> {
  const periodStart = getPeriodStart(period);
  const sessionWhere = {
    userId: { in: userIds },
    status: 'completed' as const,
    completedAt: periodStart ? { gte: periodStart } : undefined,
  };

  const [sessions, assignments] = await Promise.all([
    prisma.session.findMany({
      where: sessionWhere,
      select: {
        userId: true,
        totalScore: true,
        outcome: true,
        completedAt: true,
        course: {
          select: { difficulty: true },
        },
      },
      orderBy: { completedAt: 'asc' },
    }),
    prisma.trainingAssignment.findMany({
      where: {
        userId: { in: userIds },
        ...(periodStart ? { createdAt: { gte: periodStart } } : {}),
      },
      select: {
        userId: true,
        status: true,
        dueAt: true,
        completedAt: true,
      },
    }),
  ]);

  const result = new Map<string, SAWCriteria>();

  // Pengali Bobot Kesulitan (SAW Difficulty Multiplier)
  const DIFFICULTY_MULTIPLIER: Record<string, number> = {
    Beginner: 1.0,
    Intermediate: 1.15,
    Advanced: 1.3,
  };

  for (const userId of userIds) {
    const userSessions = sessions.filter(s => s.userId === userId);
    const userAssignments = assignments.filter(a => a.userId === userId);

    // C1: Avg Score dengan Difficulty Multiplier
    const weightedScores = userSessions
      .filter((s): s is typeof s & { totalScore: number } => s.totalScore !== null)
      .map(s => {
        const mult = DIFFICULTY_MULTIPLIER[s.course?.difficulty ?? 'Beginner'] ?? 1.0;
        return Math.min(100, Math.round(s.totalScore * mult));
      });
    const c1_avgScore = weightedScores.length > 0
      ? weightedScores.reduce((a, b) => a + b, 0) / weightedScores.length
      : 0;

    // C2: Outcome Rate (% closed)
    const closedCount = userSessions.filter(s => s.outcome === 'closed').length;
    const c2_outcomeRate = userSessions.length > 0
      ? (closedCount / userSessions.length) * 100
      : 0;

    // C3: Improvement Rate dengan skor terbobot
    let c3_improvementRate = 0;
    if (weightedScores.length >= 2) {
      const firstHalf = weightedScores.slice(0, Math.ceil(weightedScores.length / 2));
      const lastHalf = weightedScores.slice(Math.floor(weightedScores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const lastAvg = lastHalf.reduce((a, b) => a + b, 0) / lastHalf.length;
      // Normalisasi: rentang peningkatan -30 s.d. +30 -> 0 s.d. 100
      c3_improvementRate = Math.min(100, Math.max(0, ((lastAvg - firstAvg) + 30) / 60 * 100));
    } else if (weightedScores.length === 1) {
      c3_improvementRate = 50; // netral untuk skor tunggal
    }

    // C4: Completion Rate assignment
    const totalAssignments = userAssignments.length;
    const completedAssignments = userAssignments.filter(a => a.status === 'completed').length;
    const c4_completionRate = totalAssignments > 0
      ? (completedAssignments / totalAssignments) * 100
      : 0;

    // C5: Deadline Rate (selesai sebelum dueAt)
    const withDue = userAssignments.filter(a => a.dueAt !== null && a.status === 'completed');
    const onTime = withDue.filter(
      a => a.completedAt !== null && a.dueAt !== null && a.completedAt <= a.dueAt
    );
    const c5_deadlineRate = withDue.length > 0
      ? (onTime.length / withDue.length) * 100
      : 0;

    result.set(userId, {
      c1_avgScore,
      c2_outcomeRate,
      c3_improvementRate,
      c4_completionRate,
      c5_deadlineRate,
    });
  }

  return result;
}

function normalize(
  criteriaMap: Map<string, SAWCriteria>
): Map<string, SAWCriteria> {
  const userIds = Array.from(criteriaMap.keys());

  const maxC1 = Math.max(...userIds.map(id => criteriaMap.get(id)!.c1_avgScore), 1);
  const maxC2 = Math.max(...userIds.map(id => criteriaMap.get(id)!.c2_outcomeRate), 1);
  const maxC3 = Math.max(...userIds.map(id => criteriaMap.get(id)!.c3_improvementRate), 1);
  const maxC4 = Math.max(...userIds.map(id => criteriaMap.get(id)!.c4_completionRate), 1);
  const maxC5 = Math.max(...userIds.map(id => criteriaMap.get(id)!.c5_deadlineRate), 1);

  const normalized = new Map<string, SAWCriteria>();
  for (const [userId, c] of criteriaMap) {
    normalized.set(userId, {
      c1_avgScore: maxC1 > 0 ? c.c1_avgScore / maxC1 : 0,
      c2_outcomeRate: maxC2 > 0 ? c.c2_outcomeRate / maxC2 : 0,
      c3_improvementRate: maxC3 > 0 ? c.c3_improvementRate / maxC3 : 0,
      c4_completionRate: maxC4 > 0 ? c.c4_completionRate / maxC4 : 0,
      c5_deadlineRate: maxC5 > 0 ? c.c5_deadlineRate / maxC5 : 0,
    });
  }
  return normalized;
}

function computeV(criteria: SAWCriteria, weights: SAWWeights): number {
  const total = weights.c1 + weights.c2 + weights.c3 + weights.c4 + weights.c5;
  return (
    (weights.c1 / total) * criteria.c1_avgScore +
    (weights.c2 / total) * criteria.c2_outcomeRate +
    (weights.c3 / total) * criteria.c3_improvementRate +
    (weights.c4 / total) * criteria.c4_completionRate +
    (weights.c5 / total) * criteria.c5_deadlineRate
  );
}

/**
 * Calculate SAW rankings for given userIds
 */
export async function calculateSAW(
  userIds: string[],
  period: string = 'monthly',
  weights?: SAWWeights,
  includeBreakdown = false
): Promise<RankedUser[]> {
  if (userIds.length === 0) return [];

  const w = weights ?? (await getWeights());
  const rawCriteria = await computeRawCriteria(userIds, period);
  const normalizedCriteria = normalize(rawCriteria);

  // Fetch user names
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  // Count total sessions per user
  const sessionCounts = await prisma.session.groupBy({
    by: ['userId'],
    where: {
      userId: { in: userIds },
      status: 'completed',
    },
    _count: { id: true },
  });
  const sessionCountMap = new Map(sessionCounts.map(s => [s.userId, s._count.id]));

  const results: RankedUser[] = userIds.map(userId => {
    const raw = rawCriteria.get(userId)!;
    const norm = normalizedCriteria.get(userId)!;
    const sawScore = computeV(norm, w);
    const user = userMap.get(userId);

    const ranked: RankedUser = {
      rank: 0,
      userId,
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
      sawScore: Math.round(sawScore * 1000) / 1000,
      totalSessions: sessionCountMap.get(userId) ?? 0,
      avgScore: Math.round(raw.c1_avgScore),
    };

    if (includeBreakdown) {
      ranked.sawBreakdown = {
        c1_avgScore: Math.round(raw.c1_avgScore * 10) / 10,
        c2_outcomeRate: Math.round(raw.c2_outcomeRate * 10) / 10,
        c3_improvementRate: Math.round(raw.c3_improvementRate * 10) / 10,
        c4_completionRate: Math.round(raw.c4_completionRate * 10) / 10,
        c5_deadlineRate: Math.round(raw.c5_deadlineRate * 10) / 10,
      };
    }

    return ranked;
  });

  results.sort((a, b) => b.sawScore - a.sawScore);
  results.forEach((r, i) => { r.rank = i + 1; });

  return results;
}

/**
 * Get SAW detail for a single user
 */
export async function getUserSAWScore(
  userId: string,
  period: string = 'monthly',
  weights?: SAWWeights
): Promise<SAWDetail | null> {
  const w = weights ?? (await getWeights());
  const rawCriteria = await computeRawCriteria([userId], period);
  const normalizedCriteria = normalize(rawCriteria);

  const raw = rawCriteria.get(userId);
  const norm = normalizedCriteria.get(userId);
  if (!raw || !norm) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return null;

  const sessionCount = await prisma.session.count({
    where: { userId, status: 'completed' },
  });

  const sawScore = computeV(norm, w);

  return {
    rank: 0, // caller sets rank via calculateSAW
    userId,
    name: user.name,
    email: user.email,
    sawScore: Math.round(sawScore * 1000) / 1000,
    totalSessions: sessionCount,
    avgScore: Math.round(raw.c1_avgScore),
    sawBreakdown: {
      c1_avgScore: Math.round(raw.c1_avgScore * 10) / 10,
      c2_outcomeRate: Math.round(raw.c2_outcomeRate * 10) / 10,
      c3_improvementRate: Math.round(raw.c3_improvementRate * 10) / 10,
      c4_completionRate: Math.round(raw.c4_completionRate * 10) / 10,
      c5_deadlineRate: Math.round(raw.c5_deadlineRate * 10) / 10,
    },
    normalizedScores: {
      c1_avgScore: Math.round(norm.c1_avgScore * 1000) / 1000,
      c2_outcomeRate: Math.round(norm.c2_outcomeRate * 1000) / 1000,
      c3_improvementRate: Math.round(norm.c3_improvementRate * 1000) / 1000,
      c4_completionRate: Math.round(norm.c4_completionRate * 1000) / 1000,
      c5_deadlineRate: Math.round(norm.c5_deadlineRate * 1000) / 1000,
    },
  };
}

/**
 * Get or init LeaderboardConfig
 */
export async function getLeaderboardConfig(): Promise<SAWWeights> {
  return getWeights();
}

export async function updateLeaderboardConfig(
  weights: SAWWeights,
  updatedById: string
): Promise<void> {
  const existing = await prisma.leaderboardConfig.findFirst();
  if (existing) {
    await prisma.leaderboardConfig.update({
      where: { id: existing.id },
      data: {
        c1Weight: weights.c1,
        c2Weight: weights.c2,
        c3Weight: weights.c3,
        c4Weight: weights.c4,
        c5Weight: weights.c5,
        updatedById,
      },
    });
  } else {
    await prisma.leaderboardConfig.create({
      data: {
        c1Weight: weights.c1,
        c2Weight: weights.c2,
        c3Weight: weights.c3,
        c4Weight: weights.c4,
        c5Weight: weights.c5,
        updatedById,
      },
    });
  }
}
