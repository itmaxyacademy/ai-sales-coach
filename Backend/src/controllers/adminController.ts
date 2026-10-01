import type { RequestHandler } from "express";
import { Prisma, SessionStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { parsePage } from "../lib/http-query.js";

export function buildAdminSessionWhere(
  query: Record<string, unknown>,
  user: { role?: string; companyId?: string | null } | undefined,
  defaultStatus?: string,
) {
  const { userId, courseId, status, teamId, employee, team, course, from, to, minScore, maxScore, outcome } = query;
  for (const [label, value] of [["employee", employee], ["team", team], ["course", course], ["outcome", outcome]] as const) {
    if (value !== undefined && (typeof value !== "string" || value.length > 120)) throw new HttpError(400, `Filter ${label} tidak valid`);
  }
  for (const [label, value] of [["userId", userId], ["courseId", courseId], ["teamId", teamId]] as const) {
    if (value !== undefined && (typeof value !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(value))) throw new HttpError(400, `Filter ${label} tidak valid`);
  }
  if (status !== undefined && status !== "all" && !["active", "completed", "abandoned"].includes(String(status))) throw new HttpError(400, "Status sesi tidak valid");
  const dateFilter: Record<string, Date> = {};
  for (const [key, value] of [["gte", from], ["lte", to]] as const) {
    if (value === undefined || value === "") continue;
    if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new HttpError(400, `Tanggal ${key === "gte" ? "awal" : "akhir"} tidak valid`);
    const date = new Date(value);
    if (key === "lte" && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    dateFilter[key] = date;
  }
  const scoreFilter: Record<string, number> = {};
  for (const [key, value] of [["gte", minScore], ["lte", maxScore]] as const) {
    if (value === undefined || value === "") continue;
    const score = Number(value);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new HttpError(400, "Rentang skor harus antara 0 dan 100");
    scoreFilter[key] = score;
  }
  if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) throw new HttpError(400, "Tanggal awal harus sebelum tanggal akhir");
  const where: Prisma.SessionWhereInput = {
    ...(userId ? { userId: String(userId) } : {}),
    ...(courseId ? { courseId: String(courseId) } : {}),
    ...(status === "all" ? {} : status ? { status: status as SessionStatus } : defaultStatus ? { status: defaultStatus as SessionStatus } : {}),
    ...(outcome ? { outcome: String(outcome) } : {}),
    ...(Object.keys(dateFilter).length ? { startedAt: dateFilter } : {}),
    ...(Object.keys(scoreFilter).length ? { totalScore: scoreFilter } : {}),
  };
  const userFilter: Prisma.UserWhereInput = {};
  if (user?.role !== "super_admin") userFilter.companyId = user?.companyId ?? "__no_company__";
  if (teamId) userFilter.teamId = String(teamId);
  if (employee) userFilter.OR = [{ name: { contains: String(employee), mode: "insensitive" } }, { email: { contains: String(employee), mode: "insensitive" } }];
  if (team) userFilter.team = { name: { contains: String(team), mode: "insensitive" } };
  if (Object.keys(userFilter).length) where.user = userFilter;
  if (course) where.course = { title: { contains: String(course), mode: "insensitive" } };
  return where;
}

// GET /api/admin/system/info
export const getSystemInfo: RequestHandler = async (req, res, next) => {
  try {
    let dbStatus: "ok" | "error" = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    const memory = process.memoryUsage();

    res.json({
      app: {
        name: "Sales AI Coach API",
        version: "0.1.0",
        nodeVersion: process.version,
        env: env.NODE_ENV,
        uptime: Math.round(process.uptime()),
      },
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      },
      database: {
        status: dbStatus,
        provider: "postgresql",
        pooling: env.DATABASE_URL.includes("pgbouncer=true"),
      },
      ai: {
        provider: "openai",
        defaultModel: "gpt-4o-mini",
        apiKeyConfigured: !!process.env.OPENAI_API_KEY,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

async function buildTokenUsageFilter(query: Record<string, unknown>, user: { role?: string; companyId?: string | null } | undefined) {
  const text = (key: string) => {
    const value = query[key];
    if (value === undefined || value === "") return undefined;
    if (typeof value !== "string" || value.length > 120) throw new HttpError(400, `Filter ${key} tidak valid`);
    return value.trim() || undefined;
  };
  const from = text("from");
  const to = text("to");
  const team = text("team");
  const course = text("course");
  const model = text("model");
  const minScore = text("minScore");
  const maxScore = text("maxScore");
  const dateFilter: Prisma.DateTimeFilter = {};
  for (const [key, value] of [["gte", from], ["lte", to]] as const) {
    if (!value) continue;
    if (Number.isNaN(Date.parse(value))) throw new HttpError(400, "Tanggal tidak valid");
    const date = new Date(value);
    if (key === "lte" && /^\d{4}-\d{2}-\d{2}$/.test(value)) date.setUTCHours(23, 59, 59, 999);
    dateFilter[key] = date;
  }
  if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) throw new HttpError(400, "Tanggal awal harus sebelum tanggal akhir");
  const scoreFilter: Prisma.IntFilter = {};
  for (const [key, value] of [["gte", minScore], ["lte", maxScore]] as const) {
    if (!value) continue;
    const score = Number(value);
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new HttpError(400, "Rentang skor harus antara 0 dan 100");
    scoreFilter[key] = score;
  }
  if (scoreFilter.gte !== undefined && scoreFilter.lte !== undefined && scoreFilter.gte > scoreFilter.lte) throw new HttpError(400, "Skor minimum harus kurang dari skor maksimum");

  const where: Prisma.AiUsageLogWhereInput = {
    ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    ...(model ? { model } : {}),
  };
  if (user?.role !== "super_admin" || team) {
    const userWhere: Prisma.UserWhereInput = {};
    if (user?.role !== "super_admin") userWhere.companyId = user?.companyId ?? "__no_company__";
    if (team) userWhere.team = { name: { contains: team, mode: "insensitive" } };
    const users = await prisma.user.findMany({ where: userWhere, select: { id: true } });
    where.userId = { in: users.map(item => item.id) };
  }
  if (course || Object.keys(scoreFilter).length) {
    const sessions = await prisma.session.findMany({
      where: {
        ...(course ? { course: { title: { contains: course, mode: "insensitive" } } } : {}),
        ...(Object.keys(scoreFilter).length ? { totalScore: scoreFilter } : {}),
      },
      select: { id: true },
    });
    where.sessionId = { in: sessions.map(session => session.id) };
  }
  return where;
}

async function getTokenUsageRows(logs: Array<{
  id: string; sessionId: string | null; userId: string | null; service: string; model: string;
  promptTokens: number; completionTokens: number; totalTokens: number; createdAt: Date;
}>) {
  const userIds = [...new Set(logs.flatMap(log => log.userId ? [log.userId] : []))];
  const sessionIds = [...new Set(logs.flatMap(log => log.sessionId ? [log.sessionId] : []))];
  const [users, sessions] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, team: { select: { name: true } } } }) : [],
    sessionIds.length ? prisma.session.findMany({ where: { id: { in: sessionIds } }, select: { id: true, totalScore: true, course: { select: { title: true } } } }) : [],
  ]);
  const userMap = new Map(users.map(item => [item.id, item]));
  const sessionMap = new Map(sessions.map(item => [item.id, item]));
  return logs.map(log => {
    const owner = log.userId ? userMap.get(log.userId) : undefined;
    const session = log.sessionId ? sessionMap.get(log.sessionId) : undefined;
    return {
      ...log,
      userName: owner?.name ?? "",
      teamName: owner?.team?.name ?? "",
      courseTitle: session?.course.title ?? "",
      score: session?.totalScore ?? null,
    };
  });
}

