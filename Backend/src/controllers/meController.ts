/**
 * meController.ts - Phase 4B: Karyawan Endpoints
 * GET /api/me/dashboard
 * GET /api/me/stats
 * GET /api/me/progress
 * GET /api/me/strengths
 */
import type { RequestHandler } from "express";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import {
  calculateSAW,
  getUserSAWScore,
} from "../services/leaderboardService.js";

// ──────────────────────────────────────────────────────────────
// GET /api/me/dashboard
// ──────────────────────────────────────────────────────────────
export const getMyDashboard: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    const [pendingAssignments, weekSessions, lastSession, allSessions, allKaryawanIds] =
      await Promise.all([
        // Pending assignments (max 5, sort dueAt asc)
        prisma.trainingAssignment.findMany({
          where: { userId, status: { in: ['pending', 'in_progress'] } },
          include: {
            course: { select: { id: true, title: true, difficulty: true, category: true } },
          },
          orderBy: { dueAt: 'asc' },
          take: 5,
        }),
        // Sessions this week
        prisma.session.findMany({
          where: { userId, status: 'completed', completedAt: { gte: weekAgo } },
          select: { totalScore: true },
        }),
        // Last completed session
        prisma.session.findFirst({
          where: { userId, status: 'completed' },
          include: { course: { select: { title: true } } },
          orderBy: { completedAt: 'desc' },
        }),
        // All completed sessions for streak
        prisma.session.findMany({
          where: { userId, status: 'completed' },
          select: { completedAt: true },
          orderBy: { completedAt: 'desc' },
        }),
        // All karyawan IDs for SAW ranking (scoped to user's company if applicable)
        prisma.user.findMany({
          where: {
            role: 'karyawan',
            isActive: true,
            ...(req.user.companyId ? { companyId: req.user.companyId } : {}),
          },
          select: { id: true },
        }),
      ]);

    // Avg score this week
    const weekScores = weekSessions
      .map((s) => s.totalScore)
      .filter((s): s is number => s !== null);
    const avgScoreThisWeek =
      weekScores.length > 0
        ? Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length)
        : null;

    // Streak calculation
    let streakDays = 0;
    const uniqueDays = new Set(
      allSessions
        .map((s) => s.completedAt?.toISOString().slice(0, 10))
        .filter(Boolean),
    );
    const checkDate = new Date(todayStart);
    while (uniqueDays.has(checkDate.toISOString().slice(0, 10))) {
      streakDays++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // SAW ranking
    const karyawanIds = allKaryawanIds.map((u) => u.id);
    let rankingPosition: number | null = null;
    if (karyawanIds.length > 0) {
      const rankings = await calculateSAW(karyawanIds, "monthly");
      const myRank = rankings.find((r) => r.userId === userId);
      rankingPosition = myRank?.rank ?? null;
    }

    res.json({
      data: {
        pendingAssignments: pendingAssignments.map((a) => ({
          id: a.id,
          courseId: a.course.id,
          courseTitle: a.course.title,
          difficulty: a.course.difficulty,
          category: a.course.category,
          status: a.status,
          dueAt: a.dueAt?.toISOString() ?? null,
        })),
        avgScoreThisWeek,
        rankingPosition,
        lastSession: lastSession
          ? {
              courseTitle: lastSession.course.title,
              score: lastSession.totalScore,
              outcome: lastSession.outcome,
              completedAt: lastSession.completedAt?.toISOString() ?? null,
            }
          : null,
        streakDays,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/me/stats
// ──────────────────────────────────────────────────────────────
export const getMyStats: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;

    const [sessions, assignments, sawDetail, allKaryawanIds] = await Promise.all([
      prisma.session.findMany({
        where: { userId, status: 'completed' },
        select: { totalScore: true, outcome: true, completedAt: true },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.trainingAssignment.findMany({
        where: { userId },
        select: { status: true, dueAt: true, completedAt: true },
      }),
      getUserSAWScore(userId, 'monthly'),
      prisma.user.findMany({
        where: {
          role: 'karyawan',
          isActive: true,
          ...(req.user.companyId ? { companyId: req.user.companyId } : {}),
        },
        select: { id: true },
      }),
    ]);

    const scores = sessions
      .map((s) => s.totalScore)
      .filter((s): s is number => s !== null);
    const totalSessions = sessions.length;
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
    const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

    // Outcome rate
    const closedCount = sessions.filter((s) => s.outcome === "closed").length;
    const followUpCount = sessions.filter(
      (s) => s.outcome === "follow_up",
    ).length;
    const rejectedCount = sessions.filter(
      (s) => s.outcome === "rejected",
    ).length;
    const outcomeRate = {
      closed:
        totalSessions > 0 ? Math.round((closedCount / totalSessions) * 100) : 0,
      follow_up:
        totalSessions > 0
          ? Math.round((followUpCount / totalSessions) * 100)
          : 0,
      rejected:
        totalSessions > 0
          ? Math.round((rejectedCount / totalSessions) * 100)
          : 0,
    };

    // Completion rate assignment
    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter(
      (a) => a.status === "completed",
    ).length;
    const completionRate =
      totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

    // Improvement rate (3 sesi terakhir vs 3 pertama)
    let improvementRate = 0;
    if (scores.length >= 2) {
      const firstThree = scores.slice(
        0,
        Math.min(3, Math.floor(scores.length / 2)),
      );
      const lastThree = scores.slice(
        -Math.min(3, Math.ceil(scores.length / 2)),
      );
      const firstAvg =
        firstThree.reduce((a, b) => a + b, 0) / firstThree.length;
      const lastAvg = lastThree.reduce((a, b) => a + b, 0) / lastThree.length;
      improvementRate = Math.round(lastAvg - firstAvg);
    }

    // Deadline rate
    const withDue = assignments.filter(
      (a) => a.dueAt !== null && a.status === "completed",
    );
    const onTime = withDue.filter(
      (a) =>
        a.completedAt !== null && a.dueAt !== null && a.completedAt <= a.dueAt,
    );
    const deadlineRate =
      withDue.length > 0
        ? Math.round((onTime.length / withDue.length) * 100)
        : 0;

    // SAW rank
    const karyawanIds = allKaryawanIds.map((u) => u.id);
    let sawRank: number | null = null;
    if (karyawanIds.length > 0 && sawDetail) {
      const rankings = await calculateSAW(karyawanIds, "monthly");
      sawRank = rankings.find((r) => r.userId === userId)?.rank ?? null;
    }

    res.json({
      data: {
        totalSessions,
        avgScore,
        bestScore,
        outcomeRate,
        completionRate,
        improvementRate,
        deadlineRate,
        sawScore: sawDetail?.sawScore ?? 0,
        sawRank,
        sawBreakdown: sawDetail?.sawBreakdown ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/me/progress
// ──────────────────────────────────────────────────────────────
export const getMyProgress: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;
    const period = (req.query.period as string) || "30days";

    const now = new Date();
    let dateLimit: Date | null = null;
    if (period === "7days")
      dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === "30days")
      dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === "90days")
      dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const sessions = await prisma.session.findMany({
      where: {
        userId,
        status: "completed",
        ...(dateLimit ? { completedAt: { gte: dateLimit } } : {}),
      },
      select: {
        id: true,
        totalScore: true,
        outcome: true,
        completedAt: true,
        scoreBreakdown: true,
      },
      orderBy: { completedAt: "asc" },
    });

    // scores[] time series
    const scores = sessions.map((s) => ({
      sessionId: s.id,
      score: s.totalScore ?? 0,
      outcome: s.outcome,
      completedAt: s.completedAt?.toISOString() ?? null,
    }));

    // Category trends (avg per rubrik kategori per bulan)
    const categoryData = new Map<string, Map<string, number[]>>();
    for (const s of sessions) {
      if (!s.scoreBreakdown || !s.completedAt) continue;
      const month = s.completedAt.toISOString().slice(0, 7);

      let breakdown: Array<{ category: string; score: number }> = [];
      if (Array.isArray(s.scoreBreakdown)) {
        breakdown = s.scoreBreakdown as Array<{
          category: string;
          score: number;
        }>;
      } else if (typeof s.scoreBreakdown === "object") {
        breakdown = Object.entries(s.scoreBreakdown).map(
          ([category, score]) => ({
            category,
            score: Number(score),
          }),
        );
      } else {
        continue;
      }

      for (const cat of breakdown) {
        if (!categoryData.has(cat.category))
          categoryData.set(cat.category, new Map());
        const monthMap = categoryData.get(cat.category)!;
        if (!monthMap.has(month)) monthMap.set(month, []);
        monthMap.get(month)!.push(cat.score);
      }
    }
    const categoryTrends = Array.from(categoryData.entries()).map(
      ([category, monthMap]) => ({
        category,
        months: Array.from(monthMap.entries()).map(([month, vals]) => ({
          month,
          avgScore: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        })),
      }),
    );

    // Rolling avg 5 sesi
    const rawScores = sessions.map((s) => s.totalScore ?? 0);
    const improvementChart = rawScores.map((_, i) => {
      const window = rawScores.slice(Math.max(0, i - 4), i + 1);
      return {
        sessionIndex: i + 1,
        rollingAvg: Math.round(
          window.reduce((a, b) => a + b, 0) / window.length,
        ),
      };
    });

    res.json({ data: { scores, categoryTrends, improvementChart } });
  } catch (e) {
    next(e);
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/me/strengths
// ──────────────────────────────────────────────────────────────
export const getMyStrengths: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;

    const sessions = await prisma.session.findMany({
      where: { userId, status: "completed" },
      select: { scoreBreakdown: true },
    });

    // Aggregate category scores
    const catScores = new Map<string, number[]>();
    for (const s of sessions) {
      if (!s.scoreBreakdown) continue;

      let breakdown: Array<{ category: string; score: number }> = [];
      if (Array.isArray(s.scoreBreakdown)) {
        breakdown = s.scoreBreakdown as Array<{
          category: string;
          score: number;
        }>;
      } else if (typeof s.scoreBreakdown === "object") {
        breakdown = Object.entries(s.scoreBreakdown).map(
          ([category, score]) => ({
            category,
            score: Number(score),
          }),
        );
      } else {
        continue;
      }

      for (const cat of breakdown) {
        if (!catScores.has(cat.category)) catScores.set(cat.category, []);
        catScores.get(cat.category)!.push(cat.score);
      }
    }

    const categoryAvgs = Array.from(catScores.entries())
      .map(([category, vals]) => ({
        category,
        avgScore: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
        sampleCount: vals.length,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const strongest = categoryAvgs.slice(0, 3);
    const weakest = categoryAvgs.slice(-3).reverse();

    // Recommended courses addressing weakness
    const weakCategories = weakest.map((w) => w.category);
    let recommendedCourses: any[] = [];
    if (weakCategories.length > 0) {
      recommendedCourses = await prisma.course.findMany({
        where: {
          isActive: true,
          OR: [
            { category: { in: weakCategories } },
            ...weakCategories.map((cat) => ({
              title: { contains: cat, mode: 'insensitive' as const },
            })),
            ...weakCategories.map((cat) => ({
              description: { contains: cat, mode: 'insensitive' as const },
            })),
          ],
        },
        select: { id: true, title: true, difficulty: true, category: true, personaName: true, personaRole: true },
        take: 5,
      });
    }

    if (recommendedCourses.length === 0) {
      // Fallback: recommend active training courses so recommendations are never empty!
      recommendedCourses = await prisma.course.findMany({
        where: { isActive: true },
        select: { id: true, title: true, difficulty: true, category: true, personaName: true, personaRole: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
    }

    res.json({ data: { strongest, weakest, recommendedCourses } });
  } catch (e) {
    next(e);
  }
};

// ──────────────────────────────────────────────────────────────
// GET /api/me/stats/weekly
// ──────────────────────────────────────────────────────────────
export const getWeeklyStats: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;

    const getStartOfThisWeek = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      return monday;
    };

    const thisWeekStart = getStartOfThisWeek();
    const lastWeekStart = new Date(
      thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000,
    );

    const [thisWeekSessions, lastWeekSessions] = await Promise.all([
      prisma.session.findMany({
        where: {
          userId,
          status: "completed",
          completedAt: { gte: thisWeekStart },
        },
        select: { totalScore: true, outcome: true },
      }),
      prisma.session.findMany({
        where: {
          userId,
          status: "completed",
          completedAt: { gte: lastWeekStart, lt: thisWeekStart },
        },
        select: { totalScore: true, outcome: true },
      }),
    ]);

    // calculate thisWeek
    const thisWeekScores = thisWeekSessions
      .map((s) => s.totalScore)
      .filter((s): s is number => s !== null);
    const thisWeekAvg =
      thisWeekScores.length > 0
        ? Math.round(
            thisWeekScores.reduce((a, b) => a + b, 0) / thisWeekScores.length,
          )
        : null;
    const thisWeekClosed = thisWeekSessions.filter(
      (s) => s.outcome === "closed",
    ).length;
    const thisWeekFollowUp = thisWeekSessions.filter(
      (s) => s.outcome === "follow_up",
    ).length;
    const thisWeekRejected = thisWeekSessions.filter(
      (s) => s.outcome === "rejected",
    ).length;

    // calculate lastWeek
    const lastWeekScores = lastWeekSessions
      .map((s) => s.totalScore)
      .filter((s): s is number => s !== null);
    const lastWeekAvg =
      lastWeekScores.length > 0
        ? Math.round(
            lastWeekScores.reduce((a, b) => a + b, 0) / lastWeekScores.length,
          )
        : null;
    const lastWeekClosed = lastWeekSessions.filter(
      (s) => s.outcome === "closed",
    ).length;

    // calculate delta
    let avgDelta: number | null = null;
    if (thisWeekAvg !== null && lastWeekAvg !== null) {
      avgDelta = thisWeekAvg - lastWeekAvg;
    } else if (thisWeekAvg !== null) {
      avgDelta = thisWeekAvg;
    }

    const sessionsDelta = thisWeekSessions.length - lastWeekSessions.length;

    let trend: "up" | "down" | "stable" = "stable";
    if (avgDelta !== null) {
      if (avgDelta > 0) trend = "up";
      else if (avgDelta < 0) trend = "down";
    }

    res.json({
      data: {
        thisWeek: {
          avgScore: thisWeekAvg,
          totalSessions: thisWeekSessions.length,
          closedCount: thisWeekClosed,
          followUpCount: thisWeekFollowUp,
          rejectedCount: thisWeekRejected,
        },
        lastWeek: {
          avgScore: lastWeekAvg,
          totalSessions: lastWeekSessions.length,
          closedCount: lastWeekClosed,
        },
        delta: {
          avgScore: avgDelta,
          sessions: sessionsDelta,
          trend,
        },
      },
    });
  } catch (e) {
    next(e);
  }
};

// GET /api/me/badges
export const getMyBadges: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const userId = req.user.sub;

    const [earned, allBadges] = await Promise.all([
      prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true },
        orderBy: { unlockedAt: "desc" },
      }),
      prisma.badge.findMany(),
    ]);

    const earnedKeys = new Set(earned.map((e) => e.badge.key));
    const available = allBadges.filter((b) => !earnedKeys.has(b.key));

    res.json({
      data: {
        earned: earned.map((e) => ({
          badge: e.badge,
          unlockedAt: e.unlockedAt.toISOString(),
          metadata: e.metadata,
        })),
        available,
        totalEarned: earned.length,
        totalAvailable: allBadges.length,
      },
    });
  } catch (e) {
    next(e);
  }
};
