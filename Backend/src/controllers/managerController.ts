import type { RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { calculateSAW, getUserSAWScore } from "../services/leaderboardService.js";
import { validateInsightEvidence, type InsightReport } from "../services/insightService.js";
import { parsePage } from "../lib/http-query.js";

async function applyManagerTeamScope(req: Express.Request, userWhere: Prisma.UserWhereInput) {
  if (req.user?.role !== "manager") return;
  const teams = await prisma.teamLeader.findMany({ where: { userId: req.user.sub }, select: { teamId: true } });
  userWhere.teamId = { in: teams.map(team => team.teamId) };
}

// Managers may only read members of teams they lead.
async function assertManagerMemberAccess(userId: string, managerId: string) {
  const member = await prisma.user.findFirst({ where: { id: userId, role: "karyawan" }, select: { teamId: true } });
  if (!member || !member.teamId || !await prisma.teamLeader.findFirst({ where: { userId: managerId, teamId: member.teamId } })) {
    throw new HttpError(404, "Karyawan tidak ditemukan di tim Anda.");
  }
}

type ScoreDropAlert = { userId: string; name: string; latestScore: number; averagePrevious: number; drop: number };
type RepeatedWeakness = { userId: string; name: string; category: string; weakSessions: number };

// Helper for date calculations
function getStartOfWeek() {
  const d = new Date();
  const day = d.getDay(),
    diff = d.getDate() - day + (day == 0 ? -6 : 1); 
  return new Date(d.setDate(diff));
}

// GET /api/manager/dashboard
export const getManagerDashboard: RequestHandler = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = getStartOfWeek();
    startOfWeek.setHours(0,0,0,0);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    if (!req.user) throw new HttpError(401, "Unauthorized");

    const userWhere: Prisma.UserWhereInput = { role: 'karyawan', isActive: true };
    if (req.user.role !== 'super_admin') {
      userWhere.companyId = req.user.companyId;
    }
    await applyManagerTeamScope(req, userWhere);

    const karyawanRows = await prisma.user.findMany({
      where: userWhere,
      select: { id: true }
    });
    const kIds = karyawanRows.map(u => u.id);

    const [todayAssignments, weekSessions, lastWeekSessions, activeSessionsCount, dueDateAlerts] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where: { createdAt: { gte: today }, userId: { in: kIds } }
      }),
      prisma.session.findMany({
        where: { completedAt: { gte: startOfWeek }, userId: { in: kIds } },
        select: { totalScore: true }
      }),
      prisma.session.findMany({
        where: { completedAt: { gte: startOfLastWeek, lt: startOfWeek }, userId: { in: kIds } },
        select: { totalScore: true }
      }),
      prisma.session.count({
        where: { status: 'active', userId: { in: kIds } }
      }),
      prisma.trainingAssignment.findMany({
        where: {
          status: { in: ['pending', 'in_progress'] },
          dueAt: { lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
          userId: { in: kIds }
        },
        include: { assignedTo: { select: { name: true } }, course: { select: { title: true } } },
        take: 10,
        orderBy: { dueAt: 'asc' }
      })
    ]);

    const teamCompletionRate = todayAssignments.length > 0
      ? Math.round((todayAssignments.filter(a => a.status === 'completed').length / todayAssignments.length) * 100)
      : 0;

    const weekScores = weekSessions.map(s => s.totalScore).filter((s): s is number => s !== null);
    const lastWeekScores = lastWeekSessions.map(s => s.totalScore).filter((s): s is number => s !== null);
    
    const teamAvgScoreThisWeek = weekScores.length > 0 ? Math.round(weekScores.reduce((a,b)=>a+b,0)/weekScores.length) : 0;
    const teamAvgScoreLastWeek = lastWeekScores.length > 0 ? Math.round(lastWeekScores.reduce((a,b)=>a+b,0)/lastWeekScores.length) : 0;
    const teamAvgScoreDelta = teamAvgScoreThisWeek - teamAvgScoreLastWeek;

    const rankings = await calculateSAW(kIds, 'monthly');
    const top3Ranking = rankings.slice(0, 3);

    // Score Drop Alerts (drop > 15 poin dari rata2 sesi sebelumnya)
    // Untuk efisiensi, kita bisa ambil karyawan yang aktif minggu ini
    const scoreDropAlerts: ScoreDropAlert[] = [];
    const repeatedWeaknesses: RepeatedWeakness[] = [];
    const activeUsers = await prisma.user.findMany({
      where: userWhere,
      include: {
        sessions: {
          where: { status: 'completed' },
          select: { totalScore: true, completedAt: true, scoreBreakdown: true },
          orderBy: { completedAt: 'desc' },
          take: 5
        }
      }
    });

    for (const u of activeUsers) {
      const categoryScores = new Map<string, number[]>();
      for (const session of u.sessions) {
        let breakdown: Array<{ category: string; score: number }> = [];
        if (Array.isArray(session.scoreBreakdown)) {
          breakdown = session.scoreBreakdown as Array<{ category: string; score: number }>;
        } else if (session.scoreBreakdown && typeof session.scoreBreakdown === 'object') {
          breakdown = Object.entries(session.scoreBreakdown).map(([category, score]) => ({ category, score: Number(score) }));
        }
        for (const { category, score } of breakdown) {
          if (!categoryScores.has(category)) categoryScores.set(category, []);
          categoryScores.get(category)!.push(score);
        }
      }
      for (const [category, scores] of categoryScores) {
        const weakSessions = scores.filter(score => score < 70).length;
        if (weakSessions >= 2) repeatedWeaknesses.push({ userId: u.id, name: u.name, category, weakSessions });
      }

      if (u.sessions.length >= 2) {
        const latest = u.sessions[0].totalScore ?? 0;
        const previousScores = u.sessions.slice(1).map(s => s.totalScore).filter((s): s is number => s !== null);
        if (previousScores.length > 0) {
          const avgPrev = previousScores.reduce((a,b)=>a+b,0) / previousScores.length;
          if (avgPrev - latest > 15) {
            scoreDropAlerts.push({
              userId: u.id,
              name: u.name,
              latestScore: latest,
              averagePrevious: Math.round(avgPrev),
              drop: Math.round(avgPrev - latest)
            });
          }
        }
      }
    }

    const followUpItems = [
      ...scoreDropAlerts.map(alert => ({
        id: `score-${alert.userId}`, type: 'score_drop', name: alert.name,
        detail: `Skor terakhir turun ${alert.drop} poin dari rata-rata sebelumnya (${alert.averagePrevious}).`,
        href: `/manager/team/${alert.userId}`, priority: 0
      })),
      ...dueDateAlerts.map(assignment => ({
        id: `assignment-${assignment.id}`, type: 'assignment', name: assignment.assignedTo.name,
        detail: `${assignment.course.title} - ${assignment.dueAt && assignment.dueAt < new Date() ? 'terlambat' : 'jatuh tempo segera'}.`,
        href: `/manager/team/${assignment.userId}`, priority: assignment.dueAt && assignment.dueAt < new Date() ? 0 : 2
      })),
      ...repeatedWeaknesses.map(item => ({
        id: `weakness-${item.userId}-${item.category}`, type: 'weakness', name: item.name,
        detail: `${item.category.replace(/_/g, ' ')} di bawah 70 pada ${item.weakSessions} sesi terakhir.`,
        href: `/manager/team/${item.userId}`, priority: 1
      }))
    ].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

    res.json({
      data: {
        teamCompletionRate,
        teamAvgScore: {
          current: teamAvgScoreThisWeek,
          delta: teamAvgScoreDelta
        },
        activeSessions: activeSessionsCount,
        dueDateAlerts: dueDateAlerts.map(a => ({
          id: a.id,
          userName: a.assignedTo.name,
          courseTitle: a.course.title,
          dueAt: a.dueAt
        })),
        scoreDropAlerts,
        followUpItems,
        top3Ranking
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/team
export const getTeamList: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Unauthorized");

    const userWhere: Prisma.UserWhereInput = { role: 'karyawan', isActive: true };

    if (req.user.role !== 'super_admin') {
      userWhere.companyId = req.user.companyId;
    }

    await applyManagerTeamScope(req, userWhere);

    const allUsers = await prisma.user.findMany({ where: userWhere, select: { id: true } });
    const rankings = await calculateSAW(allUsers.map(user => user.id), 'monthly', undefined, true);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 100) throw new HttpError(400, "Pencarian maksimal 100 karakter.");
    const matched = search
      ? rankings.filter(user => user.name.toLowerCase().includes(search.toLowerCase()) || user.email.toLowerCase().includes(search.toLowerCase()))
      : rankings;
    const page = parsePage(req.query.page as string | undefined);
    const pageRanks = matched.slice((page - 1) * 50, page * 50);
    const userIds = pageRanks.map(user => user.userId);
    const [users, sessions, assignmentGroups] = userIds.length ? await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, team: { select: { name: true } } } }),
      prisma.session.groupBy({ by: ['userId'], where: { userId: { in: userIds }, status: 'completed' }, _avg: { totalScore: true }, _max: { completedAt: true } }),
      prisma.trainingAssignment.groupBy({ by: ['userId', 'status'], where: { userId: { in: userIds } }, _count: { id: true } })
    ]) : [[], [], []];
    const userMap = new Map(users.map(user => [user.id, user]));
    const sessionMap = new Map(sessions.map(session => [session.userId, session]));
    const team = pageRanks.map(rank => {
      const assignments = assignmentGroups.filter(item => item.userId === rank.userId);
      const totalAssignments = assignments.reduce((sum, item) => sum + item._count.id, 0);
      const completedAssignments = assignments.find(item => item.status === 'completed')?._count.id ?? 0;
      const pendingAssignments = assignments.filter(item => item.status === 'pending' || item.status === 'in_progress').reduce((sum, item) => sum + item._count.id, 0);
      const session = sessionMap.get(rank.userId);
      return {
        id: rank.userId,
        name: rank.name,
        teamName: userMap.get(rank.userId)?.team?.name || '-',
        sawScore: rank.sawScore,
        sawRank: rank.rank,
        avgScore: Math.round(session?._avg.totalScore ?? 0),
        completionRate: totalAssignments ? Math.round(completedAssignments / totalAssignments * 100) : 0,
        pendingAssignments,
        lastActive: session?._max.completedAt ?? null,
        sawBreakdown: rank.sawBreakdown
      };
    });
    res.json({ data: team, meta: { page, total: matched.length, totalPages: Math.ceil(matched.length / 50) } });
  } catch (error) {
    next(error);
  }
};

