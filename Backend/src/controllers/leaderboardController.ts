/**
 * leaderboardController.ts - Phase 4B/4C
 * GET  /api/leaderboard           (karyawan - tanpa breakdown orang lain)
 * GET  /api/manager/leaderboard/config
 * PATCH /api/manager/leaderboard/config
 * GET  /api/manager/analytics/leaderboard (manager - full breakdown)
 */
import type { RequestHandler } from 'express';
import { Prisma, Difficulty } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { logAudit } from '../lib/audit.js';
import {
  calculateSAW,
  getUserSAWScore,
  getLeaderboardConfig,
  updateLeaderboardConfig,
  DEFAULT_WEIGHTS,
} from '../services/leaderboardService.js';

// ──────────────────────────────────────────────────────────────
// GET /api/leaderboard?period=monthly&courseId=&difficulty=
// Karyawan: lihat rank + sawScore saja, TIDAK lihat breakdown orang lain
// ──────────────────────────────────────────────────────────────
export const getLeaderboard: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');
    const userId = req.user.sub;

    const period = (req.query.period as string) || 'monthly';
    const courseId = req.query.courseId as string | undefined;
    const difficulty = req.query.difficulty as string | undefined;
    if (difficulty && !Object.values(Difficulty).includes(difficulty as Difficulty)) {
      throw new HttpError(400, "Tingkat kesulitan tidak valid.");
    }

    const scope = req.query.scope as string | undefined;

    // Filter karyawan aktif dan restrict ke company yang sama
    const where: Record<string, unknown> = { 
      role: 'karyawan', 
      isActive: true 
    };

    if (req.user.role !== 'super_admin' && req.user.companyId) {
      where.companyId = req.user.companyId;
    }

    if (scope === 'team') {
      // Dapatkan teamId dari user yang sedang login
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { teamId: true }
      });
      if (currentUser?.teamId) {
        where.teamId = currentUser.teamId;
      }
    }

    if (courseId || difficulty) {
      const filteredUserIds = await prisma.session.findMany({
        where: {
          status: 'completed',
          ...(courseId ? { courseId } : {}),
          ...(difficulty ? { course: { difficulty: difficulty as Difficulty } } : {}),
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      where.id = { in: filteredUserIds.map(s => s.userId) };
    }

    const karyawanUsers = await prisma.user.findMany({
      where,
      select: { id: true },
    });
    const karyawanIds = karyawanUsers.map(u => u.id);

    if (karyawanIds.length === 0) {
      return res.json({ data: { rankings: [], myPosition: null } });
    }

    const rankings = await calculateSAW(karyawanIds, period);

    // Karyawan hanya lihat rank + sawScore + totalSessions (no breakdown)
    const publicRankings = rankings.map(r => ({
      rank: r.rank,
      userId: r.userId,
      name: r.userId === userId ? r.name : r.name, // all names visible
      sawScore: r.sawScore,
      totalSessions: r.totalSessions,
      avgScore: r.avgScore,
      isMe: r.userId === userId,
    }));

    // My position with SAW detail
    const myRaw = await getUserSAWScore(userId, period);
    const myRank = rankings.find(r => r.userId === userId);

    res.json({
      data: {
        rankings: publicRankings,
        myPosition: myRank
          ? {
              rank: myRank.rank,
              sawScore: myRank.sawScore,
              sawBreakdown: myRaw?.sawBreakdown ?? null, // only for self
              totalSessions: myRank.totalSessions,
            }
          : null,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/manager/analytics/leaderboard - full breakdown (manager)
// ──────────────────────────────────────────────────────────────
export const getManagerLeaderboard: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');
    const allowedManagerRoles = ['manager', 'company_admin', 'super_admin'];
    if (!allowedManagerRoles.includes(req.user.role)) {
      throw new HttpError(403, 'Akses manager diperlukan.');
    }

    const period = (req.query.period as string) || 'monthly';
    const sortBy = (req.query.sortBy as string) || 'sawScore';
    const userWhere: Prisma.UserWhereInput = { role: 'karyawan', isActive: true };

    if (req.user.role !== 'super_admin') {
      userWhere.companyId = req.user.companyId;
    }

    if (req.user.role === 'manager') {
      const myTeams = await prisma.teamLeader.findMany({
        where: { userId: req.user.sub },
        select: { teamId: true }
      });
      userWhere.teamId = { in: myTeams.map(t => t.teamId) };
    }

    const karyawanUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });
    const karyawanIds = karyawanUsers.map(u => u.id);

    if (karyawanIds.length === 0) {
      return res.json({ data: { rankings: [], config: DEFAULT_WEIGHTS } });
    }

    const rankings = await calculateSAW(karyawanIds, period, undefined, true);

    // Sort by different criteria
    if (sortBy === 'avgScore') rankings.sort((a, b) => b.avgScore - a.avgScore);
    else if (sortBy === 'improvementRate')
      rankings.sort((a, b) =>
        (b.sawBreakdown?.c3_improvementRate ?? 0) - (a.sawBreakdown?.c3_improvementRate ?? 0)
      );
    else if (sortBy === 'completionRate')
      rankings.sort((a, b) =>
        (b.sawBreakdown?.c4_completionRate ?? 0) - (a.sawBreakdown?.c4_completionRate ?? 0)
      );
    rankings.forEach((r, i) => { r.rank = i + 1; });

    const config = await getLeaderboardConfig();

    res.json({ data: { rankings, config } });
  } catch (e) {
    next(e);
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/manager/leaderboard/config
// ──────────────────────────────────────────────────────────────
export const getLeaderboardConfigHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');
    const allowedManagerRoles = ['manager', 'company_admin', 'super_admin'];
    if (!allowedManagerRoles.includes(req.user.role)) {
      throw new HttpError(403, 'Akses manager diperlukan.');
    }
    const config = await getLeaderboardConfig();
    res.json({ data: { config } });
  } catch (e) {
    next(e);
  }
};

// ──────────────────────────────────────────────────────────────
// PATCH /api/manager/leaderboard/config
// ──────────────────────────────────────────────────────────────
const configSchema = z.object({
  c1: z.number().int().min(0).max(100),
  c2: z.number().int().min(0).max(100),
  c3: z.number().int().min(0).max(100),
  c4: z.number().int().min(0).max(100),
  c5: z.number().int().min(0).max(100),
}).refine(d => d.c1 + d.c2 + d.c3 + d.c4 + d.c5 === 100, {
  message: 'Total bobot harus = 100',
});

export const updateLeaderboardConfigHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');
    const allowedManagerRoles = ['manager', 'company_admin', 'super_admin'];
    if (!allowedManagerRoles.includes(req.user.role)) {
      throw new HttpError(403, 'Akses manager diperlukan.');
    }
    const payload = configSchema.parse(req.body);
    await updateLeaderboardConfig(payload, req.user.sub);

    logAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: "config.leaderboard",
      targetType: "leaderboard_config",
      metadata: payload,
      ipAddress: req.ip,
    });

    res.json({ data: { config: payload } });
  } catch (e) {
    next(e);
  }
};