// GET /api/admin/token-usage
export const getTokenUsage: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as Record<string, unknown>;
    const filter = await buildTokenUsageFilter(query, req.user);
    const page = parsePage(query.page);
    const limit = query.limit === undefined ? 10 : Number(query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, "Limit harus antara 1 dan 100");
    const groupBy = query.groupBy;

    const logs = await prisma.aiUsageLog.findMany({
      where: filter,
      orderBy: { createdAt: "asc" },
    });

    const totalRequests = logs.length;
    let totalTokens = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    const modelMap = new Map<string, { totalTokens: number; requests: number; totalPrompt: number; totalCompletion: number }>();
    const serviceMap = new Map<string, { totalTokens: number; requests: number }>();
    const dayMap = new Map<string, { totalTokens: number; requests: number }>();

    for (const log of logs) {
      totalTokens += log.totalTokens;
      totalPromptTokens += log.promptTokens;
      totalCompletionTokens += log.completionTokens;

      // Group by model
      const mData = modelMap.get(log.model) || { totalTokens: 0, requests: 0, totalPrompt: 0, totalCompletion: 0 };
      mData.totalTokens += log.totalTokens;
      mData.requests += 1;
      mData.totalPrompt += log.promptTokens;
      mData.totalCompletion += log.completionTokens;
      modelMap.set(log.model, mData);

      // Group by service
      const sData = serviceMap.get(log.service) || { totalTokens: 0, requests: 0 };
      sData.totalTokens += log.totalTokens;
      sData.requests += 1;
      serviceMap.set(log.service, sData);

      // Group by day if requested
      if (groupBy === "day") {
        const dateStr = log.createdAt.toISOString().split("T")[0];
        const dData = dayMap.get(dateStr) || { totalTokens: 0, requests: 0 };
        dData.totalTokens += log.totalTokens;
        dData.requests += 1;
        dayMap.set(dateStr, dData);
      }
    }

    const byModel = Array.from(modelMap.entries()).map(([modelName, data]) => ({
      model: modelName,
      totalTokens: data.totalTokens,
      requests: data.requests,
      avgTokensPerRequest: data.requests > 0 ? Math.round(data.totalTokens / data.requests) : 0,
    }));

    const byService = Array.from(serviceMap.entries()).map(([serviceName, data]) => ({
      service: serviceName,
      totalTokens: data.totalTokens,
      requests: data.requests,
    }));

    const byDay = groupBy === "day"
      ? Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([dateStr, data]) => ({
          date: dateStr,
          totalTokens: data.totalTokens,
          requests: data.requests,
        }))
      : [];

    res.json({
      summary: {
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
        totalRequests,
      },
      byModel,
      byDay,
      byService,
      logs: await getTokenUsageRows(logs.slice().reverse().slice((page - 1) * limit, page * limit)),
      meta: { page, limit, total: logs.length, totalPages: Math.ceil(logs.length / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const exportTokenUsage: RequestHandler = async (req, res, next) => {
  try {
    const filter = await buildTokenUsageFilter(req.query as Record<string, unknown>, req.user);
    const logs = await prisma.aiUsageLog.findMany({ where: filter, orderBy: { createdAt: "desc" } });
    const rows = await getTokenUsageRows(logs);
    const csvCell = (value: unknown) => {
      const text = String(value ?? "");
      const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const columns = ["Created At", "User", "Team", "Course", "Score", "Service", "Model", "Prompt Tokens", "Completion Tokens", "Total Tokens"];
    const csv = [columns, ...rows.map(row => [row.createdAt.toISOString(), row.userName, row.teamName, row.courseTitle, row.score, row.service, row.model, row.promptTokens, row.completionTokens, row.totalTokens])]
      .map(row => row.map(csvCell).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=token-usage-export.csv");
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/token-usage/cost
export const getTokenUsageCost: RequestHandler = async (req, res, next) => {
  try {
    const filter = await buildTokenUsageFilter(req.query as Record<string, unknown>, req.user);

    const logs = await prisma.aiUsageLog.findMany({
      where: filter,
      select: {
        model: true,
        promptTokens: true,
        completionTokens: true,
        service: true,
      },
    });

    // Cerebras gpt-oss-120b : $0.35 per 1M token (input), $0.75 (output)
    // Cerebras zai-glm-4.7  : $2.25 per 1M token (input), $2.75 (output)
    // Cerebras llama3.1-8b  : $0.10 per 1M token (input), $0.10 (output) [legacy]
    // Cerebras llama3.3-70b : $0.85 per 1M token (input), $1.20 (output) [legacy]
    let totalEstimatedUSD = 0;
    const modelCostMap = new Map<string, { promptTokens: number; completionTokens: number; cost: number }>();
    const serviceCostMap = new Map<string, { promptTokens: number; completionTokens: number; cost: number }>();

    for (const log of logs) {
      let cost = 0;
      const modelLower = log.model.toLowerCase();
      if (modelLower === "gpt-oss-120b") {
        // Cerebras
        cost = (log.promptTokens * 0.35) / 1000000 + (log.completionTokens * 0.75) / 1000000;
      } else if (modelLower === "gpt-4o") {
        // OpenAI GPT-4o: $2.50 per 1M input, $10.00 per 1M output
        cost = (log.promptTokens * 2.50) / 1000000 + (log.completionTokens * 10.00) / 1000000;
      } else if (modelLower === "gpt-4o-mini") {
        // OpenAI GPT-4o mini: $0.15 per 1M input, $0.60 per 1M output
        cost = (log.promptTokens * 0.15) / 1000000 + (log.completionTokens * 0.60) / 1000000;
      } else if (modelLower === "zai-glm-4.7") {
        cost = (log.promptTokens * 2.25) / 1000000 + (log.completionTokens * 2.75) / 1000000;
      } else {
        // Default/Fallback
        cost = (log.promptTokens * 0.35) / 1000000 + (log.completionTokens * 0.75) / 1000000;
      }

      totalEstimatedUSD += cost;

      const mCost = modelCostMap.get(log.model) || { promptTokens: 0, completionTokens: 0, cost: 0 };
      mCost.promptTokens += log.promptTokens;
      mCost.completionTokens += log.completionTokens;
      mCost.cost += cost;
      modelCostMap.set(log.model, mCost);

      const sCost = serviceCostMap.get(log.service) || { promptTokens: 0, completionTokens: 0, cost: 0 };
      sCost.promptTokens += log.promptTokens;
      sCost.completionTokens += log.completionTokens;
      sCost.cost += cost;
      serviceCostMap.set(log.service, sCost);
    }

    const byModel = Array.from(modelCostMap.entries()).map(([modelName, data]) => ({
      model: modelName,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      estimatedCostUSD: Number(data.cost.toFixed(6)),
    }));

    const byService = Array.from(serviceCostMap.entries()).map(([serviceName, data]) => ({
      service: serviceName,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      estimatedCostUSD: Number(data.cost.toFixed(6)),
    }));

    res.json({
      totalEstimatedUSD: Number(totalEstimatedUSD.toFixed(6)),
      byModel,
      byService,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/sessions/export
export const exportSessions: RequestHandler = async (req, res, next) => {
  try {
    const whereClause = buildAdminSessionWhere(req.query as Record<string, unknown>, req.user, "completed");

    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        user: { select: { name: true, email: true, team: { select: { name: true } } } },
        course: { select: { title: true, category: true, difficulty: true } },
      },
      orderBy: { completedAt: 'desc' },
    });

    const csvCell = (value: unknown) => {
      const text = String(value ?? "");
      const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    let csv = "Session ID,User Name,User Email,Team,Course Title,Category,Difficulty,Total Score,Outcome,Turns,Started At,Completed At\n";
    for (const s of sessions) {
      const userName = s.user?.name ?? '';
      const userEmail = s.user?.email ?? '';
      const teamName = s.user?.team?.name ?? '';
      const courseTitle = s.course?.title ?? '';
      const category = s.course?.category ?? '';
      const difficulty = s.course?.difficulty ?? '';
      const startedAtStr = s.startedAt ? s.startedAt.toISOString() : '';
      const completedAtStr = s.completedAt ? s.completedAt.toISOString() : '';

      csv += [s.id, userName, userEmail, teamName, courseTitle, category, difficulty, s.totalScore, s.outcome, s.turnCount, startedAtStr, completedAtStr].map(csvCell).join(",") + "\n";
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sessions-export.csv');
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// GET /api/admin/audit-logs
export const getAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    const { action, actorId, from, to, page = "1", limit = "50" } = req.query;

    const filter: Prisma.AuditLogWhereInput = {};
    if (action) {
      filter.action = action as string;
    }
    if (actorId) {
      filter.actorId = actorId as string;
    }
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.gte = new Date(from as string);
      if (to) filter.createdAt.lte = new Date(to as string);
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip,
        take: limitNum,
      }),
      prisma.auditLog.count({ where: filter }),
    ]);

    res.json({
      data: logs,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