export const getTeamAssignments: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Unauthorized");
    const userWhere: Prisma.UserWhereInput = { role: "karyawan" };
    if (req.user.role !== "super_admin") userWhere.companyId = req.user.companyId ?? "__no_company__";
    await applyManagerTeamScope(req, userWhere);

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length > 100) throw new HttpError(400, "Pencarian maksimal 100 karakter.");
    const status = (typeof req.query.status === "string" ? req.query.status : "open") as "open" | "pending" | "in_progress";
    if (status !== "open" && status !== "pending" && status !== "in_progress") {
      throw new HttpError(400, "Status assignment tidak valid.");
    }
    const page = parsePage(req.query.page as string | undefined);
    const where: Prisma.TrainingAssignmentWhereInput = {
      assignedTo: userWhere,
      status: status === "open" ? { in: ["pending", "in_progress"] } : status,
      ...(search ? { OR: [
        { assignedTo: { name: { contains: search, mode: "insensitive" } } },
        { assignedTo: { email: { contains: search, mode: "insensitive" } } },
        { assignedTo: { team: { name: { contains: search, mode: "insensitive" } } } },
        { course: { title: { contains: search, mode: "insensitive" } } },
      ] } : {}),
    };
    const [assignments, total] = await Promise.all([
      prisma.trainingAssignment.findMany({
        where,
        select: {
          id: true, status: true, dueAt: true, createdAt: true,
          assignedTo: { select: { id: true, name: true, team: { select: { name: true } } } },
          course: { select: { title: true } },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * 50,
        take: 50,
      }),
      prisma.trainingAssignment.count({ where }),
    ]);
    res.json({
      data: assignments.map(item => ({
        id: item.id,
        userId: item.assignedTo.id,
        userName: item.assignedTo.name,
        teamName: item.assignedTo.team?.name ?? "-",
        courseTitle: item.course.title,
        status: item.status,
        dueAt: item.dueAt,
        createdAt: item.createdAt,
      })),
      meta: { page, total, totalPages: Math.ceil(total / 50) },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/team/:userId
export const getTeamMemberDetail: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const period = (req.query.period as string) || '30days';

    const userWhere: Prisma.UserWhereInput = { id: userId as string, role: 'karyawan' };
    if (req.user?.role !== 'super_admin' && req.user?.companyId) {
      userWhere.companyId = req.user.companyId;
    }

    const user = await prisma.user.findFirst({
      where: userWhere,
      select: { id: true, name: true, email: true, createdAt: true, companyId: true }
    });
    if (!user) throw new HttpError(404, "Karyawan tidak ditemukan atau di luar perusahaan Anda.");
    if (req.user?.role === "manager") await assertManagerMemberAccess(userId as string, req.user.sub);

    const now = new Date();
    let dateLimit: Date | null = null;
    if (period === '7days') dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30days') dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === '90days') dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const sessions = await prisma.session.findMany({
      where: { userId: userId as string, status: 'completed', ...(dateLimit ? { completedAt: { gte: dateLimit } } : {}) },
      select: { id: true, totalScore: true, outcome: true, completedAt: true, course: { select: { title: true } } },
      orderBy: { completedAt: 'desc' },
      take: 100
    });

    const sawDetail = await getUserSAWScore(userId as string, 'monthly');
    const compUsersWhere: Prisma.UserWhereInput = { role: 'karyawan', isActive: true };
    if (req.user?.role !== 'super_admin' && req.user?.companyId) {
      compUsersWhere.companyId = req.user.companyId;
    }
    await applyManagerTeamScope(req, compUsersWhere);
    const allUsers = await prisma.user.findMany({ where: compUsersWhere, select: { id: true } });
    const rankings = await calculateSAW(allUsers.map(u => u.id), 'monthly');
    const rank = rankings.find(r => r.userId === userId)?.rank ?? null;

    const recentSessions = sessions.slice(0, 5).map(s => ({
      id: s.id,
      courseTitle: s.course.title,
      score: s.totalScore,
      outcome: s.outcome,
      completedAt: s.completedAt
    }));

    const trend30Days = sessions
      .filter(s => s.completedAt && (!dateLimit || s.completedAt >= dateLimit))
      .map(s => ({
        sessionId: s.id,
        score: s.totalScore,
        completedAt: s.completedAt
      }))
      .reverse();

    res.json({
      data: {
        profile: user,
        sawDetail: sawDetail ? { ...sawDetail, rank } : null,
        trend30Days,
        recentSessions
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/sessions
export const getAllTeamSessions: RequestHandler = async (req, res, next) => {
  try {
    const period = req.query.period as string || "30days";
    let dateLimit = new Date();
    if (period === "7days") dateLimit.setDate(dateLimit.getDate() - 7);
    else if (period === "30days") dateLimit.setDate(dateLimit.getDate() - 30);
    else dateLimit = new Date(0); // alltime

    const userWhere: Prisma.UserWhereInput = { role: 'karyawan' };
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere.companyId = req.user.companyId;
    }
    await applyManagerTeamScope(req, userWhere);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 100) throw new HttpError(400, "Pencarian maksimal 100 karakter.");
    const outcome = typeof req.query.outcome === 'string' ? req.query.outcome : '';
    if (outcome && !['closed', 'follow_up', 'rejected'].includes(outcome)) throw new HttpError(400, "Hasil sesi tidak valid.");
    const minScore = req.query.minScore === undefined ? undefined : Number(req.query.minScore);
    const maxScore = req.query.maxScore === undefined ? undefined : Number(req.query.maxScore);
    if ([minScore, maxScore].some(score => score !== undefined && (!Number.isFinite(score) || score < 0 || score > 100)) || (minScore !== undefined && maxScore !== undefined && minScore > maxScore)) {
      throw new HttpError(400, "Rentang skor harus antara 0 dan 100.");
    }
    const page = parsePage(req.query.page as string | undefined);
    const where: Prisma.SessionWhereInput = {
      completedAt: { gte: dateLimit },
      user: userWhere,
      ...(outcome ? { outcome } : {}),
      ...(minScore !== undefined || maxScore !== undefined ? { totalScore: { ...(minScore !== undefined ? { gte: minScore } : {}), ...(maxScore !== undefined ? { lte: maxScore } : {}) } } : {}),
      ...(search ? { OR: [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { course: { title: { contains: search, mode: 'insensitive' } } }
      ] } : {})
    };
    const [sessions, total] = await Promise.all([prisma.session.findMany({
      where,
      include: { 
        course: { select: { title: true } },
        user: { select: { name: true } }
      },
      orderBy: { completedAt: 'desc' },
      skip: (page - 1) * 50,
      take: 50
    }), prisma.session.count({ where })]);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        course: { title: s.course.title },
        userName: s.user.name,
        totalScore: s.totalScore,
        outcome: s.outcome,
        turnCount: s.turnCount,
        status: s.status,
        completedAt: s.completedAt
      })),
      meta: { page, total, totalPages: Math.ceil(total / 50) }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/team/:userId/sessions
export const getTeamMemberSessions: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const courseId = req.query.courseId as string | undefined;
    const outcome = req.query.outcome as string | undefined;

    const userWhere: any = { id: userId as string, role: 'karyawan' };
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere.companyId = req.user.companyId;
    }
    const member = await prisma.user.findFirst({ where: userWhere, select: { id: true } });
    if (!member) throw new HttpError(404, "Karyawan tidak ditemukan atau di luar perusahaan Anda.");
    if (req.user?.role === "manager") await assertManagerMemberAccess(userId as string, req.user.sub);

    const page = parsePage(req.query.page as string | undefined);
    const where = {
      userId: userId as string,
      ...(courseId ? { courseId: courseId as string } : {}),
      ...(outcome ? { outcome: outcome as string } : {})
    };
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({ where, select: { id: true, totalScore: true, outcome: true, turnCount: true, status: true, completedAt: true, course: { select: { title: true } } }, orderBy: { completedAt: 'desc' }, skip: (page - 1) * 50, take: 50 }),
      prisma.session.count({ where })
    ]);

    res.json({
      data: sessions.map(s => ({
        id: s.id,
        courseTitle: s.course.title,
        score: s.totalScore,
        outcome: s.outcome,
        turnCount: s.turnCount,
        status: s.status,
        completedAt: s.completedAt
      })),
      meta: { page, total, totalPages: Math.ceil(total / 50) }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/team/:userId/assignments
export const getTeamMemberAssignments: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const userWhere: any = { id: userId as string, role: 'karyawan' };
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere.companyId = req.user.companyId;
    }
    const member = await prisma.user.findFirst({ where: userWhere, select: { id: true } });
    if (!member) throw new HttpError(404, "Karyawan tidak ditemukan atau di luar perusahaan Anda.");
    if (req.user?.role === "manager") await assertManagerMemberAccess(userId as string, req.user.sub);

    const page = parsePage(req.query.page as string | undefined);
    const where = { userId: userId as string };
    const [assignments, total] = await Promise.all([
      prisma.trainingAssignment.findMany({ where, select: { id: true, status: true, dueAt: true, completedAt: true, createdAt: true, course: { select: { title: true } } }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50 }),
      prisma.trainingAssignment.count({ where })
    ]);

    res.json({
      data: assignments.map(a => ({
        id: a.id,
        courseTitle: a.course.title,
        status: a.status,
        dueAt: a.dueAt,
        completedAt: a.completedAt
      })),
      meta: { page, total, totalPages: Math.ceil(total / 50) }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/sessions/:sessionId
export const getSessionDetail: RequestHandler = async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.sessionId as string },
      include: {
        course: { select: { title: true } },
        user: { select: { id: true, name: true, companyId: true, teamId: true } },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!session) throw new HttpError(404, "Sesi tidak ditemukan");

    if (req.user?.role !== 'super_admin' && session.user.companyId !== req.user?.companyId) {
      throw new HttpError(403, "Tidak memiliki akses ke sesi ini.");
    }
    if (req.user?.role === "manager") await assertManagerMemberAccess(session.user.id, req.user.sub);

    res.json({
      data: {
        id: session.id,
        userName: session.user.name,
        courseTitle: session.course.title,
        status: session.status,
        totalScore: session.totalScore,
        scoreBreakdown: session.scoreBreakdown,
        feedbackReport: validateInsightEvidence(session.feedbackReport as InsightReport, session.messages),
        facialSummary: session.facialSummary,
        outcome: session.outcome,
        trustLevel: session.trustLevel,
        customerStage: session.customerStage,
        completedAt: session.completedAt,
        messages: session.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          turnScore: m.turnScore,
          coachingHint: m.coachingHint,
          facialData: m.facialData,
          trustDelta: m.trustDelta,
          createdAt: m.createdAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/analytics/overview
export const getAnalyticsOverview: RequestHandler = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    let userWhere: Prisma.UserWhereInput = {};
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere = { companyId: req.user.companyId };
    }
    await applyManagerTeamScope(req, userWhere);

    const [currentSessions, prevSessions, currentAssignments, prevAssignments] = await Promise.all([
      prisma.session.findMany({ where: { completedAt: { gte: thirtyDaysAgo }, user: userWhere } }),
      prisma.session.findMany({ where: { completedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, user: userWhere } }),
      prisma.trainingAssignment.findMany({ where: { createdAt: { gte: thirtyDaysAgo }, assignedTo: userWhere } }),
      prisma.trainingAssignment.findMany({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, assignedTo: userWhere } })
    ]);

    const calcAvg = (sessions: Array<{ totalScore: number | null }>) => {
      const scores = sessions.map(s => s.totalScore).filter(s => s !== null);
      return scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
    };
    const calcOutcomeRate = (sessions: Array<{ outcome: string | null }>) => {
      if (!sessions.length) return 0;
      return Math.round((sessions.filter(s => s.outcome === 'closed').length / sessions.length) * 100);
    };
    const calcCompRate = (assignments: Array<{ status: string }>) => {
      if (!assignments.length) return 0;
      return Math.round((assignments.filter(a => a.status === 'completed').length / assignments.length) * 100);
    };

    const currentStats = {
      avgScore: calcAvg(currentSessions),
      outcomeRate: calcOutcomeRate(currentSessions),
      completionRate: calcCompRate(currentAssignments)
    };
    const prevStats = {
      avgScore: calcAvg(prevSessions),
      outcomeRate: calcOutcomeRate(prevSessions),
      completionRate: calcCompRate(prevAssignments)
    };

    // sessionsPerDay[] chart data
    const sessionsPerDayMap = new Map<string, number>();
    for (const s of currentSessions) {
      if (!s.completedAt) continue;
      const day = s.completedAt.toISOString().slice(0, 10);
      sessionsPerDayMap.set(day, (sessionsPerDayMap.get(day) ?? 0) + 1);
    }
    const sessionsPerDay = Array.from(sessionsPerDayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a,b) => a.date.localeCompare(b.date));

    res.json({
      data: {
        overview: currentStats,
        comparison: prevStats,
        sessionsPerDay
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/analytics/courses
export const getAnalyticsCourses: RequestHandler = async (req, res, next) => {
  try {
    const userWhere: any = {};
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere.companyId = req.user.companyId;
    }

    await applyManagerTeamScope(req, userWhere);

    const companyScope = req.user && req.user.role !== 'super_admin' && req.user.companyId
      ? { OR: [{ companyId: null }, { companyId: req.user.companyId }] }
      : {};

    const courses = await prisma.course.findMany({
      where: companyScope,
      include: {
        sessions: { where: { user: userWhere }, select: { status: true, totalScore: true, outcome: true } },
        assignments: { where: { assignedTo: userWhere }, select: { status: true } }
      }
    });

    const courseStats = courses.map(c => {
      const completedSessions = c.sessions.filter(s => s.status === 'completed');
      const scores = completedSessions.map(s => s.totalScore).filter((s): s is number => s !== null);
      const avgScore = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
      
      const closed = completedSessions.filter(s => s.outcome === 'closed').length;
      const outcomeRate = completedSessions.length ? Math.round((closed / completedSessions.length) * 100) : 0;

      const abandoned = c.sessions.filter(s => s.status === 'abandoned').length;
      const abandonRate = c.sessions.length ? Math.round((abandoned / c.sessions.length) * 100) : 0;

      const completedAssignments = c.assignments.filter(a => a.status === 'completed').length;
      const completionRate = c.assignments.length ? Math.round((completedAssignments / c.assignments.length) * 100) : 0;

      return {
        id: c.id,
        title: c.title,
        avgScore,
        outcomeRate,
        abandonRate,
        completionRate,
        totalSessions: c.sessions.length
      };
    });

    const hardestCourse = [...courseStats].sort((a,b) => a.avgScore - b.avgScore)[0] ?? null;
    const mostAbandoned = [...courseStats].sort((a,b) => b.abandonRate - a.abandonRate)[0] ?? null;

    res.json({
      data: {
        courses: courseStats.sort((a,b) => b.totalSessions - a.totalSessions),
        hardestCourse,
        mostAbandoned
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/analytics/trends?period=monthly
export const getAnalyticsTrends: RequestHandler = async (req, res, next) => {
  try {
    const period = (req.query.period as string) || '30days';
    const now = new Date();
    let dateLimit: Date | null = null;
    if (period === '7days') dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30days') dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === '90days') dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    let userWhere: Prisma.UserWhereInput = {};
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere = { companyId: req.user.companyId };
    }

    await applyManagerTeamScope(req, userWhere);

    const sessions = await prisma.session.findMany({
      where: {
        status: 'completed',
        ...(dateLimit ? { completedAt: { gte: dateLimit } } : {}),
        user: userWhere
      },
      select: { totalScore: true, outcome: true, completedAt: true, userId: true, scoreBreakdown: true }
    });

    // Group by week (simply dividing by 7 days blocks from today or calendar week)
    // For simplicity, we just return daily active users and weekly averages
    const weekMap = new Map<string, { scores: number[], closed: number, total: number }>();
    const dauMap = new Map<string, Set<string>>();
    const categoryWeeks = new Map<string, Map<string, number[]>>();

    for (const s of sessions) {
      if (!s.completedAt) continue;
      const day = s.completedAt.toISOString().slice(0, 10);
      
      if (!dauMap.has(day)) dauMap.set(day, new Set());
      dauMap.get(day)!.add(s.userId);

      // We'll use start of week as key
      const d = new Date(s.completedAt.getTime());
      const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1);
      d.setDate(diff);
      const weekStart = d.toISOString().slice(0, 10);

      if (!weekMap.has(weekStart)) weekMap.set(weekStart, { scores: [], closed: 0, total: 0 });
      const w = weekMap.get(weekStart)!;
      if (s.totalScore !== null) w.scores.push(s.totalScore);
      if (s.outcome === 'closed') w.closed++;
      w.total++;

      let breakdown: Array<{ category: string; score: number }> = [];
      if (Array.isArray(s.scoreBreakdown)) {
        breakdown = s.scoreBreakdown as Array<{ category: string; score: number }>;
      } else if (s.scoreBreakdown && typeof s.scoreBreakdown === 'object') {
        breakdown = Object.entries(s.scoreBreakdown).map(([category, score]) => ({ category, score: Number(score) }));
      }
      for (const { category, score } of breakdown) {
        if (!categoryWeeks.has(category)) categoryWeeks.set(category, new Map());
        const weeks = categoryWeeks.get(category)!;
        if (!weeks.has(weekStart)) weeks.set(weekStart, []);
        weeks.get(weekStart)!.push(score);
      }
    }

    const weeklyTrends = Array.from(weekMap.entries()).map(([week, data]) => ({
      week,
      avgScore: data.scores.length ? Math.round(data.scores.reduce((a,b)=>a+b,0)/data.scores.length) : 0,
      outcomeRate: data.total ? Math.round((data.closed / data.total) * 100) : 0
    })).sort((a,b) => a.week.localeCompare(b.week));

    const activeUsersPerDay = Array.from(dauMap.entries()).map(([date, users]) => ({
      date,
      activeUsers: users.size
    })).sort((a,b) => a.date.localeCompare(b.date));

    const categoryTrends = Array.from(categoryWeeks.entries()).map(([category, weeks]) => ({
      category,
      weeks: Array.from(weeks.entries()).map(([week, scores]) => ({
        week,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      })).sort((a, b) => a.week.localeCompare(b.week))
    }));

    res.json({
      data: {
        weeklyTrends,
        activeUsersPerDay,
        categoryTrends
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/analytics/weaknesses
export const getAnalyticsWeaknesses: RequestHandler = async (req, res, next) => {
  try {
    let userWhere: Prisma.UserWhereInput = {};
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere = { companyId: req.user.companyId };
    }

    await applyManagerTeamScope(req, userWhere);

    const sessions = await prisma.session.findMany({
      where: { status: 'completed', user: userWhere },
      select: { scoreBreakdown: true, userId: true }
    });

    const categoryScores = new Map<string, { scores: number[], userScores: Map<string, number[]> }>();

    for (const s of sessions) {
      if (!s.scoreBreakdown) continue;
      
      let breakdown: Array<{ category: string; score: number }> = [];
      if (Array.isArray(s.scoreBreakdown)) {
        breakdown = s.scoreBreakdown as Array<{ category: string; score: number }>;
      } else if (typeof s.scoreBreakdown === 'object') {
        breakdown = Object.entries(s.scoreBreakdown).map(([category, score]) => ({
          category,
          score: Number(score)
        }));
      } else {
        continue;
      }

      for (const cat of breakdown) {
        if (!categoryScores.has(cat.category)) {
          categoryScores.set(cat.category, { scores: [], userScores: new Map() });
        }
        const c = categoryScores.get(cat.category)!;
        c.scores.push(cat.score);
        
        if (!c.userScores.has(s.userId)) c.userScores.set(s.userId, []);
        c.userScores.get(s.userId)!.push(cat.score);
      }
    }

    const totalUsers = await prisma.user.count({ 
      where: { 
        role: 'karyawan', 
        isActive: true,
        ...userWhere
      } 
    });

    const weaknesses = Array.from(categoryScores.entries()).map(([category, data]) => {
      const avgScore = data.scores.length ? Math.round(data.scores.reduce((a,b)=>a+b,0)/data.scores.length) : 0;
      
      // Hitung % karyawan lemah (< 70 rata-rata di kategori ini)
      let weakUsersCount = 0;
      for (const [, scores] of data.userScores) {
        const uAvg = scores.reduce((a,b)=>a+b,0)/scores.length;
        if (uAvg < 70) weakUsersCount++;
      }
      const weakPercentage = totalUsers ? Math.round((weakUsersCount / totalUsers) * 100) : 0;

      return {
        category,
        avgScore,
        weakPercentage
      };
    }).sort((a,b) => a.avgScore - b.avgScore); // Tampilkan yang terlemah dulu

    const topWeakness = weaknesses[0];
    let recommendedCourses: any[] = [];
    const companyScope = req.user && req.user.role !== 'super_admin' && req.user.companyId
      ? { OR: [{ companyId: null }, { companyId: req.user.companyId }] }
      : {};

    if (topWeakness) {
      // Cari course dengan kategori terkait atau judul yang mengandung area kelemahan
      recommendedCourses = await prisma.course.findMany({
        where: {
          isActive: true,
          AND: [
            companyScope,
            {
              OR: [
                { category: topWeakness.category },
                { title: { contains: topWeakness.category, mode: 'insensitive' as const } },
                { description: { contains: topWeakness.category, mode: 'insensitive' as const } },
              ],
            },
          ],
        },
        select: { id: true, title: true, difficulty: true, category: true },
        take: 3,
      });
    }

    if (recommendedCourses.length === 0) {
      // Fallback: recommended active courses so training list is never empty
      recommendedCourses = await prisma.course.findMany({
        where: { isActive: true, ...companyScope },
        select: { id: true, title: true, difficulty: true, category: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
    }

    res.json({
      data: {
        weaknesses,
        recommendedCourses
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/manager/team/export
export const exportTeamList: RequestHandler = async (req, res, next) => {
  try {
    const userWhere: Prisma.UserWhereInput = { role: 'karyawan', isActive: true };
    if (req.user && req.user.role !== 'super_admin' && req.user.companyId) {
      userWhere.companyId = req.user.companyId;
    }
    await applyManagerTeamScope(req, userWhere);

    const users = await prisma.user.findMany({
      where: userWhere,
      include: {
        sessions: { where: { status: 'completed' }, select: { totalScore: true, completedAt: true }, orderBy: { completedAt: 'desc' } },
        trainingAssignments: { select: { status: true } }
      }
    });

    const rankings = await calculateSAW(users.map(u => u.id), 'monthly');

    let csv = "ID,Name,SAW Score,SAW Rank,Average Score,Completion Rate,Last Active\n";

    for (const u of users) {
      const scores = u.sessions.map(s => s.totalScore).filter((s): s is number => s !== null);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
      const totalAssignments = u.trainingAssignments.length;
      const completedAssignments = u.trainingAssignments.filter(a => a.status === 'completed').length;
      const completionRate = totalAssignments > 0 ? Math.round((completedAssignments/totalAssignments)*100) : 0;
      
      const rankData = rankings.find(r => r.userId === u.id);
      const lastActiveStr = u.sessions[0]?.completedAt ? u.sessions[0].completedAt.toISOString() : '';

      csv += `"${u.id}","${u.name}",${rankData?.sawScore ?? 0},${rankData?.rank ?? ''},${avgScore},${completionRate},"${lastActiveStr}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=team-performance-export.csv');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};
