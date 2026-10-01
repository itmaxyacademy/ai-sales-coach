import { Router } from "express";
import { requireSuperAdmin } from "../middleware/auth.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { parsePage } from "../lib/http-query.js";
import { logAudit } from "../lib/audit.js";
import { calculateSAW } from "../services/leaderboardService.js";
import { broadcastNotification } from "../services/notificationService.js";
import { getSystemInfo, getTokenUsage, getTokenUsageCost, exportTokenUsage, exportSessions, getAuditLogs, buildAdminSessionWhere } from "../controllers/adminController.js";
import {
  listAiKeys,
  createAiKey,
  updateAiKey,
  deleteAiKey,
  testAiKey,
} from "../controllers/aiKeyController.js";

export const adminRouter = Router();

// Helper
function calcAvg(scores: number[]) {
  return scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
}

type ReadinessStatus = "ok" | "warning" | "error";

function buildReadinessItem(
  key: string,
  label: string,
  status: ReadinessStatus,
  detail: string,
) {
  return { key, label, status, detail };
}

async function checkTtsService() {
  const ttsUrl = process.env.TTS_PYTHON_URL || "http://127.0.0.1:5001";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(`${ttsUrl}/health`, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── DASHBOARD & STATS ────────────────────────────────────

adminRouter.get("/dashboard", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);

    const period = (req.query.period as string) || '30days';
    const now = new Date();
    let dateLimit: Date | null = null;
    if (period === '7days') dateLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30days') dateLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === '90days') dateLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    if (!req.user) throw new HttpError(401, "Unauthorized");
    const companyId = req.user.role === 'super_admin' ? undefined : req.user.companyId;
    const scopeUsers = companyId
      ? await prisma.user.findMany({ where: { companyId }, select: { id: true } })
      : [];
    const userIds = scopeUsers.map(user => user.id);
    const isSuper = req.user.role === 'super_admin';
    const sessionScope: any = isSuper ? {} : { userId: { in: userIds } };
    const userScope: any = isSuper ? {} : { id: { in: userIds } };
    const [totalUsers, totalSessionsToday, totalSessionsPeriod, activeUsersPeriod, trendSessions, totalCourses, stuckSessions, assignments, aggregatedUsage] = await Promise.all([
      prisma.user.count({ where: userScope }),
      prisma.session.count({ where: { ...sessionScope, startedAt: { gte: today } } }),
      prisma.session.count({ where: { ...sessionScope, ...(dateLimit ? { startedAt: { gte: dateLimit } } : {}) } }),
      prisma.session.findMany({ where: { ...sessionScope, user: { role: 'karyawan' }, ...(dateLimit ? { startedAt: { gte: dateLimit } } : {}) }, distinct: ['userId'], select: { userId: true } }),
      prisma.session.findMany({
        where: {
          ...sessionScope,
          status: 'completed',
          totalScore: { not: null },
          ...(dateLimit ? { completedAt: { gte: dateLimit } } : {})
        },
        select: { totalScore: true, completedAt: true },
        orderBy: { completedAt: 'asc' }
      }),
      prisma.course.count({ where: { isActive: true, ...(isSuper ? {} : { companyId: companyId ?? "__no_company__" }) } }),
      prisma.session.count({ where: { ...sessionScope, status: 'active', startedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } } }),
      prisma.trainingAssignment.findMany({ where: { ...(isSuper ? {} : { userId: { in: userIds } }), ...(dateLimit ? { createdAt: { gte: dateLimit } } : {}) }, select: { status: true } }),
      prisma.aiUsageLog.groupBy({
        by: ['model'],
        where: {
          ...(dateLimit ? { createdAt: { gte: dateLimit } } : {}),
          ...(isSuper ? {} : { userId: { in: userIds } }),
        },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
        }
      })
    ]);

    // Calculate dynamic global avg score based on selected period
    const avgScoreGlobal = calcAvg(trendSessions.map(s => s.totalScore as number));

    // Group global trend by date
    const trendMap = new Map<string, { total: number, count: number }>();
    for (const s of trendSessions) {
      if (!s.completedAt) continue;
      const dateStr = s.completedAt.toISOString().slice(0, 10);
      const existing = trendMap.get(dateStr) || { total: 0, count: 0 };
      trendMap.set(dateStr, {
        total: existing.total + (s.totalScore || 0),
        count: existing.count + 1
      });
    }

    const globalScoreTrend = Array.from(trendMap.entries()).map(([date, item]) => ({
      date,
      avgScore: Math.round(item.total / item.count)
    }));
    const completedAssignments = assignments.filter(a => a.status === 'completed').length;

    // Calculate actual cost from aggregated usage logs
    let estimatedAiCost = 0;
    let totalAiTokens = 0;
    for (const item of aggregatedUsage) {
      const model = item.model;
      const prompt = item._sum.promptTokens || 0;
      const completion = item._sum.completionTokens || 0;
      totalAiTokens += item._sum.totalTokens || 0;

      let cost = 0;
      if (model === "gpt-oss-120b") {
        cost = (prompt * 0.35) / 1000000 + (completion * 0.75) / 1000000;
      } else if (model === "zai-glm-4.7") {
        cost = (prompt * 2.25) / 1000000 + (completion * 2.75) / 1000000;
      } else if (model === "llama3.1-8b") {
        cost = (prompt * 0.10) / 1000000 + (completion * 0.10) / 1000000;
      } else if (model === "llama3.3-70b") {
        cost = (prompt * 0.85) / 1000000 + (completion * 1.20) / 1000000;
      } else {
        cost = (prompt * 0.35) / 1000000 + (completion * 0.75) / 1000000;
      }
      estimatedAiCost += cost;
    }

    res.json({
      data: {
        totalUsers,
        totalSessionsToday,
        totalSessionsPeriod,
        activeUsersPeriod: activeUsersPeriod.length,
        assignmentsAssigned: assignments.length,
        assignmentsCompleted: completedAssignments,
        assignmentCompletionRate: assignments.length ? Math.round(completedAssignments / assignments.length * 100) : null,
        avgScoreGlobal,
        globalScoreTrend,
        totalCourses,
        estimatedAiCost: Number(estimatedAiCost.toFixed(6)),
        totalAiTokens,
        alerts: { stuckSessions }
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/companies", async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany({
      select: { id: true, name: true, maxSeats: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: companies });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/readiness", async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeKaryawan,
      totalManagers,
      totalAdmins,
      activeCourses,
      completedSessions,
      activeAiKeys,
      ttsOnline,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: "karyawan", isActive: true } }),
      prisma.user.count({ where: { role: "manager", isActive: true } }),
      prisma.user.count({ where: { role: "company_admin", isActive: true } }),
      prisma.course.count({ where: { isActive: true } }),
      prisma.session.count({ where: { status: "completed" } }),
      prisma.aiApiKey.count({ where: { isActive: true } }),
      checkTtsService(),
    ]);

    const aiReady = Boolean(process.env.OPENAI_API_KEY || activeAiKeys > 0);

    const items = [
      buildReadinessItem("database", "Database Supabase", "ok", "Prisma berhasil membaca data platform."),
      buildReadinessItem(
        "courses",
        "Materi roleplay",
        activeCourses > 0 ? "ok" : "error",
        activeCourses > 0 ? `${activeCourses} course aktif tersedia.` : "Belum ada course aktif untuk demo.",
      ),
      buildReadinessItem(
        "employees",
        "Akun karyawan",
        activeKaryawan > 0 ? "ok" : "error",
        activeKaryawan > 0 ? `${activeKaryawan} akun karyawan aktif.` : "Belum ada akun karyawan aktif.",
      ),
      buildReadinessItem(
        "sessions",
        "Data evaluasi",
        completedSessions > 0 ? "ok" : "warning",
        completedSessions > 0 ? `${completedSessions} sesi selesai bisa ditampilkan.` : "Belum ada hasil sesi nyata.",
      ),
      buildReadinessItem(
        "ai",
        "AI roleplay",
        aiReady ? "ok" : "warning",
        aiReady ? "Provider AI sudah dikonfigurasi." : "API key AI belum aktif, roleplay bisa terbatas.",
      ),
      buildReadinessItem(
        "tts",
        "Voice service",
        ttsOnline ? "ok" : "warning",
        ttsOnline ? "BackendTTS online dan siap dipakai." : "BackendTTS belum terdeteksi di port 5001.",
      ),
    ];

    const hasError = items.some((item) => item.status === "error");
    const hasWarning = items.some((item) => item.status === "warning");
    const overallStatus = hasError ? "blocked" : hasWarning ? "partial" : "ready";

    res.json({
      data: {
        checkedAt: new Date().toISOString(),
        overallStatus,
        items,
        metrics: {
          totalUsers,
          activeKaryawan,
          totalManagers,
          totalAdmins,
          activeCourses,
          completedSessions,
          activeAiKeys,
          ttsOnline,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/stats", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0,0,0,0);
    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [totalSessions, allScores, dau, mau] = await Promise.all([
      prisma.session.count(),
      prisma.session.findMany({ where: { status: 'completed' }, select: { totalScore: true } }),
      prisma.session.groupBy({ by: ['userId'], where: { startedAt: { gte: today } } }).then(res => res.length),
      prisma.session.groupBy({ by: ['userId'], where: { startedAt: { gte: firstDayMonth } } }).then(res => res.length)
    ]);

    res.json({
      data: {
        dau,
        mau,
        totalSessions,
        avgScoreGlobal: calcAvg(allScores.map(s => s.totalScore as number)),
        growthRate: 12.5 // Mocked
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── USERS ────────────────────────────────────────────────

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["karyawan", "manager", "company_admin", "super_admin"]),
  password: z.string().min(6).optional(),
  companyId: z.string().optional(),
  isActive: z.boolean().optional()
});

adminRouter.get("/users/tree", async (req, res, next) => {
  try {
    const isSuper = req.user?.role === 'super_admin';
    const whereTree: any = {};
    if (!isSuper && req.user?.companyId) {
      whereTree.companyId = req.user.companyId;
    }

    const users = await prisma.user.findMany({
      where: whereTree,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        companyId: true,
        teamId: true,
        company: { select: { name: true } },
        team: { select: { name: true } },
        ledTeams: { select: { team: { select: { id: true, name: true } } } }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    const companiesMap = new Map();
    const superAdmins: any[] = [];
    
    users.forEach(u => {
      if (u.role === 'super_admin') {
        if (isSuper) superAdmins.push(u);
        return;
      }
      if (!u.companyId) return;
      
      if (!companiesMap.has(u.companyId)) {
        companiesMap.set(u.companyId, {
          companyId: u.companyId,
          companyName: u.company?.name || `Unknown Company`,
          admins: [],
          managers: [],
          teams: new Map(),
          unassignedKaryawans: []
        });
      }
      
      const comp = companiesMap.get(u.companyId);
      
      if (u.role === 'company_admin') {
        comp.admins.push(u);
      } else if (u.role === 'manager') {
        const leadingTeams = u.ledTeams.map((lt: any) => ({
          teamId: lt.team?.id,
          teamName: lt.team?.name
        }));
        comp.managers.push({ ...u, leadingTeams });
      } else if (u.role === 'karyawan') {
        if (u.teamId) {
          if (!comp.teams.has(u.teamId)) {
            comp.teams.set(u.teamId, {
              teamId: u.teamId,
              teamName: u.team?.name || `Unknown Team`,
              karyawans: []
            });
          }
          comp.teams.get(u.teamId).karyawans.push(u);
        } else {
          comp.unassignedKaryawans.push(u);
        }
      }
    });

    const companiesTree = Array.from(companiesMap.values()).map(comp => {
      const structuredManagers = comp.managers.map((m: any) => {
        const mTeams = m.leadingTeams.map((lt: any) => {
          const t = comp.teams.get(lt.teamId);
          if (t) comp.teams.delete(lt.teamId);
          return t || { teamId: lt.teamId, teamName: lt.teamName, karyawans: [] };
        });
        return { ...m, teams: mTeams };
      });
      
      const unassignedTeams = Array.from(comp.teams.values());

      return {
        companyId: comp.companyId,
        companyName: comp.companyName,
        admins: comp.admins,
        managers: structuredManagers,
        unmanagedTeams: unassignedTeams,
        unassignedKaryawans: comp.unassignedKaryawans
      };
    });

    res.json({
      superAdmins: isSuper ? superAdmins : [],
      companies: companiesTree
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users", async (req, res, next) => {
  try {
    const role = req.query.role as string;
    const search = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      ...(role ? { role: role as any } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    if (req.user?.role !== 'super_admin' && req.user?.companyId) {
      whereClause.companyId = req.user.companyId;
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          teamId: true,
          team: { select: { id: true, name: true } },
          ledTeams: { select: { team: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    res.json({
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const payload = userSchema.parse(req.body);
    if (!payload.password) throw new HttpError(400, "Password dibutuhkan");

    const isSuper = req.user?.role === "super_admin";
    if (!isSuper && payload.role === "super_admin") {
      throw new HttpError(403, "Hanya super admin yang dapat membuat super admin.");
    }

    const effectiveCompanyId = isSuper ? payload.companyId : req.user?.companyId;

    if (payload.role === "company_admin") {
      if (!effectiveCompanyId) throw new HttpError(400, "companyId dibutuhkan untuk membuat company_admin");
      const existingAdmin = await prisma.user.findFirst({
        where: { companyId: effectiveCompanyId, role: "company_admin", isActive: true }
      });
      if (existingAdmin) throw new HttpError(400, "Perusahaan ini sudah memiliki Company Admin. Hanya diperbolehkan satu Company Admin.");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash,
        role: payload.role as any,
        companyId: effectiveCompanyId,
        isActive: payload.isActive ?? true
      },
      select: { id: true, name: true, email: true, role: true }
    });

    logAudit({
      actorId: req.user!.sub,
      actorRole: req.user!.role,
      action: "user.create",
      targetType: "user",
      targetId: user.id,
      metadata: { role: user.role },
      ipAddress: req.ip,
    });

    res.status(201).json({ data: user });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/users/:id", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
    });
    if (!user) throw new HttpError(404, "User tidak ditemukan");

    let sawRank = null;
    if (user.role === 'karyawan') {
      const allKaryawan = await prisma.user.findMany({ where: { role: 'karyawan', isActive: true }, select: { id: true } });
      const rankings = await calculateSAW(allKaryawan.map(u => u.id), 'alltime');
      sawRank = rankings.find(r => r.userId === user.id) ?? null;
    }

    res.json({
      data: {
        profile: user,
        sawGlobalRank: sawRank
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const payload = userSchema.partial().parse(req.body);
    
    if (targetId === req.user?.sub && payload.role) {
      const currentUser = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
      if (currentUser?.role !== payload.role) throw new HttpError(403, "Tidak diperbolehkan mengubah role diri sendiri.");
    }

    if (payload.role === "company_admin") {
      const targetUser = await prisma.user.findUnique({ where: { id: targetId }, select: { companyId: true, role: true } });
      const compId = payload.companyId || targetUser?.companyId;
      if (compId && targetUser?.role !== "company_admin") {
        const existingAdmin = await prisma.user.findFirst({
          where: { companyId: compId, role: "company_admin", isActive: true }
        });
        if (existingAdmin) throw new HttpError(400, "Perusahaan ini sudah memiliki Company Admin. Hanya diperbolehkan satu Company Admin.");
      }
    }

    const user = await prisma.user.update({
      where: { id: targetId },
      data: {
        name: payload.name,
        email: payload.email,
        role: payload.role as any,
        companyId: payload.companyId,
        isActive: payload.isActive
      },
      select: { id: true, name: true, email: true, role: true, isActive: true }
    });

    logAudit({
      actorId: req.user!.sub,
      actorRole: req.user!.role,
      action: "user.update",
      targetType: "user",
      targetId: user.id,
      metadata: payload,
      ipAddress: req.ip,
    });

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete("/users/:id", async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user?.sub) throw new HttpError(403, "Tidak diperbolehkan menghapus akun sendiri.");
    
    const user = await prisma.user.update({
      where: { id: targetId },
      data: { isActive: false },
      select: { id: true, isActive: true }
    });

    logAudit({
      actorId: req.user!.sub,
      actorRole: req.user!.role,
      action: "user.delete",
      targetType: "user",
      targetId: user.id,
      ipAddress: req.ip,
    });

    res.json({ data: user, message: "User di-soft delete" });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    const tempPass = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPass, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash }
    });
    res.json({ data: { tempPassword: tempPass }, message: "Berhasil generate password sementara" });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/users/bulk-import", async (req, res) => {
  res.json({ message: "Not implemented yet" });
});

adminRouter.get("/users/:id/activity-log", async (req, res) => {
  res.json({ data: [] }); // Mocked
});


// ─── COURSES ──────────────────────────────────────────────

adminRouter.get("/courses", async (req, res, next) => {
  try {
    // Multi-tenant: company_admin hanya melihat course milik perusahaannya
    // super_admin melihat semua
    const where: any = {};
    if (req.user?.role === "company_admin" && req.user?.companyId) {
      where.companyId = req.user.companyId;
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { sessions: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ data: courses });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/courses/:id/force-deactivate", async (req, res, next) => {
  try {
    // Multi-tenant: company_admin hanya bisa deactivate course milik perusahaannya
    const courseWhere: any = { id: req.params.id };
    if (req.user?.role === "company_admin" && req.user?.companyId) {
      courseWhere.companyId = req.user.companyId;
    }

    const existing = await prisma.course.findFirst({ where: courseWhere });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Course tidak ditemukan atau bukan milik perusahaan Anda." });
    }

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { isActive: false }
    });
    res.json({ data: course });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/courses/:id/reactivate", async (req, res, next) => {
  try {
    const courseWhere: any = { id: req.params.id };
    if (req.user?.role === "company_admin" && req.user?.companyId) {
      courseWhere.companyId = req.user.companyId;
    }

    const existing = await prisma.course.findFirst({ where: courseWhere });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Course tidak ditemukan atau bukan milik perusahaan Anda." });
    }

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: { isActive: true }
    });
    res.json({ data: course });
  } catch (error) {
    next(error);
  }
});


// ─── SESSIONS ─────────────────────────────────────────────

adminRouter.get("/sessions/export", exportSessions);

adminRouter.get("/sessions", async (req, res, next) => {
  try {
    const whereClause = buildAdminSessionWhere(req.query as Record<string, unknown>, req.user);
    const page = parsePage(req.query.page as string | undefined);
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: whereClause,
        include: {
          user: { select: { name: true, email: true, team: { select: { name: true } } } },
          course: { select: { title: true } }
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * 100,
        take: 100
      }),
      prisma.session.count({ where: whereClause })
    ]);
    res.json({ data: sessions, meta: { page, total, totalPages: Math.ceil(total / 100) } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/sessions/:id", async (req, res, next) => {
  try {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        course: true,
        user: { select: { name: true } },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });
    if (!session) throw new HttpError(404, "Session tidak ditemukan");
    res.json({ data: session });
  } catch (error) {
    next(error);
  }
});


// ─── ANALYTICS ────────────────────────────────────────────

adminRouter.get("/analytics/usage", async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const companyId = req.user?.role === 'super_admin' ? undefined : req.user?.companyId;
    const [sessions, users] = await Promise.all([
      prisma.session.findMany({ where: { startedAt: { gte: since }, ...(companyId ? { user: { companyId } } : {}) }, select: { startedAt: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since }, ...(companyId ? { companyId } : {}) }, select: { createdAt: true } })
    ]);
    const countByDay = (dates: Date[]) => {
      const counts = new Map<string, number>();
      for (const date of dates) {
        const day = date.toISOString().slice(0, 10);
        counts.set(day, (counts.get(day) || 0) + 1);
      }
      return Array.from(counts, ([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
    };
    res.json({ data: { sessionsPerDay: countByDay(sessions.map(s => s.startedAt)), usersPerDay: countByDay(users.map(u => u.createdAt)) } });
  } catch (error) { next(error); }
});

adminRouter.get("/analytics/ai-costs", async (req, res, next) => {
  return getTokenUsageCost(req, res, next);
});

adminRouter.get("/analytics/top-performers", async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const allKaryawan = await prisma.user.findMany({
      where: { role: 'karyawan', isActive: true, ...(req.user?.role === 'super_admin' ? {} : { companyId: req.user?.companyId }) },
      select: { id: true }
    });
    const rankings = await calculateSAW(allKaryawan.map((u: { id: string }) => u.id), 'alltime');
    res.json({ data: rankings.slice(0, limit) });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/analytics/course-effectiveness", async (req, res, next) => {
  try {
    const isSuperAdmin = req.user?.role === 'super_admin';
    const companyId = req.user?.companyId;
    const companyScope = isSuperAdmin ? {} : { OR: [{ companyId: null }, { companyId }] };
    const courses = await prisma.course.findMany({
      where: companyScope,
      select: {
        id: true,
        title: true,
        sessions: { where: isSuperAdmin ? {} : { user: { companyId } }, select: { status: true, totalScore: true, outcome: true } },
        assignments: { where: isSuperAdmin ? {} : { assignedTo: { companyId } }, select: { status: true } }
      }
    });
    const stats = courses.map(course => {
      const completed = course.sessions.filter(session => session.status === 'completed');
      const scores = completed.flatMap(session => session.totalScore === null ? [] : [session.totalScore]);
      const closed = completed.filter(session => session.outcome === 'closed').length;
      const abandoned = course.sessions.filter(session => session.status === 'abandoned').length;
      return {
        id: course.id,
        title: course.title,
        avgScore: calcAvg(scores),
        outcomeRate: completed.length ? Math.round(closed / completed.length * 100) : 0,
        abandonRate: course.sessions.length ? Math.round(abandoned / course.sessions.length * 100) : 0,
        completionRate: course.assignments.length ? Math.round(course.assignments.filter(a => a.status === 'completed').length / course.assignments.length * 100) : 0,
        totalSessions: course.sessions.length
      };
    });
    const used = stats.filter(course => course.totalSessions > 0);
    res.json({ data: {
      mostEffective: used.length ? [...used].sort((a, b) => b.avgScore - a.avgScore)[0] : null,
      mostAbandoned: used.length ? [...used].sort((a, b) => b.abandonRate - a.abandonRate)[0] : null
    } });
  } catch (error) { next(error); }
});


// ─── SYSTEM ───────────────────────────────────────────────

adminRouter.get("/system/health", async (req, res, next) => {
  try {
    let db = "error";
    let pgvector = "unknown";
    let aiConfigured = Boolean(process.env.OPENAI_API_KEY);
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = "ok";
      const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
      pgvector = extensions.length ? "ok" : "missing";
      aiConfigured ||= (await prisma.aiApiKey.count({ where: { isActive: true } })) > 0;
    } catch {
      pgvector = "unknown";
    }
    res.json({ data: {
      db,
      pgvector,
      ai: aiConfigured ? "configured" : "missing_key",
      avgResponseTime: null,
      errorRate: null,
    } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/system/abandoned-sessions", async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { status: 'active', startedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } }
    });
    res.json({ data: sessions });
  } catch (error) {
    next(error);
  }
});

const handleCleanupSessions = async (req: any, res: any, next: any) => {
  try {
    const [stuckActive, zeroTurn] = await prisma.$transaction([
      prisma.session.updateMany({
        where: { status: 'active', startedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
        data: { status: 'abandoned' }
      }),
      prisma.session.updateMany({
        where: { turnCount: 0 },
        data: { status: 'abandoned', totalScore: null }
      })
    ]);
    res.json({ message: `${stuckActive.count + zeroTurn.count} sesi menggantung/0 turn dibersihkan.` });
  } catch (error) {
    next(error);
  }
};

adminRouter.post("/system/cleanup-sessions", handleCleanupSessions);
adminRouter.delete("/system/cleanup-sessions", handleCleanupSessions);

adminRouter.post("/system/reindex-rag", async (req, res) => {
  res.json({ message: "Reindexing dimulai di background." });
});

adminRouter.get("/system/logs", async (req, res) => {
  res.json({ data: [] });
});


// ─── NOTIFICATIONS ────────────────────────────────────────

const broadcastSchema = z.object({
  title: z.string().min(3),
  message: z.string().min(10),
  targetRole: z.enum(["karyawan", "manager", "company_admin"]).optional()
});

adminRouter.post("/notifications/broadcast", async (req, res, next) => {
  try {
    const payload = broadcastSchema.parse(req.body);
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        ...(payload.targetRole ? { role: payload.targetRole } : {})
      },
      select: { id: true }
    });

    if (users.length > 0) {
      await broadcastNotification(users.map(u => u.id), payload.title, payload.message);
    }
    res.json({ message: `Broadcast dikirim ke ${users.length} user.` });
  } catch (error) {
    next(error);
  }
});

// ─── ASSIGNMENTS ──────────────────────────────────────────

adminRouter.get("/assignments", async (req, res, next) => {
  try {
    const assignments = await prisma.trainingAssignment.findMany({
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        course: { select: { id: true, title: true, description: true, difficulty: true, category: true } },
        assignedBy: { select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = assignments.map(a => ({
      id: a.id,
      note: a.note,
      status: a.status,
      dueAt: a.dueAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      completedAt: a.completedAt?.toISOString() ?? null,
      user: a.assignedTo,
      scenario: a.course,
      assignedBy: a.assignedBy
    }));

    res.json({ assignments: mapped });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/assignments", async (req, res, next) => {
  try {
    const { userId, scenarioId, note, dueAt } = z.object({
      userId: z.string().uuid(),
      scenarioId: z.string().uuid(),
      note: z.string().optional(),
      dueAt: z.string().datetime().optional().nullable()
    }).parse(req.body);

    const assignment = await prisma.trainingAssignment.create({
      data: {
        userId,
        courseId: scenarioId,
        assignedById: req.user!.sub,
        note,
        dueAt: dueAt ? new Date(dueAt) : null
      },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, role: true } },
        course: { select: { id: true, title: true, description: true, difficulty: true, category: true } },
        assignedBy: { select: { id: true, name: true, email: true, role: true } }
      }
    });

    res.status(201).json({
      assignment: {
        id: assignment.id,
        note: assignment.note,
        status: assignment.status,
        dueAt: assignment.dueAt?.toISOString() ?? null,
        createdAt: assignment.createdAt.toISOString(),
        updatedAt: assignment.updatedAt.toISOString(),
        completedAt: assignment.completedAt?.toISOString() ?? null,
        user: assignment.assignedTo,
        scenario: assignment.course,
        assignedBy: assignment.assignedBy
      }
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/system/info', getSystemInfo);
adminRouter.get('/token-usage/export', exportTokenUsage);
adminRouter.get('/token-usage', getTokenUsage);
adminRouter.get('/token-usage/cost', getTokenUsageCost);
adminRouter.get('/ai-keys', requireSuperAdmin, listAiKeys);
adminRouter.post('/ai-keys', requireSuperAdmin, createAiKey);
adminRouter.patch('/ai-keys/:id', requireSuperAdmin, updateAiKey);
adminRouter.delete('/ai-keys/:id', requireSuperAdmin, deleteAiKey);
adminRouter.post('/ai-keys/:id/test', requireSuperAdmin, testAiKey);
adminRouter.get('/audit-logs', getAuditLogs);
adminRouter.post('/badges/seed', async (req, res, next) => {
  try {
    const { seedBadges } = await import("../services/badgeService.js");
    await seedBadges();
    res.json({ message: "Badges seeded successfully" });
  } catch (error) {
    next(error);
  }
});


